/**
 * Orchestrator Agent Server
 * Listens for multi-agent mission requests and coordinates execution
 */

import express from 'express';
import { MultiAgentCoordinator } from './coordinator';
import type { MissionPlan } from './types';
import { parseUnits, type Address } from 'viem';
import * as dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

// Validate environment
const ORCHESTRATOR_PRIVATE_KEY = process.env.ORCHESTRATOR_PRIVATE_KEY as `0x${string}`;
const ORCHESTRATOR_ADDRESS = process.env.ORCHESTRATOR_ADDRESS as Address;
const USDC_ADDRESS = (process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as Address;
const PORT = parseInt(process.env.PORT || '3100');

if (!ORCHESTRATOR_PRIVATE_KEY || !ORCHESTRATOR_ADDRESS) {
  logger.error('Missing required environment variables: ORCHESTRATOR_PRIVATE_KEY, ORCHESTRATOR_ADDRESS');
  process.exit(1);
}

// Initialize coordinator
const coordinator = new MultiAgentCoordinator(
  {
    privateKey: ORCHESTRATOR_PRIVATE_KEY,
    address: ORCHESTRATOR_ADDRESS,
    agentId: 'orchestrator-agent',
  },
  USDC_ADDRESS
);

// Express server
const app = express();
app.use(express.json());

/**
 * Health check
 */
app.get('/health', async (req, res) => {
  try {
    const balance = await coordinator.getBalance();
    res.json({
      status: 'healthy',
      address: coordinator.getAddress(),
      balance: balance.toString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Execute mission
 * POST /execute
 */
app.post('/execute', async (req, res) => {
  try {
    const plan: MissionPlan = req.body;

    // Validate request
    if (!plan.missionId || !plan.subAgents || plan.subAgents.length === 0) {
      return res.status(400).json({
        error: 'Invalid mission plan',
        message: 'missionId and subAgents are required',
      });
    }

    logger.info(`[Orchestrator Server] Received mission: ${plan.missionId}`);

    // Execute mission
    const execution = await coordinator.executeMission(plan);

    res.json({
      success: execution.status === 'completed',
      execution,
    });
  } catch (error) {
    logger.error('[Orchestrator Server] Execution error:', error);
    res.status(500).json({
      error: 'Mission execution failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get coordinator info
 */
app.get('/info', async (req, res) => {
  try {
    const balance = await coordinator.getBalance();
    res.json({
      agentId: 'orchestrator-agent',
      address: coordinator.getAddress(),
      balance: balance.toString(),
      capabilities: ['multi-agent-coordination', 'sequential-execution', 'parallel-execution'],
      status: 'available',
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Orchestrator Agent listening on port ${PORT}`);
  logger.info(`📍 Address: ${coordinator.getAddress()}`);
  logger.info(`💰 Ready to coordinate multi-agent missions`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
