// app/api/health/route.ts
// Health check endpoint to verify Gemini API connection

import { NextRequest, NextResponse } from 'next/server';
import { testConnection } from '@/lib/embeddings';

export async function GET(request: NextRequest) {
  try {
    const result = await testConnection();

    const statusCode = result.success ? 200 : 503;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Health Check] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        message: `Health check failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
