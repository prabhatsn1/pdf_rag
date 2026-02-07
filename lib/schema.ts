// lib/schema.ts
// Zod validation schemas for API routes

import { z } from 'zod';

// Upload endpoint validation
export const uploadFileSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.type === 'application/pdf', { message: 'Only PDF files are allowed' })
    .refine(
      (file) => file.size <= 20 * 1024 * 1024, // 20MB
      { message: 'File size must be less than 20MB' }
    ),
});

// Chat endpoint validation
export const chatRequestSchema = z.object({
  docId: z.string().min(1, 'Document ID is required'),
  question: z.string().min(1, 'Question is required').max(2000, 'Question too long'),
  topK: z.number().int().min(1).max(20).optional().default(8),
});

// Chunk metadata schema
export const chunkMetadataSchema = z.object({
  id: z.string(),
  docId: z.string(),
  text: z.string(),
  pageNumber: z.number().int().positive(),
  charStart: z.number().int().nonnegative(),
  charEnd: z.number().int().positive(),
});

// Upload response schema
export const uploadResponseSchema = z.object({
  docId: z.string(),
  chunkCount: z.number().int().nonnegative(),
});

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

// Environment variables schema
export const envSchema = z.object({
  GOOGLE_API_KEY: z.string().min(1, 'Google API key is required'),
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX: z.string().optional(),
  PINECONE_ENV: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
});

// Type exports from schemas
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
export type UploadResponseOutput = z.infer<typeof uploadResponseSchema>;
export type ErrorResponseOutput = z.infer<typeof errorResponseSchema>;
