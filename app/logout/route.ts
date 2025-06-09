// app/logout/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    // Build a redirect to /login
    const res = NextResponse.redirect(new URL('/login', request.url));

    // Overwrite + expire the auth cookie
    res.cookies.set({
        name: 'yourAuthToken',
        value: '',
        maxAge: 0,
        path: '/',
    });

    return res;
}
