import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';

async function main() {
  const email = 'superadmin@edufeed.com';
  const password = await hashPassword('superadmin123');

  await prisma.user.upsert({
    where: { active_email: { email, is_active: true } },
    update: {
      password_hash: password,
      role: 'SUPERADMIN',
      is_active: true,
      must_change_password: false
    },
    create: {
      email,
      name: 'System Superadmin',
      password_hash: password,
      role: 'SUPERADMIN',
      is_active: true,
      must_change_password: false
    }
  });
  console.log('Superadmin user seeded: superadmin@edufeed.com / superadmin123');
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
