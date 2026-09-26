import { readFileSync } from 'fs';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
    collection,
    collectionGroup,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    updateDoc,
    where,
    arrayUnion,
    increment,
} from 'firebase/firestore';

/**
 * What firestore.rules lets each kind of caller do, checked against the
 * things the app and the website actually ask for.
 *
 *   npx firebase emulators:exec --only firestore \
 *     "node scripts/testFirestoreRules.mjs"
 */

const ANNA = 'anna';
const BJORN = 'bjorn';
const CARL = 'carl';

let passed = 0;
let failed = 0;

async function check(name, run) {
    try {
        await run();
        passed += 1;
        console.log(`  ok   ${name}`);
    } catch (error) {
        failed += 1;
        console.log(`  FAIL ${name}`);
        console.log(`       ${error.message}`);
    }
}

const env = await initializeTestEnvironment({
    projectId: 'svelta-rules-test',
    firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
    },
});

/** The data every case starts from, written past the rules. */
await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'recipes/r1'), {
        userId: ANNA,
        title: 'Annas brød',
        visibility: 'public',
        coAuthorIds: [CARL],
        likeCount: 0,
        commentCount: 0,
        ratingCount: 0,
        ratingSum: 0,
    });

    await setDoc(doc(db, 'recipes/r1/comments/c1'), {
        userId: BJORN,
        text: 'Nam',
    });

    await setDoc(doc(db, 'recipes/r1/likes/' + BJORN), { userId: BJORN });
    await setDoc(doc(db, 'recipes/r1/ratings/' + BJORN), { value: 4 });

    await setDoc(doc(db, 'users/' + ANNA), {
        name: 'Anna',
        following: [],
        followerCount: 0,
        followingCount: 0,
        incomingFollowRequests: [],
        outgoingFollowRequests: [],
        notificationPrefs: { like: true },
        blocked: [],
    });

    await setDoc(doc(db, 'users/' + BJORN), {
        name: 'Bjørn',
        following: [],
        followerCount: 0,
        followingCount: 0,
        incomingFollowRequests: [],
        outgoingFollowRequests: [],
        blocked: [],
    });

    await setDoc(doc(db, 'users/' + ANNA + '/notifications/n1'), {
        recipientId: ANNA,
        title: 'Noen likte',
    });

    await setDoc(doc(db, 'users/' + ANNA + '/collections/k1'), {
        name: 'Baking',
        ownerId: ANNA,
    });

    await setDoc(doc(db, 'collectionsRecipes/k1/recipes/e1'), {
        ownerId: ANNA,
        recipeRef: doc(db, 'recipes/r1'),
    });

    await setDoc(doc(db, 'publicUsers/' + ANNA), { name: 'Anna' });
    await setDoc(doc(db, 'publicPopularRecipes/r1'), {
        title: 'Annas brød',
        searchTerms: ['an', 'ann'],
    });
});

const anna = env.authenticatedContext(ANNA).firestore();
const bjorn = env.authenticatedContext(BJORN).firestore();
const carl = env.authenticatedContext(CARL).firestore();
const guest = env.unauthenticatedContext().firestore();

console.log('\nrecipes');

await check('anyone reads a recipe', () =>
    assertSucceeds(getDoc(doc(guest, 'recipes/r1')))
);

await check('the cook edits their own recipe', () =>
    assertSucceeds(updateDoc(doc(anna, 'recipes/r1'), { title: 'Nytt navn' }))
);

await check('a co-author edits the recipe', () =>
    assertSucceeds(updateDoc(doc(carl, 'recipes/r1'), { title: 'Carls navn' }))
);

await check('a stranger cannot edit the recipe', () =>
    assertFails(updateDoc(doc(bjorn, 'recipes/r1'), { title: 'Kapret' }))
);

await check('a stranger cannot delete the recipe', () =>
    assertFails(deleteDoc(doc(bjorn, 'recipes/r1')))
);

await check('a stranger may keep the like count', () =>
    assertSucceeds(
        updateDoc(doc(bjorn, 'recipes/r1'), { likeCount: increment(1) })
    )
);

