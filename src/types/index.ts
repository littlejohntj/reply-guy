export interface Profile {
  id: string;
  twitter_handle: string;
  display_name: string;
  avatar_url?: string;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Tweet {
  id: string;
  tweet_id: string;
  profile_id: string;
  content: string;
  author_handle: string;
  author_name: string;
  author_avatar?: string;
  tweet_url: string;
  posted_at: string;
  likes: number;
  retweets: number;
  replies: number;
  fetched_at: string;
  filter_status: 'pending' | 'show' | 'skip';
  filter_category?: string;
  suggested_reply?: string;
  replied: boolean;
  created_at: string;
}

export interface ReplyDraft {
  id: string;
  tweet_id: string;
  content: string;
  status: 'draft' | 'sent' | 'skipped';
  created_at: string;
  sent_at?: string;
}

export interface FilterRule {
  id: string;
  name: string;
  prompt: string;
  category: string;
  active: boolean;
  created_at: string;
}

export interface StyleProfile {
  id: string;
  name: string;
  source_handle?: string;
  sample_tweets: string[];
  style_prompt: string;
  created_at: string;
  updated_at: string;
}
