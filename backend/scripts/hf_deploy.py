"""Create + push the Cognify backend to a Hugging Face Docker Space.

Uses the cached `huggingface-cli` login. Sets non-DB config as Space variables
and the API keys as Space secrets. DATABASE_URL is set separately once the
Supabase connection string is available (so the build can start in parallel).
"""
from pathlib import Path

from huggingface_hub import HfApi

REPO = "Arun-Sanjay/cognify"
BACKEND = Path(__file__).resolve().parent.parent  # .../backend


def parse_env(p: Path) -> dict:
    d: dict = {}
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                d[k.strip()] = v.strip()
    return d


env = parse_env(BACKEND / ".env")
api = HfApi()

api.create_repo(REPO, repo_type="space", space_sdk="docker", private=False, exist_ok=True)
print("space ready:", REPO)

variables = {
    "PORT": "7860",
    "ENVIRONMENT": "production",
    "ANTHROPIC_MODEL_DEV": "claude-haiku-4-5-20251001",
    "ANTHROPIC_MODEL_PROD": "claude-opus-4-6",
    "USE_PRODUCTION_MODEL": "False",
    "JWT_ALGORITHM": "HS256",
    "JWT_EXPIRE_MINUTES": "10080",
    "CORS_ALLOWED_ORIGINS": "http://localhost:5173,http://localhost:3000",
}
for k, v in variables.items():
    api.add_space_variable(REPO, k, v)
print("variables set:", list(variables))

secrets = {
    "ANTHROPIC_API_KEY": env.get("ANTHROPIC_API_KEY", ""),
    "JWT_SECRET_KEY": env.get("JWT_SECRET_KEY", ""),
    # Mirror the working local .env: the ElevenLabs key + the live-interview
    # agent id must come from the SAME account that provisioned the agent.
    "ELEVENLABS_API_KEY": env.get("ELEVENLABS_API_KEY", ""),
    "ELEVENLABS_AGENT_ID": env.get("ELEVENLABS_AGENT_ID", ""),
}
for k, v in secrets.items():
    if v:
        api.add_space_secret(REPO, k, v)
print("secrets set:", [k for k, v in secrets.items() if v])

readme = """---
title: Cognify Backend
emoji: 🎓
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

Cognify FastAPI backend — auth, RAG knowledge base, streaming AI chat.
"""
tmp = BACKEND / "_hf_readme.md"
tmp.write_text(readme)
api.upload_file(path_or_fileobj=str(tmp), path_in_repo="README.md", repo_id=REPO, repo_type="space")
tmp.unlink()
print("README uploaded")

api.upload_folder(
    folder_path=str(BACKEND),
    repo_id=REPO,
    repo_type="space",
    allow_patterns=[
        "app/**", "alembic/**", "alembic.ini", "scripts/**",
        "requirements.txt", "requirements-dev.txt", "Dockerfile",
    ],
    ignore_patterns=["**/__pycache__/**", "*.pyc", "**/*.db"],
)
print("code uploaded — HF build started. Space: https://huggingface.co/spaces/" + REPO)
print("Backend URL will be: https://arun-sanjay-cognify.hf.space")