await check('a stranger cannot slip a title past the counters', () =>
    assertFails(
        updateDoc(doc(bjorn, 'recipes/r1'), {
            likeCount: increment(1),
            title: 'Kapret',
        })
    )
);

await check('a new recipe must be your own', () =>
    assertFails(
        setDoc(doc(bjorn, 'recipes/r2'), { userId: ANNA, title: 'Forfalskning' })
    )
);

await check('a cook writes their own new recipe', () =>
    assertSucceeds(
        setDoc(doc(bjorn, 'recipes/r3'), { userId: BJORN, title: 'Bjørns' })
    )
);

console.log('\nlikes, ratings and comments');

await check('a like is written under your own id', () =>
    assertSucceeds(
        setDoc(doc(anna, 'recipes/r1/likes/' + ANNA), { userId: ANNA })
    )
);

await check('a like cannot be written for someone else', () =>
    assertFails(
        setDoc(doc(anna, 'recipes/r1/likes/' + BJORN), { userId: BJORN })
    )
);

await check("a like of your own is yours to remove", () =>
    assertSucceeds(deleteDoc(doc(anna, 'recipes/r1/likes/' + ANNA)))
);

await check("someone else's like is not", () =>
    assertFails(deleteDoc(doc(anna, 'recipes/r1/likes/' + BJORN)))
);

await check('a rating of one through five', () =>
    assertSucceeds(
        setDoc(doc(anna, 'recipes/r1/ratings/' + ANNA), { value: 5 })
    )
);

await check('a rating of fifty is refused', () =>
    assertFails(setDoc(doc(anna, 'recipes/r1/ratings/' + ANNA), { value: 50 }))
);

await check('a comment carries the name of the one who wrote it', () =>
    assertSucceeds(
        setDoc(doc(bjorn, 'recipes/r1/comments/c2'), {
            userId: BJORN,
            text: 'Godt!',
        })
    )
);

await check('a comment cannot be signed with another name', () =>
    assertFails(
        setDoc(doc(bjorn, 'recipes/r1/comments/c3'), {
            userId: ANNA,
            text: 'Ikke min',
        })
    )
);

await check('the cook removes a comment from their recipe', () =>
    assertSucceeds(deleteDoc(doc(anna, 'recipes/r1/comments/c1')))
);

await check("a stranger cannot remove someone else's comment", () =>
    assertFails(deleteDoc(doc(carl, 'recipes/r1/comments/c2')))
);

await check('the one who wrote it can remove it', () =>
    assertSucceeds(deleteDoc(doc(bjorn, 'recipes/r1/comments/c2')))
);

console.log('\ncooks');

await check('a signed-in cook reads another profile', () =>
    assertSucceeds(getDoc(doc(bjorn, 'users/' + ANNA)))
);

await check('a stranger to the app reads nothing', () =>
    assertFails(getDoc(doc(guest, 'users/' + ANNA)))
);

await check('a cook edits their own profile', () =>
    assertSucceeds(updateDoc(doc(anna, 'users/' + ANNA), { name: 'Anna B' }))
);

await check("nobody edits someone else's name", () =>
    assertFails(updateDoc(doc(bjorn, 'users/' + ANNA), { name: 'Kapret' }))
);

await check("nobody touches someone else's varsler", () =>
    assertFails(
        updateDoc(doc(bjorn, 'users/' + ANNA), {
            notificationPrefs: { like: false },
        })
    )
);

await check('following writes the follow fields on the other profile', () =>
    assertSucceeds(
        updateDoc(doc(bjorn, 'users/' + ANNA), {
            followerCount: increment(1),
            incomingFollowRequests: arrayUnion(BJORN),
        })
    )
);

await check('varsler are read by the cook they belong to', () =>
    assertSucceeds(getDoc(doc(anna, 'users/' + ANNA + '/notifications/n1')))
);

await check("varsler are not read by anyone else", () =>
    assertFails(getDoc(doc(bjorn, 'users/' + ANNA + '/notifications/n1')))
);

