import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import FeedPageClient from '@/app/feed/FeedPageClient';

export default async function FeedPage() {
    const cookieStore = await cookies();
    const hasAuthCookie = Boolean(cookieStore.get('yourAuthToken')?.value);

    if (!hasAuthCookie) {
        redirect('/welcome');
    }

    return <FeedPageClient />;
}
