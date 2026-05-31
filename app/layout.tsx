import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/app/components/Navbar';
import AuthSync from '@/app/components/AuthSync';
import Footer from '@/app/components/footer';
import ReactQueryProvider from '@/app/components/ReactQueryProvider';
import { Suspense } from 'react';
import { Fraunces, Newsreader, Sora, Space_Grotesk, Syne, Urbanist } from 'next/font/google';

const urbanist = Urbanist({
    subsets: ['latin'],
    variable: '--font-urbanist',
});

const sora = Sora({
    subsets: ['latin'],
    variable: '--font-sora',
});

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    variable: '--font-space-grotesk',
});

const fraunces = Fraunces({
    subsets: ['latin'],
    variable: '--font-fraunces',
});

const newsreader = Newsreader({
    subsets: ['latin'],
    variable: '--font-newsreader',
});

const syne = Syne({
    subsets: ['latin'],
    variable: '--font-syne',
});


export const metadata: Metadata = {
    title: 'Svelta | Sosial oppskriftsapp',
    description: 'Svelta er en sosial oppskriftsapp der du kan dele oppskrifter, oppdage nye retter, følge kokker og bygge egne kokebøker.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="no">
        <head>
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            />
            <meta
                name="description"
                content="Svelta er en sosial oppskriftsapp der du kan dele oppskrifter, oppdage nye retter, følge kokker og bygge egne kokebøker."
            />
            <meta name="keywords" content="Svelta, oppskrifter, mat, kokebok, matapp, sosial oppskriftsapp" />
            <meta name="author" content="Svelta" />


            <link rel="icon" type="image/png" href="/favicon/favicon-96x96.png" sizes="96x96" />
            <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
            <link rel="shortcut icon" href="/favicon/favicon.ico" />
            <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
            <meta name="apple-mobile-web-app-title" content="Svelta" />
            <link rel="manifest" href="/favicon/site.webmanifest" />

            <meta name="msapplication-TileColor" content="#ffffff" />
            <meta name="msapplication-TileImage" content="/ms-icon-144x144.png" />
            <meta name="theme-color" content="#ffffff" />

            <link
                rel="stylesheet"
                href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=search"
            />

            <link
                href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
                rel="stylesheet"
            />
        </head>
        <body
            className={[
                urbanist.variable,
                sora.variable,
                spaceGrotesk.variable,
                fraunces.variable,
                newsreader.variable,
                syne.variable,
                'flex min-h-screen flex-col',
            ].join(' ')}
        >
        <AuthSync />

        <ReactQueryProvider>
            <Suspense fallback={null}>
                <Navbar />
            </Suspense>
            {children}
        </ReactQueryProvider>
        <Footer />
        </body>
        </html>
    );
}
