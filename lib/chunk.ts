// lib/chunk.ts
// Recursive character text splitter with metadata tracking

import { v4 as uuidv4 } from 'uuid';
import type { Chunk, DocId, PageContent } from './types';

export interface ChunkOptions {
  chunkSize?: number; // Target chunk size in characters (default: 1200)
  chunkOverlap?: number; // Overlap between chunks (default: 180)
  minChunkSize?: number; // Minimum chunk size to keep (default: 100)
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  chunkSize: 1200,
  chunkOverlap: 180,
  minChunkSize: 100,
};

// Separators in order of preference (most to least specific)
const SEPARATORS = [
  '\n\n\n', // Section breaks
  '\n\n', // Paragraph breaks
  '\n', // Line breaks
  '. ', // Sentence endings
  '! ', // Exclamation endings
  '? ', // Question endings
  '; ', // Semicolon
  ', ', // Comma
  ' ', // Word boundaries
  '', // Character level (last resort)
];

/**
 * Split pages into chunks with metadata tracking
 */
export function chunkPages(
  pages: PageContent[],
  docId: DocId,
  options: ChunkOptions = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: Chunk[] = [];

  // Track global character offset across all pages
  let globalCharOffset = 0;

  for (const page of pages) {
    const pageChunks = splitTextRecursive(
      page.text,
      opts.chunkSize,
      opts.chunkOverlap,
      opts.minChunkSize
    );

    for (const chunkText of pageChunks) {
      // Find the character position in the page text
      const charStartInPage = page.text.indexOf(chunkText);
      const charStart = globalCharOffset + Math.max(0, charStartInPage);
      const charEnd = charStart + chunkText.length;

      chunks.push({
        id: `ch_${uuidv4().slice(0, 8)}`,
        docId,
        text: chunkText,
        pageNumber: page.pageNumber,
        charStart,
        charEnd,
      });
    }

    // Update global offset for next page
    globalCharOffset += page.text.length + 1; // +1 for page separator
  }

  return chunks;
}

/**
 * Recursive text splitter that tries to split on meaningful boundaries
 */
function splitTextRecursive(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  minChunkSize: number,
  separatorIndex: number = 0
): string[] {
  // Base case: text is small enough
  if (text.length <= chunkSize) {
    return text.trim() ? [text.trim()] : [];
  }

  // If we've exhausted all separators, split by characters
  if (separatorIndex >= SEPARATORS.length) {
    return splitByCharacters(text, chunkSize, chunkOverlap, minChunkSize);
  }

  const separator = SEPARATORS[separatorIndex];

  // If separator is empty string, split by characters
  if (separator === '') {
    return splitByCharacters(text, chunkSize, chunkOverlap, minChunkSize);
  }

  const parts = text.split(separator);

  // If no splits happened, try next separator
  if (parts.length === 1) {
    return splitTextRecursive(text, chunkSize, chunkOverlap, minChunkSize, separatorIndex + 1);
  }

  // Merge parts into chunks of appropriate size
  return mergeSplits(parts, separator, chunkSize, chunkOverlap, minChunkSize, separatorIndex);
}

/**
 * Merge split parts back together into appropriately sized chunks
 */
function mergeSplits(
  splits: string[],
  separator: string,
  chunkSize: number,
  chunkOverlap: number,
  minChunkSize: number,
  separatorIndex: number
): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  let overlapBuffer = '';

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i].trim();

    if (!split) continue;

    const potentialChunk = currentChunk
      ? currentChunk + separator + split
      : overlapBuffer + (overlapBuffer ? separator : '') + split;

    if (potentialChunk.length <= chunkSize) {
      // Add to current chunk
      currentChunk = potentialChunk;
    } else {
      // Current chunk is full
      if (currentChunk.trim() && currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk.trim());

        // Create overlap from end of current chunk
        overlapBuffer = getOverlapText(currentChunk, chunkOverlap);
      }

      // Start new chunk with current split
      if (split.length > chunkSize) {
        // This split is too large, recursively split it
        const subChunks = splitTextRecursive(
          split,
          chunkSize,
          chunkOverlap,
          minChunkSize,
          separatorIndex + 1
        );

        // Add all but the last subchunk
        for (let j = 0; j < subChunks.length - 1; j++) {
          chunks.push(subChunks[j]);
        }

        // Use the last subchunk as the new current chunk
        currentChunk = subChunks.length > 0 ? subChunks[subChunks.length - 1] : '';
        overlapBuffer = '';
      } else {
        currentChunk = overlapBuffer + (overlapBuffer ? separator : '') + split;
        overlapBuffer = '';
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim() && currentChunk.length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Split text by character count as last resort
 */
function splitByCharacters(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  minChunkSize: number
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Try to end at a word boundary
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start + chunkSize * 0.5) {
        end = lastSpace;
      }
    }

    const chunk = text.slice(start, end).trim();

    if (chunk.length >= minChunkSize) {
      chunks.push(chunk);
    }

    // Move start with overlap
    start = end - chunkOverlap;
    if (start >= text.length - minChunkSize) break;
  }

  return chunks;
}

/**
 * Extract overlap text from the end of a chunk
 */
function getOverlapText(text: string, overlapSize: number): string {
  if (text.length <= overlapSize) {
    return text;
  }

  // Try to start at a word boundary
  const startPos = text.length - overlapSize;
  const firstSpace = text.indexOf(' ', startPos);

  if (firstSpace !== -1 && firstSpace < text.length - overlapSize * 0.5) {
    return text.slice(firstSpace + 1);
  }

  return text.slice(startPos);
}

/**
 * Estimate the number of chunks that will be created
 */
export function estimateChunkCount(text: string, options: ChunkOptions = {}): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const effectiveChunkSize = opts.chunkSize - opts.chunkOverlap;
  return Math.ceil(text.length / effectiveChunkSize);
}
