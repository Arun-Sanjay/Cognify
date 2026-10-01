"""Fetch source material for Learn lectures (dev tool — not used by the app).

For each YouTube id: metadata (yt-dlp), an English transcript
(youtube-transcript-api: manual English → auto English → auto-translated to
English), a 480p download, key frames every N seconds, and contact sheets
(4×4 grids with timestamps) so a notes author can scan a whole lecture quickly.

    pip install "yt-dlp[default,curl-cffi]" youtube-transcript-api deno pillow
    python scripts/learn_fetch.py --out /tmp/learn-work <youtube_id> [<youtube_id> ...]

Output per video in <out>/<id>/:
    base.json            meta + transcript (the lecture JSON minus notes/why)
    transcript.txt       "[mm:ss] text" lines, ~20 s per line (for reading)
    frames/f_0001.jpg…   key frames (frames.json maps file → seconds)
    sheets/sheet_01.jpg… contact sheets of the frames
Needs network, ffmpeg on PATH, and a JS runtime (deno) for yt-dlp.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

SHEET_COLS, SHEET_ROWS = 4, 4


def _run(cmd: list[str]) -> str:
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def fetch_meta(yt_dlp: str, video_id: str) -> dict:
    info = json.loads(
        _run([yt_dlp, "--impersonate", "chrome", "--skip-download", "--dump-json",
              f"https://www.youtube.com/watch?v={video_id}"])
    )
    return {
        "id": video_id,
        "youtube_id": video_id,
        "title": info.get("title", ""),
        "channel": info.get("channel") or info.get("uploader", ""),
        "channel_url": info.get("channel_url"),
        "duration_sec": int(info.get("duration") or 0),
        "views": info.get("view_count"),
        "likes": info.get("like_count"),
        "comments": info.get("comment_count"),
        "upload_date": info.get("upload_date"),
    }


def fetch_transcript(video_id: str) -> dict:
    from youtube_transcript_api import YouTubeTranscriptApi

    api = YouTubeTranscriptApi()
    listing = list(api.list(video_id))
    manual_en = [t for t in listing if not t.is_generated and t.language_code.startswith("en")]
    auto_en = [t for t in listing if t.is_generated and t.language_code.startswith("en")]
    if manual_en:
        chosen, source = manual_en[0], "manual-en"
    elif auto_en:
        chosen, source = auto_en[0], "auto-en"
    else:
        base = next((t for t in listing if not t.is_generated), listing[0])
        kind = "auto" if base.is_generated else "manual"
        chosen, source = base.translate("en"), f"{kind}-{base.language_code}→en"
    fetched = chosen.fetch()
    segments = [
        {"start": round(s.start, 2), "dur": round(s.duration, 2), "text": s.text.replace("\n", " ").strip()}
        for s in fetched.snippets
        if s.text.strip()
    ]
    return {"source": source, "language": "en", "segments": segments}


def transcript_txt(segments: list[dict], window: float = 20.0) -> str:
    lines, buf, start = [], [], None
    for seg in segments:
        if start is None:
            start = seg["start"]
        buf.append(seg["text"])
        if seg["start"] + seg["dur"] - start >= window:
            lines.append(f"[{int(start) // 60:02d}:{int(start) % 60:02d}] {' '.join(buf)}")
            buf, start = [], None
    if buf and start is not None:
        lines.append(f"[{int(start) // 60:02d}:{int(start) % 60:02d}] {' '.join(buf)}")
    return "\n".join(lines) + "\n"


# Tried in order: YouTube intermittently 403s one delivery path (e.g. DASH)
# while another (HLS) still works.
FORMAT_FALLBACKS = [
    "bv*[height<=480][ext=mp4]/b[height<=480]",
    "bv*[height<=480][protocol^=m3u8]",
    "bv*[height<=480]",
]


def download_video(yt_dlp: str, video_id: str, dest: Path) -> Path:
    existing = sorted(dest.glob("video.*"))
    if existing:
        return existing[0]
    last_error: Exception | None = None
    for fmt in FORMAT_FALLBACKS:
        try:
            _run([yt_dlp, "--impersonate", "chrome", "-f", fmt, "-o", str(dest / "video.%(ext)s"),
                  f"https://www.youtube.com/watch?v={video_id}"])
            return sorted(dest.glob("video.*"))[0]
        except subprocess.CalledProcessError as e:
            last_error = e
    raise RuntimeError(f"all download formats failed: {last_error}")


def extract_frames(video: Path, dest: Path, duration: int) -> list[dict]:
    frames_dir = dest / "frames"
    shutil.rmtree(frames_dir, ignore_errors=True)
    frames_dir.mkdir(parents=True)
    # ~1 frame / 10 s for short lectures, capped at ~160 frames for long ones.
    interval = max(10, math.ceil(duration / 160)) if duration else 15
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(video), "-vf", f"fps=1/{interval},scale=960:-2",
         "-q:v", "4", str(frames_dir / "f_%04d.jpg")],
        check=True,
    )
    files = sorted(frames_dir.glob("f_*.jpg"))
    return [{"file": f.name, "t": i * interval} for i, f in enumerate(files)]


def contact_sheets(dest: Path, frames: list[dict]) -> int:
    from PIL import Image, ImageDraw

    sheets_dir = dest / "sheets"
    shutil.rmtree(sheets_dir, ignore_errors=True)
    sheets_dir.mkdir(parents=True)
    per = SHEET_COLS * SHEET_ROWS
    tile_w = 480
    for n, i in enumerate(range(0, len(frames), per), start=1):
        batch = frames[i : i + per]
        tiles = []
        for fr in batch:
            img = Image.open(dest / "frames" / fr["file"]).convert("RGB")
            img = img.resize((tile_w, round(img.height * tile_w / img.width)))
            label = f"{fr['file'][2:6]}  {fr['t'] // 60:02d}:{fr['t'] % 60:02d}"
            draw = ImageDraw.Draw(img)
            draw.rectangle((0, 0, 8 + 7 * len(label), 20), fill="black")
            draw.text((5, 4), label, fill="yellow")
            tiles.append(img)
        tile_h = tiles[0].height
        rows = math.ceil(len(tiles) / SHEET_COLS)
        sheet = Image.new("RGB", (tile_w * SHEET_COLS, tile_h * rows), "black")
        for k, tile in enumerate(tiles):
            sheet.paste(tile, ((k % SHEET_COLS) * tile_w, (k // SHEET_COLS) * tile_h))
        sheet.save(sheets_dir / f"sheet_{n:02d}.jpg", quality=80)
    return len(list(sheets_dir.glob("*.jpg")))


def process(yt_dlp: str, video_id: str, out: Path, keep_video: bool, stages: set[str]) -> None:
    dest = out / video_id
    dest.mkdir(parents=True, exist_ok=True)
    base_path = dest / "base.json"
    base = json.loads(base_path.read_text()) if base_path.exists() else {}
    if "meta" in stages or not base:
        base.update(fetch_meta(yt_dlp, video_id))
        base_path.write_text(json.dumps(base, ensure_ascii=False, indent=1))
    if "frames" in stages and not (dest / "frames.json").exists():
        video = download_video(yt_dlp, video_id, dest)
        frames = extract_frames(video, dest, base["duration_sec"])
        (dest / "frames.json").write_text(json.dumps(frames))
        contact_sheets(dest, frames)
        if not keep_video:
            video.unlink(missing_ok=True)
    if "transcript" in stages and not base.get("transcript"):
        # YouTube rate-limits caption requests hard; fail fast and rerun later
        # with `--stages transcript` rather than sleeping here.
        transcript = fetch_transcript(video_id)
        base["transcript"] = transcript
        base_path.write_text(json.dumps(base, ensure_ascii=False, indent=1))
        (dest / "transcript.txt").write_text(transcript_txt(transcript["segments"]))
    frames_n = len(json.loads((dest / "frames.json").read_text())) if (dest / "frames.json").exists() else 0
    segs = len(base.get("transcript", {}).get("segments", []))
    print(f"{video_id}: {base.get('title', '')[:60]!r} {base.get('duration_sec')}s, {segs} transcript segs, {frames_n} frames")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ids", nargs="+")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--yt-dlp", default="yt-dlp")
    parser.add_argument("--keep-video", action="store_true")
    parser.add_argument("--stages", default="meta,frames,transcript",
                        help="comma list of meta,frames,transcript (completed stages are skipped)")
    args = parser.parse_args()
    failures = []
    for video_id in args.ids:
        try:
            process(args.yt_dlp, video_id, args.out, args.keep_video, set(args.stages.split(",")))
        except Exception as e:  # noqa: BLE001
            failures.append(video_id)
            print(f"{video_id}: FAILED — {e}", file=sys.stderr)
    if failures:
        sys.exit(f"failed: {' '.join(failures)}")


if __name__ == "__main__":
    main()
