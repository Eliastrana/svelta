import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Svelta',
        short_name: 'Svelta',
        description:
            'Svelta er en sosial oppskriftsapp der du kan dele oppskrifter, oppdage nye retter, folge kokker og bygge egne kokeboker.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8f4ea',
        theme_color: '#f8f4ea',
        lang: 'no',
        categories: ['food', 'social', 'lifestyle'],
        icons: [
            {
                src: '/favicon/web-app-manifest-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/favicon/web-app-manifest-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/favicon/apple-touch-icon.png',
                sizes: '180x180',
                type: 'image/png',
            },
        ],
    };
}
