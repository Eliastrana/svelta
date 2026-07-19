import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import WelcomePageClient from '@/app/welcome/WelcomePageClient';

export default async function WelcomePage() {
    const cookieStore = await cookies();
    const hasAuthCookie = Boolean(cookieStore.get('yourAuthToken')?.value);

    if (hasAuthCookie) {
        redirect('/feed');
    }

    return <WelcomePageClient />;
}
