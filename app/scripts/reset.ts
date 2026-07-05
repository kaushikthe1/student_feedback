import { prisma } from '../src/lib/prisma';
import * as argon2 from 'argon2';

async function main() {
  const adminHash = await argon2.hash('admin123');
  await prisma.user.update({
    where: { active_email: { email: 'admin@edufeed.com', is_active: true } },
    data: { password_hash: adminHash }
  });
  console.log('Admin password reset to admin123');

  const studentHash = await argon2.hash('student123');
  await prisma.user.update({
    where: { active_email: { email: 'john@example.com', is_active: true } },
    data: { password_hash: studentHash }
  });
  console.log('Student password reset to student123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
