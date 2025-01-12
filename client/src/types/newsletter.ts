import { z } from 'zod';

export type NewsletterStatus = 'draft' | 'finalized' | 'sent';

export interface Newsletter {
  id: number;
  content: string;
  status: NewsletterStatus;
  urlId: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  loopId: number;
}

export const newsletterSchema = z.object({
  id: z.number(),
  content: z.string(),
  status: z.enum(['draft', 'finalized', 'sent']),
  urlId: z.string(),
  sentAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  loopId: z.number(),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
