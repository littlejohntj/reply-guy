// TwttrAPI Client - For authenticated Twitter feeds
// Docs: https://rapidapi.com/twttrapi-twttrapi-default/api/twttrapi

const BASE_URL = 'https://twttrapi.p.rapidapi.com';

interface TwttrAPIConfig {
  rapidApiKey: string;
  twttrSession?: string;  // Twitter auth session
  twttrProxy?: string;
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
    quotes: number;
  };
  url: string;
}

interface RawTweetData {
  rest_id?: string;
  legacy?: {
    full_text?: string;
    created_at?: string;
    favorite_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
  core?: {
    user_results?: {
      result?: {
        rest_id?: string;
        legacy?: {
          name?: string;
          screen_name?: string;
          profile_image_url_https?: string;
        };
      };
    };
  };
}

function getHeaders(config: TwttrAPIConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'x-rapidapi-host': 'twttrapi.p.rapidapi.com',
    'x-rapidapi-key': config.rapidApiKey,
    'Content-Type': 'application/json',
  };

  if (config.twttrSession) {
    headers['twttr-session'] = config.twttrSession;
  }
  if (config.twttrProxy) {
    headers['twttr-proxy'] = config.twttrProxy;
  }

  return headers;
}

function transformTweet(raw: RawTweetData): TimelineTweet {
  const legacy = raw.legacy || {};
  const userResult = raw.core?.user_results?.result || {};
  const userLegacy = userResult.legacy || {};
  const screenName = userLegacy.screen_name || '';

  return {
    id: raw.rest_id || '',
    text: legacy.full_text || '',
    created_at: legacy.created_at || '',
    author: {
      id: userResult.rest_id || '',
      name: userLegacy.name || '',
      screen_name: screenName,
      profile_image_url: userLegacy.profile_image_url_https || '',
    },
    metrics: {
      likes: legacy.favorite_count || 0,
      retweets: legacy.retweet_count || 0,
      replies: legacy.reply_count || 0,
      quotes: legacy.quote_count || 0,
    },
    url: `https://x.com/${screenName}/status/${raw.rest_id}`,
  };
}

export async function getForYouTimeline(
  config: TwttrAPIConfig,
  cursor?: string
): Promise<{ tweets: TimelineTweet[]; cursor?: string }> {
  const url = cursor
    ? `${BASE_URL}/for-you-timeline?cursor=${encodeURIComponent(cursor)}`
    : `${BASE_URL}/for-you-timeline`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(config),
  });

  if (!response.ok) {
    throw new Error(`TwttrAPI error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Extract tweets from response (structure may vary)
  const rawTweets = data.data?.tweets || data.tweets || [];
  const tweets = rawTweets.map(transformTweet);

  return {
    tweets,
    cursor: data.cursor || data.next_cursor,
  };
}

export async function getFollowingTimeline(
  config: TwttrAPIConfig,
  cursor?: string
): Promise<{ tweets: TimelineTweet[]; cursor?: string }> {
  const url = cursor
    ? `${BASE_URL}/following-timeline?cursor=${encodeURIComponent(cursor)}`
    : `${BASE_URL}/following-timeline`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(config),
  });

  if (!response.ok) {
    throw new Error(`TwttrAPI error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const rawTweets = data.data?.tweets || data.tweets || [];
  const tweets = rawTweets.map(transformTweet);

  return {
    tweets,
    cursor: data.cursor || data.next_cursor,
  };
}

// Login to get session token
export async function loginWithCredentials(
  config: TwttrAPIConfig,
  username: string,
  password: string
): Promise<{ session: string }> {
  const response = await fetch(`${BASE_URL}/login-email-username`, {
    method: 'POST',
    headers: {
      ...getHeaders(config),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username,
      password,
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  return { session: data.session || data.twttr_session };
}
