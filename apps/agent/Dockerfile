FROM oven/bun:1

ARG BUILD_TIME=0

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git caddy gnupg iproute2 wireguard-tools \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && chmod a+r /etc/apt/keyrings/docker.asc \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin \
  && rm -rf /var/lib/apt/lists/*

RUN curl -sSL https://railpack.com/install.sh | sh -s -- --bin-dir /usr/local/bin

WORKDIR /app
COPY package.json ./
COPY src ./src

RUN mkdir -p /var/lib/dequel/workspace

CMD ["bun", "src/index.ts"]
