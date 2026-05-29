FROM oven/bun:1 AS build

WORKDIR /app
COPY package.json ./
RUN bun install

COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
RUN bun run build

FROM oven/bun:1
WORKDIR /app
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["bun", "x", "serve", "-s", "dist", "-l", "3000"]
