import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  LogOut,
  ChevronLeft,
  Wallet,
  Users,
  AlertTriangle,
  DollarSign,
  Shield,
  PiggyBank,
  Percent,
  Edit,
  Loader2,
  BarChart3
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import type { PoolPerformance, PoolPerformanceHistory } from '@shared/schema';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', notation: 'compact', maximumFractionDigits: 0 }).format(amount);
}

function formatFullCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount);
}

type PoolData = {
  performance: PoolPerformance | null;
  history: PoolPerformanceHistory[];
};

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  iconBg,
  valueClass 
}: { 
  icon: any; 
  label: string; 
  value: string; 
  subValue?: string;
  iconBg: string;
  valueClass?: string;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium truncate">{label}</p>
            <p className={`text-xl font-bold ${valueClass || ''}`}>{value}</p>
            {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PoolPerformancePage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    totalPoolSize: '',
    activeLoans: '',
    par1Plus: '',
    par7Plus: '',
    par30Plus: '',
    monthlyCollections: '',
    reserveBalance: '',
    defaultRate: '',
  });

  const { data, isLoading } = useQuery<PoolData>({
    queryKey: ['/api/pool-performance'],
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: any) => {
      const res = await apiRequest('PUT', '/api/pool-performance', formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pool-performance'] });
      toast({ title: 'Success', description: 'Pool performance updated!' });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function openEditDialog() {
    if (data?.performance) {
      setFormData({
        totalPoolSize: String(data.performance.totalPoolSize),
        activeLoans: String(data.performance.activeLoans),
        par1Plus: String(data.performance.par1Plus),
        par7Plus: String(data.performance.par7Plus),
        par30Plus: String(data.performance.par30Plus),
        monthlyCollections: String(data.performance.monthlyCollections),
        reserveBalance: String(data.performance.reserveBalance),
        defaultRate: String(data.performance.defaultRate),
      });
    }
    setEditDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate(formData);
  }

  const chartData = data?.history?.slice().reverse() || [];
  const performance = data?.performance;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">InvestorHub</span>
            {isAdmin && (
              <Badge variant="secondary" className="hidden sm:flex">
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
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
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation(isAdmin ? '/admin' : '/dashboard')}
            className="mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <BarChart3 className="w-8 h-8" />
                Pool Performance
              </h1>
              <p className="text-muted-foreground">Investment pool metrics and historical trends</p>
            </div>
            {isAdmin && (
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openEditDialog} data-testid="button-edit-performance">
                    <Edit className="w-4 h-4 mr-2" />
                    Update Values
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Update Pool Performance</DialogTitle></DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Total Pool Size</Label><Input type="number" step="0.01" value={formData.totalPoolSize} onChange={(e) => setFormData({...formData, totalPoolSize: e.target.value})} data-testid="input-pool-size" /></div>
                      <div><Label>Active Loans</Label><Input type="number" value={formData.activeLoans} onChange={(e) => setFormData({...formData, activeLoans: e.target.value})} data-testid="input-active-loans" /></div>
                      <div><Label>PAR 1+ (%)</Label><Input type="number" step="0.1" value={formData.par1Plus} onChange={(e) => setFormData({...formData, par1Plus: e.target.value})} data-testid="input-par1" /></div>
                      <div><Label>PAR 7+ (%)</Label><Input type="number" step="0.1" value={formData.par7Plus} onChange={(e) => setFormData({...formData, par7Plus: e.target.value})} data-testid="input-par7" /></div>
                      <div><Label>PAR 30+ (%)</Label><Input type="number" step="0.1" value={formData.par30Plus} onChange={(e) => setFormData({...formData, par30Plus: e.target.value})} data-testid="input-par30" /></div>
                      <div><Label>Monthly Collections</Label><Input type="number" step="0.01" value={formData.monthlyCollections} onChange={(e) => setFormData({...formData, monthlyCollections: e.target.value})} data-testid="input-collections" /></div>
                      <div><Label>Reserve Balance</Label><Input type="number" step="0.01" value={formData.reserveBalance} onChange={(e) => setFormData({...formData, reserveBalance: e.target.value})} data-testid="input-reserve" /></div>
                      <div><Label>Default Rate (%)</Label><Input type="number" step="0.01" value={formData.defaultRate} onChange={(e) => setFormData({...formData, defaultRate: e.target.value})} data-testid="input-default-rate" /></div>
                    </div>
                    <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save">
                      {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(8)].map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : performance ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard 
                icon={Wallet} 
                label="Total Pool Size" 
                value={formatCurrency(performance.totalPoolSize)}
                subValue={formatFullCurrency(performance.totalPoolSize)}
                iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
              />
              <StatCard 
                icon={Users} 
                label="Active Loans" 
                value={String(performance.activeLoans)}
                iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
              />
              <StatCard 
                icon={DollarSign} 
                label="Monthly Collections" 
                value={formatCurrency(performance.monthlyCollections)}
                subValue={formatFullCurrency(performance.monthlyCollections)}
                iconBg="bg-gradient-to-br from-emerald-500 to-green-600"
              />
              <StatCard 
                icon={PiggyBank} 
                label="Reserve Balance" 
                value={formatCurrency(performance.reserveBalance)}
                subValue={formatFullCurrency(performance.reserveBalance)}
                iconBg="bg-gradient-to-br from-cyan-500 to-teal-600"
              />
              <StatCard 
                icon={AlertTriangle} 
                label="PAR 1+" 
                value={`${performance.par1Plus}%`}
                subValue="Payments 1+ days late"
                iconBg="bg-gradient-to-br from-yellow-500 to-amber-600"
                valueClass={performance.par1Plus > 10 ? 'text-red-600' : ''}
              />
              <StatCard 
                icon={AlertTriangle} 
                label="PAR 7+" 
                value={`${performance.par7Plus}%`}
                subValue="Payments 7+ days late"
                iconBg="bg-gradient-to-br from-orange-500 to-red-500"
                valueClass={performance.par7Plus > 5 ? 'text-red-600' : ''}
              />
              <StatCard 
                icon={AlertTriangle} 
                label="PAR 30+" 
                value={`${performance.par30Plus}%`}
                subValue="Payments 30+ days late"
                iconBg="bg-gradient-to-br from-red-500 to-rose-600"
                valueClass={performance.par30Plus > 3 ? 'text-red-600' : ''}
              />
              <StatCard 
                icon={Percent} 
                label="Default Rate" 
                value={`${performance.defaultRate}%`}
                iconBg="bg-gradient-to-br from-slate-500 to-gray-600"
                valueClass={performance.defaultRate > 2 ? 'text-red-600' : 'text-emerald-600'}
              />
            </div>

            {/* Charts */}
            {chartData.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Pool Size & Collections Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pool Size & Collections Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} className="fill-muted-foreground" />
                        <Tooltip 
                          formatter={(value: number) => formatFullCurrency(value)}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="totalPoolSize" name="Pool Size" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                        <Area type="monotone" dataKey="monthlyCollections" name="Collections" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* PAR Rates Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Portfolio at Risk (PAR) Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} className="fill-muted-foreground" />
                        <Tooltip 
                          formatter={(value: number) => `${value}%`}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="par1Plus" name="PAR 1+" stroke="#eab308" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="par7Plus" name="PAR 7+" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="par30Plus" name="PAR 30+" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Active Loans Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Active Loans Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Bar dataKey="activeLoans" name="Active Loans" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Default Rate & Reserve Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Default Rate & Reserve Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} className="fill-muted-foreground" />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} className="fill-muted-foreground" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="defaultRate" name="Default Rate %" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                        <Line yAxisId="right" type="monotone" dataKey="reserveBalance" name="Reserve ($)" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No pool performance data available</p>
              {isAdmin && (
                <Button className="mt-4" onClick={openEditDialog}>Add Performance Data</Button>
              )}
            </CardContent>
          </Card>
        )}

        {performance && (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Last updated: {new Date(performance.updatedAt).toLocaleString()}
          </div>
        )}
      </main>
    </div>
  );
}
