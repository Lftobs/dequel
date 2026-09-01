FROM oven/bun:1

ARG BUILD_TIME=0

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    bash \
    unzip \
    tar \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.5.1.tgz | tar -xz -C /usr/local/bin --strip-components=1 && \
    curl -sSL https://railpack.com/install.sh | sh -s -- --bin-dir /usr/local/bin


WORKDIR /app
COPY package.json bun.lock* drizzle.config.ts* ./
RUN bun install

COPY src ./src

RUN mkdir -p /app/data /app/workspace /caddy/routes

EXPOSE 3001

CMD ["bun", "src/index.ts"]
