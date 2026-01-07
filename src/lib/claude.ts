import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface FilterResult {
  shouldShow: boolean;
  category: string;
  reason: string;
}

export async function filterTweet(
  tweet: string,
  authorHandle: string,
  customPrompt?: string
): Promise<FilterResult> {
  const systemPrompt = customPrompt || `You are a tweet filter assistant. Be PERMISSIVE - let most tweets through.

Categorize as:
- "priority": Great opportunity - questions, hot takes, discussions you can add to
- "engage": Default for most tweets - anything you could potentially reply to
- "skip": ONLY skip: retweets (RT), pure ads/promos, single emojis, "gm/gn" only, completely empty

When in doubt, choose "engage". The user will manually skip if needed.`;

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 200,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Tweet by @${authorHandle}:\n"${tweet}"\n\nRespond with JSON only: {"shouldShow": boolean, "category": "engage"|"skip"|"priority", "reason": "brief reason"}`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback if parsing fails
  }

  return {
    shouldShow: true,
    category: 'engage',
    reason: 'Could not parse filter response',
  };
}

export interface QuotedTweet {
  text: string;
  authorHandle: string;
  url?: string;
}

export async function generateReply(
  tweet: string,
  authorHandle: string,
  stylePrompt?: string,
  count: number = 1,
  quotedTweet?: QuotedTweet
): Promise<string[]> {
  const systemPrompt = stylePrompt || `You write Twitter replies. One-liners only. 15 words max. Usually under 10.

THE VIBE:
- You're a friend firing off a quick reply, not a thought leader dropping wisdom
- React to the tweet, don't analyze it
- If it's funny, riff on the joke. Don't explain why it's funny.
- If it's a take, agree/disagree quickly or add a small twist
- Match their energy level exactly

NEVER DO THIS (thought leader brain):
- "This is basically..." followed by an insight
- "The real X is Y" framework tweets
- Explaining the deeper meaning of their tweet back to them
- Adding statistics, studies, or "data shows"
- Making it about productivity, optimization, or self-improvement
- Startup/hustle culture speak

GOOD REPLIES SOUND LIKE:
- "my room has owed me that apology for months"
- "the real flex"
- "this but unironically"
- "down bad and correct"
- "genuinely unhinged take but ok"
- Quick reactions, not essays

Keep it casual. Lowercase is fine. No hashtags. No emojis unless they used them.`;

  // Build the user prompt with optional quote context
  const buildPrompt = (basePrompt: string) => {
    let prompt = basePrompt;
    if (quotedTweet?.text) {
      prompt += `\n\n[This tweet is quoting another tweet${quotedTweet.authorHandle ? ` by @${quotedTweet.authorHandle}` : ''}:\n"${quotedTweet.text}"]\n\nConsider both the main tweet AND the quoted tweet context.`;
    }
    return prompt;
  };

  if (count === 1) {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: buildPrompt(`Reply to this tweet by @${authorHandle}:\n\n"${tweet}"\n\nOne short reply. Under 15 words. No preamble.`),
        },
      ],
    });
    const reply = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    return [reply];
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 250,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: buildPrompt(`Write ${count} short reply options to this tweet by @${authorHandle}:\n\n"${tweet}"\n\nEach reply must be under 15 words. Different vibes, same brevity. Format as JSON array: ["reply1", "reply2", "reply3"]`),
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const replies = JSON.parse(jsonMatch[0]);
      if (Array.isArray(replies)) {
        return replies.map((r: string) => r.trim());
      }
    }
  } catch {
    // Fallback: split by newlines if JSON parsing fails
  }

  return [responseText.trim()];
}

export interface TweetImage {
  base64: string;
  mediaType: string;
}

export async function generateReplyWithVision(
  tweet: string,
  authorHandle: string,
  images: TweetImage[],
  stylePrompt?: string,
  count: number = 3,
  quotedTweet?: QuotedTweet
): Promise<string[]> {
  const systemPrompt = stylePrompt || `You write Twitter replies. One-liners only. 15 words max. Usually under 10.

THE VIBE:
- You're a friend firing off a quick reply, not a thought leader dropping wisdom
- React to the tweet AND what you see in the image(s)
- If it's funny, riff on the joke. Don't explain why it's funny.
- If it's a take, agree/disagree quickly or add a small twist
- Match their energy level exactly

Keep it casual. Lowercase is fine. No hashtags. No emojis unless they used them.`;

  // Build content array with images first, then text
  const content: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }> = [];

  // Add images
  for (const img of images) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.base64
      }
    });
  }

  // Build text prompt
  let textPrompt = `Reply to this tweet by @${authorHandle}:\n\n"${tweet}"`;

  if (quotedTweet?.text) {
    textPrompt += `\n\n[This tweet is quoting another tweet${quotedTweet.authorHandle ? ` by @${quotedTweet.authorHandle}` : ''}:\n"${quotedTweet.text}"]`;
  }

  textPrompt += `\n\nThe tweet includes ${images.length} image(s) shown above. Consider both the text AND visual content.`;

  if (count === 1) {
    textPrompt += `\n\nOne short reply. Under 15 words. No preamble.`;
  } else {
    textPrompt += `\n\nWrite ${count} short reply options. Each under 15 words. Different vibes, same brevity. Format as JSON array: ["reply1", "reply2", "reply3"]`;
  }

  content.push({ type: 'text', text: textPrompt });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: count === 1 ? 100 : 300,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: content as Anthropic.MessageCreateParams['messages'][0]['content']
      }
    ]
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  if (count === 1) {
    return [responseText.trim()];
  }

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const replies = JSON.parse(jsonMatch[0]);
      if (Array.isArray(replies)) {
        return replies.map((r: string) => r.trim());
      }
    }
  } catch {
    // Fallback
  }

  return [responseText.trim()];
}

export async function generateVariations(
  originalTweet: string,
  currentReply: string,
  stylePrompt?: string,
  count: number = 3
): Promise<string[]> {
  const systemPrompt = stylePrompt || `You write Twitter replies. One-liners only. 15 words max. Usually under 10.

Keep it casual. Lowercase is fine. No hashtags. No emojis unless the original had them.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Original tweet: "${originalTweet}"

Current reply: "${currentReply}"

Write ${count} variations of this reply. Same vibe, different words. Keep the same general angle/approach but mix up the phrasing. Each under 15 words.

Format as JSON array: ["reply1", "reply2", "reply3"]`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const replies = JSON.parse(jsonMatch[0]);
      if (Array.isArray(replies)) {
        return replies.map((r: string) => r.trim());
      }
    }
  } catch {
    // Fallback
  }

  return [responseText.trim()];
}

export async function refineReply(
  originalTweet: string,
  currentReply: string,
  feedback: string,
  stylePrompt?: string,
  count: number = 3
): Promise<string[]> {
  const systemPrompt = stylePrompt || `You write Twitter replies. One-liners only. 15 words max. Usually under 10.

Keep it casual. Lowercase is fine. No hashtags. No emojis unless appropriate.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Original tweet: "${originalTweet}"

Current reply: "${currentReply}"

User feedback: "${feedback}"

Rewrite the reply based on the feedback. Generate ${count} options. Each under 15 words.

Format as JSON array: ["reply1", "reply2", "reply3"]`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const replies = JSON.parse(jsonMatch[0]);
      if (Array.isArray(replies)) {
        return replies.map((r: string) => r.trim());
      }
    }
  } catch {
    // Fallback
  }

  return [responseText.trim()];
}

export async function analyzeWritingStyle(tweets: string[]): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Analyze HOW this person talks (not WHAT they talk about) and create a voice guide for writing replies in their style:

${tweets.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

Focus on VOICE and DELIVERY:
1. Sentence length - do they write long or short? Fragments ok?
2. Punctuation style - periods? no periods? ellipses? dashes?
3. Capitalization - proper caps, all lowercase, ALL CAPS for emphasis?
4. Word choices - formal/casual? slang? specific phrases they repeat?
5. Humor style - dry, absurd, self-deprecating, none?
6. Energy level - chill, hyped, deadpan?

DO NOT focus on:
- What topics they care about
- Their opinions or takes
- What "value" they add
- Their expertise or knowledge areas

The goal is to capture their VOICE so replies sound like them, not their BRAIN.

Format as a short system prompt (under 200 words) that captures how to write like them. Focus on the mechanics of their writing, not their worldview.`,
      },
    ],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}
