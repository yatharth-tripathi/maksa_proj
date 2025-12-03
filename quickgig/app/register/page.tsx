'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseEther } from 'viem';
import ERC8004RegistryABI from '@/lib/contracts/abis/ERC8004Registry.json';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { COMMON_CAPABILITIES } from '@/lib/erc8004/types';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useRegisterAgent } from '@/lib/erc8004/official-hooks';

type AgentType = 0 | 1 | 2; // Human, AI, Hybrid

interface AgentCardData {
  name: string;
  description: string;
  agentType: 'human' | 'ai' | 'hybrid';
  bio?: string;
  avatar?: string;
  contact?: {
    website?: string;
    github?: string;
    twitter?: string;
    email?: string;
  };
  pricing?: {
    hourlyRate?: number;
    perMessage?: number;
    perTask?: number;
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [step, setStep] = useState(1);

  // Form data
  const [agentType, setAgentType] = useState<AgentType>(0);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [customCapability, setCustomCapability] = useState('');
  const [agentCardData, setAgentCardData] = useState<AgentCardData>({
    name: '',
    description: '',
    agentType: 'human',
  });
  const [registerInOfficial, setRegisterInOfficial] = useState(true); // Default to true

  // Contract interaction
  const { writeContractAsync } = useWriteContract();
  const { register: registerOfficialAgent, isReady: isOfficialReady } = useRegisterAgent();

  // Registration state tracking
  const [isRegistering, setIsRegistering] = useState(false);
  const [quickgigTxHash, setQuickgigTxHash] = useState<`0x${string}` | null>(null);
  const [quickgigSuccess, setQuickgigSuccess] = useState(false);
  const [officialSuccess, setOfficialSuccess] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [ipfsUri, setIpfsUri] = useState<string | null>(null);

  const registrationFee = parseEther('0.001'); // 0.001 ETH

  const handleCapabilityToggle = (capability: string) => {
    if (selectedCapabilities.includes(capability)) {
      setSelectedCapabilities(selectedCapabilities.filter((c) => c !== capability));
    } else {
      setSelectedCapabilities([...selectedCapabilities, capability]);
    }
  };

  const handleAddCustomCapability = () => {
    if (customCapability.trim() && !selectedCapabilities.includes(customCapability.trim())) {
      setSelectedCapabilities([...selectedCapabilities, customCapability.trim()]);
      setCustomCapability('');
    }
  };

  const handleRegister = async () => {
    if (!isConnected || !address || !publicClient) {
      toast.error('Please connect your wallet');
      return;
    }

    if (selectedCapabilities.length === 0) {
      toast.error('Please select at least one capability');
      return;
    }

    setIsRegistering(true);
    setRegistrationError(null);
    setQuickgigSuccess(false);
    setOfficialSuccess(false);

    try {
      // Step 0: Check if already registered
      toast.info('Checking registration status...');
      try {
        const existingAgentId = await publicClient.readContract({
          address: CONTRACTS.ERC8004_REGISTRY,
          abi: ERC8004RegistryABI.abi,
          functionName: 'getAgentByWallet',
          args: [address],
        });

        // If agentId is not zero bytes, user is already registered
        if (existingAgentId && existingAgentId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          setIsRegistering(false);
          throw new Error('You already have an agent registered with this wallet. Please use a different wallet or update your existing agent from the dashboard.');
        }
      } catch (checkError) {
        // If it's our "already registered" error, rethrow it
        if (checkError instanceof Error && checkError.message.includes('already have an agent')) {
          throw checkError;
        }
        // Otherwise, log and continue (might be contract version issue)
        console.warn('Could not check existing registration:', checkError);
      }

      // Step 1: Upload to IPFS
      toast.info('Uploading metadata to IPFS...');
      const response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: agentCardData,
          name: `agent_${address}_${Date.now()}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload to IPFS');
      }

      const { ipfsUri: uploadedUri } = await response.json();
      setIpfsUri(uploadedUri);

      // Step 2: Register in QUICKGIG registry
      toast.info('Submitting to QUICKGIG registry...');
      try {
        const txHash = await writeContractAsync({
          address: CONTRACTS.ERC8004_REGISTRY,
          abi: ERC8004RegistryABI.abi,
          functionName: 'registerAgent',
          args: [agentType, uploadedUri, selectedCapabilities],
          value: registrationFee,
        });

        setQuickgigTxHash(txHash);
        toast.info('Waiting for QUICKGIG registration confirmation...');

        // Wait for transaction receipt
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        setQuickgigSuccess(true);
        toast.success('Registered in QUICKGIG registry!');

        // Step 2.5: Sync agent to database for discovery
        toast.info('Syncing agent to database...');
        try {
          await fetch('/api/agents/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              address,
              name: agentCardData.name,
              capabilities: selectedCapabilities,
              agentType: agentCardData.agentType,
              bio: agentCardData.bio,
              avatarUrl: agentCardData.avatar,
              pricingPerTask: agentCardData.pricing?.perTask,
              metadataUri: uploadedUri,
            }),
          });
          console.log('[Registration] Agent synced to database for discovery');
        } catch (syncError) {
          // Don't fail the entire registration if sync fails
          console.error('[Registration] Database sync failed (non-critical):', syncError);
        }
      } catch (quickgigError) {
        console.error('QUICKGIG registration failed:', quickgigError);
        const errorMessage = quickgigError instanceof Error ? quickgigError.message : 'Transaction failed';

        // User cancelled
        if (errorMessage.includes('User rejected') || errorMessage.includes('User denied')) {
          throw new Error('Registration cancelled');
        }

        // Already registered
        if (errorMessage.includes('AgentAlreadyExists') || errorMessage.includes('0x5da86bf1')) {
          throw new Error('You already have an agent registered with this wallet. Use a different wallet or update your existing agent.');
        }

        // Insufficient fee
        if (errorMessage.includes('InsufficientFee') || errorMessage.includes('0x85982a30')) {
          throw new Error('Insufficient registration fee. The contract may require more than 0.001 ETH.');
        }

        // Empty capabilities
        if (errorMessage.includes('EmptyCapabilities') || errorMessage.includes('0x0d82532d')) {
          throw new Error('No capabilities selected. Please go back and select at least one capability.');
        }

        // Generic gas estimation error
        if (errorMessage.includes('gas') || errorMessage.includes('useroperation reverted')) {
          throw new Error('Transaction would fail. This usually means you already have an agent registered, have insufficient balance, or there\'s a contract issue. Check your wallet balance and try again.');
        }

        throw new Error(`Registration failed: ${errorMessage}`);
      }

      // Step 3: Register in official ERC-8004 (if selected)
      if (registerInOfficial && isOfficialReady) {
        toast.info('Submitting to official ERC-8004 registry...');
        try {
          await registerOfficialAgent(uploadedUri);
          setOfficialSuccess(true);
          toast.success('Registered in official ERC-8004 registry!');
        } catch (officialError) {
          console.error('Official registration failed:', officialError);
          const errorMessage = officialError instanceof Error ? officialError.message : 'Transaction failed';
          if (errorMessage.includes('User rejected') || errorMessage.includes('User denied')) {
            throw new Error('Official ERC-8004 registration cancelled. You can uncheck the option and proceed with QUICKGIG only.');
          }
          throw new Error(`Official ERC-8004 registration failed: ${errorMessage}`);
        }
      } else {
        // Not registering in official, mark as success
        setOfficialSuccess(true);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setRegistrationError(errorMsg);
      toast.error(errorMsg);
      setIsRegistering(false);
    }
  };

  // Handle successful registration - only show success screen when all selected registrations complete
  const isFullyRegistered = quickgigSuccess && (!registerInOfficial || officialSuccess);

  if (isFullyRegistered && quickgigTxHash) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
          <div className="max-w-2xl mx-auto">
            <div className="border-2 border-black p-6 sm:p-7 md:p-8 bg-black text-white mb-4 sm:mb-5 md:mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 border-2 border-white mx-auto mb-4 sm:mb-5 md:mb-6 flex items-center justify-center">
                <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-white"></div>
              </div>
              <h1 className="font-black text-2xl sm:text-3xl uppercase tracking-tight text-center mb-1.5 sm:mb-2">
                REGISTRATION SUCCESSFUL!
              </h1>
              <p className="font-mono text-[10px] sm:text-xs uppercase tracking-wide text-center opacity-80">
                YOUR AGENT IS NOW IN THE ERC-8004 REGISTRY
              </p>
            </div>

            <div className="border-2 border-black bg-white mb-4 sm:mb-5 md:mb-6">
              <div className="grid grid-cols-1 divide-y-2 divide-black">
                <div className="p-4 sm:p-5 md:p-6">
                  <p className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1.5 sm:mb-2 opacity-60">
                    STATUS
                  </p>
                  <p className="font-black text-base sm:text-lg uppercase">
                    DISCOVERABLE ON-CHAIN
                  </p>
                </div>

                <div className="p-4 sm:p-5 md:p-6">
                  <p className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-2 sm:mb-3 opacity-60">
                    REGISTRATIONS
                  </p>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-black bg-black flex items-center justify-center">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white"></div>
                      </div>
                      <span className="font-mono text-[10px] sm:text-xs">QUICKGIG Registry</span>
                    </div>
                    {registerInOfficial && officialSuccess && (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-black bg-black flex items-center justify-center">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white"></div>
                        </div>
                        <span className="font-mono text-[10px] sm:text-xs">
                          Official ERC-8004 Registry
                        </span>
                        <Badge variant="outline" className="border-black text-[9px] sm:text-[10px]">CROSS-PLATFORM</Badge>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 sm:p-5 md:p-6">
                  <p className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-2 sm:mb-3 opacity-60">
                    CAPABILITIES
                  </p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {selectedCapabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 border-2 border-black bg-black text-white font-mono text-[10px] sm:text-xs uppercase"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 sm:p-5 md:p-6">
                  <p className="font-bold text-[10px] sm:text-xs uppercase tracking-wide mb-1.5 sm:mb-2 opacity-60">
                    NEXT STEP
                  </p>
                  <p className="font-black text-base sm:text-lg uppercase">
                    START BIDDING ON BOUNTIES
                  </p>
                </div>
              </div>
            </div>

            <a
              href={`https://sepolia.basescan.org/tx/${quickgigTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-2 border-black p-3 sm:p-4 font-bold text-[10px] sm:text-xs uppercase tracking-wide md:hover:bg-black md:hover:text-white transition-all duration-300 text-center mb-4 sm:mb-5 md:mb-6"
            >
              VIEW TRANSACTION →
            </a>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button onClick={() => router.push('/agents')} className="flex-1 text-[10px] sm:text-xs">
                BROWSE AGENTS
              </Button>
              <Button onClick={() => router.push('/bounties')} variant="outline" className="flex-1 text-[10px] sm:text-xs">
                FIND BOUNTIES
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 container mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="border-2 border-black p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 md:mb-8 bg-white">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 border-2 border-black bg-black flex items-center justify-center flex-shrink-0">
                <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 bg-white"></div>
              </div>
              <h1 className="font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase tracking-tight text-black leading-none">
                REGISTER AS AGENT
              </h1>
            </div>
            <p className="font-mono text-[10px] sm:text-xs text-black uppercase tracking-wide">
              JOIN THE ERC-8004 REGISTRY AND START EARNING IN THE TRUSTLESS ECONOMY
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex gap-1.5 sm:gap-2 md:gap-3 mb-4 sm:mb-6 md:mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1 sm:gap-1.5 md:gap-2">
                <div className={`w-full h-2 sm:h-2.5 md:h-3 border-2 border-black transition-all duration-300 ${
                  s <= step ? 'bg-black' : 'bg-white'
                }`} />
                <span className="font-bold text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-wide text-black opacity-50">
                  STEP {s}
                </span>
              </div>
            ))}
          </div>

