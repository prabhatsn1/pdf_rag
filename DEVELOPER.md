# Developer Guide: RAG Implementation

This document explains the technical implementation of the Retrieval-Augmented Generation (RAG) system built with Next.js, Google Gemini, and TypeScript.

## Architecture Overview

```
PDF Upload → Parse → Chunk → Embed → Vector Store
                                           ↓
User Question → Embed → Retrieve → LLM Context → Streaming Response
```

## Core Components

### 1. PDF Processing (`lib/pdf.ts`)

**Technology**: `pdf-parse` v2 with class-based API

```typescript
const parser = new PDFParse(buffer);
const result = await parser.parse();
// result.text: full text
// result.info.total: page count
```

**Key Functions**:
- `parsePDF(buffer)`: Extracts text per page, returns `PageContent[]`
- `getPageCount(buffer)`: Quick page count without full parse
- `validatePDFBuffer(buffer)`: Checks PDF validity

**Implementation Detail**: Pages are extracted individually to preserve metadata for citations. Each chunk knows its source page number.

### 2. Text Chunking (`lib/chunk.ts`)

**Algorithm**: Recursive Character Text Splitter

```typescript
chunkPages(pages, docId, {
  chunkSize: 1200,        // Target size
  chunkOverlap: 180,      // Overlap between chunks
  minChunkSize: 100       // Minimum valid chunk
})
```

**Splitting Hierarchy**:
1. **Section splits** (`\n\n\n+`): Major document sections
2. **Paragraph splits** (`\n\n+`): Paragraph boundaries
3. **Sentence splits** (`[.!?]\s+`): Individual sentences
4. **Character splits**: Last resort fallback

**Output Format**:
```typescript
{
  id: 'chunk_uuid',
  docId: 'doc_uuid',
  text: 'chunk content...',
  page: 2,
  index: 5
}
```

**Why Overlap?**: Prevents context loss at chunk boundaries. A question about content spanning two chunks can still retrieve relevant context.

### 3. Embeddings (`lib/embeddings.ts`)

**Model**: Google `text-embedding-004` (768 dimensions)

**API Usage**:
```typescript
const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
const result = await model.embedContent(text);
const vector = result.embedding.values; // Float32Array[768]
```

**Batch Processing**:
```typescript
embedTexts(['chunk1', 'chunk2', ...])
// → Promise<number[][]>
```

**Similarity Function**:
```typescript
cosineSimilarity(vecA, vecB)
// → 0.0 to 1.0 (higher = more similar)
```

**Implementation Note**: Embeddings are cached in the vector store. Query embeddings are generated separately using `embedQuery()`.

### 4. Vector Storage

#### Memory Store (`lib/vectorstore/memory.ts`)

**Data Structure**:
```typescript
Map<ChunkId, {
  id: ChunkId,
  docId: DocId,
  vector: number[],
  metadata: {
    text: string,
    page: number,
    index: number
  }
}>
```

**Query Process**:
1. Calculate cosine similarity with all vectors
2. Sort by score (descending)
3. Filter by `scoreThreshold` (default: 0.2)
4. Return top-k results (default: 8)

**MMR (Maximal Marginal Relevance)**:
```typescript
queryWithMMR(query, topK, lambda = 0.7)
// lambda: balance between relevance (1.0) and diversity (0.0)
// Iteratively selects chunks that are relevant but dissimilar to already-selected ones
```

#### Pinecone Store (`lib/vectorstore/pinecone.ts`)

**Initialization**:
```typescript
const pc = new Pinecone({ apiKey });
const index = pc.index(indexName);
```

**Upsert Format** (SDK v7):
```typescript
await index.namespace(docId).upsert({
  records: [{
    id: chunkId,
    values: vector,
    metadata: { text, page, index }
  }]
});
```

**Query**:
```typescript
await index.namespace(docId).query({
  vector: queryVector,
  topK: 8,
  includeMetadata: true
});
```

**Namespace Strategy**: Each document gets its own namespace for isolation and efficient deletion.

### 5. Retrieval (`lib/retriever.ts`)

**Main Function**:
```typescript
retrieve(query, docId, {
  topK = 8,
  scoreThreshold = 0.2,
  useMMR = true,
  mmrLambda = 0.7
})
```

**Flow**:
1. Check if document exists: `hasDoc(docId)`
2. Embed the query: `embedQuery(query)`
3. Search vectors: MMR or similarity search
4. Filter by score threshold
5. Return chunks with scores

**Score Interpretation**:
- `> 0.7`: Highly relevant
- `0.4 - 0.7`: Moderately relevant
- `0.2 - 0.4`: Weakly relevant
- `< 0.2`: Filtered out

**MMR Benefits**:
- Reduces redundancy in retrieved chunks
- Improves answer diversity
- Better for complex questions spanning multiple topics

### 6. LLM Integration (`lib/llm.ts`)

