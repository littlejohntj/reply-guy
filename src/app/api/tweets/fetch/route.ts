import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getUserTweets } from '@/lib/scrapecreators';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = createServiceClient();

    // Get all tracked profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: 'No profiles to fetch tweets for' });
    }

    const results = {
      fetched: 0,
      filtered: 0,
      errors: [] as string[],
      byProfile: {} as Record<string, number>,
    };

    // Pick 5 random profiles and fetch in PARALLEL
    const shuffled = [...profiles].sort(() => Math.random() - 0.5);
    const profilesToFetch = shuffled.slice(0, 5);

    // Fetch all profiles in parallel
    const fetchPromises = profilesToFetch.map(async (profile) => {
      try {
        const tweetsResponse = await getUserTweets(profile.twitter_handle, {
          limit: 10,
          includeReplies: false,
        });

        // Filter to recent tweets (last 7 days)
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const recentTweets = (tweetsResponse.data || [])
          .filter(tweet => {
            const tweetDate = new Date(tweet.created_at).getTime();
            return tweetDate > sevenDaysAgo;
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return { profile, tweets: recentTweets, error: null };
      } catch (err) {
        return { profile, tweets: [], error: err instanceof Error ? err.message : 'Unknown error' };
      }
    });

    const fetchResults = await Promise.all(fetchPromises);

    // Process results and insert tweets
    for (const { profile, tweets, error } of fetchResults) {
      if (error) {
        results.errors.push(`Fetch error for @${profile.twitter_handle}: ${error}`);
        continue;
      }

      let profileFetched = 0;

      for (const tweet of tweets) {
        // Check if tweet already exists
        const { data: existing } = await supabase
          .from('tweets')
          .select('id')
          .eq('tweet_id', tweet.id)
          .single();

        if (existing) continue;

        // Insert tweet
        const { error: insertError } = await supabase.from('tweets').insert({
          tweet_id: tweet.id,
          profile_id: profile.id,
          content: tweet.text,
          author_handle: tweet.author?.screen_name || profile.twitter_handle,
          author_name: tweet.author?.name || profile.display_name,
          author_avatar: tweet.author?.profile_image_url,
          tweet_url: tweet.url || `https://x.com/${profile.twitter_handle}/status/${tweet.id}`,
          posted_at: new Date(tweet.created_at).toISOString(),
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          replies: tweet.public_metrics?.reply_count || 0,
          filter_status: 'show',
          filter_category: 'engage',
          replied: false,
        });

        if (insertError) {
          results.errors.push(`Insert error for ${tweet.id}: ${insertError.message}`);
        } else {
          results.fetched++;
          profileFetched++;
          results.filtered++;
        }
      }

      results.byProfile[profile.twitter_handle] = profileFetched;
    }

    // Get total tweet counts per profile
    const { data: tweetCounts } = await supabase
      .from('tweets')
      .select('author_handle')
      .eq('replied', false)
      .neq('filter_status', 'skip');

    const countsByHandle: Record<string, number> = {};
    for (const t of tweetCounts || []) {
      countsByHandle[t.author_handle] = (countsByHandle[t.author_handle] || 0) + 1;
    }

    return NextResponse.json({ ...results, tweetCounts: countsByHandle });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
