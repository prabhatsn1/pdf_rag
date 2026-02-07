// tests/retriever.test.ts
// Tests for the retriever module

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cosineSimilarity } from '../lib/embeddings';

// Mock the embeddings module
vi.mock('../lib/embeddings', async () => {
  const actual = await vi.importActual('../lib/embeddings');
  return {
    ...actual,
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
  };
});

// Mock the vector store
vi.mock('../lib/vectorstore', () => ({
  hasDoc: vi.fn().mockResolvedValue(true),
  query: vi.fn().mockResolvedValue({
    chunks: [
      { id: 'ch_1', docId: 'doc_1', text: 'First chunk', pageNumber: 1, charStart: 0, charEnd: 11 },
      {
        id: 'ch_2',
        docId: 'doc_1',
        text: 'Second chunk',
        pageNumber: 1,
        charStart: 12,
        charEnd: 24,
      },
    ],
    scores: [0.95, 0.85],
  }),
  queryWithMMR: vi.fn().mockResolvedValue({
    chunks: [
      { id: 'ch_1', docId: 'doc_1', text: 'First chunk', pageNumber: 1, charStart: 0, charEnd: 11 },
      {
        id: 'ch_3',
        docId: 'doc_1',
        text: 'Third chunk',
        pageNumber: 2,
        charStart: 25,
        charEnd: 36,
      },
    ],
    scores: [0.95, 0.75],
  }),
}));

describe('cosineSimilarity', () => {
  it('should calculate cosine similarity correctly', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(1);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(-1);
  });

  it('should handle normalized vectors', () => {
    const a = [0.6, 0.8, 0];
    const b = [0.8, 0.6, 0];
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeCloseTo(0.96, 2);
  });

  it('should throw for mismatched dimensions', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow('Vectors must have the same dimension');
  });

  it('should handle zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

describe('retrieve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve chunks for a query', async () => {
    const { retrieve } = await import('../lib/retriever');

    const result = await retrieve('doc_1', 'test query');

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.scores.length).toBe(result.chunks.length);
  });

  it('should respect topK parameter', async () => {
    const { retrieve } = await import('../lib/retriever');
    const vectorStore = await import('../lib/vectorstore');

    await retrieve('doc_1', 'test query', { topK: 5 });

    expect(vectorStore.queryWithMMR).toHaveBeenCalled();
  });

  it('should return empty results for non-existent document', async () => {
    const vectorStore = await import('../lib/vectorstore');
    vi.mocked(vectorStore.hasDoc).mockResolvedValueOnce(false);

    const { retrieve } = await import('../lib/retriever');
    const result = await retrieve('non_existent', 'test query');

    expect(result.chunks).toHaveLength(0);
    expect(result.scores).toHaveLength(0);
  });

  it('should use MMR by default', async () => {
    const { retrieve } = await import('../lib/retriever');
    const vectorStore = await import('../lib/vectorstore');

    await retrieve('doc_1', 'test query');

    expect(vectorStore.queryWithMMR).toHaveBeenCalled();
  });

  it('should use regular query when MMR is disabled', async () => {
    const { retrieve } = await import('../lib/retriever');
    const vectorStore = await import('../lib/vectorstore');

    await retrieve('doc_1', 'test query', { useMMR: false });

    expect(vectorStore.query).toHaveBeenCalled();
  });
});

describe('hasRelevantContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when relevant content exists', async () => {
    const { hasRelevantContent } = await import('../lib/retriever');

    const result = await hasRelevantContent('doc_1', 'test query');

    expect(result).toBe(true);
  });

  it('should return false when score is below threshold', async () => {
    const vectorStore = await import('../lib/vectorstore');
    vi.mocked(vectorStore.queryWithMMR).mockResolvedValueOnce({
      chunks: [
        {
          id: 'ch_1',
          docId: 'doc_1',
          text: 'Low relevance',
          pageNumber: 1,
          charStart: 0,
          charEnd: 13,
        },
      ],
      scores: [0.1], // Below default 0.3 threshold
    });

    const { hasRelevantContent } = await import('../lib/retriever');
    const result = await hasRelevantContent('doc_1', 'test query');

    expect(result).toBe(false);
  });
});
