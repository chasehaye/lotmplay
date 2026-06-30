FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch with CUDA first (large layer, cache it separately)
RUN pip3 install --no-cache-dir \
    torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu124

# Install TTS and dependencies
RUN pip3 install --no-cache-dir \
    fastapi uvicorn \
    TTS==0.22.0 \
    transformers==4.46.3

COPY server.py .

# voices/ is mounted as a volume at runtime - not baked into image
VOLUME ["/app/voices"]

# Model cache - mounted as volume so it persists across deploys
ENV HOME=/root
VOLUME ["/root/.local/share/tts"]

EXPOSE 8765
CMD ["python3", "server.py"]
