// lib/embeddings.ts
// Google Embeddings client using text-embedding-004

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EmbeddingResult } from './types';

const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSION = 768; // text-embedding-004 dimension
const MAX_BATCH_SIZE = 100; // Max texts per batch request
const RATE_LIMIT_DELAY = 100; // ms between batches
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

let genAI: GoogleGenerativeAI | null = null;

/**
 * Initialize the Google AI client
 */
function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set. ' +
          'Please add it to your .env file.'
      );
    }

    // Validate API key format (should start with "AIza")
    if (!apiKey.startsWith('AIza')) {
      console.warn(
        '[Embeddings] Warning: API key format may be invalid (should start with "AIza")'
      );
    }

    console.log(
      `[Embeddings] Initializing Google AI client with API key: ${apiKey.substring(0, 8)}...`
    );
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get embedding for a single text with retry logic
 */
export async function embedText(text: string): Promise<EmbeddingResult> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Embeddings] Attempting to embed text (attempt ${attempt}/${MAX_RETRIES})...`);

      const result = await model.embedContent(text);

      if (!result.embedding || !result.embedding.values) {
        throw new Error('Invalid response from API: missing embedding values');
      }

      console.log(
        `[Embeddings] Successfully embedded text (${result.embedding.values.length} dimensions)`
      );

      return {
        vector: result.embedding.values,
      };
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`[Embeddings] Attempt ${attempt}/${MAX_RETRIES} failed:`, errorMessage);

      // Don't retry on authentication errors or invalid key errors
      if (
        errorMessage.includes('API_KEY_INVALID') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403')
      ) {
        console.error(
          '[Embeddings] API key error detected. Please verify your GOOGLE_GENERATIVE_AI_API_KEY in .env file.'
        );
        break;
      }

      // Exponential backoff for retries
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`[Embeddings] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries failed
  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Failed to embed text after ${MAX_RETRIES} attempts: ${errorMsg}. ` +
      'Please check your internet connection and API key.'
  );
}

/**
 * Get embeddings for multiple texts in batches with retry logic
 */
export async function embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) {
    return [];
  }

  console.log(`[Embeddings] Starting batch embedding for ${texts.length} texts...`);

  const client = getClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });
  const results: EmbeddingResult[] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const batchNum = Math.floor(i / MAX_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(texts.length / MAX_BATCH_SIZE);

    console.log(
      `[Embeddings] Processing batch ${batchNum}/${totalBatches} (${batch.length} texts)...`
    );

    let lastError: Error | unknown;
    let batchSuccess = false;

    // Retry logic for each batch
    for (let attempt = 1; attempt <= MAX_RETRIES && !batchSuccess; attempt++) {
      try {
        if (attempt > 1) {
          console.log(
            `[Embeddings] Retrying batch ${batchNum} (attempt ${attempt}/${MAX_RETRIES})...`
          );
        }

        // Process batch with Promise.all
        const batchResults = await Promise.all(
          batch.map(async (text, idx) => {
            try {
              const result = await model.embedContent(text);

              if (!result.embedding || !result.embedding.values) {
                throw new Error(`Invalid response for text ${idx}: missing embedding values`);
              }

              return {
                vector: result.embedding.values,
              };
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.error(`[Embeddings] Failed to embed text ${i + idx}:`, errorMsg);
              throw error;
            }
          })
        );

        results.push(...batchResults);
        batchSuccess = true;
        console.log(`[Embeddings] Batch ${batchNum}/${totalBatches} completed successfully`);
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error(
          `[Embeddings] Batch ${batchNum} attempt ${attempt}/${MAX_RETRIES} failed:`,
          errorMessage
        );

        // Don't retry on authentication errors
        if (
          errorMessage.includes('API_KEY_INVALID') ||
          errorMessage.includes('401') ||
          errorMessage.includes('403')
        ) {
          console.error(
            '[Embeddings] API key error detected. Please verify your GOOGLE_GENERATIVE_AI_API_KEY in .env file.'
          );
          throw new Error(
            `Authentication failed: ${errorMessage}. Please check your API key in .env file.`
          );
        }

        // Exponential backoff for retries
        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
          console.log(`[Embeddings] Waiting ${delay}ms before retry...`);
          await sleep(delay);
        }
      }
    }

    // If batch failed after all retries
    if (!batchSuccess) {
      const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(
        `Failed to embed batch ${batchNum}/${totalBatches} after ${MAX_RETRIES} attempts: ${errorMsg}. ` +
          'Please check your internet connection and API key.'
      );
    }

    // Rate limiting between batches
    if (i + MAX_BATCH_SIZE < texts.length) {
      await sleep(RATE_LIMIT_DELAY);
    }
  }

  console.log(`[Embeddings] Successfully embedded ${results.length} texts`);
  return results;
}

/**
 * Get embeddings for query text (same as embedText but semantically distinct)
 */
export async function embedQuery(query: string): Promise<number[]> {
  const result = await embedText(query);
  return result.vector;
}

/**
 * Get the embedding dimension for the model
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIMENSION;
}

/**
 * Validate that a vector has the correct dimension
 */
export function validateVector(vector: number[]): boolean {
  return vector.length === EMBEDDING_DIMENSION;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}
