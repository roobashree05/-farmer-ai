FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/

RUN npm install

COPY . .

RUN npm run build -w @aijewel/shared \
  && npm run build -w @aijewel/types \
  && npx prisma generate \
  && npm run build -w @aijewel/api

RUN chmod +x infrastructure/docker/api-entrypoint.sh

EXPOSE 4000

CMD ["sh", "infrastructure/docker/api-entrypoint.sh"]
