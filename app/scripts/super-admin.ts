import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

let connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres_password@localhost:5432/feedback_db?schema=public';

if (connectionString.startsWith('prisma+postgres://')) {
  try {
    const urlObj = new URL(connectionString);
    const apiKey = urlObj.searchParams.get('api_key');
    if (apiKey) {
      const decoded = JSON.parse(Buffer.from(apiKey, 'base64').toString('utf-8'));
      if (decoded.databaseUrl) {
        connectionString = decoded.databaseUrl.replace('template1', 'postgres');
      }
    }
  } catch (e) {}
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const command = process.argv[2];

  if (command !== 'recover' && command !== 'seed') {
    console.error('Usage: npx tsx scripts/super-admin.ts <seed|recover>');
    process.exit(1);
  }

  const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
  
  if (!SUPERADMIN_EMAIL) {
    console.error('Error: SUPERADMIN_EMAIL environment variable is required');
    process.exit(1);
  }

  // Generate a random temporary password
  const tempPassword = crypto.randomBytes(12).toString('hex');
  const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

  if (command === 'seed') {
    const existing = await prisma.user.findFirst({
      where: { role: 'SUPERADMIN' }
    });

    if (existing) {
      console.log('Super-admin already exists. Use "recover" to reset password.');
      process.exit(0);
    }

    await prisma.user.create({
      data: {
        role: 'SUPERADMIN',
        email: SUPERADMIN_EMAIL,
        password_hash: passwordHash,
        name: 'Super Admin',
        is_hidden: true,
        is_active: true,
        must_change_password: true,
      }
    });

    console.log('Super-admin created successfully.');
    console.log(`Email: ${SUPERADMIN_EMAIL}`);
    console.log(`Temporary Password: ${tempPassword}`);
    console.log('Please login and change your password immediately.');
  } else if (command === 'recover') {
    const superAdmin = await prisma.user.findFirst({
      where: { email: SUPERADMIN_EMAIL, role: 'SUPERADMIN' }
    });

    if (!superAdmin) {
      console.error('Error: Super-admin not found with the configured email.');
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: superAdmin.id },
      data: {
        password_hash: passwordHash,
        must_change_password: true,
        token_version: { increment: 1 }, // Revoke existing sessions
        failed_login_count: 0,
        locked_until: null,
      }
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actor_user_id: superAdmin.id,
        action: 'SUPERADMIN_RECOVERED',
        entity: 'USER',
        entity_id: superAdmin.id,
        metadata: { method: 'CLI' }
      }
    });

    console.log('Super-admin password reset successfully.');
    console.log(`Temporary Password: ${tempPassword}`);
    console.log('Please login and change your password immediately. All existing sessions have been revoked.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
