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
    const updatesList = updates.map(u => {
      const mediaHtml = u.mediaUrls?.map((url, index) => `
  <figure class="my-4">
    <img src="${url}" 
         alt="Update from ${u.userName} - Media ${index + 1}" 
         class="rounded-lg shadow-md max-w-[250px] w-full h-auto mx-auto"
         loading="lazy" />
  </figure>
`).join('\n') || '';

      return `<div class="update-details" data-member="${u.userName}">
  <div class="update-content mb-4">
    ${u.content}
  </div>
  ${mediaHtml}
</div>`;
    }).join('\n\n');

    const vibeDescription = vibe.join(', ');
    const customHeader = options?.customHeader || '';
    const customClosing = options?.customClosing || '';

    const prompt = `Create an engaging narrative-style newsletter for the group "${loopName}" with a ${vibeDescription} tone.

${customHeader ? `Use this custom header: ${customHeader}\n` : ''}

Here are all the updates from members:

${updatesList}

Important requirements:
1. Create a catchy, fun title that captures the overall theme or spirit
2. Weave the updates into a cohesive story:
   - Create thematic sections that naturally connect different updates
   - Use creative transitions to flow between topics
   - Include relevant quotes from members' updates to add personality
   - Make unexpected but meaningful connections between updates
   - INCLUDE ALL updates but present them in a narrative way
3. Add personality through:
   - Fun, thematic section headers
   - Brief narrative commentary between sections
   - Creative use of emojis that fit the story
4. End with an engaging closing that ties everything together
5. IMPORTANT: For any update that includes images:
   - Keep all image tags exactly as provided
   - Introduce images naturally in the narrative
   - Add context around the images to make them part of the story

${customClosing ? `\n${customClosing}` : ''}

Important guidelines:
- Use proper HTML tags and styling:
  - Main title: <h1 class="text-4xl font-bold text-center mb-8">
  - Section headers: <h2 class="text-2xl font-bold mt-8 mb-4">
  - Quotes: <blockquote class="border-l-4 border-primary pl-4 my-4 italic">
- Make it feel like a story, not a list of updates
- Keep your ${vibeDescription} tone throughout
- Preserve all original content while presenting it creatively
- Include every update but blend them naturally into the narrative
- Use member quotes to highlight key points
- Keep ALL original content including images exactly as provided
- Keep the original context and meaning of updates intact`;

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

    return `
<div class="newsletter-content max-w-3xl mx-auto">
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