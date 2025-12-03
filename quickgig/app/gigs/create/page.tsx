'use client';

import { useRouter } from 'next/navigation';
import { GigCreationForm } from '@/components/gig/gig-creation-form';
import { Header } from '@/components/layout/header';

export default function CreateGigPage() {
  const router = useRouter();

  const handleSuccess = (gigId: bigint) => {
    // Navigate to the gig detail page
    router.push(`/gigs/${gigId}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase mb-1.5 sm:mb-2">
            CREATE GIG
          </h1>
          <p className="font-mono text-[10px] sm:text-xs md:text-sm opacity-60">
            Set up a milestone-based contract with escrow protection
          </p>
        </div>

        {/* Form */}
        <GigCreationForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
