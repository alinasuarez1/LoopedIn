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

// Helper function to split updates into batches
function splitUpdatesToBatches(updates: NewsletterUpdate[], batchSize: number = 10): NewsletterUpdate[][] {
  const batches: NewsletterUpdate[][] = [];
  for (let i = 0; i < updates.length; i += batchSize) {
    batches.push(updates.slice(i, i + batchSize));
  }
  return batches;
}

async function generateNewsletterSection(
  loopName: string,
  updates: NewsletterUpdate[],
  vibe: string[],
  sectionIndex: number,
  totalSections: number,
  options?: NewsletterOptions
): Promise<string> {
  const vibeDescription = vibe.join(', ');
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

  let prompt: string;

  if (sectionIndex === 0) {
    // First section: Include title and introduction
    prompt = `Create the opening section of the newsletter for the group "${loopName}" with a ${vibeDescription} tone.

Here are the first set of updates to cover:

${updatesList}

Requirements:
1. Start with:
   - A catchy overall title for the entire newsletter using <h1> tag
   - An engaging introduction that sets the tone
   - A smooth transition into the first updates
2. Present the updates in a natural, narrative flow:
   - Group related updates together
   - Use member quotes to highlight key points
   - Keep ALL original content including images exactly as provided

Format Guidelines:
- Main title: <h1 class="text-4xl font-bold text-center mb-8">
- Section headers: <h2 class="text-2xl font-bold mt-8 mb-4">
- Quotes: <blockquote class="border-l-4 border-primary pl-4 my-4 italic">`;
  } else if (sectionIndex === totalSections - 1) {
    // Last section: Include conclusion
    prompt = `Create the final section of the newsletter for the group "${loopName}" with a ${vibeDescription} tone.

Here are the final updates to cover:

${updatesList}

Requirements:
1. Present the updates in a natural, narrative flow:
   - Group related updates together
   - Use member quotes to highlight key points
   - Keep ALL original content including images exactly as provided
2. End with:
   - A satisfying conclusion that ties everything together
   - A fun prompt or question for next time

Format Guidelines:
- Section headers: <h2 class="text-2xl font-bold mt-8 mb-4">
- Quotes: <blockquote class="border-l-4 border-primary pl-4 my-4 italic">`;
  } else {
    // Middle sections: Pure content focus
    prompt = `Continue the newsletter for the group "${loopName}" with a ${vibeDescription} tone.

Here are the next updates to cover:

${updatesList}

Requirements:
1. Focus ONLY on presenting the updates:
   - No introduction or transition text needed
   - No "In this section" or similar phrases
   - Just weave the updates together naturally
2. Present updates in a natural, narrative flow:
   - Group related updates together
   - Use member quotes to highlight key points
   - Keep ALL original content including images exactly as provided

Format Guidelines:
- Section headers: <h2 class="text-2xl font-bold mt-8 mb-4">
- Quotes: <blockquote class="border-l-4 border-primary pl-4 my-4 italic">

IMPORTANT: Do not mention this being a continuation or middle section. Just focus on the content.`;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 4000,
  });

  return completion.choices[0].message.content || '';
}

export async function generateNewsletter(
  loopName: string,
  updates: NewsletterUpdate[],
  vibe: string[],
  options?: NewsletterOptions
): Promise<string> {
  try {
    // First collect all images for the gallery with their associated text
    const allImages = updates.flatMap(update =>
      update.mediaUrls?.map(url => ({
        url,
        userName: update.userName,
        caption: update.content
      })) || []
    );

    // Split updates into batches and generate sections
    const batches = splitUpdatesToBatches(updates);
    const sections = await Promise.all(
      batches.map((batch, index) => 
        generateNewsletterSection(loopName, batch, vibe, index, batches.length, options)
      )
    );

    // Combine all sections
    const newsletterContent = sections.join('\n\n');

    // Create the photo gallery HTML if there are images
    const photoGallery = allImages.length > 0 ? `
<h2 class="text-2xl font-bold mt-12 mb-6">📸 Photo Gallery</h2>
<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
  ${allImages.map(img => `
  <figure class="relative group">
    <img src="${img.url}" 
         alt="Shared by ${img.userName}" 
         class="rounded-lg shadow-md w-full h-48 object-cover"
         loading="lazy" />
    <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 rounded-b-lg">
      <p class="text-sm font-semibold">Shared by ${img.userName}</p>
      ${img.caption ? `<p class="text-xs mt-1 line-clamp-2">${img.caption}</p>` : ''}
    </div>
  </figure>
  `).join('\n')}
</div>` : '';

    return `
<div class="newsletter-content max-w-4xl mx-auto">
  <header class="text-center mb-8">
    <div class="text-sm text-gray-500">
      Generated on ${new Date().toLocaleDateString()}
    </div>
  </header>

  <article class="prose prose-lg mx-auto">
    ${newsletterContent}
    ${photoGallery}
  </article>

  <footer class="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
    <p>This newsletter was generated with ❤️ by LoopedIn</p>
    <p class="mt-1">Want to contribute to the next update? Just send us a text message!</p>
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