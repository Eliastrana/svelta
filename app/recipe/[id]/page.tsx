import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import RecipeDetailClient from './RecipeDetailClient';

type PageProps = {
    params: Promise<{ id: string }>;
};

type RecipeDoc = {
    title?: string;
    description?: string;
    coverImage?: string;
};

const SITE_URL = 'https://www.svelta.no';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id: recipeId } = await params;

    const snap = await adminDb.collection('recipes').doc(recipeId).get();

    if (!snap.exists) {
        return {
            metadataBase: new URL(SITE_URL),
            title: 'Oppskrift ikke funnet | Svelta',
            description: 'Oppskriften finnes ikke.',
            robots: { index: false, follow: false },
        };
    }

    const data = snap.data() as RecipeDoc;

    const title = (data.title?.trim() || 'Oppskrift').slice(0, 80);
    const description = (data.description?.trim() || 'Se oppskriften på Svelta.').slice(0, 160);

    const imageUrl = data.coverImage?.trim() || `${SITE_URL}/og-default.jpg`;
    const url = `${SITE_URL}/recipe/${recipeId}`;

    return {
        metadataBase: new URL(SITE_URL),
        title: `${title} | Svelta`,
        description,
        openGraph: {
            title,
            description,
            url,
            siteName: 'Svelta',
            type: 'article',
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt: title,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [imageUrl],
        },
    };
}

export default async function Page({ params }: PageProps) {
    const { id } = await params;
    return <RecipeDetailClient id={id} />;
}