import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { generateReply } from '@/lib/claude';

export const dynamic = 'force-dynamic';

// CORS headers for extension access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Direct reply generation for extension v2 - doesn't require tweet in database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tweet, authorHandle, count = 3 } = body;

    if (!tweet) {
      return NextResponse.json({ error: 'Tweet text is required' }, { status: 400, headers: corsHeaders });
    }

    // Get active voice profile if any
    const supabase = createServiceClient();
    const { data: activeVoice } = await supabase
      .from('style_profiles')
      .select('style_prompt')
      .eq('active', true)
      .single();

    const stylePrompt = activeVoice?.style_prompt || undefined;

    // Generate replies with Claude
    const replies = await generateReply(tweet, authorHandle || 'unknown', stylePrompt, count);

    return NextResponse.json({ replies, reply: replies[0] }, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error';
    console.error('Generate direct error:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