          {/* Step 1: Agent Type */}
          {step === 1 && (
            <div className="border-2 border-black p-4 sm:p-6 md:p-8 bg-white">
              <h2 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-1.5 sm:mb-2 text-black">
                CHOOSE AGENT TYPE
              </h2>
              <p className="font-mono text-[10px] sm:text-xs text-black mb-4 sm:mb-5 md:mb-6 opacity-60">
                Select the type that best describes you or your agent
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
                <button
                  onClick={() => {
                    setAgentType(0);
                    setAgentCardData({ ...agentCardData, agentType: 'human' });
                  }}
                  className={`group p-4 sm:p-5 md:p-6 border-2 border-black transition-all duration-300 ${
                    agentType === 0
                      ? 'bg-black text-white'
                      : 'bg-white text-black md:hover:bg-black md:hover:text-white'
                  }`}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-3.5 md:mb-4 border-2 border-current flex items-center justify-center">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-1.5 sm:mb-2">HUMAN</h3>
                  <p className="font-mono text-[10px] sm:text-xs opacity-60">
                    Human freelancer providing services
                  </p>
                </button>

                <button
                  onClick={() => {
                    setAgentType(1);
                    setAgentCardData({ ...agentCardData, agentType: 'ai' });
                  }}
                  className={`group p-4 sm:p-5 md:p-6 border-2 border-black transition-all duration-300 ${
                    agentType === 1
                      ? 'bg-black text-white'
                      : 'bg-white text-black md:hover:bg-black md:hover:text-white'
                  }`}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-3.5 md:mb-4 border-2 border-current flex items-center justify-center">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-1.5 sm:mb-2">AI AGENT</h3>
                  <p className="font-mono text-[10px] sm:text-xs opacity-60">
                    Autonomous AI agent operating 24/7
                  </p>
                </button>

                <button
                  onClick={() => {
                    setAgentType(2);
                    setAgentCardData({ ...agentCardData, agentType: 'hybrid' });
                  }}
                  className={`group p-4 sm:p-5 md:p-6 border-2 border-black transition-all duration-300 ${
                    agentType === 2
                      ? 'bg-black text-white'
                      : 'bg-white text-black md:hover:bg-black md:hover:text-white'
                  }`}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-3 sm:mb-3.5 md:mb-4 border-2 border-current flex items-center justify-center">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-1.5 sm:mb-2">HYBRID</h3>
                  <p className="font-mono text-[10px] sm:text-xs opacity-60">
                    Human-assisted AI or AI-assisted human
                  </p>
                </button>
              </div>

              <Button onClick={() => setStep(2)} className="w-full">
                NEXT: SELECT CAPABILITIES →
              </Button>
            </div>
          )}

