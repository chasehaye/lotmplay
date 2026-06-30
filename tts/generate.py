"""
Chatterbox TTS generation sidecar.
Called by the .NET server per chapter.

Usage:
    python generate.py --text-file "path/to/chapter.txt" --out "path/to/output.wav"

Voice reference: tts/voices/reference.m4b (or .wav/.mp3 etc.)
A 30-second trimmed clip is auto-extracted on first run using torchaudio.
"""

import argparse
import os
import sys
from pathlib import Path

import torch
import torchaudio

VOICES_DIR = Path(__file__).parent / "voices"
REFERENCE_CANDIDATES = [
    "reference.wav", "reference.flac", "reference.mp3",
    "reference.m4a", "reference.ogg", "reference.m4b",
]
TRIMMED_PATH = VOICES_DIR / "reference_trimmed.wav"
TRIM_START_SEC = 30
TRIM_DURATION_SEC = 30


def find_reference() -> Path:
    for name in REFERENCE_CANDIDATES:
        p = VOICES_DIR / name
        if p.exists():
            return p
    raise FileNotFoundError(
        f"No voice reference found in {VOICES_DIR}. "
        f"Drop a file named 'reference.wav' (or .m4b, .mp3) there."
    )


def ensure_trimmed_reference() -> Path:
    if TRIMMED_PATH.exists():
        return TRIMMED_PATH

    src = find_reference()
    print(f"Extracting reference clip from {src}...", file=sys.stderr)

    waveform, sr = torchaudio.load(str(src))

    # Mono
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)

    total_samples = waveform.shape[1]
    start = min(int(TRIM_START_SEC * sr), total_samples)
    end = min(start + int(TRIM_DURATION_SEC * sr), total_samples)
    if end - start < int(5 * sr):  # if less than 5s remain, take from beginning
        start = 0
        end = min(int(TRIM_DURATION_SEC * sr), total_samples)

    trimmed = waveform[:, start:end]

    # Resample to 22050 if needed
    target_sr = 22050
    if sr != target_sr:
        trimmed = torchaudio.functional.resample(trimmed, sr, target_sr)

    torchaudio.save(str(TRIMMED_PATH), trimmed, target_sr)
    print(f"Trimmed reference saved to {TRIMMED_PATH}", file=sys.stderr)
    return TRIMMED_PATH


def generate(text: str, out_path: str) -> None:
    reference = ensure_trimmed_reference()

    from chatterbox.tts import ChatterboxTTS

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading Chatterbox on {device}...", file=sys.stderr)

    model = ChatterboxTTS.from_pretrained(device=device)
    wav = model.generate(text, audio_prompt_path=str(reference))

    torchaudio.save(out_path, wav, model.sr)
    print(f"Saved: {out_path}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text-file", required=True, help="Path to .txt file with chapter text")
    parser.add_argument("--out", required=True, help="Output .wav file path")
    args = parser.parse_args()

    with open(args.text_file, "r", encoding="utf-8") as f:
        text = f.read().strip()

    if not text:
        print("Empty text file, skipping.", file=sys.stderr)
        sys.exit(0)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    generate(text, args.out)


if __name__ == "__main__":
    main()
