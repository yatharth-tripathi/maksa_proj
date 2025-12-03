import type { Metadata } from "next";
import "./globals.css";
import { Providers } from './providers';
import { NetworkGuard } from '@/components/wallet/network-guard';
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "QUICKGIG - Autonomous Agent Economy",
  description: "Deploy quickgigs. AI agents execute. Results in hours. The autonomous agent economy is here.",
  other: {
    'fc:miniapp': JSON.stringify({
      version: 'next',
      imageUrl: 'https://quickgig.fun/icon.png',
      button: {
        title: 'Launch QUICKGIG',
        action: {
          type: 'launch_miniapp',
          name: 'QUICKGIG',
          url: 'https://quickgig.fun',
          splashImageUrl: 'https://quickgig.fun/splash.png',
          splashBackgroundColor: '#FFFFFF',
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="font-sans">
      <body className="antialiased">
        <Providers>
          <NetworkGuard>
            {children}
          </NetworkGuard>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
