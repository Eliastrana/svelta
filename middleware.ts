import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/; // matches "/something.png", "/fonts.woff2", etc.

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = req.cookies.get('yourAuthToken')?.value;

    // ✅ Always allow Next internals + public/static files
    // (public/ assets like /icons/chef.png, /og-default.jpg, etc.)
    const isAlwaysAllowed =
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/__/') ||
        pathname === '/old_favicon.ico' ||
        pathname === '/robots.txt' ||
        pathname === '/sitemap.xml' ||
        PUBLIC_FILE.test(pathname);

    if (isAlwaysAllowed) return NextResponse.next();

    // ✅ Public routes (important for share previews)
    const isPublicRoute =
        pathname === '/' ||
        pathname === '/login' ||
        pathname === '/logout' ||
        pathname === '/api/auth/session' ||
        pathname.startsWith('/recipe/'); // 👈 allow recipe pages publicly

    if (isPublicRoute) {
        // if already logged in and on /login, go to next or home
        if (pathname === '/login' && token) {
            const next = req.nextUrl.searchParams.get('next') || '/';
            return NextResponse.redirect(new URL(next, req.url));
        }
        return NextResponse.next();
    }

    // ✅ Protect everything else
    if (!token) {
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};
