// Per-tweet session management for conversation context
// Allows images to be sent once and reused for variations/refinements

export interface TweetImage {
  base64: string;
  mediaType: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TweetSession {
  tweetId: string;
  images: TweetImage[];
  messages: ConversationMessage[];
  createdAt: Date;
  lastAccessedAt: Date;
}

// In-memory session storage
const sessions = new Map<string, TweetSession>();

// Session TTL: 1 hour
const SESSION_TTL = 60 * 60 * 1000;

export function getSession(tweetId: string): TweetSession | undefined {
  const session = sessions.get(tweetId);
  if (session) {
    // Check if expired
    if (Date.now() - session.lastAccessedAt.getTime() > SESSION_TTL) {
      sessions.delete(tweetId);
      return undefined;
    }
    session.lastAccessedAt = new Date();
  }
  return session;
}

export function createSession(tweetId: string, images: TweetImage[] = []): TweetSession {
  const session: TweetSession = {
    tweetId,
    images,
    messages: [],
    createdAt: new Date(),
    lastAccessedAt: new Date()
  };
  sessions.set(tweetId, session);
  return session;
}

export function getOrCreateSession(tweetId: string, images: TweetImage[] = []): TweetSession {
  let session = getSession(tweetId);
  if (!session) {
    session = createSession(tweetId, images);
  } else if (images.length > 0 && session.images.length === 0) {
    // Update with images if we didn't have them before
    session.images = images;
  }
  return session;
}

export function addMessageToSession(
  tweetId: string,
  role: 'user' | 'assistant',
  content: string
): void {
  const session = sessions.get(tweetId);
  if (session) {
    session.messages.push({ role, content });
    session.lastAccessedAt = new Date();
  }
}

export function hasSessionImages(tweetId: string): boolean {
  const session = getSession(tweetId);
  return session ? session.images.length > 0 : false;
}

export function getSessionImages(tweetId: string): TweetImage[] {
  const session = getSession(tweetId);
  return session?.images || [];
}

// Cleanup expired sessions periodically
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startSessionCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [tweetId, session] of sessions) {
      if (now - session.lastAccessedAt.getTime() > SESSION_TTL) {
        sessions.delete(tweetId);
      }
    }
  }, 15 * 60 * 1000); // Every 15 minutes
}

export function stopSessionCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Start cleanup on module load
startSessionCleanup();
