import 'server-only';
import { getApps, initializeApp, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp(): App {
    const apps = getApps();
    if (apps.length) return apps[0];

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) {
        throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY env var');
    }

    // Hvis du har lagt inn env med quotes fra vercel/etc kan det komme med \n i private_key
    const parsed = JSON.parse(raw) as {
        project_id: string;
        client_email: string;
        private_key: string;
    };

    const serviceAccount: ServiceAccount = {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    };

    return initializeApp({
        credential: cert(serviceAccount),
    });
}

export const adminDb = getFirestore(getAdminApp());