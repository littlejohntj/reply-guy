import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database path - store in project data directory
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'tweets.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Better performance
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seen_tweets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tweet_id TEXT UNIQUE NOT NULL,
      content TEXT,
      author_handle TEXT NOT NULL,
      author_name TEXT,
      posted_at TEXT,
      likes INTEGER DEFAULT 0,
      retweets INTEGER DEFAULT 0,
      replies INTEGER DEFAULT 0,
      media_urls TEXT,
      quoted_tweet_content TEXT,
      seen_at TEXT DEFAULT (datetime('now')),
      replied BOOLEAN DEFAULT FALSE,
      skipped BOOLEAN DEFAULT FALSE,
      reply_text TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_seen_tweets_tweet_id ON seen_tweets(tweet_id);
    CREATE INDEX IF NOT EXISTS idx_seen_tweets_author ON seen_tweets(author_handle);
    CREATE INDEX IF NOT EXISTS idx_seen_tweets_seen_at ON seen_tweets(seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_seen_tweets_replied ON seen_tweets(replied);
    CREATE INDEX IF NOT EXISTS idx_seen_tweets_skipped ON seen_tweets(skipped);
  `);
}

export interface StoredTweet {
  tweet_id: string;
  content: string;
  author_handle: string;
  author_name?: string;
  posted_at?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  media_urls?: string[];
  quoted_tweet_content?: { text: string; authorHandle: string };
}

export function storeTweets(tweets: StoredTweet[]): { stored: number } {
  const db = getDatabase();

  const insertStmt = db.prepare(`
    INSERT INTO seen_tweets (
      tweet_id, content, author_handle, author_name, posted_at,
      likes, retweets, replies, media_urls, quoted_tweet_content
    ) VALUES (
      @tweet_id, @content, @author_handle, @author_name, @posted_at,
      @likes, @retweets, @replies, @media_urls, @quoted_tweet_content
    )
    ON CONFLICT(tweet_id) DO UPDATE SET
      content = excluded.content,
      likes = excluded.likes,
      retweets = excluded.retweets,
      replies = excluded.replies,
      media_urls = excluded.media_urls,
      quoted_tweet_content = excluded.quoted_tweet_content,
      updated_at = datetime('now')
  `);

  let stored = 0;

  const transaction = db.transaction((tweets: StoredTweet[]) => {
    for (const tweet of tweets) {
      const result = insertStmt.run({
        tweet_id: tweet.tweet_id,
        content: tweet.content || '',
        author_handle: tweet.author_handle,
        author_name: tweet.author_name || null,
        posted_at: tweet.posted_at || null,
        likes: tweet.likes || 0,
        retweets: tweet.retweets || 0,
        replies: tweet.replies || 0,
        media_urls: tweet.media_urls ? JSON.stringify(tweet.media_urls) : null,
        quoted_tweet_content: tweet.quoted_tweet_content ? JSON.stringify(tweet.quoted_tweet_content) : null
      });

      if (result.changes > 0) {
        stored++;
      }
    }
  });

  transaction(tweets);

  return { stored };
}

export function markTweetReplied(tweetId: string, replyText?: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE seen_tweets
    SET replied = TRUE, reply_text = ?, updated_at = datetime('now')
    WHERE tweet_id = ?
  `).run(replyText || null, tweetId);
}

export function markTweetSkipped(tweetId: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE seen_tweets
    SET skipped = TRUE, updated_at = datetime('now')
    WHERE tweet_id = ?
  `).run(tweetId);
}

export function getTweetStats(): {
  total: number;
  replied: number;
  skipped: number;
  today: number;
  byAuthor: { author: string; count: number }[];
} {
  const db = getDatabase();

  const total = db.prepare('SELECT COUNT(*) as count FROM seen_tweets').get() as { count: number };
  const replied = db.prepare('SELECT COUNT(*) as count FROM seen_tweets WHERE replied = TRUE').get() as { count: number };
  const skipped = db.prepare('SELECT COUNT(*) as count FROM seen_tweets WHERE skipped = TRUE').get() as { count: number };
  const today = db.prepare(`
    SELECT COUNT(*) as count FROM seen_tweets
    WHERE date(seen_at) = date('now')
  `).get() as { count: number };
  const byAuthor = db.prepare(`
    SELECT author_handle as author, COUNT(*) as count
    FROM seen_tweets
    GROUP BY author_handle
    ORDER BY count DESC
    LIMIT 20
  `).all() as { author: string; count: number }[];

  return {
    total: total.count,
    replied: replied.count,
    skipped: skipped.count,
    today: today.count,
    byAuthor
  };
}

export function getRecentTweets(limit: number = 50): StoredTweet[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT tweet_id, content, author_handle, author_name, posted_at,
           likes, retweets, replies, media_urls, quoted_tweet_content
    FROM seen_tweets
    ORDER BY seen_at DESC
    LIMIT ?
  `).all(limit) as {
    tweet_id: string;
    content: string;
    author_handle: string;
    author_name: string | null;
    posted_at: string | null;
    likes: number;
    retweets: number;
    replies: number;
    media_urls: string | null;
    quoted_tweet_content: string | null;
  }[];

  return rows.map(row => ({
    tweet_id: row.tweet_id,
    content: row.content,
    author_handle: row.author_handle,
    author_name: row.author_name || undefined,
    posted_at: row.posted_at || undefined,
    likes: row.likes,
    retweets: row.retweets,
    replies: row.replies,
    media_urls: row.media_urls ? JSON.parse(row.media_urls) : undefined,
    quoted_tweet_content: row.quoted_tweet_content ? JSON.parse(row.quoted_tweet_content) : undefined
  }));
}
