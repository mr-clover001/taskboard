FROM node:20-bookworm-slim

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npx prisma generate

RUN chmod +x bin/setup bin/docker-entrypoint .git-hooks/* 2>/dev/null || true

EXPOSE 3000

ENTRYPOINT ["bin/docker-entrypoint"]
CMD ["npm", "run", "dev"]
