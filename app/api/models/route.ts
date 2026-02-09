// app/api/models/route.ts
// API endpoint to list available models from Google Generative AI

import { NextRequest, NextResponse } from 'next/server';
import { listAvailableModels } from '@/lib/llm';

export async function GET(request: NextRequest) {
  try {
    const models = await listAvailableModels();

    return NextResponse.json({
      success: true,
      count: models.length,
      models,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Models API] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        message: `Failed to fetch models: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
