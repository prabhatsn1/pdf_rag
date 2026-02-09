/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/llm.ts
// Gemini LLM client with streaming support

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { Chunk, LLMConfig, Citation } from './types';

const DEFAULT_CONFIG: LLMConfig = {
  model: process.env.GOOGLE_LLM_MODEL || 'gemini-1.5-flash',
  maxTokens: 4096,
  temperature: 0.3,
};

let genAI: GoogleGenerativeAI | null = null;

/**
 * System prompt for grounded responses
 */
const SYSTEM_PROMPT = `Role: You are a precise assistant grounded strictly in the provided PDF context.

Rules:
1. Only answer from the provided chunks. If the answer isn't clearly supported, reply: "I don't see this in the uploaded document."
2. Cite the page numbers and chunk IDs that support your answer using the format: (page X, chunk Y)
3. Prefer direct quotes (short) for critical facts; otherwise paraphrase.
4. Be concise and structured: use bullet points or short sections.
5. If the user asks for something unrelated to the PDF, clarify the limitation.
6. If there are multiple interpretations, list them with citations.

Always include citations for every factual claim you make.`;

/**
 * Initialize the Google AI client
 */
function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY environment variable is not set');
    }
    console.log(`[LLM] Initializing Google AI client with LLM model: ${DEFAULT_CONFIG.model}`);
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Get a configured Gemini model
 */
export function getModel(config: Partial<LLMConfig> = {}): GenerativeModel {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const client = getClient();

  return client.getGenerativeModel({
    model: mergedConfig.model,
    generationConfig: {
      maxOutputTokens: mergedConfig.maxTokens,
      temperature: mergedConfig.temperature,
    },
    systemInstruction: SYSTEM_PROMPT,
  });
}

/**
 * Build the user prompt with retrieved context
 */
export function buildPrompt(question: string, chunks: Chunk[], topK: number): string {
  let contextSection = '';

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    contextSection += `[Chunk ${i + 1} | chunkId=${chunk.id} | page ${chunk.pageNumber}]\n`;
    contextSection += `"${chunk.text}"\n---\n\n`;
  }

  return `User question:
${question}

Retrieved context (up to ${topK} chunks):
${contextSection}
Instructions:
- Use the context above.
- Include citations like (page {pageNumber}, chunk {chunkId}).
- If not in the document, say: "I don't see this in the uploaded document."`;
}

/**
 * Extract citations from response text
 */
export function extractCitations(text: string, chunks: Chunk[]): Citation[] {
  const citations: Citation[] = [];
  const seen = new Set<string>();

  // Match citation patterns like (page X, chunk Y) or (page X, chunk ch_abc123)
  const citationPattern = /\(page\s*(\d+),?\s*chunk\s*(ch_[\w]+|\d+)\)/gi;
  let match;

  while ((match = citationPattern.exec(text)) !== null) {
    const pageNumber = parseInt(match[1], 10);
    const chunkRef = match[2];

    // Find the corresponding chunk
    const chunk = chunks.find((c) => c.id === chunkRef || c.pageNumber === pageNumber);

    if (chunk) {
      const key = `${chunk.id}-${chunk.pageNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        citations.push({
          chunkId: chunk.id,
          pageNumber: chunk.pageNumber,
          text: chunk.text.slice(0, 100) + (chunk.text.length > 100 ? '...' : ''),
        });
      }
    }
  }

  // If no citations found in text, include chunks used as context
  if (citations.length === 0) {
    for (const chunk of chunks.slice(0, 3)) {
      citations.push({
        chunkId: chunk.id,
        pageNumber: chunk.pageNumber,
        text: chunk.text.slice(0, 100) + (chunk.text.length > 100 ? '...' : ''),
      });
    }
  }

  return citations;
}

/**
 * Ask a question with context and return a streaming response
 */
export async function* askWithContext(
  question: string,
  chunks: Chunk[],
  config: Partial<LLMConfig> = {}
): AsyncGenerator<{ text: string; done: boolean; citations?: Citation[] }> {
  const model = getModel(config);
  const prompt = buildPrompt(question, chunks, chunks.length);

  try {
    const result = await model.generateContentStream(prompt);
    let fullText = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullText += chunkText;
        yield { text: chunkText, done: false };
      }
    }

    // Extract and yield citations at the end
    const citations = extractCitations(fullText, chunks);
    yield { text: '', done: true, citations };
  } catch (error) {
    console.error(
      '[LLM] Error generating response:',
      error instanceof Error ? error.message : error
    );
    throw new Error(
      `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Ask a question with context and return a complete response (non-streaming)
 */
export async function askWithContextSync(
  question: string,
  chunks: Chunk[],
  config: Partial<LLMConfig> = {}
): Promise<{ text: string; citations: Citation[] }> {
  const model = getModel(config);
  const prompt = buildPrompt(question, chunks, chunks.length);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const citations = extractCitations(text, chunks);

    return { text, citations };
  } catch (error) {
    console.error(
      '[LLM] Error generating response:',
      error instanceof Error ? error.message : error
    );
    throw new Error(
      `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if the model is available
 */
export function isModelConfigured(): boolean {
  return !!process.env.GOOGLE_API_KEY;
}
/**
 * List all available models from Google Generative AI
 */
export async function listAvailableModels(): Promise<
  Array<{
    displayName: string;
    name: string;
    description: string;
    version: string;
    supportedGenerationMethods: string[];
    temperature?: number;
    topP?: number;
    topK?: number;
  }>
> {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
    }

    // Use Google's REST API to list models
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    // Transform the results to a simpler format
    return (data.models || [])
      .map((model: any) => ({
        displayName: model.displayName || model.name,
        name: model.name.split('/').pop() || model.name, // Extract model name from "models/gemini-1.5-flash"
        description: model.description || '',
        version: model.version || '',
        supportedGenerationMethods: model.supportedGenerationMethods || [],
        temperature: model.temperature,
        topP: model.topP,
        topK: model.topK,
      }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('[LLM] Failed to list models:', error);
    throw new Error(
      `Failed to list available models: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
