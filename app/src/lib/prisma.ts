import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

let connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres_password@localhost:5432/feedback_db?schema=public'

// Decode prisma+postgres URL if present
if (connectionString.startsWith('prisma+postgres://')) {
  try {
    const urlObj = new URL(connectionString);
    const apiKey = urlObj.searchParams.get('api_key');
    if (apiKey) {
      const decoded = JSON.parse(Buffer.from(apiKey, 'base64').toString('utf-8'));
      if (decoded.databaseUrl) {
        // Use the actual db url as the raw connection string
        connectionString = decoded.databaseUrl.replace('template1', 'postgres');
      }
    }
  } catch (e) {
    console.error('Failed to parse prisma+postgres URL', e);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
