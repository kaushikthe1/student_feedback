import argon2 from 'argon2';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import fs from 'fs';
import path from 'path';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. This is required for secure authentication.');
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = JWTPayload & {
  userId: string;
  email: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'STUDENT';
  tokenVersion: number;
  mustChangePassword?: boolean;
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function createSession(payload: Omit<SessionPayload, 'exp' | 'iat'>) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJwtSecret());
    
  const refreshToken = await new SignJWT({ ...payload, isRefresh: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60, // 15 minutes
  });

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as SessionPayload;
  } catch (error) {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    // Check for maintenance mode
    const maintenancePath = path.join(process.cwd(), '.maintenance');
    if (fs.existsSync(maintenancePath)) {
      return null;
    }
  } catch (e) {
    // ignore fs errors if deploying somewhere weird
  }
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return null;
  }

  const payload = await verifyToken(sessionToken);
  if (!payload) {
    return null;
  }

  try {
    // Check global session epoch (post-restore safety)
    const epochPath = path.join(process.cwd(), 'session-epoch.txt');
    if (fs.existsSync(epochPath)) {
      const epochStr = fs.readFileSync(epochPath, 'utf8').trim();
      const epochNum = parseInt(epochStr, 10);
      if (!isNaN(epochNum)) {
        // If the token was issued BEFORE the epoch, it is invalid
        if (payload.iat && (payload.iat * 1000) < epochNum) {
          return null;
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // Authoritative per-request read of token_version as per spec §14
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { token_version: true, is_active: true, must_change_password: true }
  });

  if (!user || !user.is_active || user.token_version !== payload.tokenVersion) {
    return null;
  }

  return {
    ...payload,
    mustChangePassword: user.must_change_password
  };
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
  cookieStore.delete('refresh_token');
}
