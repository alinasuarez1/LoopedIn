import Anthropic from '@anthropic-ai/sdk';
import type { Newsletter } from '@db/schema';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface NewsletterUpdate {
  content: string;
  userName: string;
  mediaUrls?: string[];
}

interface NewsletterOptions {
  customHeader?: string;
  customClosing?: string;
}

export async function generateNewsletter(
  loopName: string,
  updates: NewsletterUpdate[],
  vibe: string[],
  options?: NewsletterOptions
): Promise<string> {
  try {
    const updatesList = updates.map(u => {
      const mediaHtml = u.mediaUrls?.map((url, index) => 
        `\n![Update media ${index + 1}](${url})`
      ).join('\n') || '';

      return `${u.userName}: ${u.content}${mediaHtml}`;
    }).join('\n\n');

    const vibeDescription = vibe.join(', ');
    const customHeader = options?.customHeader ? `\nCustom Header: ${options.customHeader}` : '';
    const customClosing = options?.customClosing ? `\nCustom Closing: ${options.customClosing}` : '';

    const prompt = `Generate a friendly and engaging newsletter for the group "${loopName}". 
The newsletter should have a ${vibeDescription} tone.

${customHeader}

Here are the updates from members:

${updatesList}

Please format this as a well-structured newsletter that includes:
1. A warm, personalized greeting that matches the group's vibe
2. A brief overview highlighting key themes or patterns from the updates
3. Individual member updates, organized in an engaging way
4. Key highlights or noteworthy moments
5. A forward-looking element that builds anticipation for the next update${customClosing}

Use markdown formatting for better readability. Make sure to:
- Break up long paragraphs
- Use bullet points for lists
- Add emphasis using bold or italics where appropriate
- Include section headers
- Maintain a consistent, friendly tone throughout
- Preserve all image markdown syntax exactly as provided in the updates`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const newsletterContent = response.content[0].text;

    // Add metadata and formatting
    return `---
Generated for: ${loopName}
Date: ${new Date().toLocaleDateString()}
---

${newsletterContent}

---
This newsletter was generated with ❤️ by Loop
Want to contribute to the next update? Just reply to this message!
---`;
  } catch (error) {
    console.error('Failed to generate newsletter:', error);
    throw new Error('Failed to generate newsletter. Please try again later.');
  }
}

export async function analyzeUpdatesForHighlights(updates: string[]): Promise<string[]> {
  try {
    const prompt = `Given these updates from a group, identify 3-5 key themes or highlights that would be interesting to feature in a newsletter:

${updates.join('\n')}

Please output only the highlights, one per line, focusing on:
- Common themes across updates
- Notable achievements or milestones
- Shared experiences or connections
- Forward-looking plans or aspirations`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].text.split('\n').filter(Boolean);
  } catch (error) {
    console.error('Failed to analyze updates:', error);
    throw new Error('Failed to analyze updates. Please try again later.');
  }
}

export async function suggestNewsletterImprovements(
  newsletterContent: string,
  vibe: string[]
): Promise<string> {
  try {
    const prompt = `Review this newsletter draft and suggest improvements to make it more engaging and aligned with the ${vibe.join(', ')} vibe:

${newsletterContent}

Focus on:
1. Tone and voice consistency
2. Structure and flow
3. Engagement factors
4. Personal touches
5. Call-to-action effectiveness

Provide specific, actionable suggestions.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Failed to suggest improvements:', error);
    throw new Error('Failed to analyze newsletter. Please try again later.');
  }
}