import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { generateVariations } from '@/lib/claude';
import { getSession } from '@/lib/sessions';

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
    const { tweet, currentReply, tweetId, count = 3 } = body;

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

    // Check if there's a session with images (for logging/future use)
    const session = tweetId ? getSession(tweetId) : undefined;
    if (session?.images?.length) {
      console.log(`Variations for tweet ${tweetId} - session has ${session.images.length} images (text-only variations)`);
    }

    // Generate text-only variations
    // Note: For now, variations don't use images - they just rephrase the existing reply
    // The user can always press G again for image-aware fresh replies
    const replies = await generateVariations(tweet, currentReply, stylePrompt, count);

    return NextResponse.json({ replies }, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error';
    console.error('Variations error:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
