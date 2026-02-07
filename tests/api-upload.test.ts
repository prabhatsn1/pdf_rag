// tests/api-upload.test.ts
// Tests for the upload API route

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('../lib/pdf', () => ({
  parsePDF: vi.fn().mockResolvedValue([
    { pageNumber: 1, text: 'Test content from page one.' },
    { pageNumber: 2, text: 'Test content from page two.' },
  ]),
  validatePDFBuffer: vi.fn().mockReturnValue(true),
}));

vi.mock('../lib/chunk', () => ({
  chunkPages: vi.fn().mockReturnValue([
    { id: 'ch_1', docId: 'doc_test', text: 'Chunk 1', pageNumber: 1, charStart: 0, charEnd: 7 },
    { id: 'ch_2', docId: 'doc_test', text: 'Chunk 2', pageNumber: 2, charStart: 8, charEnd: 15 },
  ]),
}));

vi.mock('../lib/embeddings', () => ({
  embedTexts: vi
    .fn()
    .mockResolvedValue([
      { vector: new Array(768).fill(0.1) },
      { vector: new Array(768).fill(0.2) },
    ]),
}));

vi.mock('../lib/vectorstore', () => ({
  upsert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-1234'),
}));

describe('Upload API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate that a file is provided', async () => {
    const formData = new FormData();
    // No file added

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    });

    // Import the route handler
    const { POST } = await import('../app/api/upload/route');
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('No file provided');
  });

  it('should reject non-PDF files', async () => {
    const formData = new FormData();
    const textFile = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
    formData.append('file', textFile);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../app/api/upload/route');
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Only PDF files are allowed');
  });

  it('should reject files larger than 20MB', async () => {
    const formData = new FormData();
    // Create a file larger than 20MB
    const largeContent = new Uint8Array(21 * 1024 * 1024); // 21MB
    const pdfFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
    formData.append('file', pdfFile);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../app/api/upload/route');
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('too large');
  });

  it('should process valid PDF and return docId and chunkCount', async () => {
    const formData = new FormData();
    // Create a minimal PDF-like buffer
    const pdfContent = Buffer.from('%PDF-1.4\nTest PDF content');
    const pdfFile = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });
    formData.append('file', pdfFile);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../app/api/upload/route');
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.docId).toBeDefined();
    expect(data.docId).toMatch(/^doc_/);
    expect(data.chunkCount).toBe(2);
  });

  it('should handle PDF parsing errors gracefully', async () => {
    const pdf = await import('../lib/pdf');
    vi.mocked(pdf.parsePDF).mockRejectedValueOnce(new Error('PDF parsing failed'));

    const formData = new FormData();
    const pdfContent = Buffer.from('%PDF-1.4\nCorrupt PDF');
    const pdfFile = new File([pdfContent], 'corrupt.pdf', { type: 'application/pdf' });
    formData.append('file', pdfFile);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../app/api/upload/route');
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to process');
  });
});
