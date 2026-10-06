FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/

RUN npm install

COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_DEMO_MODE=true
ARG NEXT_PUBLIC_DEMO_EMAIL=admin@aijewel.local
ARG NEXT_PUBLIC_DEMO_PASSWORD=Local-demo-1234

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
ENV NEXT_PUBLIC_DEMO_EMAIL=$NEXT_PUBLIC_DEMO_EMAIL
ENV NEXT_PUBLIC_DEMO_PASSWORD=$NEXT_PUBLIC_DEMO_PASSWORD

RUN npm run build -w @aijewel/types \
  && npm run build -w @aijewel/web

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@aijewel/web"]
