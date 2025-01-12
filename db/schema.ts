import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { nanoid } from 'nanoid';

export type ReminderSchedule = {
  day: string;
  time: string; // 24-hour format "HH:mm"
}[];

export type NewsletterStatus = 'draft' | 'finalized' | 'sent';

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phoneNumber: text("phone_number").unique().notNull(),
  isAdmin: boolean("is_admin").default(false),
  isPrivileged: boolean("is_privileged").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loops = pgTable("loops", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  frequency: text("frequency").notNull(), // 'biweekly' or 'monthly'
  vibe: jsonb("vibe").$type<string[]>().notNull(),
  context: text("context"),
  reminderSchedule: jsonb("reminder_schedule").$type<ReminderSchedule>().notNull(),
  creatorId: integer("creator_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loopMembers = pgTable("loop_members", {
  id: serial("id").primaryKey(),
  loopId: integer("loop_id").references(() => loops.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
  context: text("context"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const updates = pgTable("updates", {
  id: serial("id").primaryKey(),
  loopId: integer("loop_id").references(() => loops.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const newsletters = pgTable("newsletters", {
  id: serial("id").primaryKey(),
  loopId: integer("loop_id").references(() => loops.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ['draft', 'finalized', 'sent'] }).$type<NewsletterStatus>().notNull().default('draft'),
  urlId: text("url_id").notNull().unique(),
  sentAt: timestamp("sent_at", { precision: 3, mode: "date" }),
  createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
});

// Define relations
export const loopsRelations = relations(loops, ({ one, many }) => ({
  creator: one(users, {
    fields: [loops.creatorId],
    references: [users.id],
  }),
  members: many(loopMembers),
  updates: many(updates),
  newsletters: many(newsletters),
}));

export const loopMembersRelations = relations(loopMembers, ({ one }) => ({
  loop: one(loops, {
    fields: [loopMembers.loopId],
    references: [loops.id],
  }),
  user: one(users, {
    fields: [loopMembers.userId],
    references: [users.id],
  }),
}));

export const updatesRelations = relations(updates, ({ one }) => ({
  loop: one(loops, {
    fields: [updates.loopId],
    references: [loops.id],
  }),
  user: one(users, {
    fields: [updates.userId],
    references: [users.id],
  }),
}));

export const newslettersRelations = relations(newsletters, ({ one }) => ({
  loop: one(loops, {
    fields: [newsletters.loopId],
    references: [loops.id],
  }),
}));

// Create Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertLoopSchema = createInsertSchema(loops);
export const selectLoopSchema = createSelectSchema(loops);
export const insertLoopMemberSchema = createInsertSchema(loopMembers);
export const selectLoopMemberSchema = createSelectSchema(loopMembers);
export const insertUpdateSchema = createInsertSchema(updates);
export const selectUpdateSchema = createSelectSchema(updates);
export const insertNewsletterSchema = createInsertSchema(newsletters);
export const selectNewsletterSchema = createSelectSchema(newsletters);

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Loop = typeof loops.$inferSelect;
export type InsertLoop = typeof loops.$inferInsert;
export type LoopMember = typeof loopMembers.$inferSelect;
export type InsertLoopMember = typeof loopMembers.$inferInsert;
export type Update = typeof updates.$inferSelect;
export type InsertUpdate = typeof updates.$inferInsert;
export type Newsletter = typeof newsletters.$inferSelect;
export type InsertNewsletter = typeof newsletters.$inferInsert;