**Model**: Google Gemini (`gemini-1.5-flash` default, `gemini-1.5-pro` optional)

**System Prompt**:
```typescript
const systemPrompt = `You are a helpful assistant answering questions based on document content.

CRITICAL RULES:
1. Answer ONLY using provided document content
2. For EVERY fact, cite the chunk ID: {{chunk_abc123}}
3. If information is not in the document, say "I don't have that information"
4. Do not make assumptions or use external knowledge`;
```

**Context Construction**:
```typescript
function buildPrompt(question, chunks) {
  const context = chunks.map((chunk, i) => 
    `[Chunk ${i + 1} - ID: ${chunk.id}]\n${chunk.text}`
  ).join('\n\n---\n\n');
  
  return `${context}\n\nQuestion: ${question}`;
}
```

**Streaming Response**:
```typescript
async function* askWithContext(question, chunks) {
  const result = await model.generateContentStream(prompt);
  
  for await (const chunk of result.stream) {
    const text = chunk.text();
    yield { text, done: false };
  }
  
  yield { text: '', done: true };
}
```

**Citation Extraction**:
```typescript
// Pattern: {{chunk_uuid}}
const citationPattern = /\{\{(chunk_[a-f0-9-]+)\}\}/g;
```

### 7. API Routes

#### Upload Route (`app/api/upload/route.ts`)

**Flow**:
```typescript
1. Parse FormData → File
2. Validate file (PDF, max 20MB)
3. Convert to Buffer
4. parsePDF(buffer) → PageContent[]
5. chunkPages(pages, docId) → Chunk[]
6. embedTexts(chunks.map(c => c.text)) → number[][]
7. vectorStore.upsert(chunks, vectors)
8. Return { docId, chunkCount }
```

**Error Handling**:
- No file: 400 "No file uploaded"
- Wrong type: 400 "File must be a PDF"
- Too large: 400 "File must be less than 20MB"
- Parse error: 500 with details

#### Chat Route (`app/api/chat/route.ts`)

**Flow**:
```typescript
1. Validate request: { docId, question, topK? }
2. Check document exists
3. retrieve(question, docId, topK)
4. If no results: Return "no relevant content" message
5. askWithContext(question, chunks) → Stream
6. Parse citations from chunks
7. Stream SSE with { text, citations }
```

**SSE Format**:
```typescript
// Data chunk
data: {"text":"partial answer...","done":false}\n\n

// Citations
data: {"citations":[{"id":"chunk_x","text":"...","page":1}]}\n\n

// Complete
data: {"done":true}\n\n
```

**Concurrent Requests**: Each request is independent. Multiple users can chat simultaneously.

## Frontend Components

### UploadDropzone (`components/UploadDropzone.tsx`)

**Library**: `react-dropzone`

**Features**:
- Drag & drop
- Click to browse
- PDF-only validation
- 20MB size limit
- Upload progress

**API Call**:
```typescript
const formData = new FormData();
formData.append('file', file);

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});
```

### Chat Component (`components/Chat.tsx`)

**State Management**:
```typescript
const [messages, setMessages] = useState<DisplayMessage[]>([]);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
```

**Streaming Handler**:
```typescript
const reader = response.body!.getReader();
const decoder = new TextDecoder();

let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      // Update UI with data.text or data.citations
    }
  }
}
```

**Auto-scroll**: Uses `useEffect` with ref to scroll to bottom on new messages.

## Testing Strategy

### Unit Tests (`tests/chunk.test.ts`, `tests/retriever.test.ts`)

**Mocking**:
```typescript
vi.mock('../lib/embeddings', () => ({
  embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, ...]),
  embedTexts: vi.fn().mockResolvedValue([[0.1, ...], [0.2, ...]])
}));
```

**Test Cases**:
- Chunk splitting at different separators
- Overlap validation
- Retrieval with various topK values
- MMR vs regular query
- Score threshold filtering

### Integration Tests (`tests/api-*.test.ts`)

**Request Mocking**:
```typescript
const request = new Request('http://localhost/api/upload', {
  method: 'POST',
  body: formData
});

const { POST } = await import('../app/api/upload/route');
const response = await POST(request as any);
```

**Validation Tests**:
- Missing file/parameters
- Invalid file types
- Size limits
- Non-existent documents

**Mock PDF Generation**:
```typescript
const mockPDFBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj...'
);
```

## Environment Configuration

### Required Variables

```bash
# Production
GOOGLE_GENERATIVE_AI_API_KEY=AIza...  # Required
PINECONE_API_KEY=pcsk_...              # Optional (uses memory store if not set)
PINECONE_INDEX_NAME=rag-app            # Required if Pinecone is used

# Development
NODE_ENV=development                    # Defaults to memory store
```

### Vector Store Selection Logic

```typescript
// lib/vectorstore/index.ts
if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX_NAME) {
  return await createPineconeStore();
} else {
  return createMemoryStore();
}
```

## Performance Considerations

