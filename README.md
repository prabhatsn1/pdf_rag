# PDF RAG Chat

A full-stack Next.js application that allows you to upload PDF documents and chat with them using AI. Get answers grounded in your documents with citations, powered by Google Gemini.

## Features

- **PDF Upload**: Drag-and-drop or click to upload PDF files (max 20MB)
- **Smart Chunking**: Automatic text extraction and chunking with overlap for better context
- **Vector Search**: Semantic search using Google's text-embedding-004 model
- **AI Chat**: Ask questions and get answers grounded in your document with citations
- **Streaming Responses**: Real-time streaming of AI responses
- **Citations**: Every answer includes page and chunk references
- **Dark Mode**: Automatic dark mode support

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **AI**: Google Gemini (gemini-1.5-flash / gemini-1.5-pro)
- **Embeddings**: Google text-embedding-004 (768 dimensions)
- **Vector Store**: In-memory (dev) / Pinecone (prod)
- **Styling**: Tailwind CSS
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js 20.16.0+ or 22.3.0+
- A Google AI API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

1. Clone the repository:

   ```bash
   git clone <repo-url>
   cd pdf_rag
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory:

   ```env
   # Google AI API Key (required)
   GOOGLE_API_KEY=your_google_api_key_here

   # Pinecone Configuration (optional - for production)
   # PINECONE_API_KEY=your_pinecone_api_key_here
   # PINECONE_INDEX=pdf-rag
   # PINECONE_ENV=us-east-1

   # App Configuration
   NODE_ENV=development
   ```

4. Run the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload a PDF**: Drag and drop a PDF file into the upload area, or click to select one.
2. **Wait for processing**: The app will extract text, create chunks, and generate embeddings.
3. **Start chatting**: Ask questions about your document in the chat interface.
4. **View citations**: Each answer includes references to specific pages and chunks.

### Example Questions

- "Give me a 3-bullet executive summary. Cite pages."
- "What are the key risks and mitigations mentioned?"
- "List all dates mentioned and what they refer to."
- "Which section defines the SLAs? Provide page and short quote."

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # Chat endpoint with streaming
│   │   └── upload/route.ts    # PDF upload and processing
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Main UI
├── components/
│   ├── Chat.tsx               # Chat interface
│   ├── Citation.tsx           # Citation display
│   ├── Message.tsx            # Chat message
│   └── UploadDropzone.tsx     # File upload
├── lib/
│   ├── chunk.ts               # Text chunking
│   ├── embeddings.ts          # Google embeddings
│   ├── llm.ts                 # Gemini client
│   ├── pdf.ts                 # PDF parsing
│   ├── retriever.ts           # Vector search
│   ├── schema.ts              # Zod schemas
│   ├── types.ts               # TypeScript types
│   └── vectorstore/
│       ├── index.ts           # Store abstraction
│       ├── memory.ts          # In-memory store
│       └── pinecone.ts        # Pinecone store
├── tests/
│   ├── api-chat.test.ts
│   ├── api-upload.test.ts
│   ├── chunk.test.ts
│   └── retriever.test.ts
└── ...config files
```

## API Reference

### POST /api/upload

Upload a PDF file for processing.

**Request**: `multipart/form-data` with `file` field (PDF, max 20MB)

**Response**:

```json
{
  "docId": "doc_abc123",
  "chunkCount": 42
}
```

### POST /api/chat

Ask a question about an uploaded document.

**Request**:

```json
{
  "docId": "doc_abc123",
  "question": "What is this document about?",
  "topK": 8
}
```

**Response**: Server-Sent Events (SSE) stream with:

- `type: "text"` - Text chunks of the response
- `type: "done"` - End of response with citations
- `type: "error"` - Error message

## Configuration

### Environment Variables

| Variable           | Required | Description                       |
| ------------------ | -------- | --------------------------------- |
| `GOOGLE_API_KEY`   | Yes      | Google AI API key                 |
| `PINECONE_API_KEY` | No       | Pinecone API key (for production) |
| `PINECONE_INDEX`   | No       | Pinecone index name               |
| `PINECONE_ENV`     | No       | Pinecone environment              |
| `NODE_ENV`         | No       | development / production          |

### Chunking Options

Default chunking configuration (can be modified in `app/api/upload/route.ts`):

- **Chunk Size**: 1200 characters
- **Chunk Overlap**: 180 characters
- **Min Chunk Size**: 100 characters

### LLM Configuration

The app supports two Gemini models:

- `gemini-1.5-flash` (default) - Fast responses
- `gemini-1.5-pro` - Higher quality responses

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run format:check # Check formatting
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage
```

## Deployment

### Vercel

This app is compatible with Vercel deployment:

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in the Vercel dashboard
4. Deploy

**Note**: The API routes use `runtime = 'nodejs'` for PDF parsing compatibility.

### Production Vector Store

For production deployments, enable Pinecone:

1. Create a Pinecone account and index
2. Set the index dimension to **768** (must match text-embedding-004)
3. Add Pinecone environment variables
4. The app will automatically use Pinecone when configured

## Limitations

- **OCR**: Scanned PDFs (images only) are not supported. Text must be extractable.
- **File Size**: Maximum 20MB per file
- **Timeout**: Serverless function timeout may affect very large PDFs
- **Single Document**: Current implementation supports one document at a time per session

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:run`
5. Submit a pull request

## License

MIT
