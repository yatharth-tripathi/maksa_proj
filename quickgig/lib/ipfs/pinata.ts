/**
 * Pinata IPFS Upload Utility
 * Upload JSON metadata and files to IPFS via Pinata
 */

const PINATA_API_KEY = process.env.PINATA_API_KEY!;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET!;
const PINATA_JWT = process.env.PINATA_JWT!;

if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_API_SECRET)) {
  console.warn('Pinata credentials not configured. IPFS uploads will fail.');
}

/**
 * Upload JSON metadata to IPFS
 */
export async function uploadJSON(data: unknown, name: string): Promise<string> {
  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: data,
        pinataMetadata: {
          name: name,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinata upload failed: ${error}`);
    }

    const result = await response.json();
    return `ipfs://${result.IpfsHash}`;
  } catch (error) {
    console.error('IPFS upload error:', error);
    throw error;
  }
}

/**
 * Upload file to IPFS
 */
export async function uploadFile(file: File, name?: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    if (name) {
      formData.append(
        'pinataMetadata',
        JSON.stringify({
          name: name,
        })
      );
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinata file upload failed: ${error}`);
    }

    const result = await response.json();
    return `ipfs://${result.IpfsHash}`;
  } catch (error) {
    console.error('IPFS file upload error:', error);
    throw error;
  }
}

/**
 * Unpin content from IPFS (cleanup)
 */
export async function unpinContent(ipfsHash: string): Promise<void> {
  try {
    // Remove ipfs:// prefix if present
    const hash = ipfsHash.replace('ipfs://', '');

    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${hash}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn(`Pinata unpin failed: ${error}`);
    }
  } catch (error) {
    console.error('IPFS unpin error:', error);
  }
}

/**
 * Get pinned content metadata
 */
export async function getPinnedContent(ipfsHash: string): Promise<unknown> {
  try {
    const hash = ipfsHash.replace('ipfs://', '');

    const response = await fetch(`https://api.pinata.cloud/data/pinList?hashContains=${hash}`, {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch pinned content');
    }

    const result = await response.json();
    return result.rows[0];
  } catch (error) {
    console.error('IPFS get pinned content error:', error);
    throw error;
  }
}
