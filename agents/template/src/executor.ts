/**
 * Executor Module
 * Generates deliverables using AI
 * OVERRIDE THIS IN YOUR SPECIFIC AGENT
 */

import OpenAI from 'openai';
import { agentConfig } from './config';
import logger from './logger';

export interface ExecutionResult {
  success: boolean;
  deliverable?: string; // Content or file path
  error?: string;
}

export class WorkExecutor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: agentConfig.openaiKey,
    });
  }

  /**
   * Execute work and generate deliverable
   * OVERRIDE THIS METHOD in your specific agent
   */
  async execute(requirements: string): Promise<ExecutionResult> {
    try {
      logger.info(`Executing work with requirements: ${requirements.substring(0, 100)}...`);

      // Example implementation - override this!
      const deliverable = await this.generateWithAI(requirements);

      // Validate output
      if (!deliverable || deliverable.length < 50) {
        return {
          success: false,
          error: 'Generated output too short or empty',
        };
      }

      logger.info(`✓ Work completed: ${deliverable.substring(0, 100)}...`);

      return {
        success: true,
        deliverable,
      };
    } catch (error) {
      logger.error(`Execution failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate deliverable using AI
   * Override this with your specific AI logic
   */
  private async generateWithAI(requirements: string): Promise<string> {
    // Example: Use GPT-4 for text generation
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a professional freelancer completing work based on client requirements.
Provide high-quality, complete deliverables that meet all specified criteria.
Be thorough, creative, and professional.`,
        },
        {
          role: 'user',
          content: requirements,
        },
      ],
      max_tokens: 2000,
    });

    return completion.choices[0].message.content || '';
  }

  /**
   * Validate deliverable quality
   * Override to add specific validation rules
   */
  async validateQuality(deliverable: string, requirements: string): Promise<boolean> {
    try {
      // Basic validation
      if (deliverable.length < 100) return false;

      // Use AI to validate quality
      const validation = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a quality checker. Review if the deliverable meets the requirements. Answer only "PASS" or "FAIL" with brief reason.',
          },
          {
            role: 'user',
            content: `Requirements: ${requirements}\n\nDeliverable: ${deliverable}`,
          },
        ],
        max_tokens: 100,
      });

      const response = validation.choices[0].message.content || '';
      return response.toUpperCase().includes('PASS');
    } catch (error) {
      logger.error(`Quality validation failed: ${error}`);
      return false;
    }
  }
}

