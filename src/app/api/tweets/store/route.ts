import { NextRequest, NextResponse } from 'next/server';
import { storeTweets, StoredTweet } from '@/lib/sqlite';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tweets } = body as { tweets: StoredTweet[] };

    if (!tweets || !Array.isArray(tweets)) {
      return NextResponse.json(
        { error: 'tweets array is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = storeTweets(tweets);

    return NextResponse.json({
      success: true,
      stored: result.stored
    }, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Store error';
    console.error('Store tweets error:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