### Chunking Performance
- **1000 pages**: ~2-3 seconds
- **Bottleneck**: Regex splitting
- **Optimization**: Could parallelize per-page chunking

### Embedding Performance
- **Rate Limit**: 1500 requests/minute (Google API)
- **Batch Size**: 100 chunks per request
- **1000 chunks**: ~10 seconds
- **Optimization**: Batch embeddings in parallel

### Retrieval Performance
- **Memory Store**: O(n) similarity calculation
- **1000 chunks**: ~50ms
- **Pinecone**: O(log n) with indexing
- **1000 chunks**: ~100ms (network latency)

### LLM Streaming
- **Time to First Token**: ~500ms
- **Tokens per Second**: ~20-30
- **500 token response**: ~20 seconds

## Advanced Features

### Maximal Marginal Relevance (MMR)

**Formula**:
```
MMR = argmax[λ * Sim(q, d) - (1-λ) * max Sim(d, d_i)]
      d ∈ D \ S          d_i ∈ S

where:
- q: query
- d: candidate document
- S: already selected documents
- λ: trade-off parameter (0.7 default)
```

**Implementation**:
```typescript
for (let i = 0; i < topK; i++) {
  let bestScore = -Infinity;
  let bestIdx = -1;
  
  for (let j = 0; j < candidates.length; j++) {
    if (selected.has(j)) continue;
    
    const relevance = similarityScores[j];
    const maxDiversity = Math.max(
      ...selectedIndices.map(si => 
        cosineSimilarity(candidates[j].vector, candidates[si].vector)
      )
    );
    
    const mmrScore = lambda * relevance - (1 - lambda) * maxDiversity;
    if (mmrScore > bestScore) {
      bestScore = mmrScore;
      bestIdx = j;
    }
  }
  
  selected.add(bestIdx);
}
```

### Citation Preservation

**Chunk-Level Citations**:
- Each chunk maintains `{ id, docId, page, index }`
- LLM embeds chunk IDs in responses: `{{chunk_abc123}}`
- Frontend parses and displays citations

**Citation Display**:
```typescript
<Citation 
  id="chunk_abc123"
  text="The relevant excerpt..."
  page={2}
/>
```

## Deployment

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Environment Variables**: Set in Vercel dashboard under Settings → Environment Variables.

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Extending the System

### Adding New Vector Stores

1. Implement `VectorStore` interface in `lib/vectorstore/`
2. Add to `getVectorStore()` selection logic
3. Set environment variables for configuration

### Supporting Other LLMs

1. Create new file: `lib/llm-openai.ts` or `lib/llm-anthropic.ts`
2. Implement same interface: `askWithContext(question, chunks)`
3. Update `app/api/chat/route.ts` to use new LLM

### Adding Document Types

1. Create parser: `lib/docx.ts`, `lib/html.ts`
2. Output same `PageContent[]` format
3. Update upload route to handle new MIME types

## Troubleshooting

### Common Issues

**"No relevant content found"**
- Check `scoreThreshold` (default: 0.2)
- Verify embeddings are generated correctly
- Try different chunk size/overlap settings

**Slow embedding generation**
- Batch size too large (reduce from 100 to 50)
- Network latency (check Google API status)
- Consider caching embeddings

**Citations not appearing**
- Check LLM is including `{{chunk_id}}` in response
- Verify citation parsing regex: `/\{\{(chunk_[a-f0-9-]+)\}\}/g`
- Ensure frontend is receiving citation metadata

**Memory store growing too large**
- Implement TTL for documents
- Add cleanup endpoint: `DELETE /api/documents/:docId`
- Migration to Pinecone for production

## Code Quality

### Type Safety

All functions are strongly typed with TypeScript:
```typescript
export async function retrieve(
  query: string,
  docId: DocId,
  options?: RetrievalOptions
): Promise<RetrieveResult[]>
```

### Validation

All external inputs validated with Zod:
```typescript
const validation = chatRequestSchema.safeParse(body);
if (!validation.success) {
  return validation.error.issues[0].message;
}
```

### Error Handling

Consistent error response format:
```typescript
return NextResponse.json(
  { error: 'Error message', details: 'Detailed info' },
  { status: 400 }
);
```

## Monitoring & Observability

### Logging

Console logs for key operations:
```typescript
console.log('[Upload] Processing file:', filename);
console.log('[Retriever] Retrieved chunks:', chunks.length);
console.log('[Chat] Question for doc:', docId);
```

### Metrics to Track

- Upload success rate
- Average chunk count per document
- Retrieval latency
- LLM response time
- Citation accuracy

### Future Improvements

- [ ] Add structured logging (Winston/Pino)
- [ ] Implement distributed tracing
- [ ] Add Prometheus metrics endpoint
- [ ] Set up error tracking (Sentry)

---

**Last Updated**: February 6, 2026
**Version**: 1.0.0
**Maintainer**: Developer Team
