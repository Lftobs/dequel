FROM oven/bun:1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    bash \
    unzip \
    tar \
    gnupg \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install Docker CLI + buildx plugin from Docker's official repo
RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y docker-ce-cli docker-buildx-plugin && \
    rm -rf /var/lib/apt/lists/*

# Verify docker + buildx are available
RUN docker --version && docker buildx version

# Install railpack
RUN curl -sSL https://railpack.com/install.sh | sh -s -- --bin-dir /usr/local/bin


RUN curl -sSL https://mise.jdx.dev/install.sh | sh \
    && ln -sf /root/.local/bin/mise /usr/local/bin/mise

WORKDIR /app

COPY apps/api/package.json ./
RUN bun install

COPY apps/api/src ./src
COPY scripts ./scripts

RUN mkdir -p /app/data /app/workspace /caddy/routes

EXPOSE 3001

CMD ["bun", "src/index.ts"]
