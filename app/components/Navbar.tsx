// Navbar.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import UserProfileDisplay from '@/app/components/UserProfileDisplay';
import UserSearchModal from '@/app/components/UserSearchModal';
import RecommendModal from '@/app/components/RecommendModal';

import {
    fetchCollections,
    createCollection,
} from '@/helpers/collectionHelpers';
import { useUserData } from '@/hooks/useUserData';

interface CollectionDoc {
    id: string;
    name: string;
}

type NavKey = 'home' | 'friends' | 'create' | 'collections' | 'profile';

const Navbar: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const [showRecommend, setShowRecommend] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isMobileCollapsed, setIsMobileCollapsed] = useState(false);
    const [pendingTab, setPendingTab] = useState<{
        key: NavKey;
        fromPath: string;
    } | null>(null);
    const [lastTab, setLastTab] = useState<NavKey>('home');

    const uid = user?.uid ?? '';
    const userData = useUserData(uid);
    const queryClient = useQueryClient();
    const incomingFollowRequestCount =
        userData?.incomingFollowRequests?.length ?? 0;

    // ─────────────────────────────────────────────────────────────
    // Auth
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthReady(true);
        });
        return () => unsub();
    }, []);

    // ─────────────────────────────────────────────────────────────
    // RecommendModal: always in sync with ?recommend=1
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const recommend = searchParams.get('recommend') === '1';
        setShowRecommend(recommend);
    }, [searchParams]);

    const setRecommendParam = (open: boolean) => {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        if (open) url.searchParams.set('recommend', '1');
        else url.searchParams.delete('recommend');

        const next = url.pathname + (url.search ? url.search : '');
        router.replace(next, { scroll: false });
    };

    // ─────────────────────────────────────────────────────────────
    // Collections fetch (still ok to keep, if you use it elsewhere)
    // ─────────────────────────────────────────────────────────────
    useQuery<CollectionDoc[], Error>({
        queryKey: ['collections', uid],
        queryFn: () => fetchCollections(uid),
        enabled: false, // 👈 not needed in navbar anymore since collections is a page now
        placeholderData: (prev) => prev ?? [],
    });

    useMutation({
        mutationFn: ({ name }: { name: string }) => createCollection(uid, name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collections', uid] });
        },
    });

    // ─────────────────────────────────────────────────────────────
    // Keep the selected tab responsive to taps, then reconcile it with the URL.
    // ─────────────────────────────────────────────────────────────
    const routeTab: NavKey | null =
        pathname === '/' || pathname === '/feed'
            ? 'home'
            : pathname === '/add-friends'
              ? 'friends'
              : pathname === '/create-recipe' || pathname.startsWith('/recipe/edit/')
                ? 'create'
                : pathname === '/collections' || pathname.startsWith('/collections/')
                  ? 'collections'
                  : uid && pathname === `/user/${uid}`
                    ? 'profile'
                    : null;

    const selectedTab =
        pendingTab?.fromPath === pathname
            ? pendingTab.key
            : routeTab ?? lastTab;

    useEffect(() => {
        setPendingTab(null);
        if (routeTab) setLastTab(routeTab);
        setIsMobileCollapsed(false);
    }, [pathname, routeTab]);

    useEffect(() => {
        if (!pendingTab) return;
        const timeout = window.setTimeout(() => setPendingTab(null), 8000);
        return () => window.clearTimeout(timeout);
    }, [pendingTab]);

    const handleTabClick = (
        event: React.MouseEvent<HTMLAnchorElement>,
        key: NavKey,
        href: string
    ) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

        setIsMobileCollapsed(false);

        if (pathname === href) {
            event.preventDefault();
            setPendingTab(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setPendingTab({ key, fromPath: pathname });
    };

    useEffect(() => {
        let lastY = window.scrollY;

        const onScroll = () => {
            const nextY = window.scrollY;

            if (window.innerWidth >= 768) {
                setIsMobileCollapsed(false);
                lastY = nextY;
                return;
            }

            if (nextY < 32) {
                setIsMobileCollapsed(false);
                lastY = nextY;
                return;
            }

            const delta = nextY - lastY;
            if (delta > 8) setIsMobileCollapsed(true);
            if (delta < -8) setIsMobileCollapsed(false);

            lastY = nextY;
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        onScroll();

        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, []);

    // ─────────────────────────────────────────────────────────────
    // Styling helpers
    // ─────────────────────────────────────────────────────────────
    const iconBase =
        'flex cursor-pointer touch-manipulation items-center justify-center rounded-full transition-transform duration-100 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365d2c] motion-reduce:transition-none';

    const iconWrapBg = (active: boolean) =>
        [
            'h-12 w-12 grid place-items-center rounded-full transition-all duration-150',
            active ? 'brown-button' : 'hover:bg-slate-100',
        ].join(' ');

    const requestBadge =
        incomingFollowRequestCount > 99 ? '99+' : incomingFollowRequestCount;

    const renderNavIcon = (item: {
        key: string;
        active: boolean;
        icon: React.ReactNode;
    }) => {
        if (item.key === 'profile') return item.icon;

        const showRequestBadge =
            item.key === 'friends' && incomingFollowRequestCount > 0;

        return (
            <span className="relative inline-grid place-items-center">
                <span className={iconWrapBg(item.active)}>{item.icon}</span>
                {showRequestBadge ? (
                    <span className="absolute -right-1 -top-1 min-w-[1.15rem] rounded-full bg-[#365d2c] px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-sm">
                        {requestBadge}
                    </span>
                ) : null}
            </span>
        );
    };

    const navItems: Array<{
        key: NavKey;
        label: string;
        href: string;
        active: boolean;
        icon: React.ReactNode;
    }> = [
        {
            key: 'home',
            label: 'Hjem',
            href: '/feed',
            active: selectedTab === 'home',
            icon: <span className="material-symbols-outlined">home</span>,
        },
        {
            key: 'friends',
            label: 'Legg til venner',
            href: '/add-friends',
            active: selectedTab === 'friends',
            icon: <span className="material-symbols-outlined">person_add</span>,
        },
        {
            key: 'create',
            label: 'Lag oppskrift',
            href: '/create-recipe',
            active: selectedTab === 'create',
            icon: (
                <span className="material-symbols-outlined bg-lime-100 p-3 rounded-full">
                    add
                </span>
            ),
        },
        {
            key: 'collections',
            label: 'Samlinger',
            href: '/collections',
            active: selectedTab === 'collections',
            icon: <span className="material-symbols-outlined">menu_book</span>,
        },
        {
            key: 'profile',
            label: 'Profil',
            href: `/user/${uid}`,
            active: selectedTab === 'profile',
            icon: <UserProfileDisplay active={selectedTab === 'profile'} />,
        },
    ];

    const activeNavItem = navItems.find((item) => item.active) ?? navItems[0];

    if (!authReady || !user) return null;

    return (
        <>
            {showRecommend && (
                <RecommendModal
                    onClose={() => {
                        setRecommendParam(false);
                    }}
                />
            )}

            <nav aria-label="Hovednavigasjon" className="fixed bottom-2 inset-x-0 z-50 px-4 md:bottom-6">
                <div className="mx-auto hidden max-w-sm items-center justify-between gap-2 rounded-full border border-slate-200 bg-white/90 px-2.5 py-2 shadow-xl backdrop-blur-lg md:flex">
                    {navItems.map((item) => (
                        <Link
                            key={item.key}
                            href={item.href}
                            onClick={(event) => handleTabClick(event, item.key, item.href)}
                            className={
                                item.key === 'profile'
                                    ? `${iconBase} flex-shrink-0`
                                    : iconBase
                            }
                            aria-label={item.label}
                            aria-current={routeTab === item.key ? 'page' : undefined}
                        >
                            {renderNavIcon(item)}
                        </Link>
                    ))}
                </div>

                <div
                    className={[
                        'mx-auto flex md:hidden items-center overflow-hidden rounded-full border border-slate-200 bg-white/90 shadow-xl backdrop-blur-lg',
                        'transition-[max-width,padding] duration-150 ease-out motion-reduce:transition-none',
                        isMobileCollapsed
                            ? 'max-w-[72px] justify-center px-2 py-2'
                            : 'max-w-sm justify-between gap-2 px-2 py-2',
                    ].join(' ')}
                >
                    {isMobileCollapsed ? (
                        <button
                            type="button"
                            onClick={() => {
                                setIsMobileCollapsed(false);
                            }}
                            className={`${iconBase} flex-shrink-0`}
                            aria-label="Utvid navigasjon"
                            aria-expanded={false}
                        >
                            {renderNavIcon({
                                ...activeNavItem,
                                active: true,
                            })}
                        </button>
                    ) : (
                        navItems.map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                onClick={(event) => handleTabClick(event, item.key, item.href)}
                                className={item.key === 'profile' ? `${iconBase} flex-shrink-0` : iconBase}
                                aria-label={item.label}
                                aria-current={routeTab === item.key ? 'page' : undefined}
                            >
                                {renderNavIcon(item)}
                            </Link>
                        ))
                    )}
                </div>

                {showModal && (
                    <UserSearchModal onClose={() => setShowModal(false)} />
                )}
            </nav>
        </>
    );
};

export default Navbar;
