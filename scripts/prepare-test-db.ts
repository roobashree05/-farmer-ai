import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

async function main() {
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
  const prisma = new PrismaClient();
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE row RECORD;
    BEGIN
      FOR row IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(row.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  await prisma.$disconnect();
  execSync('npx tsx database/seed/seed.ts', { stdio: 'inherit', env: process.env });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
