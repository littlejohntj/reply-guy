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

export async function generateReply(
  tweet: string,
  authorHandle: string,
  stylePrompt?: string,
  count: number = 1
): Promise<string[]> {
  const systemPrompt = stylePrompt || `You write Twitter replies. Be concise, authentic, and conversational.
Avoid:
- Starting with "Great point!" or similar empty praise
- Being sycophantic or overly enthusiastic
- Using hashtags or emojis unless the conversation calls for it
- Being preachy or giving unsolicited advice

Do:
- Add genuine value or a new perspective
- Be direct and confident
- Match the energy of the original tweet
- Keep it under 280 characters when possible`;

  if (count === 1) {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Write a reply to this tweet by @${authorHandle}:\n\n"${tweet}"\n\nJust give me the reply text, nothing else.`,
        },
      ],
    });
    const reply = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    return [reply];
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Write ${count} different reply options to this tweet by @${authorHandle}:\n\n"${tweet}"\n\nGive me ${count} distinct replies with different tones/angles. Format as JSON array of strings: ["reply1", "reply2", "reply3"]`,
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

export async function analyzeWritingStyle(tweets: string[]): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Analyze the writing style of these tweets and create a detailed style guide for mimicking this voice:

${tweets.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

Include:
1. Tone and personality traits
2. Common phrases or patterns
3. Sentence structure preferences
4. Topics they engage with
5. What they avoid
6. Any unique quirks

Format as a system prompt that could be used to write in this style.`,
      },
    ],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}
