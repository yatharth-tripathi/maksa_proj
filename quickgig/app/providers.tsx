'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { baseSepolia } from 'wagmi/chains';
import { http, createConfig, WagmiProvider } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import { Toaster } from 'sonner';
import '@coinbase/onchainkit/styles.css';
import { useState } from 'react';

const wagmiConfig = createConfig({
  chains: [baseSepolia] as const,
  connectors: [
    coinbaseWallet({
      appName: 'QUICKGIG',
      preference: 'smartWalletOnly',
      appLogoUrl: 'https://quickgig.fun/icon.png',
    }),
  ],
  ssr: true,
  multiInjectedProviderDiscovery: false,
  transports: {
    [baseSepolia.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <WagmiProvider config={wagmiConfig as any}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={baseSepolia}
          config={{
            appearance: {
              name: 'QUICKGIG',
              mode: 'light',
              theme: 'base',
            },
          }}
        >
          {children}

          {/* Toast notifications */}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                fontFamily: 'var(--font-sans)',
              },
            }}
          />
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
