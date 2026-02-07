// lib/vectorstore/index.ts
// Vector store abstraction layer

import * as memoryStore from './memory';
import * as pineconeStore from './pinecone';
import type { Chunk, DocId, RetrieveResult } from '../types';

export type VectorStoreType = 'memory' | 'pinecone';

/**
 * Determine which vector store to use based on environment
 */
export function getStoreType(): VectorStoreType {
  if (pineconeStore.isPineconeConfigured()) {
    return 'pinecone';
  }
  return 'memory';
}

/**
 * Upsert chunks with vectors to the appropriate store
 */
export async function upsert(docId: DocId, chunks: Chunk[], vectors: number[][]): Promise<void> {
  const storeType = getStoreType();

  if (storeType === 'pinecone') {
    await pineconeStore.upsert(docId, chunks, vectors);
  } else {
    await memoryStore.upsert(docId, chunks, vectors);
  }
}

/**
 * Query for similar chunks
 */
export async function query(
  docId: DocId,
  queryVector: number[],
  topK: number = 8,
  scoreThreshold: number = 0.2
): Promise<RetrieveResult> {
  const storeType = getStoreType();

  if (storeType === 'pinecone') {
    return pineconeStore.query(docId, queryVector, topK, scoreThreshold);
  } else {
    return memoryStore.query(docId, queryVector, topK, scoreThreshold);
  }
}

/**
 * Query with MMR for diversity (memory store only, falls back to regular query for Pinecone)
 */
export async function queryWithMMR(
  docId: DocId,
  queryVector: number[],
  topK: number = 8,
  lambda: number = 0.5
): Promise<RetrieveResult> {
  const storeType = getStoreType();

  if (storeType === 'pinecone') {
    // Pinecone doesn't support MMR natively, use regular query
    return pineconeStore.query(docId, queryVector, topK);
  } else {
    return memoryStore.queryWithMMR(docId, queryVector, topK, lambda);
  }
}

/**
 * Delete a document from the store
 */
export async function deleteDoc(docId: DocId): Promise<boolean> {
  const storeType = getStoreType();

  if (storeType === 'pinecone') {
    return pineconeStore.deleteDoc(docId);
  } else {
    return memoryStore.deleteDoc(docId);
  }
}

/**
 * Check if a document exists
 */
export async function hasDoc(docId: DocId): Promise<boolean> {
  const storeType = getStoreType();

  if (storeType === 'pinecone') {
    return pineconeStore.hasDoc(docId);
  } else {
    return memoryStore.hasDoc(docId);
  }
}

// Re-export for direct access if needed
export { memoryStore, pineconeStore };
