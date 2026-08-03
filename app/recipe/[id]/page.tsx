import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { canViewRecipe } from '@/helpers/recipeVisibility';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { Recipe } from '@/app/types/Recipe';
import RecipeDetailClient from './RecipeDetailClient';

type PageProps = {
    params: Promise<{ id: string }>;
};

const SITE_URL = 'https://www.svelta.no';

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.filter((item): item is string => typeof item === 'string');
}

function normalizeRecipe(
    id: string,
    raw: Record<string, unknown>
): Recipe {
    return {
        id,
        title: asString(raw.title) ?? 'Oppskrift',
        description: asString(raw.description),
        image: asString(raw.image) ?? '',
        bgColor: asString(raw.bgColor),
        fontStyle: asString(raw.fontStyle),
        userId: asString(raw.userId) ?? '',
        visibility:
            raw.visibility === 'private' ? 'private' : 'public',
        ingredients: asStringArray(raw.ingredients),
        ingredientsDetailed: Array.isArray(raw.ingredientsDetailed)
            ? raw.ingredientsDetailed.flatMap((item) => {
                  if (!item || typeof item !== 'object') return [];
                  const entry = item as Record<string, unknown>;

                  return [
                      {
                          name: asString(entry.name) ?? '',
                          amount: asString(entry.amount),
                      },
                  ].filter((ingredient) => ingredient.name.length > 0);
              })
            : undefined,
        cookingSteps: Array.isArray(raw.cookingSteps)
            ? raw.cookingSteps.flatMap((item) => {
                  if (!item || typeof item !== 'object') return [];
                  const step = item as Record<string, unknown>;
                  const title = asString(step.title) ?? '';
                  const description = asString(step.description) ?? '';

                  return [
                      {
                          title,
                          description,
                          imageUrl: asString(step.imageUrl),
                          linkedRecipe:
                              step.linkedRecipe &&
                              typeof step.linkedRecipe === 'object'
                                  ? (() => {
                                        const linked = step.linkedRecipe as Record<
                                            string,
                                            unknown
                                        >;
                                        const linkedId = asString(linked.id);
                                        const linkedTitle = asString(
                                            linked.title
                                        );
                                        if (!linkedId || !linkedTitle) {
                                            return undefined;
                                        }

                                        return {
                                            id: linkedId,
                                            title: linkedTitle,
                                            coverImage: asString(
                                                linked.coverImage
                                            ),
                                        };
                                    })()
                                  : undefined,
                          ingredientMentions: Array.isArray(
                              step.ingredientMentions
                          )
                              ? step.ingredientMentions.flatMap((mention) => {
                                    if (
                                        !mention ||
                                        typeof mention !== 'object'
                                    ) {
                                        return [];
                                    }

                                    const rawMention = mention as Record<
                                        string,
                                        unknown
                                    >;
                                    const ingredientName = asString(
                                        rawMention.ingredientName
                                    );
                                    const matchText = asString(
                                        rawMention.matchText
                                    );
                                    const amount = asString(
                                        rawMention.amount
                                    );

                                    if (
                                        !ingredientName ||
                                        !matchText ||
                                        !amount
                                    ) {
                                        return [];
                                    }

                                    return [
                                        {
                                            ingredientName,
                                            matchText,
                                            amount,
                                        },
                                    ];
                                })
                              : undefined,
                      },
                  ];
              })
            : [],
        portions: asString(raw.portions),
        temperature: asString(raw.temperature),
        cookingTime: asString(raw.cookingTime),
        coverImage: asString(raw.coverImage),
        tags: asStringArray(raw.tags),
        coAuthorIds: asStringArray(raw.coAuthorIds),
        pendingCoAuthorInviteIds: asStringArray(raw.pendingCoAuthorInviteIds),
        coAuthors: Array.isArray(raw.coAuthors)
            ? raw.coAuthors.flatMap((item) => {
                  if (!item || typeof item !== 'object') return [];
                  const coAuthor = item as Record<string, unknown>;
                  const uid = asString(coAuthor.uid);
                  if (!uid) return [];

                  return [
                      {
                          uid,
                          name: asString(coAuthor.name),
                          photoURL: asString(coAuthor.photoURL),
                      },
                  ];
              })
            : undefined,
        ratingSum:
            typeof raw.ratingSum === 'number' ? raw.ratingSum : undefined,
        ratingCount:
            typeof raw.ratingCount === 'number' ? raw.ratingCount : undefined,
        likeCount:
            typeof raw.likeCount === 'number' ? raw.likeCount : undefined,
        commentCount:
            typeof raw.commentCount === 'number' ? raw.commentCount : undefined,
        popularityScore:
            typeof raw.popularityScore === 'number'
                ? raw.popularityScore
                : undefined,
        creator:
            raw.creator && typeof raw.creator === 'object'
                ? {
                      name: asString((raw.creator as Record<string, unknown>).name),
                      photoURL: asString(
                          (raw.creator as Record<string, unknown>).photoURL
                      ),
                  }
                : undefined,
    };
}

async function fetchRecipeSnapshot(recipeId: string): Promise<Recipe | null> {
    const snap = await adminDb.collection('recipes').doc(recipeId).get();
    if (!snap.exists) return null;

    return normalizeRecipe(snap.id, snap.data() as Record<string, unknown>);
}

async function getViewerUidFromCookieToken() {
    const cookieStore = await cookies();
    const token = cookieStore.get('yourAuthToken')?.value;
    if (!token) return '';

    try {
        const decoded = await adminAuth.verifyIdToken(token);
        return decoded.uid ?? '';
    } catch {
        return '';
    }
}

async function getViewerFollowingIds(uid: string): Promise<string[]> {
    if (!uid) return [];

    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) return [];

    const following = (snap.data()?.following ?? []) as unknown;
    return asStringArray(following) ?? [];
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { id: recipeId } = await params;
    const recipe = await fetchRecipeSnapshot(recipeId);

    if (!recipe || recipe.visibility === 'private') {
        return {
            metadataBase: new URL(SITE_URL),
            title: 'Oppskrift ikke funnet | Svelta',
            description: 'Oppskriften finnes ikke.',
            robots: { index: false, follow: false },
        };
    }

    const title = (recipe.title?.trim() || 'Oppskrift').slice(0, 80);
    const description = (
        recipe.description?.trim() || 'Se oppskriften på Svelta.'
    ).slice(0, 160);

    const imageUrl = recipe.coverImage?.trim() || `${SITE_URL}/og-default.jpg`;
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
    const [recipe, viewerUid] = await Promise.all([
        fetchRecipeSnapshot(id),
        getViewerUidFromCookieToken(),
    ]);
    const viewerFollowing = await getViewerFollowingIds(viewerUid);
    const initialRecipe =
        recipe && canViewRecipe(recipe, viewerUid, viewerFollowing)
            ? recipe
            : null;

    return <RecipeDetailClient id={id} initialRecipe={initialRecipe} />;
}
