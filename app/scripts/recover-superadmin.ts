import { prisma } from '../src/lib/prisma';
import * as argon2 from 'argon2';

async function main() {
  const args = process.argv.slice(2);
  const newPassword = args[0];

  if (!newPassword) {
    console.error('Error: Please provide a new password.');
    console.error('Usage: npx tsx scripts/recover-superadmin.ts <new_password>');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  try {
    const superadmin = await prisma.user.findFirst({
      where: { role: 'SUPERADMIN' }
    });

    if (!superadmin) {
      console.error('Error: No superadmin found in the database.');
      process.exit(1);
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    await prisma.user.update({
      where: { id: superadmin.id },
      data: {
        password_hash: passwordHash,
        token_version: { increment: 1 }, // Revoke all existing sessions
      }
    });

    console.log('✅ Superadmin password successfully recovered and updated!');
    console.log(`Updated user ID: ${superadmin.id}`);
    console.log('All existing sessions for this superadmin have been revoked.');
  } catch (error) {
    console.error('Failed to update superadmin password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
