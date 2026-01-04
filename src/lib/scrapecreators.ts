const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY!;
const BASE_URL = 'https://api.scrapecreators.com/v1';

// Normalized tweet interface for our app
export interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author: {
    id: string;
    name: string;
    screen_name: string;
    profile_image_url: string;
  };
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
  url: string;
}

export interface UserTweetsResponse {
  success: boolean;
  credits_remaining: number;
  tweets: Tweet[];
}

export interface UserProfile {
  id: string;
  name: string;
  screen_name: string;
  description: string;
  profile_image_url: string;
  followers_count: number;
  following_count: number;
}

// Transform raw API response to our normalized format
function transformTweet(raw: Record<string, unknown>): Tweet {
  const legacy = raw.legacy as Record<string, unknown> || {};
  const core = raw.core as Record<string, unknown> || {};
  const userResults = core.user_results as Record<string, unknown> || {};
  const userResult = userResults.result as Record<string, unknown> || {};
  const userLegacy = userResult.legacy as Record<string, unknown> || {};

  return {
    id: raw.rest_id as string || '',
    text: legacy.full_text as string || '',
    created_at: legacy.created_at as string || '',
    author: {
      id: userResult.rest_id as string || '',
      name: userLegacy.name as string || '',
      screen_name: userLegacy.screen_name as string || '',
      profile_image_url: userLegacy.profile_image_url_https as string || '',
    },
    public_metrics: {
      like_count: legacy.favorite_count as number || 0,
      retweet_count: legacy.retweet_count as number || 0,
      reply_count: legacy.reply_count as number || 0,
      quote_count: legacy.quote_count as number || 0,
    },
    url: raw.url as string || '',
  };
}

export async function getUserProfile(handle: string): Promise<UserProfile> {
  const response = await fetch(`${BASE_URL}/twitter/profile?handle=${encodeURIComponent(handle)}`, {
    headers: {
      'x-api-key': SCRAPECREATORS_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch profile');
  }

  const legacy = data.legacy || {};

  return {
    id: data.rest_id || '',
    name: legacy.name || data.core?.name || '',
    screen_name: legacy.screen_name || data.core?.screen_name || '',
    description: legacy.description || '',
    profile_image_url: legacy.profile_image_url_https || '',
    followers_count: legacy.followers_count || 0,
    following_count: legacy.friends_count || 0,
  };
}

export async function getUserTweets(
  handle: string,
  options: {
    limit?: number;
    cursor?: string;
    includeReplies?: boolean;
  } = {}
): Promise<{ data: Tweet[]; cursor?: string }> {
  const params = new URLSearchParams({
    handle: handle,
  });

  if (options.cursor) {
    params.append('cursor', options.cursor);
  }

  const response = await fetch(`${BASE_URL}/twitter/user-tweets?${params}`, {
    headers: {
      'x-api-key': SCRAPECREATORS_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tweets: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch tweets');
  }

  // Transform tweets to our format
  const tweets = (data.tweets || [])
    .map(transformTweet)
    .slice(0, options.limit || 20);

  return {
    data: tweets,
    cursor: data.cursor,
  };
}

export async function getTweetById(tweetId: string): Promise<Tweet> {
  const response = await fetch(`${BASE_URL}/twitter/tweet?id=${tweetId}`, {
    headers: {
      'x-api-key': SCRAPECREATORS_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tweet: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch tweet');
  }

  return transformTweet(data);
}
