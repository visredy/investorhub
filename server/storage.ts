import { db } from "./db";
import { users, investments, payouts, documents, poolPerformance, poolPerformanceHistory, waterfallConfig, waterfallDistributions, agreements, mifosSyncLogs, mifosLoans, mifosRepayments, absPools, poolLoans } from "@shared/schema";
import type { User, InsertUser, Investment, InsertInvestment, Payout, InsertPayout, Document, InsertDocument, DashboardStats, InvestorWithStats, PoolPerformance, InsertPoolPerformance, PoolPerformanceHistory, InsertPoolPerformanceHistory, WaterfallConfig, InsertWaterfallConfig, WaterfallDistribution, InsertWaterfallDistribution, Agreement, InsertAgreement, MifosSyncLog, InsertMifosSyncLog, MifosLoan, InsertMifosLoan, MifosRepayment, InsertMifosRepayment, AbsPool, InsertAbsPool, PoolLoan, InsertPoolLoan, PoolWithMetrics } from "@shared/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashedPassword, salt] = stored.split(".");
  const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
  const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllInvestors(): Promise<InvestorWithStats[]>;
  validatePassword(email: string, password: string): Promise<User | null>;
  
  // Investments
  getInvestmentsByUser(userId: number): Promise<Investment[]>;
  createInvestment(investment: InsertInvestment): Promise<Investment>;
  updateInvestmentRoi(id: number, roi: number): Promise<Investment | undefined>;
  
  // Payouts
  getPayoutsByUser(userId: number): Promise<Payout[]>;
  createPayout(payout: InsertPayout): Promise<Payout>;
  updatePayoutStatus(id: number, status: 'pending' | 'paid' | 'cancelled'): Promise<Payout | undefined>;
  getPendingPayoutsCount(): Promise<number>;
  
  // Documents
  getDocumentsByUser(userId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  
  // Stats
  getDashboardStats(userId: number): Promise<DashboardStats>;
  
  // Pool Performance
  getPoolPerformance(): Promise<PoolPerformance | undefined>;
  updatePoolPerformance(data: InsertPoolPerformance): Promise<PoolPerformance>;
  getPoolPerformanceHistory(): Promise<PoolPerformanceHistory[]>;
  addPoolPerformanceHistory(data: InsertPoolPerformanceHistory): Promise<PoolPerformanceHistory>;
  
  // Waterfall
  getWaterfallConfig(): Promise<WaterfallConfig | undefined>;
  updateWaterfallConfig(data: InsertWaterfallConfig): Promise<WaterfallConfig>;
  getWaterfallDistributions(): Promise<WaterfallDistribution[]>;
  createWaterfallDistribution(data: InsertWaterfallDistribution): Promise<WaterfallDistribution>;
  
  // Agreements
  getAgreementsByUser(userId: number): Promise<Agreement[]>;
  getAgreement(id: number): Promise<Agreement | undefined>;
  getAllAgreements(): Promise<Agreement[]>;
  createAgreement(data: InsertAgreement): Promise<Agreement>;
  signAgreement(id: number, signatureData: string, signedPdfFilename: string): Promise<Agreement | undefined>;
  
  // MifosX Sync
  createSyncLog(data: InsertMifosSyncLog): Promise<MifosSyncLog>;
  updateSyncLog(id: number, data: Partial<InsertMifosSyncLog>): Promise<MifosSyncLog | undefined>;
  getSyncLogs(limit?: number): Promise<MifosSyncLog[]>;
  upsertMifosLoan(data: InsertMifosLoan): Promise<MifosLoan>;
  getMifosLoans(): Promise<MifosLoan[]>;
  upsertMifosRepayment(data: InsertMifosRepayment): Promise<MifosRepayment>;
  getMifosRepaymentsByLoan(mifosLoanId: number): Promise<MifosRepayment[]>;
  clearMifosData(): Promise<void>;
  
  // ABS Pools
  getAllPools(): Promise<PoolWithMetrics[]>;
  getPool(id: number): Promise<AbsPool | undefined>;
  createPool(data: InsertAbsPool): Promise<AbsPool>;
  updatePoolStatus(id: number, status: 'draft' | 'open' | 'locked' | 'closed'): Promise<AbsPool | undefined>;
  deletePool(id: number): Promise<void>;
  getPoolLoans(poolId: number): Promise<PoolLoan[]>;
  addLoanToPool(data: InsertPoolLoan): Promise<PoolLoan>;
  removeLoanFromPool(poolId: number, mifosLoanId: number): Promise<void>;
  getPoolMetrics(poolId: number): Promise<PoolWithMetrics | undefined>;
  getAvailableLoansForPool(poolId: number): Promise<MifosLoan[]>;
  
  // Seed
  seedDatabase(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await hashPassword(insertUser.password);
    const [user] = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
      password: hashedPassword,
    }).returning();
    return user;
  }

  async validatePassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    const isValid = await comparePasswords(password, user.password);
    return isValid ? user : null;
  }

  async getAllInvestors(): Promise<InvestorWithStats[]> {
    const allUsers = await db.select().from(users).where(eq(users.role, 'investor'));
    const result: InvestorWithStats[] = [];
    
    for (const user of allUsers) {
      const stats = await this.getDashboardStats(user.id);
      result.push({
        ...user,
        totalInvested: stats.totalInvested,
        currentBalance: stats.currentBalance,
        roiPercentage: stats.roiPercentage,
      });
    }
    
    return result;
  }

  async getInvestmentsByUser(userId: number): Promise<Investment[]> {
    return db.select().from(investments).where(eq(investments.userId, userId));
  }

  async createInvestment(investment: InsertInvestment): Promise<Investment> {
    const [inv] = await db.insert(investments).values(investment).returning();
    return inv;
  }

  async updateInvestmentRoi(id: number, roi: number): Promise<Investment | undefined> {
    const [inv] = await db.update(investments).set({ roi }).where(eq(investments.id, id)).returning();
    return inv;
  }

  async getPayoutsByUser(userId: number): Promise<Payout[]> {
    return db.select().from(payouts).where(eq(payouts.userId, userId));
  }

  async createPayout(payout: InsertPayout): Promise<Payout> {
    const [p] = await db.insert(payouts).values(payout).returning();
    return p;
  }

  async updatePayoutStatus(id: number, status: 'pending' | 'paid' | 'cancelled'): Promise<Payout | undefined> {
    const [p] = await db.update(payouts).set({ status }).where(eq(payouts.id, id)).returning();
    return p;
  }

  async getPendingPayoutsCount(): Promise<number> {
    const pending = await db.select().from(payouts).where(eq(payouts.status, 'pending'));
    return pending.length;
  }

  async getDocumentsByUser(userId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.userId, userId));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [d] = await db.insert(documents).values(doc).returning();
    return d;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getDashboardStats(userId: number): Promise<DashboardStats> {
    const userInvestments = await this.getInvestmentsByUser(userId);
    const userPayouts = await this.getPayoutsByUser(userId);
    
    const totalInvested = userInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    const totalReturns = userInvestments.reduce((sum, inv) => sum + (inv.amount * (inv.roi / 100)), 0);
    const paidPayouts = userPayouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    
    const currentBalance = totalInvested + totalReturns - paidPayouts;
    
    const avgRoi = userInvestments.length > 0 
      ? userInvestments.reduce((sum, inv) => sum + inv.roi, 0) / userInvestments.length 
      : 0;
    const monthlyReturn = totalInvested * (avgRoi / 100 / 12);
    
    const roiPercentage = totalInvested > 0 
      ? ((currentBalance - totalInvested) / totalInvested) * 100 
      : 0;
    
    return {
      totalInvested,
      currentBalance,
      monthlyReturn,
      roiPercentage,
    };
  }

  async getPoolPerformance(): Promise<PoolPerformance | undefined> {
    const [perf] = await db.select().from(poolPerformance);
    return perf;
  }

  async updatePoolPerformance(data: InsertPoolPerformance): Promise<PoolPerformance> {
    const existing = await this.getPoolPerformance();
    if (existing) {
      const [updated] = await db.update(poolPerformance)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(poolPerformance.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(poolPerformance).values(data).returning();
      return created;
    }
  }

  async getPoolPerformanceHistory(): Promise<PoolPerformanceHistory[]> {
    return db.select().from(poolPerformanceHistory).orderBy(desc(poolPerformanceHistory.createdAt));
  }

  async addPoolPerformanceHistory(data: InsertPoolPerformanceHistory): Promise<PoolPerformanceHistory> {
    const [hist] = await db.insert(poolPerformanceHistory).values(data).returning();
    return hist;
  }

  async getWaterfallConfig(): Promise<WaterfallConfig | undefined> {
    const [config] = await db.select().from(waterfallConfig);
    return config;
  }

  async updateWaterfallConfig(data: InsertWaterfallConfig): Promise<WaterfallConfig> {
    const existing = await this.getWaterfallConfig();
    if (existing) {
      const [updated] = await db.update(waterfallConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(waterfallConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(waterfallConfig).values(data).returning();
      return created;
    }
  }

  async getWaterfallDistributions(): Promise<WaterfallDistribution[]> {
    return db.select().from(waterfallDistributions).orderBy(desc(waterfallDistributions.createdAt));
  }

  async createWaterfallDistribution(data: InsertWaterfallDistribution): Promise<WaterfallDistribution> {
    const [dist] = await db.insert(waterfallDistributions).values(data).returning();
    return dist;
  }

  async getAgreementsByUser(userId: number): Promise<Agreement[]> {
    return db.select().from(agreements).where(eq(agreements.userId, userId)).orderBy(desc(agreements.createdAt));
  }

  async getAgreement(id: number): Promise<Agreement | undefined> {
    const [agreement] = await db.select().from(agreements).where(eq(agreements.id, id));
    return agreement;
  }

  async getAllAgreements(): Promise<Agreement[]> {
    return db.select().from(agreements).orderBy(desc(agreements.createdAt));
  }

  async createAgreement(data: InsertAgreement): Promise<Agreement> {
    const [agreement] = await db.insert(agreements).values(data).returning();
    return agreement;
  }

  async signAgreement(id: number, signatureData: string, signedPdfFilename: string): Promise<Agreement | undefined> {
    const [agreement] = await db.update(agreements)
      .set({ 
        signatureData, 
        signedPdfFilename, 
        status: 'signed', 
        signedAt: new Date() 
      })
      .where(eq(agreements.id, id))
      .returning();
    return agreement;
  }

  async seedDatabase(): Promise<void> {
    // Check if already seeded
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) return;

    // Create admin
    const admin = await this.createUser({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin',
    });

    // Create investors
    const investor1 = await this.createUser({
      name: 'John Smith',
      email: 'john@example.com',
      password: 'password123',
      role: 'investor',
    });

    const investor2 = await this.createUser({
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      password: 'password123',
      role: 'investor',
    });

    const investor3 = await this.createUser({
      name: 'Michael Chen',
      email: 'michael@example.com',
      password: 'password123',
      role: 'investor',
    });

    // Add investments
    await this.createInvestment({ userId: investor1.id, amount: 50000, roi: 12.5, description: 'Growth Fund A' });
    await this.createInvestment({ userId: investor1.id, amount: 25000, roi: 8.0, description: 'Stable Income Fund' });
    await this.createInvestment({ userId: investor2.id, amount: 100000, roi: 15.0, description: 'High Yield Portfolio' });
    await this.createInvestment({ userId: investor3.id, amount: 75000, roi: 10.0, description: 'Balanced Growth' });
    await this.createInvestment({ userId: investor3.id, amount: 30000, roi: 7.5, description: 'Conservative Fund' });

    // Add payouts
    await this.createPayout({ userId: investor1.id, month: 'January 2024', amount: 520.83, status: 'paid' });
    await this.createPayout({ userId: investor1.id, month: 'February 2024', amount: 520.83, status: 'paid' });
    await this.createPayout({ userId: investor1.id, month: 'March 2024', amount: 687.50, status: 'pending' });
    await this.createPayout({ userId: investor2.id, month: 'December 2023', amount: 1250.00, status: 'paid' });
    await this.createPayout({ userId: investor2.id, month: 'January 2024', amount: 1250.00, status: 'paid' });
    await this.createPayout({ userId: investor3.id, month: 'March 2024', amount: 625.00, status: 'paid' });
    await this.createPayout({ userId: investor3.id, month: 'April 2024', amount: 812.50, status: 'pending' });

    // Add pool performance data
    await this.updatePoolPerformance({
      totalPoolSize: 2500000,
      activeLoans: 145,
      par1Plus: 8.5,
      par7Plus: 4.2,
      par30Plus: 1.8,
      monthlyCollections: 285000,
      reserveBalance: 125000,
      defaultRate: 0.9,
    });

    // Add historical data
    const months = ['Sep 2023', 'Oct 2023', 'Nov 2023', 'Dec 2023', 'Jan 2024', 'Feb 2024'];
    const historicalData = [
      { totalPoolSize: 1800000, activeLoans: 98, par1Plus: 10.2, par7Plus: 5.5, par30Plus: 2.8, monthlyCollections: 195000, reserveBalance: 85000, defaultRate: 1.5 },
      { totalPoolSize: 1950000, activeLoans: 108, par1Plus: 9.8, par7Plus: 5.2, par30Plus: 2.5, monthlyCollections: 215000, reserveBalance: 92000, defaultRate: 1.3 },
      { totalPoolSize: 2100000, activeLoans: 118, par1Plus: 9.2, par7Plus: 4.8, par30Plus: 2.2, monthlyCollections: 235000, reserveBalance: 100000, defaultRate: 1.2 },
      { totalPoolSize: 2200000, activeLoans: 125, par1Plus: 8.9, par7Plus: 4.6, par30Plus: 2.0, monthlyCollections: 248000, reserveBalance: 108000, defaultRate: 1.1 },
      { totalPoolSize: 2350000, activeLoans: 135, par1Plus: 8.7, par7Plus: 4.4, par30Plus: 1.9, monthlyCollections: 265000, reserveBalance: 115000, defaultRate: 1.0 },
      { totalPoolSize: 2450000, activeLoans: 140, par1Plus: 8.6, par7Plus: 4.3, par30Plus: 1.85, monthlyCollections: 275000, reserveBalance: 120000, defaultRate: 0.95 },
    ];

    for (let i = 0; i < months.length; i++) {
      await this.addPoolPerformanceHistory({ month: months[i], ...historicalData[i] });
    }

    console.log('Database seeded with sample data!');
  }

  // MifosX Sync methods
  async createSyncLog(data: InsertMifosSyncLog): Promise<MifosSyncLog> {
    const [log] = await db.insert(mifosSyncLogs).values(data).returning();
    return log;
  }

  async updateSyncLog(id: number, data: Partial<InsertMifosSyncLog>): Promise<MifosSyncLog | undefined> {
    const [log] = await db.update(mifosSyncLogs)
      .set({ ...data, completedAt: new Date() })
      .where(eq(mifosSyncLogs.id, id))
      .returning();
    return log;
  }

  async getSyncLogs(limit: number = 50): Promise<MifosSyncLog[]> {
    return db.select().from(mifosSyncLogs).orderBy(desc(mifosSyncLogs.startedAt)).limit(limit);
  }

  async upsertMifosLoan(data: InsertMifosLoan): Promise<MifosLoan> {
    const existing = await db.select().from(mifosLoans).where(eq(mifosLoans.mifosLoanId, data.mifosLoanId));
    
    if (existing.length > 0) {
      const [updated] = await db.update(mifosLoans)
        .set({ ...data, lastSyncedAt: new Date() })
        .where(eq(mifosLoans.mifosLoanId, data.mifosLoanId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(mifosLoans).values(data).returning();
      return created;
    }
  }

  async getMifosLoans(): Promise<MifosLoan[]> {
    return db.select().from(mifosLoans).orderBy(desc(mifosLoans.lastSyncedAt));
  }

  async upsertMifosRepayment(data: InsertMifosRepayment): Promise<MifosRepayment> {
    const existing = await db.select().from(mifosRepayments)
      .where(eq(mifosRepayments.mifosTransactionId, data.mifosTransactionId));
    
    if (existing.length > 0) {
      const [updated] = await db.update(mifosRepayments)
        .set({ ...data, lastSyncedAt: new Date() })
        .where(eq(mifosRepayments.mifosTransactionId, data.mifosTransactionId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(mifosRepayments).values(data).returning();
      return created;
    }
  }

  async getMifosRepaymentsByLoan(mifosLoanId: number): Promise<MifosRepayment[]> {
    return db.select().from(mifosRepayments).where(eq(mifosRepayments.mifosLoanId, mifosLoanId));
  }

  async clearMifosData(): Promise<void> {
    await db.delete(mifosRepayments);
    await db.delete(mifosLoans);
  }

  // ABS Pools
  async getAllPools(): Promise<PoolWithMetrics[]> {
    const pools = await db.select().from(absPools).orderBy(desc(absPools.createdAt));
    const poolsWithMetrics: PoolWithMetrics[] = [];
    
    for (const pool of pools) {
      const metrics = await this.getPoolMetrics(pool.id);
      if (metrics) {
        poolsWithMetrics.push(metrics);
      }
    }
    
    return poolsWithMetrics;
  }

  async getPool(id: number): Promise<AbsPool | undefined> {
    const [pool] = await db.select().from(absPools).where(eq(absPools.id, id));
    return pool;
  }

  async createPool(data: InsertAbsPool): Promise<AbsPool> {
    const [pool] = await db.insert(absPools).values(data).returning();
    return pool;
  }

  async updatePoolStatus(id: number, status: 'draft' | 'open' | 'locked' | 'closed'): Promise<AbsPool | undefined> {
    const updateData: any = { status };
    if (status === 'locked') {
      updateData.lockedAt = new Date();
    }
    const [pool] = await db.update(absPools)
      .set(updateData)
      .where(eq(absPools.id, id))
      .returning();
    return pool;
  }

  async deletePool(id: number): Promise<void> {
    await db.delete(absPools).where(eq(absPools.id, id));
  }

  async getPoolLoans(poolId: number): Promise<PoolLoan[]> {
    return db.select().from(poolLoans).where(eq(poolLoans.poolId, poolId));
  }

  async addLoanToPool(data: InsertPoolLoan): Promise<PoolLoan> {
    const [poolLoan] = await db.insert(poolLoans).values(data).returning();
    return poolLoan;
  }

  async removeLoanFromPool(poolId: number, mifosLoanId: number): Promise<void> {
    await db.delete(poolLoans)
      .where(and(eq(poolLoans.poolId, poolId), eq(poolLoans.mifosLoanId, mifosLoanId)));
  }

  async getPoolMetrics(poolId: number): Promise<PoolWithMetrics | undefined> {
    const [pool] = await db.select().from(absPools).where(eq(absPools.id, poolId));
    if (!pool) return undefined;

    const loans = await this.getPoolLoans(poolId);
    const mifosLoanIds = loans.map(l => l.mifosLoanId);
    
    let totalPrincipal = 0;
    let totalOutstanding = 0;
    let totalRepaid = 0;

    if (mifosLoanIds.length > 0) {
      const linkedLoans = await db.select().from(mifosLoans)
        .where(inArray(mifosLoans.mifosLoanId, mifosLoanIds));
      
      for (const loan of linkedLoans) {
        totalPrincipal += loan.principal || 0;
        totalOutstanding += loan.totalOutstanding || 0;
        totalRepaid += loan.totalRepaid || 0;
      }
    }

    return {
      ...pool,
      loanCount: loans.length,
      totalPrincipal,
      totalOutstanding,
      totalRepaid,
    };
  }

  async getAvailableLoansForPool(poolId: number): Promise<MifosLoan[]> {
    const existingLoans = await this.getPoolLoans(poolId);
    const existingMifosLoanIds = existingLoans.map(l => l.mifosLoanId);
    
    const allLoans = await db.select().from(mifosLoans);
    return allLoans.filter(loan => !existingMifosLoanIds.includes(loan.mifosLoanId));
  }
}

export const storage = new DatabaseStorage();
