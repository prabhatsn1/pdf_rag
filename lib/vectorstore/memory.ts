// lib/vectorstore/memory.ts
// In-memory vector store for development

import { cosineSimilarity } from '../embeddings';
import type { Chunk, DocId, RetrieveResult } from '../types';

interface StoredVector {
  chunk: Chunk;
  vector: number[];
}

interface DocStore {
  vectors: StoredVector[];
  createdAt: Date;
}

// In-memory storage - persists during server lifetime
const store = new Map<DocId, DocStore>();

/**
 * Add chunks with vectors to the store
 */
export async function upsert(docId: DocId, chunks: Chunk[], vectors: number[][]): Promise<void> {
  if (chunks.length !== vectors.length) {
    throw new Error('Chunks and vectors arrays must have the same length');
  }

  const docStore: DocStore = {
    vectors: chunks.map((chunk, i) => ({
      chunk,
      vector: vectors[i],
    })),
    createdAt: new Date(),
  };

  store.set(docId, docStore);
  console.log(`[MemoryStore] Stored ${chunks.length} vectors for doc ${docId}`);
}

/**
 * Query the store for similar chunks
 */
export async function query(
  docId: DocId,
  queryVector: number[],
  topK: number = 8,
  scoreThreshold: number = 0.2
): Promise<RetrieveResult> {
  const docStore = store.get(docId);

  if (!docStore) {
    console.warn(`[MemoryStore] Document ${docId} not found`);
    return { chunks: [], scores: [] };
  }

  // Calculate similarities
  const scored = docStore.vectors.map(({ chunk, vector }) => ({
    chunk,
    score: cosineSimilarity(queryVector, vector),
  }));

  // Sort by score descending and filter by threshold
  const filtered = scored
    .filter((item) => item.score >= scoreThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    chunks: filtered.map((item) => item.chunk),
    scores: filtered.map((item) => item.score),
  };
}

/**
 * Query with Maximal Marginal Relevance (MMR) for diversity
 */
export async function queryWithMMR(
  docId: DocId,
  queryVector: number[],
  topK: number = 8,
  lambda: number = 0.5, // Balance between relevance and diversity
  candidateMultiplier: number = 3
): Promise<RetrieveResult> {
  const docStore = store.get(docId);

  if (!docStore) {
    return { chunks: [], scores: [] };
  }

  // Get initial candidates (more than topK)
  const numCandidates = Math.min(topK * candidateMultiplier, docStore.vectors.length);

  const scored = docStore.vectors.map(({ chunk, vector }) => ({
    chunk,
    vector,
    score: cosineSimilarity(queryVector, vector),
  }));

  // Sort and get top candidates
  const candidates = scored.sort((a, b) => b.score - a.score).slice(0, numCandidates);

  if (candidates.length === 0) {
    return { chunks: [], scores: [] };
  }

  // MMR selection
  const selected: typeof candidates = [];
  const remaining = [...candidates];

  // First selection is always the most relevant
  selected.push(remaining.shift()!);

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Relevance to query
      const relevance = candidate.score;

      // Max similarity to already selected items
      const maxSimilarity = Math.max(
        ...selected.map((s) => cosineSimilarity(candidate.vector, s.vector))
      );

      // MMR score: balance relevance and diversity
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  // Sort final results by original relevance score
  selected.sort((a, b) => b.score - a.score);

  return {
    chunks: selected.map((item) => item.chunk),
    scores: selected.map((item) => item.score),
  };
}

/**
 * Delete a document from the store
 */
export async function deleteDoc(docId: DocId): Promise<boolean> {
  const existed = store.has(docId);
  store.delete(docId);
  return existed;
}

/**
 * Check if a document exists in the store
 */
export async function hasDoc(docId: DocId): Promise<boolean> {
  return store.has(docId);
}

/**
 * Get document info
 */
export async function getDocInfo(
  docId: DocId
): Promise<{ chunkCount: number; createdAt: Date } | null> {
  const docStore = store.get(docId);
  if (!docStore) return null;

  return {
    chunkCount: docStore.vectors.length,
    createdAt: docStore.createdAt,
  };
}

/**
 * Get all document IDs
 */
export async function listDocs(): Promise<DocId[]> {
  return Array.from(store.keys());
}

/**
 * Clear all documents from the store
 */
export async function clearAll(): Promise<void> {
  store.clear();
  console.log('[MemoryStore] Cleared all documents');
}

/**
 * Get store statistics
 */
export function getStats(): { docCount: number; totalVectors: number } {
  let totalVectors = 0;
  for (const docStore of store.values()) {
    totalVectors += docStore.vectors.length;
  }

  return {
    docCount: store.size,
    totalVectors,
  };
}
