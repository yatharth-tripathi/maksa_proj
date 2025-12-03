'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/connect-button';
import { useAccount } from 'wagmi';
import { useUIStore } from '@/lib/store/ui';

export function Header() {
  const pathname = usePathname();
  const mobileMenuOpen = useUIStore((state) => state.mobileMenuOpen);
  const setMobileMenuOpen = useUIStore((state) => state.setMobileMenuOpen);
  const { address } = useAccount();

  const isActive = (path: string) => pathname === path;

  const navLinks = [
    { href: '/chat', label: 'START MISSION' },
    { href: '/bounties', label: 'MISSIONS' },
    { href: '/agents', label: 'AGENTS' },
    { href: '/leaderboard', label: 'LEADERBOARD' },
    { href: '/dashboard', label: 'CONTROL' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b-2 border-black">
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="group flex items-center gap-2 sm:gap-3 transition-all duration-300 md:hover:tracking-wider"
            >
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 border-2 border-black transition-all duration-300 md:group-hover:rotate-45">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-black transition-all duration-300 md:group-hover:scale-75" />
                </div>
                <div className="absolute top-0 right-0 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-black" />
                <div className="absolute bottom-0 left-0 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-black" />
              </div>
              <span className="text-lg sm:text-xl font-bold text-black tracking-tight uppercase">
                QUICKGIG
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group relative font-semibold text-sm tracking-wide text-black uppercase transition-all duration-300 hover:tracking-widest"
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-0.5 bg-black transition-all duration-300 ${
                      isActive(link.href) ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}
                  />
                </Link>
              ))}
            </nav>

            {/* Mobile/Tablet: Hamburger + Wallet */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              {/* Hamburger Menu Button (Mobile/Tablet Only) */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden w-9 h-9 sm:w-10 sm:h-10 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors flex items-center justify-center flex-shrink-0"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              {/* Show wallet in header on mobile only when connected, always show on desktop */}
              <div className={`flex-shrink min-w-0 ${address ? '' : 'hidden md:block'}`}>
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-14 sm:top-16 z-40 bg-white border-t-2 border-black animate-fade-in">
            <nav className="container mx-auto px-4 sm:px-6 py-6 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 sm:py-4 font-bold text-sm sm:text-base tracking-wide uppercase transition-all duration-300 border-2 ${
                    isActive(link.href)
                      ? 'border-black bg-black text-white'
                      : 'border-black bg-white text-black hover:bg-black hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {/* Show Connect Wallet in menu only when not connected */}
              {!address && (
                <div className="pt-4 border-t-2 border-black mt-4">
                  <ConnectButton />
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
  );
}
