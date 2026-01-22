import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = req.cookies.get('yourAuthToken')?.value;

    // Always allow Next assets
    const isNextAsset =
        pathname.startsWith('/_next/') ||
        pathname === '/favicon.ico';

    if (isNextAsset) return NextResponse.next();

    // ✅ If you're on /login and already have token => go home
    if (pathname === '/login') {
        if (token) return NextResponse.redirect(new URL('/', req.url));
        return NextResponse.next();
    }

    // Allow logout page
    if (pathname === '/logout') return NextResponse.next();

    // ✅ Protect everything else
    if (!token) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};