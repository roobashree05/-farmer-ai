#!/bin/sh
set -e
npx prisma migrate deploy
npx tsx database/seed/seed.ts
node apps/api/dist/main.js
