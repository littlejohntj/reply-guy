-- Reply Guy Database Schema

-- Profiles table: Twitter accounts to track
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  twitter_handle VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  avatar_url TEXT,
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tweets table: Fetched tweets from tracked profiles
CREATE TABLE tweets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id VARCHAR(50) NOT NULL UNIQUE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_handle VARCHAR(50) NOT NULL,
  author_name VARCHAR(100),
  author_avatar TEXT,
  tweet_url TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  filter_status VARCHAR(20) DEFAULT 'pending' CHECK (filter_status IN ('pending', 'show', 'skip')),
  filter_category VARCHAR(50),
  suggested_reply TEXT,
  replied BOOLEAN DEFAULT FALSE,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Filter rules table: Custom LLM filtering rules
CREATE TABLE filter_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  prompt TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Style profiles table: Writing style configurations
CREATE TABLE style_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  source_handle VARCHAR(50),
  sample_tweets JSONB DEFAULT '[]'::jsonb,
  style_prompt TEXT,
  active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reply drafts table: Track reply history
CREATE TABLE reply_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id UUID REFERENCES tweets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_tweets_profile_id ON tweets(profile_id);
CREATE INDEX idx_tweets_posted_at ON tweets(posted_at DESC);
CREATE INDEX idx_tweets_filter_status ON tweets(filter_status);
CREATE INDEX idx_tweets_replied ON tweets(replied);
CREATE INDEX idx_profiles_twitter_handle ON profiles(twitter_handle);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to style_profiles
CREATE TRIGGER update_style_profiles_updated_at
  BEFORE UPDATE ON style_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (enable when auth is added)
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE filter_rules ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE style_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reply_drafts ENABLE ROW LEVEL SECURITY;
