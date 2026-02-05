import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  LogOut,
  ChevronLeft,
  Plus,
  DollarSign,
  FileText,
  Trash2,
  Download,
  Loader2,
  Shield,
  Wallet,
  PiggyBank,
  Calendar,
  Edit
} from 'lucide-react';
import type { DashboardStats, Investment, Payout, Document } from '@shared/schema';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount);
}

type InvestorDetail = {
  user: { id: number; name: string; email: string; role: string };
  investments: Investment[];
  payouts: Payout[];
  documents: Document[];
  stats: DashboardStats;
};

export default function InvestorDetailPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const investorId = parseInt(params.id || '0');

  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [roiDialogOpen, setRoiDialogOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);

  // Form states
  const [invAmount, setInvAmount] = useState('');
  const [invRoi, setInvRoi] = useState('');
  const [invDesc, setInvDesc] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMonth, setPayMonth] = useState('');
  const [payStatus, setPayStatus] = useState('pending');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docDesc, setDocDesc] = useState('');
  const [newRoi, setNewRoi] = useState('');

  const { data: investor, isLoading } = useQuery<InvestorDetail>({
    queryKey: ['/api/admin/investor', investorId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/investor/${investorId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch investor');
      return res.json();
    },
  });

  const addInvestmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/admin/investor/${investorId}/investment`, data);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/investor', investorId] });
      toast({ title: 'Success', description: 'Investment added!' });
      setInvestmentDialogOpen(false);
      setInvAmount(''); setInvRoi(''); setInvDesc('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateRoiMutation = useMutation({
    mutationFn: async ({ id, roi }: { id: number; roi: number }) => {
      const res = await apiRequest('PATCH', `/api/admin/investment/${id}/roi`, { roi });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/investor', investorId] });
      toast({ title: 'Success', description: 'ROI updated!' });
      setRoiDialogOpen(false);
      setNewRoi(''); setSelectedInvestment(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addPayoutMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/admin/investor/${investorId}/payout`, data);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/investor', investorId] });
      toast({ title: 'Success', description: 'Payout recorded!' });
      setPayoutDialogOpen(false);
      setPayAmount(''); setPayMonth(''); setPayStatus('pending');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updatePayoutStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest('PATCH', `/api/admin/payout/${id}/status`, { status });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/investor', investorId] });
      toast({ title: 'Success', description: 'Status updated!' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/admin/investor/${investorId}/document`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/investor', investorId] });
      toast({ title: 'Success', description: 'Document uploaded!' });
      setDocumentDialogOpen(false);
      setDocFile(null); setDocDesc('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/admin/document/${id}`, {});
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/investor', investorId] });
      toast({ title: 'Success', description: 'Document deleted!' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!investor) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <p>Investor not found</p>
        <Button onClick={() => setLocation('/admin')} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }

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
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => setLocation('/admin')} className="mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Button>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xl font-bold">
            {investor.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-investor-name">{investor.user.name}</h1>
            <p className="text-muted-foreground">{investor.user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Invested</p>
                <p className="text-xl font-bold">{formatCurrency(investor.stats.totalInvested)}</p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-3">
              <PiggyBank className="w-8 h-8 text-emerald-600" />
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-xl font-bold">{formatCurrency(investor.stats.currentBalance)}</p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Monthly</p>
                <p className="text-xl font-bold">{formatCurrency(investor.stats.monthlyReturn)}</p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-sm text-muted-foreground">ROI</p>
                <p className={`text-xl font-bold ${investor.stats.roiPercentage >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {investor.stats.roiPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent></Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Investments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Investments
              </CardTitle>
              <Dialog open={investmentDialogOpen} onOpenChange={setInvestmentDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-investment"><Plus className="w-4 h-4 mr-1" />Add</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Investment</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); addInvestmentMutation.mutate({ amount: parseFloat(invAmount), roi: parseFloat(invRoi) || 0, description: invDesc }); }} className="space-y-4">
                    <div><Label>Amount</Label><Input type="number" step="0.01" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} required data-testid="modal-input-amount" /></div>
                    <div><Label>ROI (%)</Label><Input type="number" step="0.1" value={invRoi} onChange={(e) => setInvRoi(e.target.value)} data-testid="modal-input-roi" /></div>
                    <div><Label>Description</Label><Input value={invDesc} onChange={(e) => setInvDesc(e.target.value)} data-testid="modal-input-description" /></div>
                    <Button type="submit" disabled={addInvestmentMutation.isPending} data-testid="modal-button-submit">
                      {addInvestmentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {investor.investments.length > 0 ? (
                <Table data-testid="table-investments">
                  <TableHeader><TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>ROI</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {investor.investments.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.description || 'Investment'}</TableCell>
                        <TableCell>{formatCurrency(inv.amount)}</TableCell>
                        <TableCell>{inv.roi}%</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => { setSelectedInvestment(inv); setNewRoi(String(inv.roi)); setRoiDialogOpen(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <div className="p-8 text-center text-muted-foreground">No investments</div>}
            </CardContent>
          </Card>

          {/* Payouts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Payouts
              </CardTitle>
              <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-record-payout"><Plus className="w-4 h-4 mr-1" />Record</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record Payout</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); addPayoutMutation.mutate({ amount: parseFloat(payAmount), month: payMonth, status: payStatus }); }} className="space-y-4">
                    <div><Label>Amount</Label><Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required data-testid="modal-payout-amount" /></div>
                    <div><Label>Month</Label><Input placeholder="e.g., January 2024" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} data-testid="modal-payout-month" /></div>
                    <div><Label>Status</Label>
                      <Select value={payStatus} onValueChange={setPayStatus}>
                        <SelectTrigger data-testid="modal-payout-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" disabled={addPayoutMutation.isPending} data-testid="modal-button-record">
                      {addPayoutMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Record
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {investor.payouts.length > 0 ? (
                <Table data-testid="table-payouts">
                  <TableHeader><TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {investor.payouts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.month}</TableCell>
                        <TableCell>{formatCurrency(p.amount)}</TableCell>
                        <TableCell>
                          <Select value={p.status} onValueChange={(val) => updatePayoutStatusMutation.mutate({ id: p.id, status: val })}>
                            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <div className="p-8 text-center text-muted-foreground">No payouts</div>}
            </CardContent>
          </Card>
        </div>

        {/* Documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents
            </CardTitle>
            <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-upload-document"><Plus className="w-4 h-4 mr-1" />Upload</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); if (!docFile) return; const fd = new FormData(); fd.append('file', docFile); fd.append('description', docDesc); uploadDocumentMutation.mutate(fd); }} className="space-y-4">
                  <div><Label>File</Label><Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} required data-testid="modal-file-input" /></div>
                  <div><Label>Description</Label><Input value={docDesc} onChange={(e) => setDocDesc(e.target.value)} placeholder="e.g., Q1 Report" data-testid="modal-file-description" /></div>
                  <Button type="submit" disabled={uploadDocumentMutation.isPending} data-testid="modal-button-upload">
                    {uploadDocumentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Upload
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {investor.documents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {investor.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg" data-testid={`document-${doc.id}`}>
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.description || doc.originalFilename}</p>
                      <p className="text-xs text-muted-foreground">{new Date(doc.uploadDate).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="outline" onClick={() => window.open(`/api/documents/${doc.id}/download`, '_blank')} data-testid={`button-download-${doc.id}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="text-destructive" onClick={() => deleteDocumentMutation.mutate(doc.id)} data-testid={`button-delete-${doc.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="p-8 text-center text-muted-foreground">No documents</div>}
          </CardContent>
        </Card>

        {/* ROI Edit Dialog */}
        <Dialog open={roiDialogOpen} onOpenChange={setRoiDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Update ROI</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (selectedInvestment) updateRoiMutation.mutate({ id: selectedInvestment.id, roi: parseFloat(newRoi) }); }} className="space-y-4">
              <div><Label>Annual ROI (%)</Label><Input type="number" step="0.1" value={newRoi} onChange={(e) => setNewRoi(e.target.value)} required /></div>
              <Button type="submit" disabled={updateRoiMutation.isPending}>
                {updateRoiMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Update
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
