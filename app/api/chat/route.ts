// app/api/chat/route.ts
// Chat endpoint - retrieves context and streams Gemini responses with citations

import { NextRequest } from 'next/server';
import { chatRequestSchema } from '@/lib/schema';
import { retrieve } from '@/lib/retriever';
import { askWithContext } from '@/lib/llm';
import * as vectorStore from '@/lib/vectorstore';
import type { ChatChunkDelta } from '@/lib/types';

// Force Node.js runtime
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = chatRequestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          details: validation.error.issues.map((e: { message: string }) => e.message).join(', '),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { docId, question, topK } = validation.data;

    // Verify document exists
    const docExists = await vectorStore.hasDoc(docId);
    if (!docExists) {
      return new Response(
        JSON.stringify({ error: 'Document not found. Please upload a document first.' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[Chat] Processing question for doc ${docId}: "${question.slice(0, 50)}..."`);

    // Retrieve relevant chunks
    const { chunks, scores } = await retrieve(docId, question, { topK });

    if (chunks.length === 0) {
      // No relevant content found
      const noContextResponse: ChatChunkDelta = {
        type: 'text',
        text: "I don't see any relevant information in the uploaded document for your question. Please try rephrasing or ask about a topic that's covered in the document.",
      };

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(noContextResponse)}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    console.log(
      `[Chat] Retrieved ${chunks.length} chunks with scores: ${scores.map((s) => s.toFixed(3)).join(', ')}`
    );

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream LLM response
          for await (const chunk of askWithContext(question, chunks)) {
            const delta: ChatChunkDelta = {
              type: chunk.done ? 'done' : 'text',
              text: chunk.text || undefined,
              citations: chunk.citations,
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
          }
        } catch (error) {
          console.error('[Chat] Streaming error:', error);
          const errorDelta: ChatChunkDelta = {
            type: 'error',
            error: error instanceof Error ? error.message : 'Failed to generate response',
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorDelta)}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
