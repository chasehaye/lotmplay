#!/bin/bash
# Run once on a fresh Ubuntu 22.04/24.04 server as root.
set -e

# --- Docker ---
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# --- NVIDIA Container Toolkit (for GPU access in Docker) ---
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
apt-get update
apt-get install -y nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker

# --- Data directories on /mnt/drive2 ---
mkdir -p /mnt/drive2/postgres
mkdir -p /mnt/drive2/uploads
mkdir -p /mnt/drive2/tts/voices
mkdir -p /mnt/drive2/tts/cache
# Postgres needs to own its data directory
chown 999:999 /mnt/drive2/postgres

# --- App directory ---
mkdir -p /srv/player
cd /srv/player

# Copy docker-compose.yml here (or git clone the repo)
# cp /path/to/docker-compose.yml .

# --- .env file ---
# Copy deploy/.env.example to /srv/player/.env and fill in values
# cp deploy/.env.example .env
# nano .env

echo ""
echo "Setup complete. Next steps:"
echo "  1. Copy docker-compose.yml to /srv/player/"
echo "  2. Copy deploy/.env.example to /srv/player/.env and fill in secrets"
echo "  3. Add SSH public key for GitHub Actions to ~/.ssh/authorized_keys"
echo "  4. Log in to ghcr.io: docker login ghcr.io -u YOUR_GITHUB_USERNAME"
echo "  5. Run: cd /srv/player && docker compose up -d"
echo ""
echo "  To copy voices to the drive (run from your local machine):"
echo "  rsync -avz tts/voices/ YOUR_USER@YOUR_SERVER_IP:/mnt/drive2/tts/voices/"
