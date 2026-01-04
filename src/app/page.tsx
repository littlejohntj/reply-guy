'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, RefreshCw, Send, X, Settings, Sparkles, SkipForward, Loader2, Keyboard, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Profile {
  id: string;
  twitter_handle: string;
  display_name: string;
  priority: 'high' | 'medium' | 'low';
  tweet_count?: number;
  pending_count?: number;
}

interface VoiceProfile {
  id: string;
  name: string;
  source_handle?: string;
  description?: string;
  sample_tweets?: string[];
  style_prompt?: string;
  active: boolean;
}

interface Tweet {
  id: string;
  tweet_id: string;
  content: string;
  author_handle: string;
  author_name: string;
  tweet_url: string;
  posted_at: string;
  likes: number;
  retweets: number;
  filter_category?: string;
  filter_status?: string;
  suggested_reply?: string;
  replied: boolean;
}

export default function Dashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [replyOptions, setReplyOptions] = useState<string[]>([]);
  const [selectedReplyIndex, setSelectedReplyIndex] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState<'queue' | 'profiles' | 'settings'>('queue');
  const [newHandle, setNewHandle] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const tweetListRef = useRef<HTMLDivElement>(null);

  // Voice training state
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceHandle, setVoiceHandle] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [analyzingVoice, setAnalyzingVoice] = useState(false);

  // Feed source state
  const [feedSource, setFeedSource] = useState<'profiles' | 'for-you' | 'following'>('profiles');
  const [feedConfigured, setFeedConfigured] = useState(false);

  const filteredTweets = tweets.filter(t => !t.replied && t.filter_status !== 'skip');
  const selectedTweet = filteredTweets[selectedIndex] || null;

  useEffect(() => {
    fetchProfiles();
    fetchTweets();
    fetchVoiceProfiles();
    checkFeedConfig();
  }, []);

  async function checkFeedConfig() {
    try {
      const res = await fetch('/api/feed');
      const data = await res.json();
      setFeedConfigured(!data.needsAuth && !data.error?.includes('not configured'));
    } catch {
      setFeedConfigured(false);
    }
  }

  async function fetchVoiceProfiles() {
    try {
      const res = await fetch('/api/voice-profiles');
      const data = await res.json();
      setVoiceProfiles(data.profiles || []);
    } catch (error) {
      console.error('Failed to fetch voice profiles:', error);
    }
  }

  async function analyzeVoice() {
    if (!voiceHandle.trim()) return;
    setAnalyzingVoice(true);

    try {
      const res = await fetch('/api/voice-profiles/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: voiceHandle.replace('@', ''),
          description: voiceDescription,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        await fetchVoiceProfiles();
        setShowVoiceModal(false);
        setVoiceHandle('');
        setVoiceDescription('');
      }
    } catch (error) {
      console.error('Failed to analyze voice:', error);
    }
    setAnalyzingVoice(false);
  }

  async function deleteProfile(id: string) {
    try {
      await fetch(`/api/profiles?id=${id}`, { method: 'DELETE' });
      fetchProfiles();
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  }

  async function setActiveVoice(id: string) {
    try {
      await fetch('/api/voice-profiles/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchVoiceProfiles();
    } catch (error) {
      console.error('Failed to activate voice:', error);
    }
  }

  // Update reply text when selected tweet or reply options change
  useEffect(() => {
    if (replyOptions.length > 0) {
      setReplyText(replyOptions[selectedReplyIndex] || '');
    } else if (selectedTweet?.suggested_reply) {
      setReplyText(selectedTweet.suggested_reply);
    }
  }, [selectedReplyIndex, replyOptions, selectedTweet]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Allow Escape to blur
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (view !== 'queue') return;

      switch (e.key.toLowerCase()) {
        case 'j': // Next tweet
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredTweets.length - 1));
          setReplyOptions([]);
          setSelectedReplyIndex(0);
          break;
        case 'k': // Previous tweet
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          setReplyOptions([]);
          setSelectedReplyIndex(0);
          break;
        case 'g': // Generate replies
          e.preventDefault();
          if (selectedTweet && !generating) {
            generateReplies(selectedTweet);
          }
          break;
        case 'r': // Open & Reply
          e.preventDefault();
          if (selectedTweet && replyText) {
            openTweetAndReply(selectedTweet);
          }
          break;
        case 'o': // Just open tweet
          e.preventDefault();
          if (selectedTweet) {
            window.open(selectedTweet.tweet_url, '_blank');
          }
          break;
        case 's': // Skip tweet
          e.preventDefault();
          if (selectedTweet) {
            skipTweet(selectedTweet);
          }
          break;
        case 'd': // Mark as done/replied
          e.preventDefault();
          if (selectedTweet) {
            markAsReplied(selectedTweet);
          }
          break;
        case 'v': // Cycle through reply options
          e.preventDefault();
          if (replyOptions.length > 1) {
            setSelectedReplyIndex(i => (i + 1) % replyOptions.length);
          }
          break;
        case '?': // Show shortcuts
          e.preventDefault();
          setShowShortcuts(s => !s);
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, selectedTweet, replyText, generating, filteredTweets.length, replyOptions]);

  // Scroll selected tweet into view
  useEffect(() => {
    if (tweetListRef.current && selectedIndex >= 0) {
      const items = tweetListRef.current.querySelectorAll('[data-tweet-item]');
      items[selectedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIndex]);

  async function fetchProfiles() {
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    }
  }

  async function fetchTweets() {
    try {
      const res = await fetch('/api/tweets');
      const data = await res.json();
      setTweets(data.tweets || []);
    } catch (error) {
      console.error('Failed to fetch tweets:', error);
    }
  }

  async function addProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!newHandle.trim()) return;

    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newHandle.replace('@', '') }),
      });
      if (res.ok) {
        setNewHandle('');
        fetchProfiles();
      }
    } catch (error) {
      console.error('Failed to add profile:', error);
    }
  }

  async function refreshTweets() {
    setLoading(true);
    try {
      if (feedSource === 'profiles') {
        await fetch('/api/tweets/fetch', { method: 'POST' });
      } else {
        await fetch('/api/feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: feedSource }),
        });
      }
      await fetchTweets();
    } catch (error) {
      console.error('Failed to refresh tweets:', error);
    }
    setLoading(false);
  }

  // Generate multiple reply options
  async function generateReplies(tweet: Tweet) {
    setGenerating(true);
    setReplyOptions([]);
    setSelectedReplyIndex(0);

    try {
      const res = await fetch('/api/reply/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetId: tweet.id, count: 3 }),
      });
      const data = await res.json();
      const options = data.replies || [data.reply].filter(Boolean);
      setReplyOptions(options);
      if (options.length > 0) {
        setReplyText(options[0]);
      }
    } catch (error) {
      console.error('Failed to generate replies:', error);
    }
    setGenerating(false);
  }

  // Mark tweet as replied and move to next
  const markAsReplied = useCallback(async (tweet: Tweet) => {
    try {
      await fetch('/api/tweets/mark-replied', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetId: tweet.id }),
      });
      // Update local state
      setTweets(prev => prev.map(t =>
        t.id === tweet.id ? { ...t, replied: true } : t
      ));
      // Reset reply state
      setReplyOptions([]);
      setSelectedReplyIndex(0);
      setReplyText('');
    } catch (error) {
      console.error('Failed to mark as replied:', error);
    }
  }, []);

  // Skip tweet (mark as skipped)
  async function skipTweet(tweet: Tweet) {
    console.log('Skipping tweet:', tweet.id);
    try {
      const res = await fetch('/api/tweets/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetId: tweet.id }),
      });
      const data = await res.json();
      console.log('Skip response:', res.status, data);

      if (res.ok) {
        setTweets(prev => prev.filter(t => t.id !== tweet.id));
        setReplyOptions([]);
        setReplyText('');
      }
    } catch (error) {
      console.error('Failed to skip tweet:', error);
    }
  }

  async function openTweetAndReply(tweet: Tweet) {
    // Copy to clipboard as fallback
    navigator.clipboard.writeText(replyText);

    // Store in localStorage for extension bridge to pick up
    const replyData = {
      text: replyText,
      tweetUrl: tweet.tweet_url,
      timestamp: Date.now()
    };
    localStorage.setItem('replyGuyPending', JSON.stringify(replyData));

    // Also dispatch custom event for the extension bridge
    window.dispatchEvent(new CustomEvent('replyGuyStoreReply', { detail: replyData }));

    // Mark as replied
    await markAsReplied(tweet);

    // Small delay to ensure extension picks up the data
    await new Promise(resolve => setTimeout(resolve, 100));

    // Open the tweet with #replyguy hash so extension knows to open reply box
    const url = new URL(tweet.tweet_url);
    url.hash = 'replyguy';
    window.open(url.toString(), '_blank');
  }

  function copyReply() {
    navigator.clipboard.writeText(replyText);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-slate-900 rounded-xl p-6 max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Keyboard className="w-5 h-5" />
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Next tweet</span><kbd className="px-2 py-0.5 bg-slate-800 rounded">J</kbd></div>
              <div className="flex justify-between"><span className="text-slate-400">Previous tweet</span><kbd className="px-2 py-0.5 bg-slate-800 rounded">K</kbd></div>
              <div className="flex justify-between"><span className="text-slate-400">Generate replies</span><kbd className="px-2 py-0.5 bg-slate-800 rounded">G</kbd></div>
              <div className="flex justify-between"><span className="text-slate-400">Cycle reply options</span><kbd className="px-2 py-0.5 bg-slate-800 rounded">V</kbd></div>
              <div className="flex justify-between"><span className="text-slate-400">Open tweet</span><kbd className="px-2 py-0.5 bg-slate-800 rounded">O</kbd></div>
              <div className="flex justify-between"><span className="text-slate-400">Open & Reply</span><kbd className="px-2 py-0.5 bg-slate-800 rounded">R</kbd></div>
              <div className="flex justify-between"><span className="text-slate-400">Skip tweet</span><kbd className="px-2 py-0.5 bg-slate-800 rounded">S</kbd></div>
              <div className="flex justify-between"><span className="text-slate-400">Mark as done</span><kbd className="px-2 py-0.5 bg-slate-800 rounded">D</kbd></div>
              <div className="flex justify-between"><span className="text-slate-400">Show shortcuts</span><kbd className="px-2 py-0.5 bg-slate-800 rounded">?</kbd></div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Reply Guy</h1>
            <button
              onClick={() => setShowShortcuts(true)}
              className="text-slate-500 hover:text-slate-300 transition"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>
          <nav className="flex gap-2">
            <button
              onClick={() => setView('queue')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition',
                view === 'queue' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              Queue ({filteredTweets.length})
            </button>
            <button
              onClick={() => setView('profiles')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition',
                view === 'profiles' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              Profiles
            </button>
            <button
              onClick={() => setView('settings')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition',
                view === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              <Settings className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {view === 'queue' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tweet Queue */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">Queue</h2>
                  <div className="flex bg-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => setFeedSource('profiles')}
                      className={cn(
                        'px-3 py-1 text-xs rounded-md transition',
                        feedSource === 'profiles' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                      )}
                    >
                      Tracked
                    </button>
                    <button
                      onClick={() => setFeedSource('for-you')}
                      disabled={!feedConfigured}
                      className={cn(
                        'px-3 py-1 text-xs rounded-md transition',
                        feedSource === 'for-you' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white',
                        !feedConfigured && 'opacity-50 cursor-not-allowed'
                      )}
                      title={feedConfigured ? 'For You feed' : 'Configure Twitter auth in Settings'}
                    >
                      For You
                    </button>
                    <button
                      onClick={() => setFeedSource('following')}
                      disabled={!feedConfigured}
                      className={cn(
                        'px-3 py-1 text-xs rounded-md transition',
                        feedSource === 'following' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white',
                        !feedConfigured && 'opacity-50 cursor-not-allowed'
                      )}
                      title={feedConfigured ? 'Following feed' : 'Configure Twitter auth in Settings'}
                    >
                      Following
                    </button>
                  </div>
                  <span className="text-slate-500 text-sm">
                    {selectedIndex + 1} / {filteredTweets.length}
                  </span>
                </div>
                <button
                  onClick={refreshTweets}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-sm transition"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {loading ? 'Fetching...' : 'Refresh'}
                </button>
              </div>

              <div className="space-y-2 max-h-[70vh] overflow-y-auto" ref={tweetListRef}>
                {filteredTweets.length === 0 ? (
                  <div className="bg-slate-900 rounded-xl p-8 text-center text-slate-500">
                    {loading ? 'Fetching tweets...' : 'No tweets in queue. Add profiles and refresh to fetch tweets.'}
                  </div>
                ) : (
                  filteredTweets.map((tweet, index) => (
                    <div
                      key={tweet.id}
                      data-tweet-item
                      onClick={() => {
                        setSelectedIndex(index);
                        setReplyOptions([]);
                        setSelectedReplyIndex(0);
                      }}
                      className={cn(
                        'bg-slate-900 rounded-xl p-4 cursor-pointer transition border-2',
                        index === selectedIndex
                          ? 'border-blue-500'
                          : 'border-transparent hover:border-slate-700'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium shrink-0">
                          {tweet.author_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium">{tweet.author_name}</span>
                            <span className="text-slate-500 text-sm">@{tweet.author_handle}</span>
                            {tweet.filter_category === 'priority' && (
                              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                Priority
                              </span>
                            )}
                          </div>
                          <p className="text-slate-300 text-sm line-clamp-2">{tweet.content}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>{formatRelativeTime(tweet.posted_at)}</span>
                            <span>{tweet.likes?.toLocaleString()} likes</span>
                            <span>{tweet.retweets?.toLocaleString()} RTs</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Reply Composer */}
            <div className="lg:sticky lg:top-6 h-fit">
              <h2 className="text-lg font-semibold mb-4">Reply</h2>

              {selectedTweet ? (
                <div className="bg-slate-900 rounded-xl p-4">
                  <div className="mb-4 pb-4 border-b border-slate-800">
                    <p className="text-sm text-slate-400 mb-2">Replying to @{selectedTweet.author_handle}</p>
                    <p className="text-slate-300">{selectedTweet.content}</p>
                  </div>

                  {/* Reply options tabs */}
                  {replyOptions.length > 1 && (
                    <div className="flex gap-1 mb-3">
                      {replyOptions.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedReplyIndex(i);
                            setReplyText(replyOptions[i]);
                          }}
                          className={cn(
                            'px-3 py-1 text-xs rounded-full transition',
                            i === selectedReplyIndex
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          )}
                        >
                          Option {i + 1}
                        </button>
                      ))}
                      <span className="text-xs text-slate-500 ml-2 self-center">Press V to cycle</span>
                    </div>
                  )}

                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply or press G to generate..."
                    className="w-full bg-slate-800 rounded-lg p-3 text-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => generateReplies(selectedTweet)}
                        disabled={generating}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm transition"
                      >
                        {generating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {generating ? 'Generating...' : 'Generate (G)'}
                      </button>
                      <button
                        onClick={() => skipTweet(selectedTweet)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition"
                        title="Skip this tweet (S)"
                      >
                        <SkipForward className="w-4 h-4" />
                        Skip
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => window.open(selectedTweet.tweet_url, '_blank')}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition"
                        title="Open tweet (O)"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open
                      </button>
                      <button
                        onClick={copyReply}
                        disabled={!replyText}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm transition"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => openTweetAndReply(selectedTweet)}
                        disabled={!replyText}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm transition"
                      >
                        <Send className="w-4 h-4" />
                        Reply (R)
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mt-3 text-center">
                    J/K navigate • G generate • O open • R reply • S skip
                  </p>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-xl p-8 text-center text-slate-500">
                  {filteredTweets.length === 0 ? 'No tweets to reply to' : 'Select a tweet to compose a reply'}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'profiles' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Tracked Profiles</h2>
              <form onSubmit={addProfile} className="flex gap-2">
                <input
                  type="text"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="@username"
                  className="px-3 py-2 bg-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.length === 0 ? (
                <div className="col-span-full bg-slate-900 rounded-xl p-8 text-center text-slate-500">
                  No profiles yet. Add a Twitter handle above or use the Chrome extension.
                </div>
              ) : (
                profiles.map(profile => (
                  <div
                    key={profile.id}
                    className="bg-slate-900 rounded-xl p-4 flex items-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-lg font-medium">
                      {profile.display_name?.charAt(0) || profile.twitter_handle.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{profile.display_name || profile.twitter_handle}</p>
                      <p className="text-slate-500 text-sm">@{profile.twitter_handle}</p>
                      <div className="flex gap-3 mt-1 text-xs">
                        <span className="text-blue-400">{profile.pending_count || 0} in queue</span>
                        <span className="text-slate-500">{profile.tweet_count || 0} total</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteProfile(profile.id)}
                      className="p-2 text-slate-500 hover:text-red-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Voice & Style</h2>
              <button
                onClick={() => setShowVoiceModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm transition"
              >
                <Plus className="w-4 h-4" />
                Train New Voice
              </button>
            </div>

            {/* Voice Profiles */}
            <div className="space-y-4 mb-8">
              {voiceProfiles.length === 0 ? (
                <div className="bg-slate-900 rounded-xl p-8 text-center">
                  <p className="text-slate-400 mb-4">No voice profiles yet.</p>
                  <p className="text-slate-500 text-sm">
                    Train a voice by analyzing someone&apos;s tweets and describing what you like about their style.
                  </p>
                </div>
              ) : (
                voiceProfiles.map(voice => (
                  <div
                    key={voice.id}
                    className={cn(
                      'bg-slate-900 rounded-xl p-4 border-2 transition cursor-pointer',
                      voice.active ? 'border-purple-500' : 'border-transparent hover:border-slate-700'
                    )}
                    onClick={() => setActiveVoice(voice.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{voice.name}</h3>
                          {voice.active && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        {voice.source_handle && (
                          <p className="text-slate-500 text-sm">Based on @{voice.source_handle}</p>
                        )}
                        {voice.description && (
                          <p className="text-slate-400 text-sm mt-2">{voice.description}</p>
                        )}
                      </div>
                    </div>
                    {voice.sample_tweets && voice.sample_tweets.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <p className="text-xs text-slate-500 mb-2">Sample tweets analyzed:</p>
                        <div className="space-y-1">
                          {voice.sample_tweets.slice(0, 2).map((t, i) => (
                            <p key={i} className="text-xs text-slate-400 truncate">&ldquo;{t}&rdquo;</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Twitter Auth */}
            <h2 className="text-lg font-semibold mb-4">Twitter Feed Access</h2>
            <div className="bg-slate-900 rounded-xl p-6 mb-8">
              {feedConfigured ? (
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <p className="text-green-400">Connected - For You and Following feeds available</p>
                </div>
              ) : (
                <>
                  <p className="text-slate-400 text-sm mb-4">
                    To access your For You and Following feeds, you need to configure Twitter authentication.
                  </p>
                  <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-3">
                    <p className="text-slate-300 font-medium">Setup Instructions:</p>
                    <ol className="text-slate-400 space-y-2 list-decimal list-inside">
                      <li>Log into Twitter/X in Chrome</li>
                      <li>Open DevTools (Cmd+Option+I) → Application → Cookies → x.com</li>
                      <li>Find and copy these cookie values:
                        <ul className="mt-1 ml-4 space-y-1">
                          <li>• <code className="bg-slate-700 px-1 rounded">auth_token</code></li>
                          <li>• <code className="bg-slate-700 px-1 rounded">ct0</code></li>
                        </ul>
                      </li>
                      <li>Add to your <code className="bg-slate-700 px-1 rounded">.env.local</code>:
                        <pre className="mt-2 bg-slate-950 p-2 rounded text-xs overflow-x-auto">
{`TWITTER_AUTH_TOKEN=your_auth_token_value
TWITTER_CT0=your_ct0_value`}
                        </pre>
                      </li>
                      <li>Restart the dev server</li>
                    </ol>
                  </div>
                </>
              )}
            </div>

            {/* Filter Settings */}
            <h2 className="text-lg font-semibold mb-4">Filters</h2>
            <div className="bg-slate-900 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-4">
                The AI automatically filters tweets into categories: <span className="text-yellow-400">priority</span> (high-value engagement opportunities), <span className="text-green-400">engage</span> (worth replying), or <span className="text-slate-500">skip</span> (ignore).
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-slate-300 font-medium mb-1">Skip automatically:</p>
                  <ul className="text-slate-500 text-xs space-y-1">
                    <li>• Promotional tweets</li>
                    <li>• Retweets without commentary</li>
                    <li>• Low-effort content</li>
                  </ul>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-slate-300 font-medium mb-1">Prioritize:</p>
                  <ul className="text-slate-500 text-xs space-y-1">
                    <li>• Direct questions</li>
                    <li>• Viral potential</li>
                    <li>• Engaging discussions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Voice Training Modal */}
        {showVoiceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowVoiceModal(false)}>
            <div className="bg-slate-900 rounded-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Train New Voice</h3>
              <p className="text-slate-400 text-sm mb-4">
                Enter a Twitter handle to analyze their writing style. Describe what you like about their voice to help the AI understand your preferences.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Twitter Handle</label>
                  <input
                    type="text"
                    value={voiceHandle}
                    onChange={(e) => setVoiceHandle(e.target.value)}
                    placeholder="@username"
                    className="w-full px-3 py-2 bg-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">What do you like about their style?</label>
                  <textarea
                    value={voiceDescription}
                    onChange={(e) => setVoiceDescription(e.target.value)}
                    placeholder="e.g., Concise and witty, uses humor effectively, great at asking thought-provoking questions..."
                    className="w-full bg-slate-800 rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowVoiceModal(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={analyzeVoice}
                    disabled={!voiceHandle.trim() || analyzingVoice}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm transition"
                  >
                    {analyzingVoice ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Analyze & Train
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
