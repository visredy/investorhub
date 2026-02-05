import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  ArrowLeft, 
  TrendingUp, 
  LogOut,
  Shield,
  Droplets,
  Save,
  Play,
  DollarSign,
  Users,
  PiggyBank,
  Briefcase
} from 'lucide-react';
import type { WaterfallConfig, WaterfallDistribution } from '@shared/schema';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function WaterfallPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [servicingFee, setServicingFee] = useState<string>('');
  const [investorReturns, setInvestorReturns] = useState<string>('');
  const [reserveFund, setReserveFund] = useState<string>('');
  const [sponsorProfit, setSponsorProfit] = useState<string>('');
  
  const [distributeMonth, setDistributeMonth] = useState<string>('');
  const [distributeAmount, setDistributeAmount] = useState<string>('');

  const { data: config, isLoading: configLoading } = useQuery<WaterfallConfig>({
    queryKey: ['/api/waterfall/config'],
  });

  const { data: distributions, isLoading: distributionsLoading } = useQuery<WaterfallDistribution[]>({
    queryKey: ['/api/waterfall/distributions'],
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: { 
      servicingFeePercent: number;
      investorReturnsPercent: number;
      reserveFundPercent: number;
      sponsorProfitPercent: number;
    }) => {
      return apiRequest('PUT', '/api/waterfall/config', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/waterfall/config'] });
      toast({ title: 'Waterfall configuration updated' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error updating configuration', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const distributeMutation = useMutation({
    mutationFn: async (data: { month: string; totalCollections: number }) => {
      return apiRequest('POST', '/api/waterfall/distribute', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/waterfall/distributions'] });
      setDistributeMonth('');
      setDistributeAmount('');
      toast({ title: 'Distribution created successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error creating distribution', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSaveConfig = () => {
    const svc = parseFloat(servicingFee || String(config?.servicingFeePercent || 0));
    const inv = parseFloat(investorReturns || String(config?.investorReturnsPercent || 0));
    const res = parseFloat(reserveFund || String(config?.reserveFundPercent || 0));
    const spn = parseFloat(sponsorProfit || String(config?.sponsorProfitPercent || 0));
    
    updateConfigMutation.mutate({
      servicingFeePercent: svc,
      investorReturnsPercent: inv,
      reserveFundPercent: res,
      sponsorProfitPercent: spn,
    });
  };

  const handleDistribute = () => {
    if (!distributeMonth || !distributeAmount) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    distributeMutation.mutate({
      month: distributeMonth,
      totalCollections: parseFloat(distributeAmount),
    });
  };

  const currentTotal = (
    parseFloat(servicingFee || String(config?.servicingFeePercent || 0)) +
    parseFloat(investorReturns || String(config?.investorReturnsPercent || 0)) +
    parseFloat(reserveFund || String(config?.reserveFundPercent || 0)) +
    parseFloat(sponsorProfit || String(config?.sponsorProfitPercent || 0))
  );

  const isValidTotal = Math.abs(currentTotal - 100) < 0.01;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">InvestorHub</span>
            <Badge variant="secondary" className="hidden sm:flex">
              <Shield className="w-3 h-3 mr-1" />
              Admin
            </Badge>
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
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation('/admin')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Droplets className="w-8 h-8 text-primary" />
              Waterfall Engine
            </h1>
            <p className="text-muted-foreground">Configure how monthly collections are distributed</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Distribution Percentages</CardTitle>
              <CardDescription>Set how collections are split across categories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {configLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Servicing Fee (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={servicingFee || config?.servicingFeePercent || ''}
                      onChange={(e) => setServicingFee(e.target.value)}
                      placeholder="e.g. 2"
                      data-testid="input-servicing-fee"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Investor Returns (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={investorReturns || config?.investorReturnsPercent || ''}
                      onChange={(e) => setInvestorReturns(e.target.value)}
                      placeholder="e.g. 70"
                      data-testid="input-investor-returns"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <PiggyBank className="w-4 h-4" />
                      Reserve Fund (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={reserveFund || config?.reserveFundPercent || ''}
                      onChange={(e) => setReserveFund(e.target.value)}
                      placeholder="e.g. 10"
                      data-testid="input-reserve-fund"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Sponsor Profit (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={sponsorProfit || config?.sponsorProfitPercent || ''}
                      onChange={(e) => setSponsorProfit(e.target.value)}
                      placeholder="e.g. 18"
                      data-testid="input-sponsor-profit"
                    />
                  </div>

                  <div className={`p-3 rounded-lg ${isValidTotal ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                    <p className={`text-sm font-medium ${isValidTotal ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      Total: {currentTotal.toFixed(1)}% {isValidTotal ? '✓' : '(must equal 100%)'}
                    </p>
                  </div>

                  <Button 
                    onClick={handleSaveConfig}
                    disabled={!isValidTotal || updateConfigMutation.isPending}
                    className="w-full"
                    data-testid="button-save-config"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Run Distribution</CardTitle>
              <CardDescription>Process a new monthly distribution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Input
                  type="text"
                  value={distributeMonth}
                  onChange={(e) => setDistributeMonth(e.target.value)}
                  placeholder="e.g. February 2026"
                  data-testid="input-distribute-month"
                />
              </div>

              <div className="space-y-2">
                <Label>Total Collections ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={distributeAmount}
                  onChange={(e) => setDistributeAmount(e.target.value)}
                  placeholder="e.g. 285000"
                  data-testid="input-distribute-amount"
                />
              </div>

              {distributeAmount && config && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium mb-3">Preview Distribution:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Servicing Fee:</span>
                    <span className="font-medium">{formatCurrency(parseFloat(distributeAmount) * (config.servicingFeePercent / 100))}</span>
                    <span className="text-muted-foreground">Investor Returns:</span>
                    <span className="font-medium">{formatCurrency(parseFloat(distributeAmount) * (config.investorReturnsPercent / 100))}</span>
                    <span className="text-muted-foreground">Reserve Fund:</span>
                    <span className="font-medium">{formatCurrency(parseFloat(distributeAmount) * (config.reserveFundPercent / 100))}</span>
                    <span className="text-muted-foreground">Sponsor Profit:</span>
                    <span className="font-medium">{formatCurrency(parseFloat(distributeAmount) * (config.sponsorProfitPercent / 100))}</span>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleDistribute}
                disabled={distributeMutation.isPending || !distributeMonth || !distributeAmount}
                className="w-full"
                data-testid="button-run-distribution"
              >
                <Play className="w-4 h-4 mr-2" />
                {distributeMutation.isPending ? 'Processing...' : 'Run Distribution'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Distribution History</CardTitle>
            <CardDescription>Past waterfall distributions</CardDescription>
          </CardHeader>
          <CardContent>
            {distributionsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : distributions && distributions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Collections</TableHead>
                      <TableHead className="text-right">Servicing</TableHead>
                      <TableHead className="text-right">Investor</TableHead>
                      <TableHead className="text-right">Reserve</TableHead>
                      <TableHead className="text-right">Sponsor</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distributions.map((dist) => (
                      <TableRow key={dist.id} data-testid={`row-distribution-${dist.id}`}>
                        <TableCell className="font-medium">{dist.month}</TableCell>
                        <TableCell className="text-right">{formatCurrency(dist.totalCollections)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(dist.servicingFee)}
                          <span className="text-xs text-muted-foreground ml-1">({formatPercent(dist.servicingFeePercent)})</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(dist.investorReturns)}
                          <span className="text-xs text-muted-foreground ml-1">({formatPercent(dist.investorReturnsPercent)})</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(dist.reserveFund)}
                          <span className="text-xs text-muted-foreground ml-1">({formatPercent(dist.reserveFundPercent)})</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(dist.sponsorProfit)}
                          <span className="text-xs text-muted-foreground ml-1">({formatPercent(dist.sponsorProfitPercent)})</span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {new Date(dist.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No distributions yet. Run your first distribution above.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
