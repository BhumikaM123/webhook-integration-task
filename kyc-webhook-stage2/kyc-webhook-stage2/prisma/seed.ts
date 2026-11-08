import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({ where: { id: '11111111-1111-4111-8111-111111111111' }, update: {}, create: { id: '11111111-1111-4111-8111-111111111111', name: 'Demo Tenant' } });
  await prisma.investor.upsert({ where: { id: '22222222-2222-4222-8222-222222222222' }, update: {}, create: { id: '22222222-2222-4222-8222-222222222222', tenant_id: tenant.id, email: 'investor@example.com' } });
  console.log('Seeded demo tenant and investor.');
}
main().finally(async () => prisma.$disconnect());
