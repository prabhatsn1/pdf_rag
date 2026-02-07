// lib/retriever.ts
// Retriever for fetching relevant chunks

import { embedQuery } from './embeddings';
import * as vectorStore from './vectorstore';
import type { DocId, RetrieveResult } from './types';

export interface RetrieveOptions {
  topK?: number;
  scoreThreshold?: number;
  useMMR?: boolean;
  mmrLambda?: number;
}

const DEFAULT_OPTIONS: Required<RetrieveOptions> = {
  topK: 8,
  scoreThreshold: 0.2,
  useMMR: true,
  mmrLambda: 0.5,
};

/**
 * Retrieve relevant chunks for a query
 */
export async function retrieve(
  docId: DocId,
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrieveResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check if document exists
  const docExists = await vectorStore.hasDoc(docId);
  if (!docExists) {
    console.warn(`[Retriever] Document ${docId} not found in vector store`);
    return { chunks: [], scores: [] };
  }

  // Embed the query
  const queryVector = await embedQuery(query);

  // Retrieve from vector store
  let result: RetrieveResult;

  if (opts.useMMR) {
    result = await vectorStore.queryWithMMR(docId, queryVector, opts.topK, opts.mmrLambda);
  } else {
    result = await vectorStore.query(docId, queryVector, opts.topK, opts.scoreThreshold);
  }

  console.log(
    `[Retriever] Retrieved ${result.chunks.length} chunks for query "${query.slice(0, 50)}..."`
  );

  return result;
}

/**
 * Retrieve with optional reranking (simple implementation)
 */
export async function retrieveWithRerank(
  docId: DocId,
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrieveResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get more candidates than needed
  const expandedOptions = {
    ...opts,
    topK: Math.min(opts.topK * 2, 20),
  };

  const initialResult = await retrieve(docId, query, expandedOptions);

  if (initialResult.chunks.length <= opts.topK) {
    return initialResult;
  }

  // Simple rerank: prefer chunks with query terms
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);

  const reranked = initialResult.chunks.map((chunk, i) => {
    const text = chunk.text.toLowerCase();
    const termMatches = queryTerms.filter((term) => text.includes(term)).length;
    const termBoost = (termMatches / Math.max(queryTerms.length, 1)) * 0.1;

    return {
      chunk,
      score: initialResult.scores[i] + termBoost,
    };
  });

  // Sort by adjusted score
  reranked.sort((a, b) => b.score - a.score);

  // Take top K
  const topResults = reranked.slice(0, opts.topK);

  return {
    chunks: topResults.map((r) => r.chunk),
    scores: topResults.map((r) => r.score),
  };
}

/**
 * Check if retrieval would return useful results
 */
export async function hasRelevantContent(
  docId: DocId,
  query: string,
  minScore: number = 0.3
): Promise<boolean> {
  const result = await retrieve(docId, query, { topK: 1 });
  return result.scores.length > 0 && result.scores[0] >= minScore;
}
