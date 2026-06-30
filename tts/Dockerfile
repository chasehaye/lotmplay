FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG TORCH_VERSION=2.11.0
ARG TORCH_CUDA=cu128

# Install PyTorch with CUDA first (large layer, cache it separately)
RUN pip3 install --no-cache-dir \
    torch==${TORCH_VERSION} torchaudio==${TORCH_VERSION} --index-url https://download.pytorch.org/whl/${TORCH_CUDA}

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
