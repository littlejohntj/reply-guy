import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getUserTweets } from '@/lib/scrapecreators';
import { analyzeWritingStyle } from '@/lib/claude';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const { handle, description } = body;

    if (!handle) {
      return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
    }

    // Fetch lots of tweets for better voice analysis
    const tweetsResponse = await getUserTweets(handle, { limit: 500 });
    const tweets = tweetsResponse.data || [];

    if (tweets.length === 0) {
      return NextResponse.json({ error: 'Could not fetch tweets for this handle' }, { status: 400 });
    }

    // Extract tweet texts - filter out retweets, replies, and short tweets
    const tweetTexts = tweets
      .map(t => t.text)
      .filter(t => t && !t.startsWith('RT @') && !t.startsWith('@') && t.length > 50)
      .slice(0, 100);

    if (tweetTexts.length < 3) {
      return NextResponse.json({ error: 'Not enough original tweets to analyze' }, { status: 400 });
    }

    // Analyze writing style with Claude
    const baseStylePrompt = await analyzeWritingStyle(tweetTexts);

    // Combine with user's description of what they like
    const stylePrompt = description
      ? `${baseStylePrompt}\n\nAdditional style preferences from user:\n${description}`
      : baseStylePrompt;

    // Save the voice profile
    const { data: profile, error } = await supabase
      .from('style_profiles')
      .insert({
        name: `@${handle} style`,
        source_handle: handle,
        sample_tweets: tweetTexts,
        style_prompt: stylePrompt,
        active: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to analyze voice';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
