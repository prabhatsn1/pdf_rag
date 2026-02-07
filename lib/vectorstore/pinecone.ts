// lib/vectorstore/pinecone.ts
// Pinecone vector store for production

import { Pinecone, Index } from '@pinecone-database/pinecone';
import type { Chunk, DocId, RetrieveResult } from '../types';

const EMBEDDING_DIMENSION = 768; // Must match text-embedding-004

let pineconeClient: Pinecone | null = null;
let pineconeIndex: Index | null = null;

/**
 * Initialize the Pinecone client and get the index
 */
async function getIndex(): Promise<Index> {
  if (pineconeIndex) {
    return pineconeIndex;
  }

  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;

  if (!apiKey) {
    throw new Error('PINECONE_API_KEY environment variable is not set');
  }

  if (!indexName) {
    throw new Error('PINECONE_INDEX environment variable is not set');
  }

  pineconeClient = new Pinecone({ apiKey });
  pineconeIndex = pineconeClient.index(indexName);

  console.log(`[Pinecone] Connected to index: ${indexName}`);
  return pineconeIndex;
}

/**
 * Check if Pinecone is configured
 */
export function isPineconeConfigured(): boolean {
  return !!(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
}

/**
 * Add chunks with vectors to Pinecone
 */
export async function upsert(docId: DocId, chunks: Chunk[], vectors: number[][]): Promise<void> {
  if (chunks.length !== vectors.length) {
    throw new Error('Chunks and vectors arrays must have the same length');
  }

  const index = await getIndex();

  // Prepare records for upsert
  const records = chunks.map((chunk, i) => ({
    id: `${docId}_${chunk.id}`,
    values: vectors[i],
    metadata: {
      docId: chunk.docId,
      chunkId: chunk.id,
      text: chunk.text.slice(0, 40000), // Pinecone metadata limit
      pageNumber: chunk.pageNumber,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
    },
  }));

  // Upsert in batches of 100 (Pinecone limit)
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await index.upsert({ records: batch });
    console.log(
      `[Pinecone] Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`
    );
  }

  console.log(`[Pinecone] Stored ${chunks.length} vectors for doc ${docId}`);
}

/**
 * Query Pinecone for similar chunks
 */
export async function query(
  docId: DocId,
  queryVector: number[],
  topK: number = 8,
  scoreThreshold: number = 0.2
): Promise<RetrieveResult> {
  const index = await getIndex();

  const results = await index.query({
    vector: queryVector,
    topK,
    filter: { docId: { $eq: docId } },
    includeMetadata: true,
  });

  const chunks: Chunk[] = [];
  const scores: number[] = [];

  for (const match of results.matches || []) {
    // Filter by score threshold
    if (match.score && match.score < scoreThreshold) {
      continue;
    }

    const metadata = match.metadata as Record<string, unknown>;

    if (metadata) {
      chunks.push({
        id: metadata.chunkId as string,
        docId: metadata.docId as string,
        text: metadata.text as string,
        pageNumber: metadata.pageNumber as number,
        charStart: metadata.charStart as number,
        charEnd: metadata.charEnd as number,
      });
      scores.push(match.score || 0);
    }
  }

  return { chunks, scores };
}

/**
 * Delete all vectors for a document
 */
export async function deleteDoc(docId: DocId): Promise<boolean> {
  const index = await getIndex();

  try {
    // Delete by metadata filter
    await index.deleteMany({
      filter: { docId: { $eq: docId } },
    });
    console.log(`[Pinecone] Deleted vectors for doc ${docId}`);
    return true;
  } catch (error) {
    console.error(`[Pinecone] Error deleting doc ${docId}:`, error);
    return false;
  }
}

/**
 * Check if a document exists in Pinecone
 */
export async function hasDoc(docId: DocId): Promise<boolean> {
  const index = await getIndex();

  // Query for any vectors with this docId
  const results = await index.query({
    vector: new Array(EMBEDDING_DIMENSION).fill(0),
    topK: 1,
    filter: { docId: { $eq: docId } },
  });

  return (results.matches?.length || 0) > 0;
}

/**
 * Get index statistics
 */
export async function getStats(): Promise<{ totalVectors: number; dimension: number }> {
  const index = await getIndex();
  const stats = await index.describeIndexStats();

  return {
    totalVectors: stats.totalRecordCount || 0,
    dimension: stats.dimension || EMBEDDING_DIMENSION,
  };
}

/**
 * Create index if it doesn't exist (utility function)
 */
export async function ensureIndex(): Promise<void> {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;

  if (!apiKey || !indexName) {
    throw new Error('PINECONE_API_KEY and PINECONE_INDEX must be set');
  }

  const client = new Pinecone({ apiKey });
  const indexes = await client.listIndexes();

  const indexExists = indexes.indexes?.some((idx) => idx.name === indexName);

  if (!indexExists) {
    console.log(`[Pinecone] Creating index: ${indexName}`);
    await client.createIndex({
      name: indexName,
      dimension: EMBEDDING_DIMENSION,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: process.env.PINECONE_ENV || 'us-east-1',
        },
      },
    });
    console.log(`[Pinecone] Index created: ${indexName}`);
  }
}
