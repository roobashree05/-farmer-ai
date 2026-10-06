import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const count = Number(process.argv[2] ?? 1000);
const prisma = new PrismaClient();

async function main() {
  const status = await prisma.leadStatusDefinition.findUnique({ where: { code: 'NEW' } });
  const source = await prisma.leadSource.findUnique({ where: { code: 'CSV_IMPORT' } });
  if (!status || !source) throw new Error('Seed the database before running the performance script.');
  await prisma.lead.deleteMany({ where: { phone: { startsWith: '+9170' } } });
  const started = Date.now();
  const batchSize = 1000;
  for (let offset = 0; offset < count; offset += batchSize) {
    const size = Math.min(batchSize, count - offset);
    await prisma.lead.createMany({
      data: Array.from({ length: size }, (_, index) => {
        const n = offset + index + 1;
        return {
          name: `Perf Lead ${n}`,
          phone: `+9170${String(n).padStart(8, '0')}`,
          shopName: `Perf Shop ${n % 50}`,
          location: 'Hyderabad',
          statusId: status.id,
          leadSourceId: source.id,
          customerCategory: 'RETAILER',
        };
      }),
    });
  }
  const insertMs = Date.now() - started;
  const queryStarted = Date.now();
  const page = await prisma.lead.findMany({
    where: { deletedAt: null, shopName: { contains: 'Perf Shop 1' } },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  const queryMs = Date.now() - queryStarted;
  const total = await prisma.lead.count({ where: { deletedAt: null } });
  console.log(JSON.stringify({ inserted: count, insertMs, pageSize: page.length, queryMs, totalLeads: total }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
