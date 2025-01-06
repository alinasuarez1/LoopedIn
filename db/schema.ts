import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique().notNull(),
  phoneNumber: text("phone_number").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loops = pgTable("loops", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  frequency: text("frequency").notNull(), // 'biweekly' or 'monthly'
  vibe: json("vibe").$type<string[]>().notNull(),
  context: text("context"),
  reminderSchedule: json("reminder_schedule").$type<string[]>().notNull(),
  creatorId: integer("creator_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loopMembers = pgTable("loop_members", {
  id: serial("id").primaryKey(),
  loopId: integer("loop_id").references(() => loops.id),
  userId: integer("user_id").references(() => users.id),
  context: text("context"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const updates = pgTable("updates", {
  id: serial("id").primaryKey(),
  loopId: integer("loop_id").references(() => loops.id),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const newsletters = pgTable("newsletters", {
  id: serial("id").primaryKey(),
  loopId: integer("loop_id").references(() => loops.id),
  content: text("content").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
});

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
