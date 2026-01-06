import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { generateVariations } from '@/lib/claude';

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
    const { tweet, currentReply, count = 3 } = body;

    if (!tweet || !currentReply) {
      return NextResponse.json(
        { error: 'Tweet and currentReply are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get active voice profile if any
    const supabase = createServiceClient();
    const { data: activeVoice } = await supabase
      .from('style_profiles')
      .select('style_prompt')
      .eq('active', true)
      .single();

    const stylePrompt = activeVoice?.style_prompt || undefined;

    const replies = await generateVariations(tweet, currentReply, stylePrompt, count);

    return NextResponse.json({ replies }, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error';
    console.error('Variations error:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
