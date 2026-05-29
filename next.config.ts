import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'firebasestorage.googleapis.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                port: '',
                pathname: '/**',
            },
        ],
    },
    async rewrites() {
        const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

        if (!firebaseAuthDomain) {
            return [];
        }

        return [
            {
                source: '/__/auth/:path*',
                destination: `https://${firebaseAuthDomain}/__/auth/:path*`,
            },
            {
                source: '/__/firebase/init.json',
                destination: `https://${firebaseAuthDomain}/__/firebase/init.json`,
            },
        ];
    },
};

export default nextConfig;
