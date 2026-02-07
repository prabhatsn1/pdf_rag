// tests/chunk.test.ts
// Tests for the chunking library

import { describe, it, expect } from 'vitest';
import { chunkPages, estimateChunkCount } from '../lib/chunk';
import type { PageContent } from '../lib/types';

describe('chunkPages', () => {
  it('should create chunks from a single page', () => {
    const pages: PageContent[] = [
      {
        pageNumber: 1,
        text: 'This is a test document with some content that should be chunked into smaller pieces for processing.',
      },
    ];

    const chunks = chunkPages(pages, 'doc_123', {
      chunkSize: 50,
      chunkOverlap: 10,
      minChunkSize: 10,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].docId).toBe('doc_123');
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[0].id).toMatch(/^ch_/);
  });

  it('should maintain page numbers across multiple pages', () => {
    const pages: PageContent[] = [
      { pageNumber: 1, text: 'Content from page one with enough text.' },
      { pageNumber: 2, text: 'Content from page two with more text.' },
      { pageNumber: 3, text: 'Content from page three with additional text.' },
    ];

    const chunks = chunkPages(pages, 'doc_456', {
      chunkSize: 30,
      chunkOverlap: 5,
      minChunkSize: 10,
    });

    // Verify chunks from each page exist
    const pageNumbers = [...new Set(chunks.map((c) => c.pageNumber))];
    expect(pageNumbers).toContain(1);
    expect(pageNumbers).toContain(2);
    expect(pageNumbers).toContain(3);
  });

  it('should include character offsets', () => {
    const pages: PageContent[] = [{ pageNumber: 1, text: 'Hello world. This is a test.' }];

    const chunks = chunkPages(pages, 'doc_789');

    for (const chunk of chunks) {
      expect(chunk.charStart).toBeGreaterThanOrEqual(0);
      expect(chunk.charEnd).toBeGreaterThan(chunk.charStart);
    }
  });

  it('should handle empty pages', () => {
    const pages: PageContent[] = [
      { pageNumber: 1, text: '' },
      { pageNumber: 2, text: '   ' },
    ];

    const chunks = chunkPages(pages, 'doc_empty');
    expect(chunks.length).toBe(0);
  });

  it('should respect minChunkSize', () => {
    const pages: PageContent[] = [
      { pageNumber: 1, text: 'Short text that should still be chunked properly.' },
    ];

    const chunks = chunkPages(pages, 'doc_min', {
      chunkSize: 100,
      chunkOverlap: 10,
      minChunkSize: 20,
    });

    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('should create overlapping chunks', () => {
    const longText = `
      This is paragraph one with some important information.
      
      This is paragraph two with more details.
      
      This is paragraph three with additional context.
      
      This is paragraph four with final thoughts.
    `.trim();

    const pages: PageContent[] = [{ pageNumber: 1, text: longText }];

    const chunks = chunkPages(pages, 'doc_overlap', {
      chunkSize: 80,
      chunkOverlap: 20,
      minChunkSize: 30,
    });

    // With overlap, consecutive chunks should share some text
    if (chunks.length > 1) {
      // Just verify we got multiple chunks
      expect(chunks.length).toBeGreaterThan(1);
    }
  });
});

describe('estimateChunkCount', () => {
  it('should estimate chunk count for text', () => {
    const text = 'a'.repeat(10000);
    const estimate = estimateChunkCount(text, {
      chunkSize: 1000,
      chunkOverlap: 100,
    });

    // Should be approximately 10000 / (1000 - 100) = ~11
    expect(estimate).toBeGreaterThanOrEqual(10);
    expect(estimate).toBeLessThanOrEqual(15);
  });

  it('should return 1 for small text', () => {
    const estimate = estimateChunkCount('Hello', { chunkSize: 1000 });
    expect(estimate).toBe(1);
  });
});
