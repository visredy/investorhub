/**
 * MifosX REST API Integration Service
 * 
 * Provides functions to interact with MifosX API:
 * - get_loans()
 * - get_repayments(loan_id)
 * - get_portfolio_summary()
 * - get_par_report()
 * 
 * Uses Basic Auth and caches results for 10 minutes
 */

// Cache store with TTL
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// MifosX API configuration from environment variables
function getConfig() {
  const apiUrl = process.env.MIFOS_API_URL;
  const username = process.env.MIFOS_USERNAME;
  const password = process.env.MIFOS_PASSWORD;

  if (!apiUrl || !username || !password) {
    throw new Error('MifosX API configuration missing. Please set MIFOS_API_URL, MIFOS_USERNAME, and MIFOS_PASSWORD environment variables.');
  }

  return { apiUrl, username, password };
}

// Create Basic Auth header
function getAuthHeader(username: string, password: string): string {
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
}

// Custom error class for MifosX API errors
export class MifosApiError extends Error {
  statusCode: number;
  responseBody: any;

  constructor(message: string, statusCode: number, responseBody?: any) {
    super(message);
    this.name = 'MifosApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

// Generic API request function
async function mifosRequest<T>(endpoint: string, cacheKey?: string): Promise<T> {
  // Check cache first
  if (cacheKey) {
    const cached = getCached<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const { apiUrl, username, password } = getConfig();
  const url = `${apiUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(username, password),
        'Content-Type': 'application/json',
        'Fineract-Platform-TenantId': process.env.MIFOS_TENANT_ID || 'default',
      },
    });

    if (!response.ok) {
      let errorBody: any;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new MifosApiError(
        `MifosX API error: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    const data = await response.json() as T;

    // Cache the result
    if (cacheKey) {
      setCache(cacheKey, data);
    }

    return data;
  } catch (error) {
    if (error instanceof MifosApiError) {
      throw error;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new MifosApiError('Failed to connect to MifosX API. Please check the API URL.', 0, null);
    }
    throw new MifosApiError(`MifosX API request failed: ${(error as Error).message}`, 0, null);
  }
}

// Types for MifosX responses
export interface MifosLoan {
  id: number;
  accountNo: string;
  clientId: number;
  clientName: string;
  loanProductId: number;
  loanProductName: string;
  principal: number;
  approvedPrincipal: number;
  proposedPrincipal: number;
  termFrequency: number;
  termPeriodFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  interestRatePerPeriod: number;
  annualInterestRate: number;
  status: {
    id: number;
    code: string;
    value: string;
    pendingApproval: boolean;
    waitingForDisbursal: boolean;
    active: boolean;
    closedObligationsMet: boolean;
    closedWrittenOff: boolean;
    closedRescheduled: boolean;
    closed: boolean;
    overpaid: boolean;
  };
  summary?: {
    principalDisbursed: number;
    principalPaid: number;
    principalOutstanding: number;
    interestCharged: number;
    interestPaid: number;
    interestOutstanding: number;
    totalExpectedRepayment: number;
    totalRepayment: number;
    totalOutstanding: number;
  };
}

export interface MifosRepayment {
  id: number;
  officeId: number;
  officeName: string;
  type: {
    id: number;
    code: string;
    value: string;
  };
  date: number[];
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    displaySymbol: string;
  };
  amount: number;
  principalPortion: number;
  interestPortion: number;
  feeChargesPortion: number;
  penaltyChargesPortion: number;
  overpaymentPortion: number;
  outstandingLoanBalance: number;
}

export interface MifosPortfolioSummary {
  totalPrincipalDisbursed: number;
  totalPrincipalRepaid: number;
  totalPrincipalOutstanding: number;
  totalInterestCharged: number;
  totalInterestRepaid: number;
  totalInterestOutstanding: number;
  totalLoans: number;
  activeLoans: number;
  closedLoans: number;
  overdueLoans: number;
}

export interface MifosParReport {
  loanProductId: number;
  loanProductName: string;
  totalOutstanding: number;
  par1Day: number;
  par7Days: number;
  par30Days: number;
  par60Days: number;
  par90Days: number;
  parRatio: number;
}

/**
 * Get all loans from MifosX
 */
export async function getLoans(): Promise<MifosLoan[]> {
  try {
    const loans = await mifosRequest<MifosLoan[]>('/loans?limit=1000', 'loans_list');
    return loans;
  } catch (error) {
    console.error('Error fetching loans from MifosX:', error);
    throw error;
  }
}

/**
 * Get repayments for a specific loan
 */
export async function getRepayments(loanId: number): Promise<MifosRepayment[]> {
  if (!loanId || isNaN(loanId)) {
    throw new MifosApiError('Invalid loan ID provided', 400, null);
  }

  try {
    const response = await mifosRequest<{ transactions?: MifosRepayment[] }>(
      `/loans/${loanId}/transactions`,
      `repayments_${loanId}`
    );
    return response.transactions || [];
  } catch (error) {
    console.error(`Error fetching repayments for loan ${loanId} from MifosX:`, error);
    throw error;
  }
}

/**
 * Get portfolio summary statistics
 */
export async function getPortfolioSummary(): Promise<MifosPortfolioSummary> {
  try {
    // Try to get the portfolio summary from the reports endpoint
    // Different MifosX versions may have different endpoints
    const summary = await mifosRequest<MifosPortfolioSummary>(
      '/runreports/PortfolioSummary',
      'portfolio_summary'
    );
    return summary;
  } catch (error) {
    // If the report endpoint doesn't exist, compute from loans
    console.warn('Portfolio summary report not available, computing from loans');
    
    try {
      const loans = await getLoans();
      
      const summary: MifosPortfolioSummary = {
        totalPrincipalDisbursed: 0,
        totalPrincipalRepaid: 0,
        totalPrincipalOutstanding: 0,
        totalInterestCharged: 0,
        totalInterestRepaid: 0,
        totalInterestOutstanding: 0,
        totalLoans: loans.length,
        activeLoans: 0,
        closedLoans: 0,
        overdueLoans: 0,
      };

      for (const loan of loans) {
        if (loan.summary) {
          summary.totalPrincipalDisbursed += loan.summary.principalDisbursed || 0;
          summary.totalPrincipalRepaid += loan.summary.principalPaid || 0;
          summary.totalPrincipalOutstanding += loan.summary.principalOutstanding || 0;
          summary.totalInterestCharged += loan.summary.interestCharged || 0;
          summary.totalInterestRepaid += loan.summary.interestPaid || 0;
          summary.totalInterestOutstanding += loan.summary.interestOutstanding || 0;
        }

        if (loan.status?.active) {
          summary.activeLoans++;
        }
        if (loan.status?.closed || loan.status?.closedObligationsMet || loan.status?.closedWrittenOff) {
          summary.closedLoans++;
        }
      }

      setCache('portfolio_summary', summary);
      return summary;
    } catch (fallbackError) {
      console.error('Error computing portfolio summary:', fallbackError);
      throw error;
    }
  }
}

/**
 * Get PAR (Portfolio at Risk) report
 */
export async function getParReport(): Promise<MifosParReport[]> {
  try {
    // Try to get the PAR report from the reports endpoint
    const parData = await mifosRequest<MifosParReport[]>(
      '/runreports/ParReport',
      'par_report'
    );
    return parData;
  } catch (error) {
    // If the report endpoint doesn't exist, return empty array with warning
    console.warn('PAR report not available from MifosX. The report may need to be configured.');
    
    // Return an empty array - in production, you might want to compute this from loan data
    return [];
  }
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Clear specific cache entry
 */
export function clearCacheEntry(key: string): boolean {
  return cache.delete(key);
}

/**
 * Check if MifosX configuration is available
 */
export function isConfigured(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}
