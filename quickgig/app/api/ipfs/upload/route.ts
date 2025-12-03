/**
 * IPFS Upload API
 * Upload JSON metadata to IPFS via Pinata
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadJSON } from '@/lib/ipfs/pinata';

export async function POST(request: NextRequest) {
  try {
    const { data, name } = await request.json();

    if (!data) {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 });
    }

    const ipfsUri = await uploadJSON(data, name || `upload_${Date.now()}`);

    return NextResponse.json({ ipfsUri });
  } catch (error) {
    console.error('IPFS upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
