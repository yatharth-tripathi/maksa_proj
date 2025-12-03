import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || '',
    'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || '',
  },
});

// Tool definitions for OpenAI tools (modern API, replaces deprecated function calling)
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'createBounty',
      description: 'Create a new bounty for a task that multiple workers can bid on',
      parameters: {
        type: 'object',
        properties: {
          requirements: {
            type: 'string',
            description: 'Detailed description of the work required',
          },
          amount: {
            type: 'number',
            description: 'Payment amount in USDC (e.g., 50 for $50)',
          },
          deadline: {
            type: 'number',
            description: 'Number of days until deadline',
          },
        },
        required: ['requirements', 'amount', 'deadline'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'createGig',
      description: 'Create a direct 1-on-1 gig with a specific worker',
      parameters: {
        type: 'object',
        properties: {
          workerAddress: {
            type: 'string',
            description: 'Ethereum address of the worker (0x...)',
          },
          milestones: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                  description: 'Milestone description',
                },
                amount: {
                  type: 'number',
                  description: 'Payment amount in USDC for this milestone',
                },
              },
            },
            description: 'Array of milestones with descriptions and amounts',
          },
        },
        required: ['workerAddress', 'milestones'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'listBounties',
      description: 'List all open bounties or filter by criteria',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'assigned', 'completed'],
            description: 'Filter by bounty status',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'submitBid',
      description: 'Submit a bid on an existing bounty',
      parameters: {
        type: 'object',
        properties: {
          bountyId: {
            type: 'number',
            description: 'ID of the bounty to bid on',
          },
          amount: {
            type: 'number',
            description: 'Bid amount in USDC',
          },
          proposal: {
            type: 'string',
            description: 'Brief proposal explaining your approach',
          },
        },
        required: ['bountyId', 'amount', 'proposal'],
      },
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        {
          message: 'OpenRouter API key not configured. Using mock response for development.',
          metadata: {
            functionCall: {
              name: 'createBounty',
              arguments: {
                requirements: message,
                amount: 50,
                deadline: 7,
              },
            },
          },
        },
        { status: 200 }
      );
    }

    // Call OpenRouter with tools (modern API - replaces deprecated function calling)
    // Using openai/gpt-4o-mini via OpenRouter
    const completion = await openai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are QUICKGIG AI, an assistant for an autonomous agent marketplace on Base blockchain.

Help users deploy missions for tasks like logo design, copywriting, web development, social media, and any creative/technical work.

Be SHORT and direct - 1-2 sentences max.

Use tools when users want to take actions. For amounts like "$50" or "fifty dollars" - extract the number.

NO long explanations. NO headings. NO bullet lists. Just quick, helpful responses.`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      tools: tools,
      tool_choice: 'auto',
    });

    const responseMessage = completion.choices[0].message;

    // Check if tool was called (modern API)
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      // Type guard: Check if this is a function tool call
      if ('function' in toolCall && toolCall.function) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        return NextResponse.json({
          message: `I'll help you ${functionName.replace(/([A-Z])/g, ' $1').toLowerCase()}. Please review the details below and confirm.`,
          metadata: {
            functionCall: {
              name: functionName,
              arguments: functionArgs,
            },
          },
        });
      }
    }

    // Regular text response
    return NextResponse.json({
      message: responseMessage.content || 'I can help you with bounties and gigs. What would you like to do?',
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
