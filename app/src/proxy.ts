import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_please_change_in_production'
);

// Define route access
const publicRoutes = ['/api/auth/login', '/api/auth/logout'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Exclude static assets, api routes that might be public, and the root login page
  if (
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    publicRoutes.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session');
  let payload;
  
  if (sessionCookie) {
    try {
      const verified = await jwtVerify(sessionCookie.value, JWT_SECRET);
      payload = verified.payload;
    } catch (err) {
      // Token invalid or expired
      payload = null;
    }
  }

  // If no valid session, redirect to login unless it's an API route
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('callbackUrl', encodeURI(pathname));
    return NextResponse.redirect(loginUrl);
  }

  // RBAC Routing based on token payload role
  const role = payload.role as string;
  
  if (pathname.startsWith('/admin') && role !== 'ADMIN' && role !== 'SUPERADMIN') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/student/dashboard', request.url));
  }

  if (pathname.startsWith('/student') && role !== 'STUDENT') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Student access required' } }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
