import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Wallet, 
  PiggyBank, 
  Calendar, 
  TrendingUp, 
  FileText, 
  Download,
  LogOut,
  DollarSign,
  BarChart3,
  FolderOpen,
  FileDown,
  Loader2,
  Calculator
} from 'lucide-react';
import type { DashboardStats, Investment, Payout, Document } from '@shared/schema';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount);
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  iconBg,
  valueClass 
}: { 
  icon: any; 
  label: string; 
  value: string; 
  iconBg: string;
  valueClass?: string;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${iconBg}`}>
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className={`text-2xl font-bold ${valueClass || ''}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [calcAmount, setCalcAmount] = useState<string>('');
  const [calcTenure, setCalcTenure] = useState<string>('12');

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: investments, isLoading: investmentsLoading } = useQuery<Investment[]>({
    queryKey: ['/api/dashboard/investments'],
  });

  const { data: payouts, isLoading: payoutsLoading } = useQuery<Payout[]>({
    queryKey: ['/api/dashboard/payouts'],
  });

  const { data: documents, isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/dashboard/documents'],
  });

  const { data: statementMonths } = useQuery<string[]>({
    queryKey: ['/api/dashboard/statement-months'],
  });

  const handleDownloadStatement = async () => {
    if (!selectedMonth) return;
    setIsDownloading(true);
    try {
      const encodedMonth = encodeURIComponent(selectedMonth);
      const response = await fetch(`/api/dashboard/statement/${encodedMonth}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to generate statement');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `InvestorHub_Statement_${selectedMonth.replace(' ', '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Statement download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">InvestorHub</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium hidden sm:inline">{user?.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} data-testid="button-logout">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-welcome">Welcome back, {user?.name}!</h1>
            <p className="text-muted-foreground">Here's an overview of your investment portfolio</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setLocation('/agreements')} data-testid="button-agreements">
              <FileText className="w-4 h-4 mr-2" />
              Agreements
            </Button>
            <Button onClick={() => setLocation('/pool-performance')} data-testid="button-pool-performance">
              <BarChart3 className="w-4 h-4 mr-2" />
              Pool Performance
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {statsLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))}
            </>
          ) : stats ? (
            <>
              <StatCard 
                icon={Wallet} 
                label="Total Invested" 
                value={formatCurrency(stats.totalInvested)} 
                iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
              />
              <StatCard 
                icon={PiggyBank} 
                label="Current Balance" 
                value={formatCurrency(stats.currentBalance)} 
                iconBg="bg-gradient-to-br from-emerald-500 to-green-600"
              />
              <StatCard 
                icon={Calendar} 
                label="Monthly Return" 
                value={formatCurrency(stats.monthlyReturn)} 
                iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
              />
              <StatCard 
                icon={TrendingUp} 
                label="ROI" 
                value={`${stats.roiPercentage.toFixed(1)}%`} 
                iconBg="bg-gradient-to-br from-amber-500 to-orange-600"
                valueClass={stats.roiPercentage >= 0 ? 'text-emerald-600' : 'text-red-600'}
              />
            </>
          ) : null}
        </div>

        {/* ROI Calculator */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              ROI Calculator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="calc-amount">Investment Amount ($)</Label>
                  <Input
                    id="calc-amount"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="e.g. 50000"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(e.target.value)}
                    data-testid="input-calc-amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calc-tenure">Investment Tenure (months)</Label>
                  <Select value={calcTenure} onValueChange={setCalcTenure}>
                    <SelectTrigger data-testid="select-calc-tenure">
                      <SelectValue placeholder="Select tenure" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months (1 year)</SelectItem>
                      <SelectItem value="24">24 months (2 years)</SelectItem>
                      <SelectItem value="36">36 months (3 years)</SelectItem>
                      <SelectItem value="60">60 months (5 years)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="md:col-span-2">
                {calcAmount && parseFloat(calcAmount) > 0 && stats ? (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold mb-4">Projected Returns</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Based on current average ROI of <span className="font-medium text-foreground">{stats.roiPercentage.toFixed(1)}%</span> annually
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {(() => {
                        const amount = parseFloat(calcAmount);
                        const months = parseInt(calcTenure);
                        const annualRate = stats.roiPercentage / 100;
                        const years = months / 12;
                        const totalReturn = amount * annualRate * years;
                        const endBalance = amount + totalReturn;
                        const monthlyReturn = totalReturn / months;
                        
                        return (
                          <>
                            <div className="text-center p-3 bg-background rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Initial Investment</p>
                              <p className="text-lg font-bold" data-testid="text-calc-initial">{formatCurrency(amount)}</p>
                            </div>
                            <div className="text-center p-3 bg-background rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Total Returns</p>
                              <p className="text-lg font-bold text-emerald-600" data-testid="text-calc-returns">{formatCurrency(totalReturn)}</p>
                            </div>
                            <div className="text-center p-3 bg-background rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Monthly Return</p>
                              <p className="text-lg font-bold text-blue-600" data-testid="text-calc-monthly">{formatCurrency(monthlyReturn)}</p>
                            </div>
                            <div className="text-center p-3 bg-background rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">End Balance</p>
                              <p className="text-lg font-bold text-primary" data-testid="text-calc-end-balance">{formatCurrency(endBalance)}</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full p-8 text-muted-foreground bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <Calculator className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Enter an investment amount to see projected returns</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Investments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Your Investments
              </CardTitle>
              <Badge>{investments?.length || 0}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {investmentsLoading ? (
                <div className="p-6"><Skeleton className="h-32 w-full" /></div>
              ) : investments && investments.length > 0 ? (
                <Table data-testid="table-investments">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>ROI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investments.map((inv) => (
                      <TableRow key={inv.id} data-testid={`row-investment-${inv.id}`}>
                        <TableCell className="font-medium">{inv.description || 'Investment'}</TableCell>
                        <TableCell>{formatCurrency(inv.amount)}</TableCell>
                        <TableCell className="text-emerald-600">{inv.roi}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No investments yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payouts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Payout History
              </CardTitle>
              <Badge>{payouts?.length || 0}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {payoutsLoading ? (
                <div className="p-6"><Skeleton className="h-32 w-full" /></div>
              ) : payouts && payouts.length > 0 ? (
                <Table data-testid="table-payouts">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout) => (
                      <TableRow key={payout.id} data-testid={`row-payout-${payout.id}`}>
                        <TableCell className="font-medium">{payout.month}</TableCell>
                        <TableCell>{formatCurrency(payout.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            payout.status === 'paid' ? 'default' : 
                            payout.status === 'pending' ? 'secondary' : 
                            'destructive'
                          }>
                            {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No payouts yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Statements */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5" />
              Monthly Statements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-3">
                  Download your monthly investment statement as a PDF. The statement includes your opening balance, returns, payouts, and closing balance.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[200px]" data-testid="select-statement-month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {statementMonths?.map((month) => (
                        <SelectItem key={month} value={month} data-testid={`option-month-${month}`}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleDownloadStatement} 
                    disabled={!selectedMonth || isDownloading}
                    data-testid="button-download-statement"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download Statement
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Your Documents
            </CardTitle>
            <Badge>{documents?.length || 0}</Badge>
          </CardHeader>
          <CardContent>
            {documentsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : documents && documents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg hover-elevate"
                    data-testid={`document-${doc.id}`}
                  >
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.description || doc.originalFilename}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.uploadDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={() => window.open(`/api/documents/${doc.id}/download`, '_blank')}
                      data-testid={`button-download-${doc.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No documents available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
