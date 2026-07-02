import { prisma } from '../src/lib/prisma';
async function main() {
  const depts = await prisma.department.findMany();
  console.log('Departments:', depts.map(d => d.name).join(', '));
  const batches = await prisma.batch.findMany();
  console.log('Batches:', batches.map(b => b.name).join(', '));
}
main().then(() => prisma.$disconnect());
