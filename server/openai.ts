import OpenAI from 'openai';
import type { Newsletter } from '@db/schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
    // Process updates with images first
    const updatesList = updates.map(u => {
      const mediaHtml = u.mediaUrls?.map((url, index) => `
        <figure class="my-6">
          <img src="${url}" 
               alt="Update from ${u.userName} - Media ${index + 1}" 
               class="rounded-lg shadow-md max-w-full h-auto mx-auto"
               loading="lazy" />
        </figure>
      `).join('\n') || '';

      return `
        <div class="update-block mb-8">
          <h3 class="text-xl font-semibold mb-3">Update from ${u.userName}</h3>
          <div class="update-content">
            ${u.content.split('\n').map(p => `<p class="mb-4">${p}</p>`).join('\n')}
          </div>
          ${mediaHtml}
        </div>`;
    }).join('\n\n');

    const vibeDescription = vibe.join(', ');
    const customHeader = options?.customHeader || '';
    const customClosing = options?.customClosing || '';

    const prompt = `Generate a comprehensive newsletter for the group "${loopName}" that includes ALL member updates. 
The newsletter should have a ${vibeDescription} tone.

${customHeader ? `Use this custom header: ${customHeader}\n` : ''}

Here are all the updates from members:

${updatesList}

Format this as a newsletter that MUST include:

1. An engaging title
2. A brief highlights section identifying key themes (2-3 paragraphs)
3. ALL member updates in their entirety - this is crucial:
   - Present each update in full
   - Do not summarize or omit any updates
   - Include all images exactly as provided
   - Maintain the original context and meaning
4. A brief forward-looking section

${customClosing ? `\n${customClosing}` : ''}

Important guidelines:
- Use semantic HTML tags (<h1>, <h2>, etc.)
- Keep the structure clear and consistent
- Maintain a ${vibeDescription} tone throughout
- Preserve all HTML content exactly as provided, especially image tags
- Add emoji icons to section headers
- Break up text into digestible paragraphs
- Do not skip or heavily summarize any updates - include everything`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const newsletterContent = completion.choices[0].message.content;

    if (!newsletterContent) {
      throw new Error("Failed to generate newsletter content");
    }

    // Add metadata and formatting
    return `
<div class="newsletter-content max-w-4xl mx-auto">
  <header class="text-center mb-8">
    <h1 class="text-4xl font-bold mb-2">${loopName}</h1>
    <div class="text-sm text-gray-500">
      Generated on ${new Date().toLocaleDateString()}
    </div>
  </header>

  <article class="prose prose-lg mx-auto">
    ${newsletterContent}
  </article>

  <footer class="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
    <p>This newsletter was generated with ❤️ by Loop</p>
    <p class="mt-1">Want to contribute to the next update? Just reply to this message!</p>
  </footer>
</div>`;
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices[0].message.content;
    return content ? content.split('\n').filter(Boolean) : [];
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0].message.content || '';
  } catch (error) {
    console.error('Failed to suggest improvements:', error);
    throw new Error('Failed to analyze newsletter. Please try again later.');
  }
}