import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum('role', ['admin', 'investor']);
export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'paid', 'cancelled']);
export const agreementStatusEnum = pgEnum('agreement_status', ['pending', 'signed', 'expired']);
export const syncStatusEnum = pgEnum('sync_status', ['running', 'success', 'failed']);
export const poolStatusEnum = pgEnum('pool_status', ['draft', 'open', 'locked', 'closed']);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").default('investor').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const investments = pgTable("investments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: real("amount").notNull(),
  startDate: date("start_date").defaultNow().notNull(),
  roi: real("roi").default(0).notNull(),
  description: text("description"),
});

export const payouts = pgTable("payouts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  month: text("month").notNull(),
  amount: real("amount").notNull(),
  status: payoutStatusEnum("status").default('pending').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  description: text("description"),
  uploadDate: timestamp("upload_date").defaultNow().notNull(),
});

export const poolPerformance = pgTable("pool_performance", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  totalPoolSize: real("total_pool_size").default(0).notNull(),
  activeLoans: integer("active_loans").default(0).notNull(),
  par1Plus: real("par_1_plus").default(0).notNull(),
  par7Plus: real("par_7_plus").default(0).notNull(),
  par30Plus: real("par_30_plus").default(0).notNull(),
  monthlyCollections: real("monthly_collections").default(0).notNull(),
  reserveBalance: real("reserve_balance").default(0).notNull(),
  defaultRate: real("default_rate").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const poolPerformanceHistory = pgTable("pool_performance_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  month: text("month").notNull(),
  totalPoolSize: real("total_pool_size").default(0).notNull(),
  activeLoans: integer("active_loans").default(0).notNull(),
  par1Plus: real("par_1_plus").default(0).notNull(),
  par7Plus: real("par_7_plus").default(0).notNull(),
  par30Plus: real("par_30_plus").default(0).notNull(),
  monthlyCollections: real("monthly_collections").default(0).notNull(),
  reserveBalance: real("reserve_balance").default(0).notNull(),
  defaultRate: real("default_rate").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const waterfallConfig = pgTable("waterfall_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  servicingFeePercent: real("servicing_fee_percent").default(2).notNull(),
  investorReturnsPercent: real("investor_returns_percent").default(70).notNull(),
  reserveFundPercent: real("reserve_fund_percent").default(10).notNull(),
  sponsorProfitPercent: real("sponsor_profit_percent").default(18).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const waterfallDistributions = pgTable("waterfall_distributions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  month: text("month").notNull(),
  totalCollections: real("total_collections").notNull(),
  servicingFee: real("servicing_fee").notNull(),
  investorReturns: real("investor_returns").notNull(),
  reserveFund: real("reserve_fund").notNull(),
  sponsorProfit: real("sponsor_profit").notNull(),
  servicingFeePercent: real("servicing_fee_percent").notNull(),
  investorReturnsPercent: real("investor_returns_percent").notNull(),
  reserveFundPercent: real("reserve_fund_percent").notNull(),
  sponsorProfitPercent: real("sponsor_profit_percent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agreements = pgTable("agreements", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  investmentAmount: real("investment_amount").notNull(),
  status: agreementStatusEnum("status").default('pending').notNull(),
  signatureData: text("signature_data"),
  signedPdfFilename: text("signed_pdf_filename"),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// ABS Pool tables
export const absPools = pgTable("abs_pools", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  targetAmount: real("target_amount").default(0).notNull(),
  status: poolStatusEnum("status").default('draft').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lockedAt: timestamp("locked_at"),
});

export const poolLoans = pgTable("pool_loans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  poolId: integer("pool_id").references(() => absPools.id, { onDelete: 'cascade' }).notNull(),
  mifosLoanId: integer("mifos_loan_id").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// MifosX sync tables
export const mifosSyncLogs = pgTable("mifos_sync_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  status: syncStatusEnum("status").notNull(),
  loansCount: integer("loans_count").default(0),
  repaymentsCount: integer("repayments_count").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const mifosLoans = pgTable("mifos_loans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  mifosLoanId: integer("mifos_loan_id").notNull().unique(),
  accountNo: text("account_no"),
  clientId: integer("client_id"),
  clientName: text("client_name"),
  loanProductName: text("loan_product_name"),
  principal: real("principal").default(0),
  approvedPrincipal: real("approved_principal").default(0),
  totalOutstanding: real("total_outstanding").default(0),
  totalRepaid: real("total_repaid").default(0),
  status: text("status"),
  statusCode: text("status_code"),
  interestRate: real("interest_rate").default(0),
  termFrequency: integer("term_frequency"),
  numberOfRepayments: integer("number_of_repayments"),
  rawData: text("raw_data"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
});

export const mifosRepayments = pgTable("mifos_repayments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  mifosTransactionId: integer("mifos_transaction_id").notNull(),
  mifosLoanId: integer("mifos_loan_id").notNull(),
  transactionType: text("transaction_type"),
  amount: real("amount").default(0),
  principalPortion: real("principal_portion").default(0),
  interestPortion: real("interest_portion").default(0),
  feesPortion: real("fees_portion").default(0),
  penaltyPortion: real("penalty_portion").default(0),
  outstandingBalance: real("outstanding_balance").default(0),
  transactionDate: text("transaction_date"),
  rawData: text("raw_data"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertInvestmentSchema = createInsertSchema(investments).omit({ id: true });
export const insertPayoutSchema = createInsertSchema(payouts).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, uploadDate: true });
export const insertPoolPerformanceSchema = createInsertSchema(poolPerformance).omit({ id: true, updatedAt: true });
export const insertPoolPerformanceHistorySchema = createInsertSchema(poolPerformanceHistory).omit({ id: true, createdAt: true });
export const insertWaterfallConfigSchema = createInsertSchema(waterfallConfig).omit({ id: true, updatedAt: true });
export const insertWaterfallDistributionSchema = createInsertSchema(waterfallDistributions).omit({ id: true, createdAt: true });
export const insertAgreementSchema = createInsertSchema(agreements).omit({ id: true, createdAt: true, signedAt: true, signatureData: true, signedPdfFilename: true });
export const insertMifosSyncLogSchema = createInsertSchema(mifosSyncLogs).omit({ id: true, startedAt: true });
export const insertMifosLoanSchema = createInsertSchema(mifosLoans).omit({ id: true, lastSyncedAt: true });
export const insertMifosRepaymentSchema = createInsertSchema(mifosRepayments).omit({ id: true, lastSyncedAt: true });
export const insertAbsPoolSchema = createInsertSchema(absPools).omit({ id: true, createdAt: true, lockedAt: true });
export const insertPoolLoanSchema = createInsertSchema(poolLoans).omit({ id: true, addedAt: true });

// Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Investment = typeof investments.$inferSelect;
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// Dashboard stats type
export type DashboardStats = {
  totalInvested: number;
  currentBalance: number;
  monthlyReturn: number;
  roiPercentage: number;
};

// Investor with stats
export type InvestorWithStats = User & {
  totalInvested: number;
  currentBalance: number;
  roiPercentage: number;
};

// Pool Performance types
export type PoolPerformance = typeof poolPerformance.$inferSelect;
export type InsertPoolPerformance = z.infer<typeof insertPoolPerformanceSchema>;
export type PoolPerformanceHistory = typeof poolPerformanceHistory.$inferSelect;
export type InsertPoolPerformanceHistory = z.infer<typeof insertPoolPerformanceHistorySchema>;

// Waterfall types
export type WaterfallConfig = typeof waterfallConfig.$inferSelect;
export type InsertWaterfallConfig = z.infer<typeof insertWaterfallConfigSchema>;
export type WaterfallDistribution = typeof waterfallDistributions.$inferSelect;
export type InsertWaterfallDistribution = z.infer<typeof insertWaterfallDistributionSchema>;

// Agreement types
export type Agreement = typeof agreements.$inferSelect;
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;

// MifosX sync types
export type MifosSyncLog = typeof mifosSyncLogs.$inferSelect;
export type InsertMifosSyncLog = z.infer<typeof insertMifosSyncLogSchema>;
export type MifosLoan = typeof mifosLoans.$inferSelect;
export type InsertMifosLoan = z.infer<typeof insertMifosLoanSchema>;
export type MifosRepayment = typeof mifosRepayments.$inferSelect;
export type InsertMifosRepayment = z.infer<typeof insertMifosRepaymentSchema>;

// ABS Pool types
export type AbsPool = typeof absPools.$inferSelect;
export type InsertAbsPool = z.infer<typeof insertAbsPoolSchema>;
export type PoolLoan = typeof poolLoans.$inferSelect;
export type InsertPoolLoan = z.infer<typeof insertPoolLoanSchema>;

// Pool with metrics
export type PoolWithMetrics = AbsPool & {
  loanCount: number;
  totalPrincipal: number;
  totalOutstanding: number;
  totalRepaid: number;
};
