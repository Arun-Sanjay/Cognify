# Video research brief — Cognify "Learn" (GATE CS → Operating System)

Goal: for each assigned topic pick the single BEST YouTube lecture in **Hinglish/Hindi** and the single BEST lecture in **English**, judged like a top GATE student would: popularity, audience approval, comment sentiment, and — most importantly — how well it covers the topic's GATE syllabus scope below.

## Tools (all network commands need `dangerouslyDisableSandbox: true`)
- yt-dlp: `Y="<scratchpad>/ytenv/bin/yt-dlp"`, always run with `PATH=<scratchpad>/ytenv/bin:$PATH` and flags `--impersonate chrome`.
  - search with metadata: `$Y --impersonate chrome --skip-download --print "%(id)s|%(channel)s|%(title)s|%(view_count)s|%(like_count)s|%(comment_count)s|%(duration)s|%(upload_date)s" "ytsearch15:<query>"`
  - playlist listing: `$Y --impersonate chrome --flat-playlist --print "%(id)s|%(title)s" <playlist url>`
  - top comments (use sparingly, only for finalists, ≤60 comments): `$Y --impersonate chrome --skip-download --write-comments --extractor-args "youtube:max_comments=60,all,0,0;comment_sort=top" -o "<dir>/%(id)s" <url>` → reads `<id>.info.json` → `comments`.
- captions check: `<scratchpad>/ytenv/bin/python -c "from youtube_transcript_api import YouTubeTranscriptApi as A; print([(t.language_code,t.is_generated) for t in A().list('<id>')])"`. A video MUST have captions (manual or auto) — reject if none.
- If you hit HTTP 429, wait 20–30 s (use a `sleep` inside the same command) and retry; don't hammer.

## Selection criteria (in priority order)
1. **Syllabus coverage** of the topic scope (a 12-min fragment covering 1/5 of the topic loses to a 45–90-min complete lecture of similar quality). You MAY pick up to 3 videos for one language if the topic is genuinely split into parts by the best channel and no single complete video of comparable quality exists — prefer fewer.
2. **Audience approval**: views, likes, like/view ratio; recency as tie-break (the OS syllabus hasn't changed much, so older classics are fine).
3. **Comment sentiment**: read the top comments of the 2–3 finalists; note praise/complaints ("best explanation", "wrong answer at 12:30", audio issues).
4. **Teaching quality signals**: clean board/slides, GATE-PYQ focus, reputable channel (Gate Smashers, Knowledge Gate, Neso Academy, NPTEL/IIT, Abdul Bari, Jenny's Lectures, Ravindrababu Ravula, GATE Wallah, Unacademy GATE, Education 4u, Scaler, etc. — but judge on evidence, not reputation).
5. Exclude: shorts, livestream replays with long dead time, 3+ hour "complete OS one-shots" (too broad for one topic), paid-course teasers, and videos with no captions.

"English" = the lecture is delivered in English (Neso Academy, NPTEL, Jenny's, Abdul Bari…). "Hinglish" = Hindi/Hinglish delivery.

## Output — write one JSON file per topic: `<scratchpad>/yt/picks/<TOPIC_ID>.json`
```json
{
  "topic_id": "T6",
  "topic": "Deadlock",
  "hinglish": [ { "video_id": "...", "title": "...", "channel": "...", "duration_sec": 741, "views": 2723123, "likes": 46500, "comments": 873, "upload_date": "20190101",
                  "captions": ["en(manual)", "en(auto)"],
                  "covers": ["necessary conditions", "RAG", "..."],
                  "why": "2–3 sentences: why this beat the others, citing numbers + comment sentiment",
                  "comment_highlights": ["short real quote", "short real quote"] } ],
  "english":  [ { ...same fields... } ],
  "runners_up": [ { "video_id": "...", "title": "...", "channel": "...", "views": 0, "reason_rejected": "..." } ],
  "coverage_gaps": "any syllabus subtopic neither pick covers, or empty"
}
```
Numbers must be real values from yt-dlp. Quotes must be real comments (trim to ≤ 20 words). Do not invent anything.
