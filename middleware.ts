import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = req.cookies.get('yourAuthToken')?.value;

    const isAlwaysAllowed =
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/__/') ||
        pathname === '/old_favicon.ico' ||
        pathname === '/robots.txt' ||
        pathname === '/sitemap.xml' ||
        PUBLIC_FILE.test(pathname);

    if (isAlwaysAllowed) return NextResponse.next();

    const isPublicRoute =
        pathname === '/' ||
        pathname === '/login' ||
        pathname === '/logout' ||
        pathname === '/api/auth/session' ||
        pathname.startsWith('/recipe/');

    if (isPublicRoute) {
        if (pathname === '/login' && token) {
            const next = req.nextUrl.searchParams.get('next') || '/';
            return NextResponse.redirect(new URL(next, req.url));
        }
        return NextResponse.next();
    }

    if (!token) {
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set(
            'next',
            req.nextUrl.pathname + req.nextUrl.search
        );
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};
