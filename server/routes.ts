import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, registerSchema, insertInvestmentSchema, insertPayoutSchema, insertPoolPerformanceSchema, insertPoolPerformanceHistorySchema } from "@shared/schema";
import session from "express-session";
import MemoryStore from "memorystore";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import * as mifosService from "./mifos-service";
import { syncMifosData, isSyncRunning } from "./mifos-scheduler";

const SessionStore = MemoryStore(session);

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: multerStorage,
  limits: { fileSize: 16 * 1024 * 1024 } // 16MB
});

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({
      checkPeriod: 86400000
    }),
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: false,
    }
  }));

  // Seed database on startup
  await storage.seedDatabase();

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    next();
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.user = user;
    next();
  };

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.validatePassword(email, password);
      
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      req.session.userId = user.id;
      res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Invalid request' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      
      const user = await storage.createUser({
        ...data,
        role: 'investor',
      });
      
      req.session.userId = user.id;
      res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Invalid request' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ message: 'Logged out' });
    });
  });

  app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    res.json({ 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    });
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    const stats = await storage.getDashboardStats(req.session.userId!);
    res.json(stats);
  });

  app.get('/api/dashboard/investments', requireAuth, async (req, res) => {
    const investments = await storage.getInvestmentsByUser(req.session.userId!);
    res.json(investments);
  });

  app.get('/api/dashboard/payouts', requireAuth, async (req, res) => {
    const payouts = await storage.getPayoutsByUser(req.session.userId!);
    res.json(payouts);
  });

  app.get('/api/dashboard/documents', requireAuth, async (req, res) => {
    const docs = await storage.getDocumentsByUser(req.session.userId!);
    res.json(docs);
  });

  // Document download
  app.get('/api/documents/:id/download', requireAuth, async (req, res) => {
    const doc = await storage.getDocument(parseInt(req.params.id));
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    const user = await storage.getUser(req.session.userId!);
    if (doc.userId !== req.session.userId && user?.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const filePath = path.join(uploadDir, doc.filename);
    res.download(filePath, doc.originalFilename);
  });

  // Admin routes
  app.get('/api/admin/investors', requireAdmin, async (req, res) => {
    const investors = await storage.getAllInvestors();
    res.json(investors);
  });

  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    const investors = await storage.getAllInvestors();
    const pendingPayouts = await storage.getPendingPayoutsCount();
    
    const totalInvested = investors.reduce((sum, inv) => sum + inv.totalInvested, 0);
    const totalBalance = investors.reduce((sum, inv) => sum + inv.currentBalance, 0);
    
    res.json({
      totalInvestors: investors.length,
      totalInvested,
      totalBalance,
      pendingPayouts,
    });
  });

  app.get('/api/admin/investor/:id', requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);
    
    if (!user || user.role !== 'investor') {
      return res.status(404).json({ message: 'Investor not found' });
    }
    
    const [investments, payouts, documents, stats] = await Promise.all([
      storage.getInvestmentsByUser(userId),
      storage.getPayoutsByUser(userId),
      storage.getDocumentsByUser(userId),
      storage.getDashboardStats(userId),
    ]);
    
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      investments,
      payouts,
      documents,
      stats,
    });
  });

  app.post('/api/admin/investor', requireAdmin, async (req, res) => {
    try {
      const { name, email, password, initialInvestment, roi } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email and password are required' });
      }
      
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      
      const user = await storage.createUser({
        name,
        email,
        password,
        role: 'investor',
      });
      
      if (initialInvestment && initialInvestment > 0) {
        await storage.createInvestment({
          userId: user.id,
          amount: initialInvestment,
          roi: roi || 0,
          description: 'Initial investment',
        });
      }
      
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to create investor' });
    }
  });

  app.post('/api/admin/investor/:id/investment', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { amount, roi, description } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
      
      const investment = await storage.createInvestment({
        userId,
        amount,
        roi: roi || 0,
        description,
      });
      
      res.json(investment);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to add investment' });
    }
  });

  app.patch('/api/admin/investment/:id/roi', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { roi } = req.body;
      
      const investment = await storage.updateInvestmentRoi(id, roi);
      if (!investment) {
        return res.status(404).json({ message: 'Investment not found' });
      }
      
      res.json(investment);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to update ROI' });
    }
  });

  app.post('/api/admin/investor/:id/payout', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { amount, month, status } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
      
      const payout = await storage.createPayout({
        userId,
        amount,
        month: month || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        status: status || 'pending',
      });
      
      res.json(payout);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to record payout' });
    }
  });

  app.patch('/api/admin/payout/:id/status', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['pending', 'paid', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      
      const payout = await storage.updatePayoutStatus(id, status);
      if (!payout) {
        return res.status(404).json({ message: 'Payout not found' });
      }
      
      res.json(payout);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to update status' });
    }
  });

  app.post('/api/admin/investor/:id/document', requireAdmin, upload.single('file'), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const doc = await storage.createDocument({
        userId,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        description: req.body.description || req.file.originalname,
      });
      
      res.json(doc);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to upload document' });
    }
  });

  app.delete('/api/admin/document/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const doc = await storage.getDocument(id);
      
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      // Delete file
      const filePath = path.join(uploadDir, doc.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      await storage.deleteDocument(id);
      res.json({ message: 'Document deleted' });
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to delete document' });
    }
  });

  // Pool Performance routes (public for investors to view, admin to edit)
  app.get('/api/pool-performance', requireAuth, async (req, res) => {
    const performance = await storage.getPoolPerformance();
    const history = await storage.getPoolPerformanceHistory();
    res.json({ performance, history });
  });

  app.put('/api/pool-performance', requireAdmin, async (req, res) => {
    try {
      const data = insertPoolPerformanceSchema.parse({
        totalPoolSize: parseFloat(req.body.totalPoolSize),
        activeLoans: parseInt(req.body.activeLoans),
        par1Plus: parseFloat(req.body.par1Plus),
        par7Plus: parseFloat(req.body.par7Plus),
        par30Plus: parseFloat(req.body.par30Plus),
        monthlyCollections: parseFloat(req.body.monthlyCollections),
        reserveBalance: parseFloat(req.body.reserveBalance),
        defaultRate: parseFloat(req.body.defaultRate),
      });
      
      const updated = await storage.updatePoolPerformance(data);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to update pool performance' });
    }
  });

  app.post('/api/pool-performance/history', requireAdmin, async (req, res) => {
    try {
      const data = insertPoolPerformanceHistorySchema.parse({
        month: req.body.month,
        totalPoolSize: parseFloat(req.body.totalPoolSize),
        activeLoans: parseInt(req.body.activeLoans),
        par1Plus: parseFloat(req.body.par1Plus),
        par7Plus: parseFloat(req.body.par7Plus),
        par30Plus: parseFloat(req.body.par30Plus),
        monthlyCollections: parseFloat(req.body.monthlyCollections),
        reserveBalance: parseFloat(req.body.reserveBalance),
        defaultRate: parseFloat(req.body.defaultRate),
      });
      
      const history = await storage.addPoolPerformanceHistory(data);
      res.json(history);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to add history' });
    }
  });

  // Waterfall Engine
  app.get('/api/waterfall/config', requireAdmin, async (req, res) => {
    try {
      let config = await storage.getWaterfallConfig();
      if (!config) {
        config = await storage.updateWaterfallConfig({
          servicingFeePercent: 2,
          investorReturnsPercent: 70,
          reserveFundPercent: 10,
          sponsorProfitPercent: 18,
        });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to get waterfall config' });
    }
  });

  app.put('/api/waterfall/config', requireAdmin, async (req, res) => {
    try {
      const { servicingFeePercent, investorReturnsPercent, reserveFundPercent, sponsorProfitPercent } = req.body;
      
      const svc = parseFloat(servicingFeePercent);
      const inv = parseFloat(investorReturnsPercent);
      const rsv = parseFloat(reserveFundPercent);
      const spn = parseFloat(sponsorProfitPercent);
      
      if (isNaN(svc) || isNaN(inv) || isNaN(rsv) || isNaN(spn)) {
        return res.status(400).json({ message: 'All percentages must be valid numbers' });
      }
      
      if (svc < 0 || inv < 0 || rsv < 0 || spn < 0) {
        return res.status(400).json({ message: 'Percentages cannot be negative' });
      }
      
      if (svc > 100 || inv > 100 || rsv > 100 || spn > 100) {
        return res.status(400).json({ message: 'Individual percentages cannot exceed 100%' });
      }
      
      const total = svc + inv + rsv + spn;
      if (Math.abs(total - 100) > 0.01) {
        return res.status(400).json({ message: `Percentages must sum to 100% (currently ${total.toFixed(2)}%)` });
      }
      
      const config = await storage.updateWaterfallConfig({
        servicingFeePercent: svc,
        investorReturnsPercent: inv,
        reserveFundPercent: rsv,
        sponsorProfitPercent: spn,
      });
      
      res.json(config);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to update waterfall config' });
    }
  });

  app.get('/api/waterfall/distributions', requireAdmin, async (req, res) => {
    try {
      const distributions = await storage.getWaterfallDistributions();
      res.json(distributions);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to get distributions' });
    }
  });

  app.post('/api/waterfall/distribute', requireAdmin, async (req, res) => {
    try {
      const { month, totalCollections } = req.body;
      
      if (!month || typeof month !== 'string' || month.trim() === '') {
        return res.status(400).json({ message: 'Month is required and must be a non-empty string' });
      }
      
      if (totalCollections === undefined || totalCollections === null) {
        return res.status(400).json({ message: 'Total collections is required' });
      }
      
      const collections = parseFloat(totalCollections);
      if (isNaN(collections) || !isFinite(collections)) {
        return res.status(400).json({ message: 'Total collections must be a valid number' });
      }
      
      if (collections <= 0) {
        return res.status(400).json({ message: 'Total collections must be a positive number' });
      }
      
      let config = await storage.getWaterfallConfig();
      if (!config) {
        config = await storage.updateWaterfallConfig({
          servicingFeePercent: 2,
          investorReturnsPercent: 70,
          reserveFundPercent: 10,
          sponsorProfitPercent: 18,
        });
      }
      
      const servicingFee = collections * (config.servicingFeePercent / 100);
      const investorReturns = collections * (config.investorReturnsPercent / 100);
      const reserveFund = collections * (config.reserveFundPercent / 100);
      const sponsorProfit = collections * (config.sponsorProfitPercent / 100);
      
      const distribution = await storage.createWaterfallDistribution({
        month,
        totalCollections: collections,
        servicingFee,
        investorReturns,
        reserveFund,
        sponsorProfit,
        servicingFeePercent: config.servicingFeePercent,
        investorReturnsPercent: config.investorReturnsPercent,
        reserveFundPercent: config.reserveFundPercent,
        sponsorProfitPercent: config.sponsorProfitPercent,
      });
      
      res.json(distribution);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to create distribution' });
    }
  });

  // PDF Statement Generation
  const statementsDir = path.join(process.cwd(), 'statements');
  if (!fs.existsSync(statementsDir)) {
    fs.mkdirSync(statementsDir, { recursive: true });
  }

  app.get('/api/dashboard/statement/:month', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const month = decodeURIComponent(req.params.month);
      
      if (!month || month.trim() === '') {
        return res.status(400).json({ message: 'Month parameter is required' });
      }
      
      const payouts = await storage.getPayoutsByUser(userId);
      const allowedMonths = [...new Set(payouts.map(p => p.month))];
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!allowedMonths.includes(currentMonth)) {
        allowedMonths.unshift(currentMonth);
      }
      
      if (!allowedMonths.includes(month)) {
        return res.status(400).json({ message: 'Invalid month for statement generation' });
      }
      
      const investments = await storage.getInvestmentsByUser(userId);
      
      const totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
      const avgRoi = investments.length > 0 
        ? investments.reduce((sum, inv) => sum + parseFloat(inv.roi || '0'), 0) / investments.length 
        : 0;
      const monthlyReturn = totalInvested * (avgRoi / 100) / 12;
      const totalPayouts = payouts.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const currentBalance = totalInvested + (totalInvested * avgRoi / 100) - totalPayouts;
      
      const openingBalance = currentBalance - monthlyReturn + (payouts.length > 0 ? parseFloat(payouts[payouts.length - 1]?.amount || '0') : 0);
      
      const statementData = {
        investorName: user.name,
        investorEmail: user.email,
        month: month,
        openingBalance: openingBalance,
        returns: monthlyReturn,
        payouts: payouts.length > 0 ? parseFloat(payouts[payouts.length - 1]?.amount || '0') : 0,
        closingBalance: currentBalance,
        roi: avgRoi,
        investments: investments.map(inv => ({
          description: inv.description,
          startDate: new Date(inv.startDate).toLocaleDateString(),
          amount: inv.amount,
          roi: inv.roi
        })),
        payoutList: payouts.slice(-6).map(p => ({
          month: p.month,
          amount: p.amount,
          status: p.status
        }))
      };

      const filename = `statement_${userId}_${Date.now()}.pdf`;
      const outputPath = path.join(statementsDir, filename);
      const jsonInputPath = path.join(statementsDir, `input_${userId}_${Date.now()}.json`);
      
      fs.writeFileSync(jsonInputPath, JSON.stringify(statementData));
      
      const scriptPath = path.join(process.cwd(), 'scripts', 'generate_statement.py');
      
      try {
        const result = spawnSync('python3', [scriptPath, jsonInputPath, outputPath], {
          encoding: 'utf-8',
          timeout: 30000
        });
        
        if (result.error || result.status !== 0) {
          throw new Error(result.stderr || result.error?.message || 'PDF generation failed');
        }
      } catch (execError: any) {
        console.error('PDF generation error:', execError.message);
        fs.unlink(jsonInputPath, () => {});
        return res.status(500).json({ message: 'Failed to generate PDF statement' });
      }
      
      fs.unlink(jsonInputPath, () => {});

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="InvestorHub_Statement_${month.replace(/ /g, '_')}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);
      
      fileStream.on('end', () => {
        fs.unlink(outputPath, () => {});
      });
      
      fileStream.on('error', (err) => {
        console.error('File stream error:', err);
        fs.unlink(outputPath, () => {});
      });
      
    } catch (error: any) {
      console.error('Statement error:', error);
      res.status(500).json({ message: error.message || 'Failed to generate statement' });
    }
  });

  // Get available months for statements
  app.get('/api/dashboard/statement-months', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const payouts = await storage.getPayoutsByUser(userId);
      
      const months = [...new Set(payouts.map(p => p.month))];
      
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!months.includes(currentMonth)) {
        months.unshift(currentMonth);
      }
      
      res.json(months);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to get statement months' });
    }
  });

  // Signed agreements directory
  const signedDocsDir = path.join(process.cwd(), 'signed_agreements');
  if (!fs.existsSync(signedDocsDir)) {
    fs.mkdirSync(signedDocsDir, { recursive: true });
  }

  // Agreement Routes - Investor
  app.get('/api/agreements', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const agreements = await storage.getAgreementsByUser(userId);
      res.json(agreements);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to get agreements' });
    }
  });

  app.get('/api/agreements/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const agreement = await storage.getAgreement(parseInt(req.params.id));
      
      if (!agreement) {
        return res.status(404).json({ message: 'Agreement not found' });
      }
      
      if (agreement.userId !== userId) {
        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ message: 'Access denied' });
        }
      }
      
      res.json(agreement);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to get agreement' });
    }
  });

  // Sign agreement
  app.post('/api/agreements/:id/sign', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const agreementId = parseInt(req.params.id);
      const { signatureData } = req.body;
      
      if (!signatureData || typeof signatureData !== 'string') {
        return res.status(400).json({ message: 'Signature data is required' });
      }
      
      if (!signatureData.startsWith('data:image/')) {
        return res.status(400).json({ message: 'Invalid signature format' });
      }
      
      // Limit signature size to 1MB to prevent DoS
      const maxSignatureSize = 1024 * 1024;
      if (signatureData.length > maxSignatureSize) {
        return res.status(400).json({ message: 'Signature data too large' });
      }
      
      const agreement = await storage.getAgreement(agreementId);
      
      if (!agreement) {
        return res.status(404).json({ message: 'Agreement not found' });
      }
      
      if (agreement.userId !== userId) {
        return res.status(403).json({ message: 'You can only sign your own agreements' });
      }
      
      if (agreement.status === 'signed') {
        return res.status(400).json({ message: 'Agreement is already signed' });
      }
      
      if (agreement.status === 'expired') {
        return res.status(400).json({ message: 'Agreement has expired' });
      }
      
      if (agreement.expiresAt && new Date(agreement.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Agreement has expired' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Generate signed PDF
      const filename = `signed_agreement_${agreementId}_${Date.now()}.pdf`;
      const outputPath = path.join(signedDocsDir, filename);
      const inputPath = path.join(signedDocsDir, `input_${agreementId}_${Date.now()}.json`);
      
      const signatureInput = {
        title: agreement.title,
        content: agreement.content,
        investmentAmount: agreement.investmentAmount,
        investorName: user.name,
        investorEmail: user.email,
        signatureData: signatureData,
        signedDate: new Date().toISOString()
      };
      
      fs.writeFileSync(inputPath, JSON.stringify(signatureInput));
      
      const scriptPath = path.join(process.cwd(), 'scripts', 'generate_signed_agreement.py');
      
      try {
        const result = spawnSync('python3', [scriptPath, inputPath, outputPath], {
          encoding: 'utf-8',
          timeout: 30000
        });
        
        if (result.error || result.status !== 0) {
          throw new Error(result.stderr || result.error?.message || 'PDF generation failed');
        }
      } catch (execError: any) {
        console.error('PDF signing error:', execError.message);
        fs.unlink(inputPath, () => {});
        return res.status(500).json({ message: 'Failed to generate signed agreement PDF' });
      }
      
      fs.unlink(inputPath, () => {});
      
      const signedAgreement = await storage.signAgreement(agreementId, signatureData, filename);
      
      if (!signedAgreement) {
        return res.status(500).json({ message: 'Failed to update agreement' });
      }
      
      res.json(signedAgreement);
    } catch (error: any) {
      console.error('Sign agreement error:', error);
      res.status(500).json({ message: error.message || 'Failed to sign agreement' });
    }
  });

  // Download signed PDF
  app.get('/api/agreements/:id/download', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const agreement = await storage.getAgreement(parseInt(req.params.id));
      
      if (!agreement) {
        return res.status(404).json({ message: 'Agreement not found' });
      }
      
      if (agreement.userId !== userId) {
        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ message: 'Access denied' });
        }
      }
      
      if (!agreement.signedPdfFilename) {
        return res.status(400).json({ message: 'Agreement has not been signed yet' });
      }
      
      const filePath = path.join(signedDocsDir, agreement.signedPdfFilename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Signed PDF file not found' });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="signed_agreement_${agreement.id}.pdf"`);
      res.sendFile(filePath);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to download agreement' });
    }
  });

  // Admin routes for agreements
  app.get('/api/admin/agreements', requireAdmin, async (_req, res) => {
    try {
      const agreements = await storage.getAllAgreements();
      res.json(agreements);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to get agreements' });
    }
  });

  app.post('/api/admin/agreements', requireAdmin, async (req, res) => {
    try {
      const { userId, title, content, investmentAmount, expiresAt } = req.body;
      
      if (!userId || !title || !content || investmentAmount === undefined) {
        return res.status(400).json({ message: 'userId, title, content, and investmentAmount are required' });
      }
      
      if (typeof title !== 'string' || title.length < 1 || title.length > 500) {
        return res.status(400).json({ message: 'Title must be between 1 and 500 characters' });
      }
      
      if (typeof content !== 'string' || content.length < 1 || content.length > 50000) {
        return res.status(400).json({ message: 'Content must be between 1 and 50000 characters' });
      }
      
      const user = await storage.getUser(parseInt(userId));
      if (!user || user.role !== 'investor') {
        return res.status(404).json({ message: 'Investor not found' });
      }
      
      const amount = parseFloat(investmentAmount);
      if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Investment amount must be a positive number' });
      }
      
      const agreement = await storage.createAgreement({
        userId: parseInt(userId),
        title,
        content,
        investmentAmount: amount,
        status: 'pending',
        expiresAt: expiresAt ? new Date(expiresAt) : null
      });
      
      res.status(201).json(agreement);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to create agreement' });
    }
  });

  // ============ MifosX API Routes ============

  // Check if MifosX is configured
  app.get('/api/mifos/status', requireAuth, requireAdmin, async (_req, res) => {
    res.json({ 
      configured: mifosService.isConfigured(),
      message: mifosService.isConfigured() 
        ? 'MifosX integration is configured' 
        : 'MifosX environment variables not set. Please configure MIFOS_API_URL, MIFOS_USERNAME, and MIFOS_PASSWORD.'
    });
  });

  // Get all loans from MifosX
  app.get('/api/mifos/loans', requireAuth, requireAdmin, async (_req, res) => {
    try {
      if (!mifosService.isConfigured()) {
        return res.status(503).json({ message: 'MifosX integration not configured' });
      }
      const loans = await mifosService.getLoans();
      res.json(loans);
    } catch (error: any) {
      console.error('MifosX loans error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch loans from MifosX',
        details: error.responseBody
      });
    }
  });

  // Get repayments for a specific loan
  app.get('/api/mifos/loans/:loanId/repayments', requireAuth, requireAdmin, async (req, res) => {
    try {
      if (!mifosService.isConfigured()) {
        return res.status(503).json({ message: 'MifosX integration not configured' });
      }
      const loanId = parseInt(req.params.loanId);
      if (isNaN(loanId)) {
        return res.status(400).json({ message: 'Invalid loan ID' });
      }
      const repayments = await mifosService.getRepayments(loanId);
      res.json(repayments);
    } catch (error: any) {
      console.error('MifosX repayments error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch repayments from MifosX',
        details: error.responseBody
      });
    }
  });

  // Get portfolio summary
  app.get('/api/mifos/portfolio-summary', requireAuth, requireAdmin, async (_req, res) => {
    try {
      if (!mifosService.isConfigured()) {
        return res.status(503).json({ message: 'MifosX integration not configured' });
      }
      const summary = await mifosService.getPortfolioSummary();
      res.json(summary);
    } catch (error: any) {
      console.error('MifosX portfolio summary error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch portfolio summary from MifosX',
        details: error.responseBody
      });
    }
  });

  // Get PAR report
  app.get('/api/mifos/par-report', requireAuth, requireAdmin, async (_req, res) => {
    try {
      if (!mifosService.isConfigured()) {
        return res.status(503).json({ message: 'MifosX integration not configured' });
      }
      const parReport = await mifosService.getParReport();
      res.json(parReport);
    } catch (error: any) {
      console.error('MifosX PAR report error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch PAR report from MifosX',
        details: error.responseBody
      });
    }
  });

  // Clear MifosX cache (admin only)
  app.post('/api/mifos/clear-cache', requireAuth, requireAdmin, async (_req, res) => {
    mifosService.clearCache();
    res.json({ message: 'MifosX cache cleared successfully' });
  });

  // Get sync logs
  app.get('/api/mifos/sync-logs', requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getSyncLogs(limit);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch sync logs' });
    }
  });

  // Trigger manual sync
  app.post('/api/mifos/sync', requireAuth, requireAdmin, async (_req, res) => {
    if (isSyncRunning()) {
      return res.status(409).json({ message: 'Sync already in progress' });
    }

    // Start sync in background
    syncMifosData().catch(err => {
      console.error('Manual sync failed:', err);
    });

    res.json({ message: 'Sync started. Check sync logs for progress.' });
  });

  // Get synced loans from local database
  app.get('/api/mifos/synced-loans', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const loans = await storage.getMifosLoans();
      res.json(loans);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch synced loans' });
    }
  });

  // Get synced repayments for a loan
  app.get('/api/mifos/synced-loans/:loanId/repayments', requireAuth, requireAdmin, async (req, res) => {
    try {
      const loanId = parseInt(req.params.loanId);
      if (isNaN(loanId)) {
        return res.status(400).json({ message: 'Invalid loan ID' });
      }
      const repayments = await storage.getMifosRepaymentsByLoan(loanId);
      res.json(repayments);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch repayments' });
    }
  });

  // ============ ABS Pool Management Routes ============
  
  // Get all pools with metrics
  app.get('/api/pools', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const pools = await storage.getAllPools();
      res.json(pools);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch pools' });
    }
  });

  // Get single pool with metrics
  app.get('/api/pools/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid pool ID' });
      }
      const pool = await storage.getPoolMetrics(id);
      if (!pool) {
        return res.status(404).json({ message: 'Pool not found' });
      }
      res.json(pool);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch pool' });
    }
  });

  // Create new pool
  app.post('/api/pools', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, targetAmount } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: 'Pool name is required' });
      }
      const parsedTarget = parseFloat(targetAmount) || 0;
      if (parsedTarget < 0) {
        return res.status(400).json({ message: 'Target amount cannot be negative' });
      }
      const pool = await storage.createPool({
        name: name.trim(),
        targetAmount: parsedTarget,
        status: 'draft',
      });
      res.status(201).json(pool);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to create pool' });
    }
  });

  // Update pool status with enforced transitions
  app.patch('/api/pools/:id/status', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid pool ID' });
      }
      if (!['draft', 'open', 'locked', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      
      const existingPool = await storage.getPool(id);
      if (!existingPool) {
        return res.status(404).json({ message: 'Pool not found' });
      }
      
      const validTransitions: Record<string, string[]> = {
        'draft': ['open'],
        'open': ['locked'],
        'locked': ['closed'],
        'closed': [],
      };
      
      if (!validTransitions[existingPool.status]?.includes(status)) {
        return res.status(400).json({ 
          message: `Invalid status transition: cannot change from '${existingPool.status}' to '${status}'` 
        });
      }
      
      const pool = await storage.updatePoolStatus(id, status);
      res.json(pool);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update pool status' });
    }
  });

  // Delete pool (only if draft)
  app.delete('/api/pools/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid pool ID' });
      }
      const pool = await storage.getPool(id);
      if (!pool) {
        return res.status(404).json({ message: 'Pool not found' });
      }
      if (pool.status !== 'draft') {
        return res.status(400).json({ message: 'Only draft pools can be deleted' });
      }
      await storage.deletePool(id);
      res.json({ message: 'Pool deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to delete pool' });
    }
  });

  // Get loans in a pool
  app.get('/api/pools/:id/loans', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid pool ID' });
      }
      const poolLoans = await storage.getPoolLoans(id);
      
      // Get full loan details for each pool loan
      const allMifosLoans = await storage.getMifosLoans();
      const mifosLoanMap = new Map(allMifosLoans.map(l => [l.mifosLoanId, l]));
      
      const loansWithDetails = poolLoans.map(pl => ({
        ...pl,
        loan: mifosLoanMap.get(pl.mifosLoanId),
      }));
      
      res.json(loansWithDetails);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch pool loans' });
    }
  });

  // Get available loans to add to pool
  app.get('/api/pools/:id/available-loans', requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid pool ID' });
      }
      const availableLoans = await storage.getAvailableLoansForPool(id);
      res.json(availableLoans);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch available loans' });
    }
  });

  // Add loan to pool
  app.post('/api/pools/:id/loans', requireAuth, requireAdmin, async (req, res) => {
    try {
      const poolId = parseInt(req.params.id);
      const { mifosLoanId } = req.body;
      
      if (isNaN(poolId)) {
        return res.status(400).json({ message: 'Invalid pool ID' });
      }
      if (!mifosLoanId) {
        return res.status(400).json({ message: 'mifosLoanId is required' });
      }

      const pool = await storage.getPool(poolId);
      if (!pool) {
        return res.status(404).json({ message: 'Pool not found' });
      }
      if (pool.status === 'locked' || pool.status === 'closed') {
        return res.status(400).json({ message: 'Cannot add loans to locked or closed pools' });
      }

      const poolLoan = await storage.addLoanToPool({ poolId, mifosLoanId });
      res.status(201).json(poolLoan);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to add loan to pool' });
    }
  });

  // Remove loan from pool
  app.delete('/api/pools/:id/loans/:mifosLoanId', requireAuth, requireAdmin, async (req, res) => {
    try {
      const poolId = parseInt(req.params.id);
      const mifosLoanId = parseInt(req.params.mifosLoanId);
      
      if (isNaN(poolId) || isNaN(mifosLoanId)) {
        return res.status(400).json({ message: 'Invalid pool ID or loan ID' });
      }

      const pool = await storage.getPool(poolId);
      if (!pool) {
        return res.status(404).json({ message: 'Pool not found' });
      }
      if (pool.status === 'locked' || pool.status === 'closed') {
        return res.status(400).json({ message: 'Cannot remove loans from locked or closed pools' });
      }

      await storage.removeLoanFromPool(poolId, mifosLoanId);
      res.json({ message: 'Loan removed from pool' });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to remove loan from pool' });
    }
  });

  return httpServer;
}
