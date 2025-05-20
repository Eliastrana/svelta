// app/components/ReactQueryProvider.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

export default function ReactQueryProvider({
                                               children,
                                           }: {
    children: React.ReactNode;
}) {
    // one QueryClient per browser tab
    const [client] = React.useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 1000 * 60 * 5,          // 5 min
                        refetchOnWindowFocus: false,
                    },
                },
            }),
    );

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
