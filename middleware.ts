// middleware.ts (at project root)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = req.cookies.get('yourAuthToken')?.value;

    // Always allow static assets, login & logout pages
    const isPublicAsset = pathname.startsWith('/_next/')
        || pathname === '/favicon.ico'
        || pathname === '/login'
        || pathname === '/logout';
    if (isPublicAsset) {
        return NextResponse.next();
    }

    // If no token: force into /login
    if (!token) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    // If token exists but somehow hit /login: send to /
    if (token && pathname === '/login') {
        return NextResponse.redirect(new URL('/', req.url));
    }

    // Otherwise let them through
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};
