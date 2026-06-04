FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
    git \
    jq \
    ripgrep \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9 turbo@2

# Fix "dubious ownership" for bind-mounted repos (host UID != container root).
# Baked into the image so it applies regardless of which repo is mounted.
RUN git config --global --add safe.directory '*'

# Default HuggingFace to offline so charter's G4 test run never hits the
# network. The warmed cache is mounted in by the workflow. Can be overridden
# at runtime with -e HF_HUB_OFFLINE=0 if a fresh download is intentionally needed.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
ENV HF_HOME=/root/.cache/huggingface

WORKDIR /repo

ENTRYPOINT ["bash", "/repo/charter/run.sh"]
