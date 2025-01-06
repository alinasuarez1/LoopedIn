import Anthropic from '@anthropic-ai/sdk';
import type { Newsletter } from '@db/schema';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateNewsletter(
  loopName: string,
  updates: Array<{ content: string; userName: string }>,
  vibe: string[]
): Promise<string> {
  const updatesList = updates.map(u => `${u.userName}: ${u.content}`).join('\n');
  const vibeDescription = vibe.join(', ');

  const prompt = `Generate a friendly newsletter for the group "${loopName}". 
The newsletter should have a ${vibeDescription} tone.

Here are the updates from members:

${updatesList}

Please format this as a well-structured newsletter that includes:
1. A warm greeting
2. A summary of key updates/themes
3. Individual updates organized in an engaging way
4. A friendly closing

Use markdown formatting for better readability.`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].value;
}

export async function analyzeUpdatesForHighlights(updates: string[]): Promise<string[]> {
  const prompt = `Given these updates from a group, identify 3-5 key themes or highlights that would be interesting to feature in a newsletter:

${updates.join('\n')}

Please output only the highlights, one per line.`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].value.split('\n').filter(Boolean);
}