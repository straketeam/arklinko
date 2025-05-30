import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  decimal,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for ARKlinko
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique(),
  arkAddress: varchar("ark_address", { length: 34 }).unique(), // ARK addresses are 34 characters
  balance: decimal("balance", { precision: 18, scale: 8 }).default("0"), // ARK precision
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Games table for tracking Plinko game results
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  betAmount: decimal("bet_amount", { precision: 18, scale: 8 }).notNull(),
  multiplier: decimal("multiplier", { precision: 10, scale: 4 }).notNull(),
  payout: decimal("payout", { precision: 18, scale: 8 }).notNull(),
  isWin: boolean("is_win").notNull(),
  seedId: integer("seed_id"),
  nonce: integer("nonce").notNull(),
  gameResult: decimal("game_result", { precision: 10, scale: 3 }), // The raw game result 0-99.999
  transactionId: varchar("transaction_id", { length: 64 }), // ARK transaction ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transactions table for tracking ARK blockchain transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'bet', 'win', 'loss'
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  arkTransactionId: varchar("ark_transaction_id", { length: 64 }),
  fromAddress: varchar("from_address", { length: 34 }),
  toAddress: varchar("to_address", { length: 34 }),
  status: varchar("status", { length: 20 }).default("pending"), // 'pending', 'confirmed', 'failed'
  gameId: integer("game_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Seeds table for provably fair gaming
export const seeds = pgTable("seeds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  serverSeed: varchar("server_seed", { length: 128 }).notNull(),
  clientSeed: varchar("client_seed", { length: 128 }),
  nonce: integer("nonce").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeedSchema = createInsertSchema(seeds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertSeed = z.infer<typeof insertSeedSchema>;
export type Seed = typeof seeds.$inferSelect;
