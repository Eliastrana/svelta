import { readFileSync } from 'fs';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes } from 'firebase/storage';

/**
 * What storage.rules lets an app upload, checked against the paths the app
 * and the website actually write to.
 *
 *   npx firebase emulators:exec --only storage \
 *     "node scripts/testStorageRules.mjs"
 */

const ANNA = 'anna';
const BJORN = 'bjorn';

const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);

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
        console.log(`       ${error.message.split('\n')[0]}`);
    }
}

const env = await initializeTestEnvironment({
    projectId: 'svelta-storage-test',
    storage: {
        rules: readFileSync('storage.rules', 'utf8'),
        host: '127.0.0.1',
        port: 9199,
    },
});

const anna = env.authenticatedContext(ANNA).storage();
const guest = env.unauthenticatedContext().storage();

const put = (store, path, metadata) =>
    uploadBytes(ref(store, path), bytes, metadata);

console.log('\nwhat the app uploads');

await check('a step photo, with a type', () =>
    assertSucceeds(
        put(anna, `recipe-steps/${ANNA}/1700000000.jpg`, {
            contentType: 'image/jpeg',
        })
    )
);

await check('a step photo, with no metadata at all', () =>
    assertSucceeds(put(anna, `recipe-steps/${ANNA}/1700000001.jpg`))
);

await check('a step photo the browser called octet-stream', () =>
    assertSucceeds(
        put(anna, `recipe-steps/${ANNA}/1700000002.jpg`, {
            contentType: 'application/octet-stream',
        })
    )
);

await check('the website nests the recipe id under the cook', () =>
    assertSucceeds(
        put(anna, `recipe-steps/${ANNA}/recipe1/1700000003.jpg`, {
            contentType: 'image/jpeg',
        })
    )
);

await check('a cover, named after the cook', () =>
    assertSucceeds(
        put(anna, `recipe-covers/${ANNA}-1700000000.jpg`, {
            contentType: 'image/jpeg',
        })
    )
);

await check('a profile picture', () =>
    assertSucceeds(
        put(anna, `profile-pictures/${ANNA}/1700000000.jpg`, {
            contentType: 'image/jpeg',
        })
    )
);

await check('a cookbook cover', () =>
    assertSucceeds(
        put(anna, `collection-covers/${ANNA}/1700000000.jpg`, {
            contentType: 'image/jpeg',
        })
    )
);

console.log('\nwhat it must not allow');

await check("a step photo under someone else's name", () =>
    assertFails(
        put(anna, `recipe-steps/${BJORN}/1700000000.jpg`, {
            contentType: 'image/jpeg',
        })
    )
);

await check("a cover named after someone else", () =>
    assertFails(
        put(anna, `recipe-covers/${BJORN}-1700000000.jpg`, {
            contentType: 'image/jpeg',
        })
    )
);

await check('an upload by nobody', () =>
    assertFails(
        put(guest, `recipe-steps/${ANNA}/1700000009.jpg`, {
            contentType: 'image/jpeg',
        })
    )
);

await env.cleanup();

console.log(`\n${passed} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
