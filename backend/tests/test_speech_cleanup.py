"""Audio cleanup tests for Phase 6 background task."""
from __future__ import annotations

import os
import time

from app.services import speech as speech_service


def test_purge_keeps_fresh_files(tmp_path, monkeypatch):
    monkeypatch.setattr(speech_service, "AUDIO_DIR", tmp_path)
    fresh = tmp_path / "fresh.mp3"
    fresh.write_bytes(b"fresh")
    report = speech_service.purge_old_audio(retention_days=7)
    assert report["deleted"] == 0
    assert fresh.exists()


def test_purge_removes_stale_files(tmp_path, monkeypatch):
    monkeypatch.setattr(speech_service, "AUDIO_DIR", tmp_path)
    stale = tmp_path / "stale.mp3"
    stale.write_bytes(b"stale-bytes")
    eight_days_ago = time.time() - 8 * 86400
    os.utime(stale, (eight_days_ago, eight_days_ago))
    report = speech_service.purge_old_audio(retention_days=7)
    assert report["deleted"] == 1
    assert report["bytes_freed"] == len(b"stale-bytes")
    assert not stale.exists()


def test_purge_disabled_with_zero_retention(tmp_path, monkeypatch):
    monkeypatch.setattr(speech_service, "AUDIO_DIR", tmp_path)
    file = tmp_path / "anything.mp3"
    file.write_bytes(b"x")
    report = speech_service.purge_old_audio(retention_days=0)
    assert report == {"scanned": 0, "deleted": 0, "bytes_freed": 0}
    assert file.exists()


def test_purge_handles_missing_dir(tmp_path, monkeypatch):
    missing = tmp_path / "does-not-exist"
    monkeypatch.setattr(speech_service, "AUDIO_DIR", missing)
    report = speech_service.purge_old_audio(retention_days=7)
    assert report == {"scanned": 0, "deleted": 0, "bytes_freed": 0}
