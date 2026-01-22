// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const token = req.cookies.get('yourAuthToken')?.value;

    // Always allow Next assets + favicon
    const isNextAsset =
        pathname.startsWith('/_next/') ||
        pathname === '/favicon.ico';

    if (isNextAsset) return NextResponse.next();

    // Allow logout page (public)
    if (pathname === '/logout') return NextResponse.next();

    // If on /login and already authenticated -> go home
    if (pathname === '/login') {
        if (token) return NextResponse.redirect(new URL('/', req.url));
        return NextResponse.next();
    }

    // ✅ Protect everything else
    if (!token) {
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = '/login';

        // ✅ preserve original path + query (?recommend=1 etc)
        const next = pathname + search;

        // Optional: avoid redirect loop if next accidentally becomes /login
        if (!next.startsWith('/login')) {
            loginUrl.searchParams.set('next', next);
        }

        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};