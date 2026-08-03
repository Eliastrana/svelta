import {
    getApps,
    initializeApp,
    applicationDefault,
    cert,
} from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import OpenAI from 'openai';

function getAdminApp() {
    const apps = getApps();
    if (apps.length) return apps[0];

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (raw) {
        const parsed = JSON.parse(raw);
        return initializeApp({
            credential: cert({
                projectId: parsed.project_id,
                clientEmail: parsed.client_email,
                privateKey: String(parsed.private_key || '').replace(
                    /\\n/g,
                    '\n'
                ),
            }),
        });
    }

    return initializeApp({
        credential: applicationDefault(),
    });
}

function parseArgs(argv) {
    const args = new Set(argv.slice(2));
    return {
        dryRun: args.has('--dry-run'),
        force: args.has('--force'),
    };
}

function toCleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

async function annotateStepIngredientsWithAI(openai, { ingredients, steps }) {
    if (!ingredients.length || !steps.length) {
        return steps.map(() => []);
    }

    const ingredientNames = ingredients
        .map((ingredient) => toCleanString(ingredient.name))
        .filter(Boolean);

    if (!ingredientNames.length) {
        return steps.map(() => []);
    }

    const prompt = JSON.stringify(
        {
            ingredients: ingredientNames,
            steps: steps.map((step, index) => ({
                stepIndex: index,
                title: toCleanString(step.title),
                description: toCleanString(step.description),
            })),
        },
        null,
        2
    );

    const chat = await openai.chat.completions.create({
        model: 'gpt-4.1-mini-2025-04-14',
        temperature: 0.1,
        messages: [
            {
                role: 'system',
                content: `
Du mapper ingredienser til oppskriftssteg.

SVAR KUN med gyldig JSON.
Format:
[
  [{"ingredientName":"...","matchText":"..."}],
  [],
  [{"ingredientName":"...","matchText":"..."}]
]

KRAV:
- Returner en ytre array med NØYAKTIG samme lengde som antall steg.
- Hvert steg skal være en array av objekter eller en tom array.
- ingredientName må være NØYAKTIG lik et navn fra ingredients-listen.
- matchText må være en NØYAKTIG substring fra step.description.
- Ta kun med ingredienser som faktisk er eksplisitt nevnt i beskrivelsen.
- Ikke gjett løst. Hvis en ingrediens ikke er tydelig nevnt, la den være ute.
- Ta kun med én oppføring per ingrediens per steg.
- Ingen markdown. Ingen forklaringer. Kun JSON.
                `.trim(),
            },
            { role: 'user', content: prompt },
        ],
    });

    const raw = chat.choices[0]?.message?.content?.trim() ?? '';

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        const start = raw.indexOf('[');
        const end = raw.lastIndexOf(']');
        if (start >= 0 && end > start) {
            parsed = JSON.parse(raw.slice(start, end + 1));
        } else {
            throw new Error('Kunne ikke parse AI-svar.');
        }
    }

    const mentionsByStep = Array.isArray(parsed) ? parsed : [];
    const amountByName = new Map(
        ingredients.map((ingredient) => [
            toCleanString(ingredient.name).toLowerCase(),
            toCleanString(ingredient.amount),
        ])
    );

    return steps.map((step, index) => {
        const stepMentions = Array.isArray(mentionsByStep[index])
            ? mentionsByStep[index]
            : [];
        const stepDescription = toCleanString(step.description);
        const seen = new Set();

        return stepMentions.flatMap((mention) => {
            if (!mention || typeof mention !== 'object') return [];

            const ingredientName = toCleanString(mention.ingredientName);
            const matchText = toCleanString(mention.matchText);
            const amount = amountByName.get(ingredientName.toLowerCase()) ?? '';

            if (!ingredientName || !matchText || !amount) return [];
            if (!ingredientNames.includes(ingredientName)) return [];
            if (!stepDescription.includes(matchText)) return [];

            const key = `${ingredientName.toLowerCase()}|${matchText.toLowerCase()}`;
            if (seen.has(key)) return [];
            seen.add(key);

            return [{ ingredientName, matchText, amount }];
        });
    });
}

function needsBackfill(data, force) {
    if (force) return true;

    const ingredientsDetailed = Array.isArray(data.ingredientsDetailed)
        ? data.ingredientsDetailed
        : [];
    const steps = Array.isArray(data.cookingSteps) ? data.cookingSteps : [];

    if (!ingredientsDetailed.length || !steps.length) return false;

    return steps.some(
        (step) =>
            !Array.isArray(step?.ingredientMentions) ||
            step.ingredientMentions.length === 0
    );
}

async function main() {
    const { dryRun, force } = parseArgs(process.argv);
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
        throw new Error('Missing OPENAI_API_KEY env var');
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const db = getFirestore(getAdminApp());
    const recipesSnap = await db
        .collection('recipes')
        .orderBy(FieldPath.documentId())
        .get();

    if (recipesSnap.empty) {
        console.log('No recipes found.');
        return;
    }

    console.log(`Found ${recipesSnap.size} recipes.`);
    console.log(
        dryRun
            ? 'Running in dry-run mode. No writes will be made.'
            : 'Backfilling step ingredient mentions...'
    );
    if (force) {
        console.log('Force mode enabled: all eligible recipes will be re-run.');
    }

    let scanned = 0;
    let processed = 0;
    let updated = 0;

    for (const recipeDoc of recipesSnap.docs) {
        scanned += 1;
        const data = recipeDoc.data();

        if (!needsBackfill(data, force)) continue;

        const ingredientsDetailed = Array.isArray(data.ingredientsDetailed)
            ? data.ingredientsDetailed.map((ingredient) => ({
                  name: toCleanString(ingredient?.name),
                  amount: toCleanString(ingredient?.amount),
              }))
            : [];
        const cookingSteps = Array.isArray(data.cookingSteps)
            ? data.cookingSteps.map((step) => ({
                  title: toCleanString(step?.title),
                  description: toCleanString(step?.description),
                  imageUrl: toCleanString(step?.imageUrl),
                  linkedRecipe:
                      step?.linkedRecipe && typeof step.linkedRecipe === 'object'
                          ? {
                                id: toCleanString(step.linkedRecipe.id),
                                title: toCleanString(step.linkedRecipe.title),
                                coverImage: toCleanString(
                                    step.linkedRecipe.coverImage
                                ),
                            }
                          : undefined,
              }))
            : [];

        if (!ingredientsDetailed.length || !cookingSteps.length) continue;

        processed += 1;
        console.log(
            `[${processed}] ${recipeDoc.id} - ${toCleanString(data.title) || 'Uten tittel'}`
        );

        const mentionsByStep = await annotateStepIngredientsWithAI(openai, {
            ingredients: ingredientsDetailed,
            steps: cookingSteps,
        });

        const nextSteps = cookingSteps.map((step, index) => {
            const nextStep = {
                title: step.title,
                description: step.description,
                imageUrl: step.imageUrl,
                ingredientMentions: mentionsByStep[index] ?? [],
            };

            if (step.linkedRecipe) {
                nextStep.linkedRecipe = step.linkedRecipe;
            }

            return nextStep;
        });

        if (dryRun) {
            console.log(
                JSON.stringify(
                    {
                        recipeId: recipeDoc.id,
                        mentionsByStep,
                    },
                    null,
                    2
                )
            );
            continue;
        }

        await recipeDoc.ref.update({
            cookingSteps: nextSteps,
        });
        updated += 1;
    }

    console.log(
        `Done. Scanned ${scanned} recipes, processed ${processed}, ${dryRun ? 'would update' : 'updated'} ${updated}.`
    );
}

main().catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
});
