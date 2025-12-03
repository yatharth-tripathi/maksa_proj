/**
 * File Upload API
 * POST /api/upload - Upload files to IPFS via Pinata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPinataClient } from '@/lib/pinata/client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const metadata = formData.get('metadata') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Parse metadata if provided
    let parsedMetadata: { name?: string; keyvalues?: Record<string, string> } = {};
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch {
        return NextResponse.json({ error: 'Invalid metadata JSON' }, { status: 400 });
      }
    }

    // Upload to Pinata
    const pinata = getPinataClient();
    const result = await pinata.uploadFile(file, {
      name: parsedMetadata.name || file.name,
      keyvalues: parsedMetadata.keyvalues,
    });

    console.log('[Upload] File uploaded to IPFS:', result.ipfsHash);

    return NextResponse.json({
      success: true,
      ipfsHash: result.ipfsHash,
      url: result.url,
      size: result.size,
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for testing
 */
export async function GET() {
  try {
    const pinata = getPinataClient();
    const isConnected = await pinata.testConnection();

    return NextResponse.json({
      endpoint: '/api/upload',
      status: isConnected ? 'connected' : 'disconnected',
      methods: {
        POST: 'Upload file to IPFS',
      },
      usage: {
        POST: {
          contentType: 'multipart/form-data',
          fields: {
            file: 'File to upload (required)',
            metadata: 'JSON string with name and keyvalues (optional)',
          },
        },
      },
    });
  } catch (error) {
    return NextResponse.json({
      endpoint: '/api/upload',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
