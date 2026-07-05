import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';

async function main() {
  const email = 'admin@edufeed.com';
  const password = await hashPassword('admin123');

  await prisma.user.upsert({
    where: { active_email: { email, is_active: true } },
    update: {
      password_hash: password,
      role: 'ADMIN',
      is_active: true,
      must_change_password: false
    },
    create: {
      email,
      name: 'System Admin',
      password_hash: password,
      role: 'ADMIN',
      is_active: true,
      must_change_password: false
    }
  });
  console.log('Admin user seeded: admin@edufeed.com / admin123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
