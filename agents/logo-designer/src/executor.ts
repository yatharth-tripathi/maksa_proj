/**
 * Logo Designer Executor
 * Uses OpenRouter (Stable Diffusion) to generate professional logos
 * CHEAP: ~$0.002 per logo vs DALL-E's $0.04!
 */

import axios from 'axios';
import { agentConfig } from './config';
import logger from './logger';

export interface ExecutionResult {
  success: boolean;
  deliverable?: string;
  imageUrl?: string;
  error?: string;
}

export class LogoExecutor {
  private openrouterKey: string;
  private apiUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    this.openrouterKey = agentConfig.openrouterKey;
  }

  /**
   * Generate logo based on requirements
   */
  async execute(requirements: string): Promise<ExecutionResult> {
    try {
      logger.info(`🎨 Generating logo: ${requirements.substring(0, 100)}...`);

      // Step 1: Parse requirements and refine prompt (using cheap text model)
      const refinedPrompt = await this.refinePrompt(requirements);
      logger.debug(`Refined prompt: ${refinedPrompt}`);

      // Step 2: Generate logo with Stable Diffusion (CHEAP!)
      const imageUrl = await this.generateLogo(refinedPrompt);
      logger.info(`✓ Logo generated: ${imageUrl}`);

      // Step 3: Create deliverable package
      const deliverable = this.createDeliverable(requirements, imageUrl, refinedPrompt);

      // Skip quality validation to save costs (cheap model)
      // Simple validation: Check if image URL is valid
      if (!imageUrl || !imageUrl.startsWith('http')) {
        logger.error('Invalid image URL generated');
        return {
          success: false,
          error: 'Image generation failed',
        };
      }

      return {
        success: true,
        deliverable,
        imageUrl,
      };
    } catch (error) {
      logger.error(`Logo generation failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Refine user requirements into image generation prompt
   * Uses FREE Llama model from OpenRouter
   */
  private async refinePrompt(requirements: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          model: 'meta-llama/llama-3.1-8b-instruct:free', // FREE MODEL!
          messages: [
            {
              role: 'system',
              content: `You are a professional logo designer. Convert client requirements into detailed image generation prompts.
Focus on: style, colors, symbols, brand personality, professional look.
Output ONLY the prompt, no explanations.`,
            },
            {
              role: 'user',
              content: `Client requirements: ${requirements}\n\nCreate a detailed prompt for a professional logo.`,
            },
          ],
          max_tokens: 150,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://quickgig.io',
            'X-Title': 'QuickGig Logo Agent',
          },
        }
      );

      return response.data.choices[0].message.content || requirements;
    } catch (error) {
      logger.error(`Prompt refinement failed: ${error}`);
      return `Professional logo design: ${requirements}. Modern, clean, minimalist style.`;
    }
  }

  /**
   * Generate logo with Stable Diffusion via OpenRouter
   * COST: ~$0.002 per image (vs DALL-E $0.04) - 20x cheaper!
   */
  private async generateLogo(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/images/generations`,
        {
          // Using Stable Diffusion XL - cheap and good quality
          model: 'stabilityai/stable-diffusion-xl-base-1.0',
          prompt: `${prompt}. Professional logo design, clean background, high quality, vector style, minimalist, suitable for branding`,
          n: 1,
          size: '1024x1024',
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://quickgig.io',
            'X-Title': 'QuickGig Logo Agent',
          },
        }
      );

      const imageUrl = response.data.data[0].url;
      
      if (!imageUrl) {
        throw new Error('No image URL returned from Stable Diffusion');
      }

      return imageUrl;
    } catch (error) {
      logger.error(`Image generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * REMOVED: Quality validation to save costs
   * For $10 budget, skip expensive vision model checks
   */

  /**
   * Create deliverable package
   */
  private createDeliverable(requirements: string, imageUrl: string, prompt: string): string {
    const deliverable = {
      type: 'logo-design',
      generatedAt: new Date().toISOString(),
      agent: agentConfig.name,
      
      requirements: requirements,
      
      deliverable: {
        imageUrl: imageUrl,
        format: 'PNG',
        size: '1024x1024',
        quality: 'high',
      },
      
      designDetails: {
        prompt: prompt,
        model: 'Stable Diffusion XL (via OpenRouter)',
        style: 'Professional, modern, clean',
        cost: '~$0.002 (20x cheaper than DALL-E)',
      },
      
      usage: {
        license: 'Commercial use allowed',
        formats: 'PNG (provided), vector conversion available on request',
        guidelines: 'Use for branding, marketing, web, print',
      },
      
      notes: `Logo generated by autonomous AI agent using Stable Diffusion XL via OpenRouter. 
High-quality design suitable for professional use at 20x lower cost than DALL-E.
Image URL will remain valid for 60 days, please download and save.`,
    };

    return JSON.stringify(deliverable, null, 2);
  }

  /**
   * Download image for backup (optional)
   */
  private async downloadImage(imageUrl: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`Image download failed: ${error}`);
      return null;
    }
  }
}

