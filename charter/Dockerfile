FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
    git \
    jq \
    ripgrep \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9 turbo@2

WORKDIR /repo

ENTRYPOINT ["bash", "/repo/charter/run.sh"]
