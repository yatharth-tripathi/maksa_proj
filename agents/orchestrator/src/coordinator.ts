/**
 * Multi-Agent Coordinator
 * Orchestrates execution of tasks across multiple agents with A2A payments
 */

import { A2APaymentClient } from '../../../quickgig/lib/x402/agent-client';
import type { Address } from 'viem';
import type {
  MissionPlan,
  AgentTask,
  TaskResult,
  MissionExecution,
  SubAgent,
} from './types';
import winston from 'winston';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export class MultiAgentCoordinator {
  private a2aClient: A2APaymentClient;
  private orchestratorAddress: Address;

  constructor(
    orchestratorCredentials: {
      privateKey: `0x${string}`;
      address: Address;
      agentId: string;
    },
    usdcAddress: Address
  ) {
    this.orchestratorAddress = orchestratorCredentials.address;
    this.a2aClient = new A2APaymentClient(orchestratorCredentials, usdcAddress);
  }

  /**
   * Execute mission with sequential coordination
   * Agents execute one after another, each building on previous results
   */
  async executeSequential(plan: MissionPlan): Promise<MissionExecution> {
    logger.info(`[Orchestrator] Starting sequential execution: ${plan.missionId}`);

    const execution: MissionExecution = {
      missionId: plan.missionId,
      status: 'in_progress',
      startedAt: new Date(),
      results: [],
      totalPaid: 0n,
    };

    try {
      // Execute agents in order
      for (const agent of plan.subAgents) {
        logger.info(`[Orchestrator] Executing agent: ${agent.name} (${agent.capability})`);

        // Build requirements (may include results from previous agents)
        const requirements = this.buildRequirements(agent, execution.results, plan);

        // Execute task with A2A payment
        try {
          const result = await this.a2aClient.executeSubTask({
            targetAgentId: agent.agentId.toString(),
            targetEndpoint: agent.endpoint,
            task: requirements,
            maxPayment: agent.payment,
          });

          const taskResult: TaskResult = {
            agentId: agent.agentId,
            success: true,
            result: result.result,
            paid: result.paid,
            txHash: result.txHash,
            completedAt: new Date(),
          };

          execution.results.push(taskResult);
          execution.totalPaid += result.paid;

          logger.info(`[Orchestrator] Agent ${agent.name} completed successfully`);
        } catch (error) {
          logger.error(`[Orchestrator] Agent ${agent.name} failed:`, error);

          const taskResult: TaskResult = {
            agentId: agent.agentId,
            success: false,
            result: '',
            paid: 0n,
            error: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          };

          execution.results.push(taskResult);
          execution.status = 'failed';
          execution.error = `Agent ${agent.name} failed: ${taskResult.error}`;
          break;
        }
      }

      // Check if all agents completed successfully
      if (execution.results.every((r) => r.success)) {
        execution.status = 'completed';
        execution.completedAt = new Date();
        logger.info(`[Orchestrator] Mission ${plan.missionId} completed successfully`);
      }

      return execution;
    } catch (error) {
      logger.error(`[Orchestrator] Mission execution failed:`, error);
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
      return execution;
    }
  }

  /**
   * Execute mission with parallel coordination
   * All agents execute simultaneously
   */
  async executeParallel(plan: MissionPlan): Promise<MissionExecution> {
    logger.info(`[Orchestrator] Starting parallel execution: ${plan.missionId}`);

    const execution: MissionExecution = {
      missionId: plan.missionId,
      status: 'in_progress',
      startedAt: new Date(),
      results: [],
      totalPaid: 0n,
    };

    try {
      // Execute all agents in parallel
      const taskPromises = plan.subAgents.map(async (agent) => {
        logger.info(`[Orchestrator] Starting agent: ${agent.name} (${agent.capability})`);

        const requirements = plan.requirements[agent.capability] || plan.description;

        try {
          const result = await this.a2aClient.executeSubTask({
            targetAgentId: agent.agentId.toString(),
            targetEndpoint: agent.endpoint,
            task: requirements,
            maxPayment: agent.payment,
          });

          const taskResult: TaskResult = {
            agentId: agent.agentId,
            success: true,
            result: result.result,
            paid: result.paid,
            txHash: result.txHash,
            completedAt: new Date(),
          };

          logger.info(`[Orchestrator] Agent ${agent.name} completed successfully`);
          return taskResult;
        } catch (error) {
          logger.error(`[Orchestrator] Agent ${agent.name} failed:`, error);

          return {
            agentId: agent.agentId,
            success: false,
            result: '',
            paid: 0n,
            error: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          } as TaskResult;
        }
      });

      // Wait for all agents to complete
      execution.results = await Promise.all(taskPromises);

      // Calculate total paid
      execution.totalPaid = execution.results.reduce((sum, r) => sum + r.paid, 0n);

      // Check if all succeeded
      if (execution.results.every((r) => r.success)) {
        execution.status = 'completed';
        logger.info(`[Orchestrator] Mission ${plan.missionId} completed successfully`);
      } else {
        execution.status = 'failed';
        const failedAgents = execution.results
          .filter((r) => !r.success)
          .map((r) => r.agentId.toString())
          .join(', ');
        execution.error = `Some agents failed: ${failedAgents}`;
        logger.error(`[Orchestrator] Mission ${plan.missionId} failed`);
      }

      execution.completedAt = new Date();
      return execution;
    } catch (error) {
      logger.error(`[Orchestrator] Mission execution failed:`, error);
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
      return execution;
    }
  }

  /**
   * Execute mission based on orchestration mode
   */
  async executeMission(plan: MissionPlan): Promise<MissionExecution> {
    logger.info(`[Orchestrator] Received mission: ${plan.missionId}`);
    logger.info(`[Orchestrator] Mode: ${plan.orchestrationMode}`);
    logger.info(`[Orchestrator] Agents: ${plan.subAgents.length}`);
    logger.info(`[Orchestrator] Budget: ${plan.totalBudget.toString()} USDC`);

    if (plan.orchestrationMode === 'sequential') {
      return this.executeSequential(plan);
    } else {
      return this.executeParallel(plan);
    }
  }

  /**
   * Build requirements for an agent, potentially including previous results
   */
  private buildRequirements(
    agent: SubAgent,
    previousResults: TaskResult[],
    plan: MissionPlan
  ): string {
    let requirements = plan.requirements[agent.capability] || plan.description;

    // For sequential execution, append relevant previous results
    if (plan.orchestrationMode === 'sequential' && previousResults.length > 0) {
      const contextFromPrevious = previousResults
        .filter((r) => r.success)
        .map((r) => `Previous result: ${r.result}`)
        .join('\n\n');

      if (contextFromPrevious) {
        requirements += `\n\nContext from previous agents:\n${contextFromPrevious}`;
      }
    }

    return requirements;
  }

  /**
   * Get orchestrator wallet balance
   */
  async getBalance(): Promise<bigint> {
    return this.a2aClient.getBalance();
  }

  /**
   * Get orchestrator address
   */
  getAddress(): Address {
    return this.orchestratorAddress;
  }
}