await check('a cookbook is readable, and only the owner writes it', async () => {
    await assertSucceeds(getDoc(doc(bjorn, 'users/' + ANNA + '/collections/k1')));
    await assertFails(
        setDoc(doc(bjorn, 'users/' + ANNA + '/collections/k2'), { name: 'Min' })
    );
});

console.log('\ncookbook entries');

await check('the owner saves a recipe into their cookbook', () =>
    assertSucceeds(
        setDoc(doc(anna, 'collectionsRecipes/k1/recipes/e2'), {
            ownerId: ANNA,
            recipeRef: doc(anna, 'recipes/r1'),
        })
    )
);

await check('nobody saves into a cookbook that is not theirs', () =>
    assertFails(
        setDoc(doc(bjorn, 'collectionsRecipes/k1/recipes/e3'), {
            ownerId: ANNA,
            recipeRef: doc(bjorn, 'recipes/r1'),
        })
    )
);

await check('a cook clears their recipe out of any cookbook', () =>
    assertSucceeds(deleteDoc(doc(anna, 'collectionsRecipes/k1/recipes/e1')))
);

console.log('\nmirrors, tokens and reports');

await check('the public profile is readable by anyone', () =>
    assertSucceeds(getDoc(doc(guest, 'publicUsers/' + ANNA)))
);

await check('a public profile is written only by its owner', () =>
    assertFails(setDoc(doc(bjorn, 'publicUsers/' + ANNA), { name: 'Kapret' }))
);

await check('the feed mirror is read, never written', async () => {
    await assertSucceeds(getDoc(doc(anna, 'publicPopularRecipes/r1')));
    await assertFails(
        setDoc(doc(anna, 'publicPopularRecipes/r1'), { title: 'Juks' })
    );
});

await check('a device registers its own push token', () =>
    assertSucceeds(
        setDoc(doc(anna, 'notificationTokens/token-1'), {
            userId: ANNA,
            platform: 'ios',
        })
    )
);

await check("a device cannot register a token for someone else", () =>
    assertFails(
        setDoc(doc(anna, 'notificationTokens/token-2'), {
            userId: BJORN,
            platform: 'ios',
        })
    )
);

await check('push tokens are not readable', () =>
    assertFails(getDoc(doc(anna, 'notificationTokens/token-1')))
);

await check('a cook reports something', () =>
    assertSucceeds(
        setDoc(doc(anna, 'reports/rep1'), {
            reporterId: ANNA,
            targetType: 'recipe',
            targetId: 'r1',
            reason: 'Støtende',
        })
    )
);

await check('reports cannot be read back or changed', async () => {
    await assertFails(getDoc(doc(anna, 'reports/rep1')));
    await assertFails(updateDoc(doc(anna, 'reports/rep1'), { reason: 'Nei' }));
});

console.log('\nqueries both clients run');

await check('the followers list', () =>
    assertSucceeds(
        getDocs(
            query(collection(bjorn, 'users'), where('following', 'array-contains', ANNA))
        )
    )
);

await check('a profile lists its recipes', () =>
    assertSucceeds(
        getDocs(query(collection(bjorn, 'recipes'), where('userId', '==', ANNA)))
    )
);

await check('the search index', () =>
    assertSucceeds(
        getDocs(
            query(
                collection(bjorn, 'publicPopularRecipes'),
                where('searchTerms', 'array-contains', 'ann')
            )
        )
    )
);

await check('closing an account finds everything it left behind', async () => {
    await assertSucceeds(
        getDocs(query(collectionGroup(bjorn, 'likes'), where('userId', '==', BJORN)))
    );
    await assertSucceeds(
        getDocs(
            query(collectionGroup(bjorn, 'comments'), where('userId', '==', BJORN))
        )
    );
    await assertSucceeds(getDocs(collectionGroup(bjorn, 'ratings')));
    await assertSucceeds(getDocs(collectionGroup(bjorn, 'recipes')));
});

console.log('\nanything else');

await check('an unknown collection is closed', async () => {
    await assertFails(setDoc(doc(anna, 'secrets/s1'), { a: 1 }));
    await assertFails(getDoc(doc(anna, 'secrets/s1')));
});

await env.cleanup();

console.log(`\n${passed} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
