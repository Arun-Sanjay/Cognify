"""Speech endpoints — thin wrappers over the ElevenLabs/Whisper speech layer.

All of these degrade gracefully: without keys they report `available: false`
and the frontend falls back to the browser's SpeechRecognition / speechSynthesis.
"""
from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser
from app.services import elevenlabs_agent, speech

router = APIRouter()


class SpeechStatus(BaseModel):
    asr_available: bool
    tts_available: bool
    agent_available: bool


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice_id: str | None = None


class TTSResponse(BaseModel):
    audio_url: str
    voice_id: str


class TranscriptionResponse(BaseModel):
    text: str


class SignedUrlResponse(BaseModel):
    signed_url: str


@router.get("/status", response_model=SpeechStatus, summary="Which speech backends are configured")
def speech_status(current_user: CurrentUser) -> SpeechStatus:
    return SpeechStatus(
        asr_available=speech.is_asr_available(),
        tts_available=speech.is_tts_available(),
        agent_available=elevenlabs_agent.is_configured(),
    )


@router.post("/tts", response_model=TTSResponse, summary="Synthesize speech (served under /audio)")
def text_to_speech(data: TTSRequest, current_user: CurrentUser) -> TTSResponse:
    result = speech.synthesize_and_save(data.text, voice_id=data.voice_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Text-to-speech is unavailable")
    audio_url, voice_id = result
    return TTSResponse(audio_url=audio_url, voice_id=voice_id)


@router.post("/transcribe", response_model=TranscriptionResponse, summary="Transcribe an audio clip")
async def transcribe(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    language: str | None = Form("en"),
) -> TranscriptionResponse:
    audio_bytes = await file.read()
    text = speech.transcribe_audio(
        audio_bytes, filename=file.filename or "audio.webm", language=language
    )
    return TranscriptionResponse(text=text)


@router.get(
    "/agent/signed-url",
    response_model=SignedUrlResponse,
    summary="Mint a short-lived signed URL for the ElevenLabs conversational agent",
)
def agent_signed_url(current_user: CurrentUser) -> SignedUrlResponse:
    url = elevenlabs_agent.get_signed_url()
    if url is None:
        raise HTTPException(status_code=503, detail="Voice agent is not configured")
    return SignedUrlResponse(signed_url=url)
