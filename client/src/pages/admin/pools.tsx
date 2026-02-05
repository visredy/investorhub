import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  LogOut,
  Plus,
  ArrowLeft,
  Shield,
  Layers,
  Lock,
  Unlock,
  Trash2,
  Eye,
  DollarSign,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react';
import type { PoolWithMetrics, MifosLoan } from '@shared/schema';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount);
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary">Draft</Badge>;
    case 'open':
      return <Badge variant="outline" className="border-blue-500 text-blue-600">Open</Badge>;
    case 'locked':
      return <Badge variant="default" className="bg-amber-500">Locked</Badge>;
    case 'closed':
      return <Badge variant="destructive">Closed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function PoolDetailDialog({ pool, onClose }: { pool: PoolWithMetrics; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

  const { data: poolLoans, isLoading: loansLoading } = useQuery<any[]>({
    queryKey: ['/api/pools', pool.id, 'loans'],
    queryFn: async () => {
      const res = await fetch(`/api/pools/${pool.id}/loans`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch pool loans');
      return res.json();
    },
  });

  const { data: availableLoans, isLoading: availableLoading } = useQuery<MifosLoan[]>({
    queryKey: ['/api/pools', pool.id, 'available-loans'],
    queryFn: async () => {
      const res = await fetch(`/api/pools/${pool.id}/available-loans`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch available loans');
      return res.json();
    },
  });

  const addLoanMutation = useMutation({
    mutationFn: async (mifosLoanId: number) => {
      return apiRequest('POST', `/api/pools/${pool.id}/loans`, { mifosLoanId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pools'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pools', pool.id] });
      toast({ title: 'Loan added to pool' });
      setSelectedLoanId('');
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add loan', description: error.message, variant: 'destructive' });
    },
  });

  const removeLoanMutation = useMutation({
    mutationFn: async (mifosLoanId: number) => {
      return apiRequest('DELETE', `/api/pools/${pool.id}/loans/${mifosLoanId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pools'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pools', pool.id] });
      toast({ title: 'Loan removed from pool' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to remove loan', description: error.message, variant: 'destructive' });
    },
  });

  const canModify = pool.status !== 'locked' && pool.status !== 'closed';

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          {pool.name}
        </DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Status</p>
            <div className="mt-1">{getStatusBadge(pool.status)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Loans</p>
            <p className="text-xl font-bold">{pool.loanCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Principal</p>
            <p className="text-xl font-bold">{formatCurrency(pool.totalPrincipal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-xl font-bold">{formatCurrency(pool.totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {canModify && (
        <div className="mb-6">
          <Label className="mb-2 block">Add Loan to Pool</Label>
          <div className="flex gap-2">
            <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
              <SelectTrigger className="flex-1" data-testid="select-loan-to-add">
                <SelectValue placeholder="Select a loan to add..." />
              </SelectTrigger>
              <SelectContent>
                {availableLoading ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : availableLoans && availableLoans.length > 0 ? (
                  availableLoans
                    .filter((loan) => loan.status === 'Active')
                    .map((loan) => (
                      <SelectItem key={loan.mifosLoanId} value={String(loan.mifosLoanId)}>
                        {loan.accountNo} - {loan.clientName} | Outstanding: {formatCurrency(loan.totalOutstanding || 0)}
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="none" disabled>No available loans</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => selectedLoanId && addLoanMutation.mutate(parseInt(selectedLoanId))}
              disabled={!selectedLoanId || addLoanMutation.isPending}
              data-testid="button-add-loan-to-pool"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-3">Loans in Pool</h3>
        {loansLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : poolLoans && poolLoans.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account No</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  {canModify && <TableHead className="w-16"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {poolLoans.map((pl: any) => (
                  <TableRow key={pl.id}>
                    <TableCell className="font-mono text-sm">{pl.loan?.accountNo || '-'}</TableCell>
                    <TableCell>{pl.loan?.clientName || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={pl.loan?.status === 'Active' ? 'default' : 'secondary'}>
                        {pl.loan?.status || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(pl.loan?.principal || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(pl.loan?.totalOutstanding || 0)}</TableCell>
                    {canModify && (
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeLoanMutation.mutate(pl.mifosLoanId)}
                          disabled={removeLoanMutation.isPending}
                          data-testid={`button-remove-loan-${pl.mifosLoanId}`}
                        >
                          <XCircle className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No loans assigned to this pool yet.</p>
        )}
      </div>

      <DialogFooter className="mt-6">
        <DialogClose asChild>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

export default function PoolsPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolTarget, setNewPoolTarget] = useState('');
  const [selectedPool, setSelectedPool] = useState<PoolWithMetrics | null>(null);

  const { data: pools, isLoading } = useQuery<PoolWithMetrics[]>({
    queryKey: ['/api/pools'],
  });

  const createPoolMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/pools', {
        name: newPoolName,
        targetAmount: parseFloat(newPoolTarget) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pools'] });
      toast({ title: 'Pool created successfully' });
      setIsCreateOpen(false);
      setNewPoolName('');
      setNewPoolTarget('');
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create pool', description: error.message, variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest('PATCH', `/api/pools/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pools'] });
      toast({ title: 'Pool status updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });

  const deletePoolMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/pools/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pools'] });
      toast({ title: 'Pool deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete pool', description: error.message, variant: 'destructive' });
    },
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/admin')} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Layers className="w-8 h-8" />
                ABS Pool Management
              </h1>
              <p className="text-muted-foreground">Create and manage asset-backed securities pools</p>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-pool">
                <Plus className="w-4 h-4 mr-2" />
                Create Pool
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Pool</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="pool-name">Pool Name</Label>
                  <Input
                    id="pool-name"
                    value={newPoolName}
                    onChange={(e) => setNewPoolName(e.target.value)}
                    placeholder="e.g., Q1 2026 EV Loans"
                    data-testid="input-pool-name"
                  />
                </div>
                <div>
                  <Label htmlFor="pool-target">Target Amount (optional)</Label>
                  <Input
                    id="pool-target"
                    type="number"
                    value={newPoolTarget}
                    onChange={(e) => setNewPoolTarget(e.target.value)}
                    placeholder="e.g., 1000000"
                    data-testid="input-pool-target"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button 
                  onClick={() => createPoolMutation.mutate()}
                  disabled={!newPoolName || createPoolMutation.isPending}
                  data-testid="button-submit-create-pool"
                >
                  Create Pool
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : pools && pools.length > 0 ? (
          <div className="grid gap-4">
            {pools.map((pool) => (
              <Card key={pool.id} className="hover-elevate">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{pool.name}</h3>
                        {getStatusBadge(pool.status)}
                      </div>
                      <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          <span>{pool.loanCount} loans</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          <span>Principal: {formatCurrency(pool.totalPrincipal)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          <span>Outstanding: {formatCurrency(pool.totalOutstanding)}</span>
                        </div>
                        {pool.targetAmount > 0 && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>Target: {formatCurrency(pool.targetAmount)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            onClick={() => setSelectedPool(pool)}
                            data-testid={`button-view-pool-${pool.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View/Manage
                          </Button>
                        </DialogTrigger>
                        {selectedPool?.id === pool.id && (
                          <PoolDetailDialog pool={selectedPool} onClose={() => setSelectedPool(null)} />
                        )}
                      </Dialog>
                      
                      {pool.status === 'draft' && (
                        <>
                          <Button 
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: pool.id, status: 'open' })}
                            disabled={updateStatusMutation.isPending}
                            data-testid={`button-open-pool-${pool.id}`}
                          >
                            <Unlock className="w-4 h-4 mr-1" />
                            Open
                          </Button>
                          <Button 
                            variant="ghost"
                            onClick={() => deletePoolMutation.mutate(pool.id)}
                            disabled={deletePoolMutation.isPending}
                            data-testid={`button-delete-pool-${pool.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      
                      {pool.status === 'open' && (
                        <Button 
                          variant="default"
                          onClick={() => updateStatusMutation.mutate({ id: pool.id, status: 'locked' })}
                          disabled={updateStatusMutation.isPending}
                          data-testid={`button-lock-pool-${pool.id}`}
                        >
                          <Lock className="w-4 h-4 mr-1" />
                          Lock Pool
                        </Button>
                      )}
                      
                      {pool.status === 'locked' && (
                        <Button 
                          variant="destructive"
                          onClick={() => updateStatusMutation.mutate({ id: pool.id, status: 'closed' })}
                          disabled={updateStatusMutation.isPending}
                          data-testid={`button-close-pool-${pool.id}`}
                        >
                          Close Pool
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Layers className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Pools Created</h3>
              <p className="text-muted-foreground mb-6">Create your first ABS pool to start managing loans.</p>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-pool">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Pool
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
