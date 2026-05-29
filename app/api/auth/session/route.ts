import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { token } = (await request.json()) as { token?: string };

        if (!token || typeof token !== 'string') {
            return NextResponse.json({ error: 'Token mangler.' }, { status: 400 });
        }

        const response = NextResponse.json({ ok: true });
        const url = new URL(request.url);
        const isHttps = url.protocol === 'https:';

        response.cookies.set({
            name: 'yourAuthToken',
            value: token,
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
            sameSite: isHttps ? 'none' : 'lax',
            secure: isHttps,
            httpOnly: false,
        });

        return response;
    } catch {
        return NextResponse.json({ error: 'Kunne ikke opprette innlogging.' }, { status: 500 });
    }
}