          {/* Step 2: Capabilities */}
          {step === 2 && (
            <div className="border-2 border-black p-4 sm:p-6 md:p-8 bg-white">
              <h2 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-1.5 sm:mb-2 text-black">
                SELECT CAPABILITIES
              </h2>
              <p className="font-mono text-[10px] sm:text-xs text-black mb-4 sm:mb-5 md:mb-6 opacity-60">
                Choose the skills and services you offer (select at least one)
              </p>

              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                {/* Common Capabilities */}
                <div>
                  <h3 className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black mb-2 sm:mb-3 opacity-60">
                    COMMON CAPABILITIES
                  </h3>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {COMMON_CAPABILITIES.map((capability) => (
                      <button
                        key={capability}
                        onClick={() => handleCapabilityToggle(capability)}
                        className={`px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2 border-2 border-black font-mono text-[10px] sm:text-xs uppercase tracking-wide transition-all duration-300 ${
                          selectedCapabilities.includes(capability)
                            ? 'bg-black text-white'
                            : 'bg-white text-black md:hover:bg-black md:hover:text-white'
                        }`}
                      >
                        {capability.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Capability */}
                <div>
                  <h3 className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black mb-2 sm:mb-3 opacity-60">
                    ADD CUSTOM CAPABILITY
                  </h3>
                  <div className="flex gap-1.5 sm:gap-2">
                    <Input
                      value={customCapability}
                      onChange={(e) => setCustomCapability(e.target.value)}
                      placeholder="e.g., blockchain-auditing"
                      className="flex-1 text-[10px] sm:text-xs"
                    />
                    <Button onClick={handleAddCustomCapability} variant="outline" className="text-[10px] sm:text-xs px-2.5 sm:px-3 md:px-4">
                      ADD
                    </Button>
                  </div>
                </div>

                {/* Selected Capabilities */}
                {selectedCapabilities.length > 0 && (
                  <div className="border-2 border-black p-3 sm:p-4 bg-white">
                    <h3 className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black mb-2 sm:mb-3">
                      SELECTED ({selectedCapabilities.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {selectedCapabilities.map((capability) => (
                        <div key={capability} className="inline-flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1 border-2 border-black bg-black text-white font-mono text-[10px] sm:text-xs uppercase">
                          {capability.replace('-', ' ')}
                          <button
                            onClick={() => handleCapabilityToggle(capability)}
                            className="md:hover:opacity-60 font-bold text-xs sm:text-sm"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 sm:gap-3">
                  <Button onClick={() => setStep(1)} variant="outline" className="flex-1 text-[10px] sm:text-xs">
                    ← BACK
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    className="flex-1 text-[10px] sm:text-xs"
                    disabled={selectedCapabilities.length === 0}
                  >
                    NEXT: AGENT DETAILS →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Agent Details */}
          {step === 3 && (
            <div className="border-2 border-black p-4 sm:p-6 md:p-8 bg-white">
              <h2 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-1.5 sm:mb-2 text-black">
                AGENT DETAILS
              </h2>
              <p className="font-mono text-[10px] sm:text-xs text-black mb-4 sm:mb-5 md:mb-6 opacity-60">
                Provide information about your agent (optional but recommended)
              </p>

              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                <div>
                  <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black block mb-1.5 sm:mb-2">
                    AGENT NAME *
                  </label>
                  <Input
                    value={agentCardData.name}
                    onChange={(e) =>
                      setAgentCardData({ ...agentCardData, name: e.target.value })
                    }
                    placeholder="Your Name or Agent Name"
                    className="text-[10px] sm:text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black block mb-1.5 sm:mb-2">
                    SHORT DESCRIPTION *
                  </label>
                  <textarea
                    value={agentCardData.description}
                    onChange={(e) =>
                      setAgentCardData({ ...agentCardData, description: e.target.value })
                    }
                    placeholder="Brief description of your services..."
                    className="w-full h-20 sm:h-24 border-2 border-black bg-white px-3 py-2 sm:px-4 sm:py-3 font-mono text-[10px] sm:text-xs placeholder:text-black placeholder:opacity-30 focus:outline-none resize-none transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black block mb-1.5 sm:mb-2">
                    BIO (OPTIONAL)
                  </label>
                  <textarea
                    value={agentCardData.bio || ''}
                    onChange={(e) =>
                      setAgentCardData({ ...agentCardData, bio: e.target.value })
                    }
                    placeholder="Tell clients more about yourself..."
                    className="w-full h-24 sm:h-28 md:h-32 border-2 border-black bg-white px-3 py-2 sm:px-4 sm:py-3 font-mono text-[10px] sm:text-xs placeholder:text-black placeholder:opacity-30 focus:outline-none resize-none transition-all duration-200"
                  />
                </div>

                <div className="flex gap-2 sm:gap-3">
                  <Button onClick={() => setStep(2)} variant="outline" className="flex-1 text-[10px] sm:text-xs">
                    ← BACK
                  </Button>
                  <Button
                    onClick={() => setStep(4)}
                    className="flex-1 text-[10px] sm:text-xs"
                    disabled={!agentCardData.name || !agentCardData.description}
                  >
                    NEXT: REVIEW & SUBMIT →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {step === 4 && (
            <div className="border-2 border-black p-4 sm:p-6 md:p-8 bg-white">
              <h2 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-1.5 sm:mb-2 text-black">
                REVIEW & SUBMIT
              </h2>
              <p className="font-mono text-[10px] sm:text-xs text-black mb-4 sm:mb-5 md:mb-6 opacity-60">
                Review your information and pay registration fee
              </p>

              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                {/* Summary */}
                <div className="border-2 border-black p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4 bg-white">
                  <div>
                    <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black block mb-1 opacity-60">
                      AGENT TYPE
                    </span>
                    <span className="font-bold text-base sm:text-lg uppercase tracking-tight">
                      {['HUMAN', 'AI', 'HYBRID'][agentType]}
                    </span>
                  </div>

                  <div>
                    <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black block mb-1 opacity-60">
                      NAME
                    </span>
                    <span className="font-mono text-xs sm:text-sm">{agentCardData.name}</span>
                  </div>

                  <div>
                    <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black block mb-1 opacity-60">
                      DESCRIPTION
                    </span>
                    <span className="font-mono text-[10px] sm:text-xs">{agentCardData.description}</span>
                  </div>

                  <div>
                    <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wide text-black block mb-1.5 sm:mb-2 opacity-60">
                      CAPABILITIES ({selectedCapabilities.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {selectedCapabilities.map((cap) => (
                        <div key={cap} className="px-2 py-1 sm:px-3 sm:py-1 border-2 border-black bg-black text-white font-mono text-[10px] sm:text-xs uppercase">
                          {cap.replace('-', ' ')}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Official ERC-8004 Registration Option */}
                <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
                  <label className="flex items-start gap-2 sm:gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={registerInOfficial}
                      onChange={(e) => setRegisterInOfficial(e.target.checked)}
                      disabled={quickgigSuccess && !officialSuccess}
                      className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black accent-black mt-0.5 flex-shrink-0 disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                        REGISTER IN OFFICIAL ERC-8004 REGISTRY
                        <Badge variant="outline" className="border-black text-[9px] sm:text-[10px]">RECOMMENDED</Badge>
                      </div>
                      <p className="font-mono text-[10px] sm:text-xs opacity-60">
                        Register your agent identity in the official ERC-8004 singleton registry for cross-platform reputation.
                        Your reputation will be portable across all ERC-8004 compliant platforms, not just QUICKGIG.
                        {registrationError && registerInOfficial && ' You can uncheck this and try again with QUICKGIG only.'}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Registration Fee */}
                <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-black text-white">
                  <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                    <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wide">
                      REGISTRATION FEE
                    </span>
                    <span className="font-black text-2xl sm:text-3xl">
                      0.001 ETH
                    </span>
                  </div>
                  <p className="font-mono text-[10px] sm:text-xs opacity-60">
                    One-time fee to prevent spam. Your agent will be immediately discoverable.
                    {registerInOfficial && ' Official ERC-8004 registration may require additional gas fees.'}
                  </p>
                </div>

                {/* Registration Status */}
                {isRegistering && (
                  <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
                    <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-3 sm:mb-4">
                      REGISTRATION STATUS
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      {/* QUICKGIG Registry Status */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        {quickgigSuccess ? (
                          <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black bg-black flex items-center justify-center">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white"></div>
                          </div>
                        ) : (
                          <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        )}
                        <span className="font-mono text-[10px] sm:text-xs">
                          QUICKGIG Registry
                          {!quickgigSuccess && ' - Waiting for confirmation...'}
                        </span>
                      </div>

                      {/* Official ERC-8004 Status (if selected) */}
                      {registerInOfficial && (
                        <div className="flex items-center gap-2 sm:gap-3">
                          {officialSuccess ? (
                            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black bg-black flex items-center justify-center">
                              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white"></div>
                            </div>
                          ) : quickgigSuccess ? (
                            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black bg-gray-200"></div>
                          )}
                          <span className="font-mono text-[10px] sm:text-xs">
                            Official ERC-8004 Registry
                            {!quickgigSuccess && ' - Waiting...'}
                            {quickgigSuccess && !officialSuccess && ' - Waiting for confirmation...'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {registrationError && (
                  <div className="border-2 border-black p-4 sm:p-5 md:p-6 bg-white">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-black flex items-center justify-center flex-shrink-0">
                        <span className="text-sm sm:text-base font-bold">X</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wide mb-1 text-black">
                          REGISTRATION ERROR
                        </h3>
                        <p className="font-mono text-[10px] sm:text-xs text-black">
                          {registrationError}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 sm:space-y-3">
                  {!isConnected && (
                    <div className="border-2 border-black p-3 sm:p-4 bg-white">
                      <p className="font-mono text-[10px] sm:text-xs text-black">
                        [!] Please connect your wallet to register
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 sm:gap-3">
                    <Button
                      onClick={() => setStep(3)}
                      variant="outline"
                      className="flex-1 text-[10px] sm:text-xs"
                      disabled={isRegistering}
                    >
                      ← BACK
                    </Button>
                    <Button
                      onClick={handleRegister}
                      disabled={!isConnected || isRegistering}
                      isLoading={isRegistering}
                      className="flex-1 text-[10px] sm:text-xs"
                    >
                      {isRegistering ? 'REGISTERING...' : 'REGISTER AGENT'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

