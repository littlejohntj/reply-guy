// Direct Twitter GraphQL API client for home timeline
// Uses auth cookies from logged-in browser session

const TWITTER_API_BASE = 'https://twitter.com/i/api/graphql';

// These endpoint IDs change occasionally - may need updating
const ENDPOINTS = {
  HomeTimeline: 'HCosKfLNW1AcOo3la3mMgg/HomeTimeline',
  HomeLatestTimeline: 's78iC304Gj48CkIBgwsggg/HomeLatestTimeline',
};

interface TwitterCookies {
  auth_token: string;
  ct0: string; // csrf token
}

export interface TimelineTweet {
  id: string;
  text: string;
  created_at: string;
  author: {
    id: string;
    name: string;
    screen_name: string;
    profile_image_url: string;
  };
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  url: string;
}

function getHeaders(cookies: TwitterCookies): Record<string, string> {
  return {
    'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
    'cookie': `auth_token=${cookies.auth_token}; ct0=${cookies.ct0}`,
    'x-csrf-token': cookies.ct0,
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-active-user': 'yes',
    'x-twitter-client-language': 'en',
    'content-type': 'application/json',
  };
}

function extractTweetsFromResponse(data: unknown): TimelineTweet[] {
  const tweets: TimelineTweet[] = [];

  function traverse(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;

    const o = obj as Record<string, unknown>;

    // Check if this is a tweet result
    if (o.__typename === 'Tweet' || o.tweet_results) {
      const tweetData = o.tweet_results
        ? (o.tweet_results as Record<string, unknown>).result as Record<string, unknown>
        : o;

      if (tweetData && tweetData.legacy) {
        const legacy = tweetData.legacy as Record<string, unknown>;
        const core = tweetData.core as Record<string, unknown> || {};
        const userResults = core.user_results as Record<string, unknown> || {};
        const userResult = userResults.result as Record<string, unknown> || {};
        const userLegacy = userResult.legacy as Record<string, unknown> || {};

        const screenName = userLegacy.screen_name as string || '';
        const tweetId = tweetData.rest_id as string || legacy.id_str as string || '';

        if (tweetId && legacy.full_text) {
          tweets.push({
            id: tweetId,
            text: legacy.full_text as string,
            created_at: legacy.created_at as string || '',
            author: {
              id: userResult.rest_id as string || '',
              name: userLegacy.name as string || '',
              screen_name: screenName,
              profile_image_url: userLegacy.profile_image_url_https as string || '',
            },
            metrics: {
              likes: legacy.favorite_count as number || 0,
              retweets: legacy.retweet_count as number || 0,
              replies: legacy.reply_count as number || 0,
            },
            url: `https://x.com/${screenName}/status/${tweetId}`,
          });
        }
      }
    }

    // Recursively traverse
    if (Array.isArray(obj)) {
      obj.forEach(traverse);
    } else {
      Object.values(o).forEach(traverse);
    }
  }

  traverse(data);

  // Dedupe by ID
  const seen = new Set<string>();
  return tweets.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export async function getHomeTimeline(
  cookies: TwitterCookies,
  type: 'for-you' | 'following' = 'for-you',
  cursor?: string
): Promise<{ tweets: TimelineTweet[]; cursor?: string }> {
  const endpoint = type === 'following'
    ? ENDPOINTS.HomeLatestTimeline
    : ENDPOINTS.HomeTimeline;

  const variables = {
    count: 40,
    includePromotedContent: false,
    latestControlAvailable: true,
    requestContext: 'launch',
    ...(cursor ? { cursor } : {}),
  };

  const features = {
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false,
  };

  const url = `${TWITTER_API_BASE}/${endpoint}?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(cookies),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twitter API error: ${response.status} - ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  const tweets = extractTweetsFromResponse(data);

  // Extract cursor for pagination
  let nextCursor: string | undefined;
  const instructions = data?.data?.home?.home_timeline_urt?.instructions || [];
  for (const instruction of instructions) {
    if (instruction.entries) {
      for (const entry of instruction.entries) {
        if (entry.content?.cursorType === 'Bottom') {
          nextCursor = entry.content.value;
        }
      }
    }
  }

  return { tweets, cursor: nextCursor };
}
