import { http, createConfig, cookieStorage, createStorage } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

// Get RPC URL from environment
const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;

if (!alchemyUrl) {
  throw new Error('NEXT_PUBLIC_ALCHEMY_RPC_URL is not defined in environment variables');
}

// WalletConnect project ID (get from https://cloud.walletconnect.com)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

export const config = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'QuickGig',
      appLogoUrl: 'https://quickgig.xyz/logo.png',
    }),
    walletConnect({
      projectId,
      metadata: {
        name: 'QuickGig',
        description: 'Conversational Gig Marketplace on Base',
        url: 'https://quickgig.xyz',
        icons: ['https://quickgig.xyz/logo.png'],
      },
    }),
  ],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  transports: {
    [baseSepolia.id]: http(alchemyUrl),
    [base.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
