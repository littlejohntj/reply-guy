import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getHomeTimeline } from '@/lib/twitter-feed';
import { filterTweet } from '@/lib/claude';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'for-you';
    const cursor = searchParams.get('cursor') || undefined;

    const authToken = process.env.TWITTER_AUTH_TOKEN;
    const ct0 = process.env.TWITTER_CT0;

    if (!authToken || !ct0) {
      return NextResponse.json({
        error: 'Twitter not configured. Add TWITTER_AUTH_TOKEN and TWITTER_CT0 to .env.local',
        needsAuth: true,
        tweets: []
      }, { status: 401 });
    }

    const cookies = { auth_token: authToken, ct0 };

    // Fetch from the appropriate timeline
    const result = await getHomeTimeline(
      cookies,
      source === 'following' ? 'following' : 'for-you',
      cursor
    );

    // Transform to our format and return
    const tweets = result.tweets.map(t => ({
      id: t.id,
      tweet_id: t.id,
      content: t.text,
      author_handle: t.author.screen_name,
      author_name: t.author.name,
      author_avatar: t.author.profile_image_url,
      tweet_url: t.url,
      posted_at: new Date(t.created_at).toISOString(),
      likes: t.metrics.likes,
      retweets: t.metrics.retweets,
      replies: t.metrics.replies,
      filter_status: 'pending',
      filter_category: null,
      replied: false,
    }));

    return NextResponse.json({
      tweets,
      cursor: result.cursor,
      source
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch feed';
    return NextResponse.json({ error: message, tweets: [] }, { status: 500 });
  }
}

// Store tweets from feed to database
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { source = 'for-you' } = body;

    const authToken = process.env.TWITTER_AUTH_TOKEN;
    const ct0 = process.env.TWITTER_CT0;

    if (!authToken || !ct0) {
      return NextResponse.json({
        error: 'Twitter not configured',
        fetched: 0
      }, { status: 500 });
    }

    const cookies = { auth_token: authToken, ct0 };

    // Fetch timeline
    const result = await getHomeTimeline(
      cookies,
      source === 'following' ? 'following' : 'for-you'
    );

    let fetched = 0;
    let filtered = 0;

    for (const tweet of result.tweets) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('tweets')
        .select('id')
        .eq('tweet_id', tweet.id)
        .single();

      if (existing) continue;

      // Filter with Claude
      let filterResult = { shouldShow: true, category: 'engage', reason: 'Default' };
      try {
        filterResult = await filterTweet(tweet.text, tweet.author.screen_name);
      } catch (e) {
        console.error('Filter error:', e);
      }

      // Insert
      const { error } = await supabase.from('tweets').insert({
        tweet_id: tweet.id,
        content: tweet.text,
        author_handle: tweet.author.screen_name,
        author_name: tweet.author.name,
        author_avatar: tweet.author.profile_image_url,
        tweet_url: tweet.url,
        posted_at: tweet.created_at ? new Date(tweet.created_at).toISOString() : new Date().toISOString(),
        likes: tweet.metrics.likes,
        retweets: tweet.metrics.retweets,
        replies: tweet.metrics.replies,
        filter_status: filterResult.shouldShow ? 'show' : 'skip',
        filter_category: filterResult.category,
        replied: false,
      });

      if (!error) {
        fetched++;
        if (filterResult.shouldShow) filtered++;
      }
    }

    return NextResponse.json({ fetched, filtered, source });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch feed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
