"""
Chatterbox TTS microservice.
Loads the model once on startup, stays warm between requests.

Usage:
    python server.py

Listens on http://localhost:8765
POST /generate  { "text_file": "path/to/chapter.txt", "out_file": "path/to/output.wav" }
GET  /health    -> { "status": "ready" }
"""

import sys
from contextlib import asynccontextmanager
from pathlib import Path

import re

import torch
import torchaudio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

VOICES_DIR = Path(__file__).parent / "voices"
REFERENCE_CANDIDATES = [
    "reference.wav", "reference.flac", "reference.mp3",
    "reference.m4a", "reference.ogg", "reference.m4b",
]
TRIMMED_PATH = VOICES_DIR / "reference_trimmed.wav"
TRIM_START_SEC = 30
TRIM_DURATION_SEC = 30

model = None
reference_path = None


def find_reference() -> Path:
    for name in REFERENCE_CANDIDATES:
        p = VOICES_DIR / name
        if p.exists():
            return p
    raise FileNotFoundError(
        f"No voice reference found in {VOICES_DIR}. "
        f"Drop a file named 'reference.wav' there."
    )


def ensure_trimmed_reference() -> Path:
    if TRIMMED_PATH.exists():
        return TRIMMED_PATH

    src = find_reference()
    print(f"Extracting reference clip from {src}...", flush=True)

    waveform, sr = torchaudio.load(str(src))

    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)

    total_samples = waveform.shape[1]
    start = min(int(TRIM_START_SEC * sr), total_samples)
    end = min(start + int(TRIM_DURATION_SEC * sr), total_samples)
    if end - start < int(5 * sr):
        start = 0
        end = min(int(TRIM_DURATION_SEC * sr), total_samples)

    trimmed = waveform[:, start:end]

    target_sr = 22050
    if sr != target_sr:
        trimmed = torchaudio.functional.resample(trimmed, sr, target_sr)

    torchaudio.save(str(TRIMMED_PATH), trimmed, target_sr)
    print(f"Trimmed reference saved to {TRIMMED_PATH}", flush=True)
    return TRIMMED_PATH


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, reference_path

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading XTTS v2 on {device}...", flush=True)

    from TTS.api import TTS
    model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

    reference_path = ensure_trimmed_reference()

    print(f"TTS server ready on {device}. Reference: {reference_path}", flush=True)
    yield
    print("TTS server shutting down.", flush=True)


def split_text(text: str, max_chars: int = 250) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks, current = [], ""
    for s in sentences:
        # If a single sentence exceeds the limit, split it hard
        if len(s) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            for i in range(0, len(s), max_chars):
                chunks.append(s[i:i + max_chars])
            continue
        if len(current) + len(s) + 1 <= max_chars:
            current = (current + " " + s).strip()
        else:
            if current:
                chunks.append(current)
            current = s
    if current:
        chunks.append(current)
    return chunks


app = FastAPI(lifespan=lifespan)


class GenerateRequest(BaseModel):
    text_file: str
    out_file: str


@app.get("/health")
def health():
    return {"status": "ready", "model": "xtts_v2", "device": "cuda" if torch.cuda.is_available() else "cpu"}


@app.post("/generate")
def generate(req: GenerateRequest):
    global model, reference_path

    text_path = Path(req.text_file)
    if not text_path.exists():
        raise HTTPException(status_code=400, detail=f"Text file not found: {req.text_file}")

    text = text_path.read_text(encoding="utf-8").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text file is empty")

    out_path = Path(req.out_file)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Generating: {text_path.name} -> {out_path.name}", flush=True)

    chunks = split_text(text)
    print(f"  {len(chunks)} chunk(s)", flush=True)

    wavs = []
    for i, chunk in enumerate(chunks):
        print(f"  chunk {i+1}/{len(chunks)}: {chunk[:60]}...", flush=True)
        tmp = out_path.with_suffix(f".chunk{i}.wav")
        model.tts_to_file(
            text=chunk,
            speaker_wav=str(reference_path),
            language="en",
            file_path=str(tmp),
        )
        w, sr = torchaudio.load(str(tmp))
        wavs.append(w)
        tmp.unlink(missing_ok=True)

    combined = torch.cat(wavs, dim=-1)
    torchaudio.save(str(out_path), combined, 24000)

    print(f"Done: {out_path.name}", flush=True)
    return {"status": "done", "out_file": str(out_path)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)
