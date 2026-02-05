import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, 
  Wallet, 
  PiggyBank, 
  Clock, 
  TrendingUp, 
  LogOut,
  Plus,
  Eye,
  Shield,
  BarChart3,
  Droplets,
  FileSignature,
  Layers
} from 'lucide-react';
import type { InvestorWithStats } from '@shared/schema';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount);
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  iconBg,
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  iconBg: string;
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
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type AdminStats = {
  totalInvestors: number;
  totalInvested: number;
  totalBalance: number;
  pendingPayouts: number;
};

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
  });

  const { data: investors, isLoading: investorsLoading } = useQuery<InvestorWithStats[]>({
    queryKey: ['/api/admin/investors'],
  });

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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage investors and track performance</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLocation('/pool-performance')} data-testid="button-pool-performance">
              <BarChart3 className="w-4 h-4 mr-2" />
              Pool Performance
            </Button>
            <Button variant="outline" onClick={() => setLocation('/admin/waterfall')} data-testid="button-waterfall">
              <Droplets className="w-4 h-4 mr-2" />
              Waterfall
            </Button>
            <Button variant="outline" onClick={() => setLocation('/admin/agreements')} data-testid="button-agreements">
              <FileSignature className="w-4 h-4 mr-2" />
              Agreements
            </Button>
            <Button variant="outline" onClick={() => setLocation('/admin/pools')} data-testid="button-pools">
              <Layers className="w-4 h-4 mr-2" />
              ABS Pools
            </Button>
            <Button onClick={() => setLocation('/admin/add-investor')} data-testid="button-add-investor">
              <Plus className="w-4 h-4 mr-2" />
              Add Investor
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
                icon={Users} 
                label="Total Investors" 
                value={stats.totalInvestors}
                iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
              />
              <StatCard 
                icon={Wallet} 
                label="Total Invested" 
                value={formatCurrency(stats.totalInvested)}
                iconBg="bg-gradient-to-br from-emerald-500 to-green-600"
              />
              <StatCard 
                icon={PiggyBank} 
                label="Total Balance" 
                value={formatCurrency(stats.totalBalance)}
                iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
              />
              <StatCard 
                icon={Clock} 
                label="Pending Payouts" 
                value={stats.pendingPayouts}
                iconBg="bg-gradient-to-br from-amber-500 to-orange-600"
              />
            </>
          ) : null}
        </div>

        {/* Investors List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              All Investors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {investorsLoading ? (
              <div className="p-6"><Skeleton className="h-48 w-full" /></div>
            ) : investors && investors.length > 0 ? (
              <Table data-testid="table-investors">
                <TableHeader>
                  <TableRow>
                    <TableHead>Investor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Total Invested</TableHead>
                    <TableHead>Current Balance</TableHead>
                    <TableHead>ROI</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investors.map((investor) => (
                    <TableRow key={investor.id} data-testid={`row-investor-${investor.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-semibold">
                            {investor.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{investor.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{investor.email}</TableCell>
                      <TableCell>{formatCurrency(investor.totalInvested)}</TableCell>
                      <TableCell>{formatCurrency(investor.currentBalance)}</TableCell>
                      <TableCell>
                        <span className={investor.roiPercentage >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {investor.roiPercentage.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setLocation(`/admin/investor/${investor.id}`)}
                          data-testid={`button-view-${investor.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No investors yet</p>
                <Button 
                  className="mt-4" 
                  onClick={() => setLocation('/admin/add-investor')}
                >
                  Add First Investor
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
