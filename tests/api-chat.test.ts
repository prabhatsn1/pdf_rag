// tests/api-chat.test.ts
// Tests for the chat API route

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('../lib/vectorstore', () => ({
  hasDoc: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/retriever', () => ({
  retrieve: vi.fn().mockResolvedValue({
    chunks: [
      {
        id: 'ch_1',
        docId: 'doc_test',
        text: 'This is chunk 1 content.',
        pageNumber: 1,
        charStart: 0,
        charEnd: 24,
      },
      {
        id: 'ch_2',
        docId: 'doc_test',
        text: 'This is chunk 2 content.',
        pageNumber: 2,
        charStart: 25,
        charEnd: 49,
      },
    ],
    scores: [0.9, 0.85],
  }),
}));

vi.mock('../lib/llm', () => ({
  askWithContext: vi.fn().mockImplementation(async function* () {
    yield { text: 'Based on the document, ', done: false };
    yield { text: 'here is the answer (page 1, chunk ch_1).', done: false };
    yield {
      text: '',
      done: true,
      citations: [{ chunkId: 'ch_1', pageNumber: 1, text: 'This is chunk 1...' }],
    };
  }),
}));

describe('Chat API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject invalid request body', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'body' }),
    });

    const { POST } = await import('../app/api/chat/route');
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid request');
  });

  it('should reject missing docId', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is this about?' }),
    });

    const { POST } = await import('../app/api/chat/route');
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.details).toContain('expected string');
  });

  it('should reject missing question', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: 'doc_test' }),
    });

    const { POST } = await import('../app/api/chat/route');
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.details).toContain('expected string');
  });

  it('should return 404 for non-existent document', async () => {
    const vectorStore = await import('../lib/vectorstore');
    vi.mocked(vectorStore.hasDoc).mockResolvedValueOnce(false);

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docId: 'non_existent_doc',
        question: 'What is this?',
      }),
    });

    const { POST } = await import('../app/api/chat/route');
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('Document not found');
  });

  it('should return SSE stream for valid request', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docId: 'doc_test',
        question: 'What is this document about?',
      }),
    });

    const { POST } = await import('../app/api/chat/route');
    const response = await POST(request as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('should handle retrieval with no results', async () => {
    const retriever = await import('../lib/retriever');
    vi.mocked(retriever.retrieve).mockResolvedValueOnce({
      chunks: [],
      scores: [],
    });

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docId: 'doc_test',
        question: 'Something not in the document?',
      }),
    });

    const { POST } = await import('../app/api/chat/route');
    const response = await POST(request as any);

    expect(response.status).toBe(200);

    // Read the stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value);
      }
    }

    // Should contain a message about no relevant information
    expect(fullText).toContain("don't see");
  });

  it('should respect topK parameter', async () => {
    const retriever = await import('../lib/retriever');

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docId: 'doc_test',
        question: 'What is this?',
        topK: 5,
      }),
    });

    const { POST } = await import('../app/api/chat/route');
    await POST(request as any);

    expect(retriever.retrieve).toHaveBeenCalledWith(
      'doc_test',
      'What is this?',
      expect.objectContaining({ topK: 5 })
    );
  });
});
