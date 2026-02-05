/**
 * MifosX Background Scheduler
 * 
 * Runs every 6 hours to:
 * - Fetch loan and repayment data from MifosX
 * - Update local database tables
 * - Log sync status
 */

import cron from 'node-cron';
import { storage } from './storage';
import * as mifosService from './mifos-service';
import type { InsertMifosLoan, InsertMifosRepayment } from '@shared/schema';

let isRunning = false;

/**
 * Sync loans and repayments from MifosX to local database
 */
export async function syncMifosData(): Promise<void> {
  if (isRunning) {
    console.log('[MifosX Scheduler] Sync already in progress, skipping...');
    return;
  }

  if (!mifosService.isConfigured()) {
    console.log('[MifosX Scheduler] MifosX not configured, skipping sync');
    return;
  }

  isRunning = true;
  console.log('[MifosX Scheduler] Starting MifosX data sync...');

  const syncLog = await storage.createSyncLog({
    status: 'running',
    loansCount: 0,
    repaymentsCount: 0,
  });

  let loansCount = 0;
  let repaymentsCount = 0;

  try {
    // Fetch loans from MifosX
    console.log('[MifosX Scheduler] Fetching loans from MifosX...');
    const loansResponse = await mifosService.getLoans();
    
    // Handle paginated response format
    const loans = Array.isArray(loansResponse) 
      ? loansResponse 
      : (loansResponse as any).pageItems || [];

    console.log(`[MifosX Scheduler] Found ${loans.length} loans to sync`);

    // Process each loan
    for (const loan of loans) {
      try {
        const loanData: InsertMifosLoan = {
          mifosLoanId: loan.id,
          accountNo: loan.accountNo || null,
          clientId: loan.clientId || null,
          clientName: loan.clientName || null,
          loanProductName: loan.loanProductName || null,
          principal: loan.principal || 0,
          approvedPrincipal: loan.approvedPrincipal || 0,
          totalOutstanding: loan.summary?.totalOutstanding || 0,
          totalRepaid: loan.summary?.totalRepayment || 0,
          status: loan.status?.value || null,
          statusCode: loan.status?.code || null,
          interestRate: loan.annualInterestRate || 0,
          termFrequency: loan.termFrequency || null,
          numberOfRepayments: loan.numberOfRepayments || null,
          rawData: JSON.stringify(loan),
        };

        await storage.upsertMifosLoan(loanData);
        loansCount++;

        // Fetch repayments for active loans
        if (loan.status?.active) {
          try {
            const repayments = await mifosService.getRepayments(loan.id);
            
            for (const repayment of repayments) {
              const repaymentData: InsertMifosRepayment = {
                mifosTransactionId: repayment.id,
                mifosLoanId: loan.id,
                transactionType: repayment.type?.value || null,
                amount: repayment.amount || 0,
                principalPortion: repayment.principalPortion || 0,
                interestPortion: repayment.interestPortion || 0,
                feesPortion: repayment.feeChargesPortion || 0,
                penaltyPortion: repayment.penaltyChargesPortion || 0,
                outstandingBalance: repayment.outstandingLoanBalance || 0,
                transactionDate: repayment.date ? repayment.date.join('-') : null,
                rawData: JSON.stringify(repayment),
              };

              await storage.upsertMifosRepayment(repaymentData);
              repaymentsCount++;
            }
          } catch (repaymentError) {
            console.error(`[MifosX Scheduler] Error fetching repayments for loan ${loan.id}:`, repaymentError);
          }
        }
      } catch (loanError) {
        console.error(`[MifosX Scheduler] Error processing loan ${loan.id}:`, loanError);
      }
    }

    // Update sync log with success
    await storage.updateSyncLog(syncLog.id, {
      status: 'success',
      loansCount,
      repaymentsCount,
    });

    console.log(`[MifosX Scheduler] Sync completed successfully. Loans: ${loansCount}, Repayments: ${repaymentsCount}`);

  } catch (error: any) {
    console.error('[MifosX Scheduler] Sync failed:', error.message);

    // Update sync log with failure
    await storage.updateSyncLog(syncLog.id, {
      status: 'failed',
      loansCount,
      repaymentsCount,
      errorMessage: error.message || 'Unknown error',
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Initialize the scheduler
 * Runs every 6 hours (cron: "0 *\/6 * * *")
 */
export function startScheduler(): void {
  console.log('[MifosX Scheduler] Initializing scheduler (runs every 6 hours)...');

  // Schedule to run every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[MifosX Scheduler] Scheduled sync triggered');
    await syncMifosData();
  });

  // Run initial sync after a short delay (30 seconds after server start)
  setTimeout(async () => {
    console.log('[MifosX Scheduler] Running initial sync...');
    await syncMifosData();
  }, 30000);

  console.log('[MifosX Scheduler] Scheduler started. Next sync will run at the next 6-hour mark.');
}

/**
 * Stop the scheduler (for testing/cleanup)
 */
export function stopScheduler(): void {
  console.log('[MifosX Scheduler] Scheduler stopped');
}

/**
 * Check if a sync is currently running
 */
export function isSyncRunning(): boolean {
  return isRunning;
}
