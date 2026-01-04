import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { generateReply } from '@/lib/claude';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const { tweetId, count = 1 } = body;

    if (!tweetId) {
      return NextResponse.json({ error: 'Tweet ID is required' }, { status: 400 });
    }

    // Get the tweet
    const { data: tweet, error: tweetError } = await supabase
      .from('tweets')
      .select('*')
      .eq('id', tweetId)
      .single();

    if (tweetError || !tweet) {
      return NextResponse.json({ error: 'Tweet not found' }, { status: 404 });
    }

    // Get active voice profile if any
    const { data: activeVoice } = await supabase
      .from('style_profiles')
      .select('style_prompt')
      .eq('active', true)
      .single();

    const stylePrompt = activeVoice?.style_prompt || undefined;

    // Generate reply(ies) with Claude
    const replies = await generateReply(tweet.content, tweet.author_handle, stylePrompt, count);

    // Save the first suggested reply
    await supabase
      .from('tweets')
      .update({ suggested_reply: replies[0] })
      .eq('id', tweetId);

    return NextResponse.json({ replies, reply: replies[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
