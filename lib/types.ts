// lib/types.ts
// Shared types for the PDF RAG application

export type DocId = string;
export type ChunkId = string;

export interface PageContent {
  pageNumber: number;
  text: string;
}

export interface Chunk {
  id: ChunkId;
  docId: DocId;
  text: string;
  pageNumber: number;
  charStart: number;
  charEnd: number;
}

export interface ChunkWithVector extends Chunk {
  vector: number[];
}

export interface RetrieveResult {
  chunks: Chunk[];
  scores: number[]; // similarity scores aligned with chunks
}

export interface UploadResponse {
  docId: DocId;
  chunkCount: number;
}

export interface ChatRequest {
  docId: DocId;
  question: string;
  topK?: number;
}

export interface Citation {
  chunkId: ChunkId;
  pageNumber: number;
  text?: string;
}

export interface ChatChunkDelta {
  type: 'text' | 'citation' | 'done' | 'error';
  text?: string;
  citations?: Citation[];
  error?: string;
}

export interface VectorStoreConfig {
  type: 'memory' | 'pinecone';
  pineconeApiKey?: string;
  pineconeIndex?: string;
  pineconeEnvironment?: string;
}

export interface EmbeddingResult {
  vector: number[];
  tokenCount?: number;
}

export interface LLMConfig {
  model: string; // Can be any model name, configurable via GOOGLE_LLM_MODEL env var
  maxTokens?: number;
  temperature?: number;
}

export interface DocumentMetadata {
  docId: DocId;
  filename: string;
  uploadedAt: Date;
  pageCount: number;
  chunkCount: number;
}
