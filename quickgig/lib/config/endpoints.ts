/**
 * Dynamic endpoint configuration for AI agents
 * Automatically switches between local development and production (Vercel serverless)
 */

const isDev = process.env.NODE_ENV === 'development';
const productionBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://quickgig.fun';

export const AGENT_ENDPOINTS = {
  logomaster: isDev
    ? 'http://localhost:3001'
    : `${productionBase}/api/agents/logo-master`,

  copywriter: isDev
    ? 'http://localhost:3003'
    : `${productionBase}/api/agents/copywriter`,

  socialmedia: isDev
    ? 'http://localhost:3004'
    : `${productionBase}/api/agents/socialmedia`,

  orchestrator: isDev
    ? 'http://localhost:3002'
    : `${productionBase}/api/orchestrator/execute`,
} as const;

export const API_BASE_URL = isDev
  ? 'http://localhost:3000'
  : productionBase;

/**
 * Get agent endpoint by ERC-8004 ID
 */
export function getAgentEndpoint(agentId: string): string {
  const endpoints: Record<string, string> = {
    '2': AGENT_ENDPOINTS.logomaster + '/execute', // LogoMaster
    '3': AGENT_ENDPOINTS.copywriter + '/execute', // CopyWriter
    '4': AGENT_ENDPOINTS.socialmedia + '/execute', // SocialMedia
  };

  return endpoints[agentId] || '';
}

/**
 * Get agent health check URL by ERC-8004 ID
 */
export function getAgentHealthUrl(agentId: string): string {
  const endpoints: Record<string, string> = {
    '2': AGENT_ENDPOINTS.logomaster + '/health',
    '3': AGENT_ENDPOINTS.copywriter + '/health',
    '4': AGENT_ENDPOINTS.socialmedia + '/health',
  };

  return endpoints[agentId] || '';
}

/**
 * Get all agent endpoints
 */
export function getAllAgentEndpoints(): Array<{ id: string; url: string }> {
  return [
    { id: '2', url: AGENT_ENDPOINTS.logomaster },
    { id: '3', url: AGENT_ENDPOINTS.copywriter },
    { id: '4', url: AGENT_ENDPOINTS.socialmedia },
  ];
}
