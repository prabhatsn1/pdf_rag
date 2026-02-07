// app/api/upload/route.ts
// PDF upload endpoint - parses, chunks, embeds, and stores vectors

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { parsePDF, validatePDFBuffer } from '@/lib/pdf';
import { chunkPages } from '@/lib/chunk';
import { embedTexts } from '@/lib/embeddings';
import * as vectorStore from '@/lib/vectorstore';
import type { UploadResponse } from '@/lib/types';

// Force Node.js runtime for PDF parsing
export const runtime = 'nodejs';

// Configure max request body size (20MB)
export const maxDuration = 60; // 60 seconds timeout

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(
  request: NextRequest
): Promise<NextResponse<UploadResponse | { error: string }>> {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');

    // Validate file exists
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Please upload a PDF file.' },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 20MB.' }, { status: 400 });
    }

    console.log(
      `[Upload] Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`
    );

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF structure
    if (!validatePDFBuffer(buffer)) {
      return NextResponse.json(
        { error: 'Invalid PDF file. The file appears to be corrupted.' },
        { status: 400 }
      );
    }

    // Parse PDF to extract text
    console.log('[Upload] Parsing PDF...');
    const pages = await parsePDF(buffer);

    if (pages.length === 0) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF. The file may be empty or contain only images.' },
        { status: 400 }
      );
    }

    console.log(`[Upload] Extracted ${pages.length} pages`);

    // Generate document ID
    const docId = `doc_${uuidv4().slice(0, 12)}`;

    // Chunk the pages
    console.log('[Upload] Chunking text...');
    const chunks = chunkPages(pages, docId, {
      chunkSize: 1200,
      chunkOverlap: 180,
    });

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'Could not create chunks from PDF. The document may contain insufficient text.' },
        { status: 400 }
      );
    }

    console.log(`[Upload] Created ${chunks.length} chunks`);

    // Generate embeddings
    console.log('[Upload] Generating embeddings...');
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(chunkTexts);
    const vectors = embeddings.map((e) => e.vector);

    console.log(`[Upload] Generated ${vectors.length} embeddings`);

    // Store in vector database
    console.log('[Upload] Storing vectors...');
    await vectorStore.upsert(docId, chunks, vectors);

    console.log(`[Upload] Successfully processed document: ${docId}`);

    const response: UploadResponse = {
      docId,
      chunkCount: chunks.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Upload] Error processing document:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: `Failed to process document: ${errorMessage}` },
      { status: 500 }
    );
  }
}
