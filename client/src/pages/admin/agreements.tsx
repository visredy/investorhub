import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  FileSignature, 
  ArrowLeft, 
  Download, 
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Users,
  Loader2
} from 'lucide-react';
import type { Agreement, InvestorWithStats } from '@shared/schema';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount);
}

export default function AdminAgreementsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [investmentAmount, setInvestmentAmount] = useState('');

  const { data: agreements, isLoading } = useQuery<Agreement[]>({
    queryKey: ['/api/admin/agreements'],
  });

  const { data: investors } = useQuery<InvestorWithStats[]>({
    queryKey: ['/api/admin/investors'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { userId: number; title: string; content: string; investmentAmount: number }) => {
      return apiRequest('POST', '/api/admin/agreements', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/agreements'] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: 'Agreement Created',
        description: 'The investment agreement has been sent to the investor.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create agreement',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setSelectedUserId('');
    setTitle('');
    setContent('');
    setInvestmentAmount('');
  };

  const handleCreate = () => {
    if (!selectedUserId || !title || !content || !investmentAmount) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const amount = parseFloat(investmentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Investment amount must be a positive number',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate({
      userId: parseInt(selectedUserId),
      title,
      content,
      investmentAmount: amount
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'signed':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"><CheckCircle2 className="w-3 h-3 mr-1" /> Signed</Badge>;
      case 'expired':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Expired</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  const defaultContent = `INVESTMENT AGREEMENT TERMS AND CONDITIONS

1. INVESTMENT OVERVIEW
This Investment Agreement ("Agreement") is entered into between the Investor and InvestorHub Fund Management ("Fund Manager").

2. INVESTMENT TERMS
- The Investor agrees to invest the specified amount into the Fund.
- The investment is subject to market conditions and risks.
- Returns are not guaranteed and may vary based on fund performance.

3. DURATION
- This investment has a minimum holding period of 12 months.
- Early withdrawal may be subject to fees and restrictions.

4. DISTRIBUTIONS
- Returns will be distributed on a monthly basis.
- Distributions are subject to the Fund's waterfall distribution policy.

5. RISK DISCLOSURE
- All investments carry risk of loss.
- Past performance is not indicative of future results.
- The Investor acknowledges understanding of these risks.

6. GOVERNING LAW
This Agreement shall be governed by applicable financial regulations and laws.

By signing this agreement, the Investor acknowledges having read, understood, and agreed to all terms and conditions set forth herein.`;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/admin')} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <FileSignature className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Manage Agreements</span>
            </div>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-agreement">
                <Plus className="w-4 h-4 mr-2" />
                Create Agreement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Investment Agreement</DialogTitle>
                <DialogDescription>
                  Create a new investment agreement for an investor to sign.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="investor">Select Investor *</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger data-testid="select-investor">
                      <SelectValue placeholder="Choose an investor" />
                    </SelectTrigger>
                    <SelectContent>
                      {investors?.map((investor) => (
                        <SelectItem key={investor.id} value={investor.id.toString()}>
                          {investor.name} ({investor.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Agreement Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Q1 2024 Investment Agreement"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Investment Amount ($) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="e.g., 50000"
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(e.target.value)}
                    data-testid="input-amount"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="content">Agreement Content *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setContent(defaultContent)}
                      data-testid="button-use-template"
                    >
                      Use Template
                    </Button>
                  </div>
                  <Textarea
                    id="content"
                    placeholder="Enter the terms and conditions..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[200px]"
                    data-testid="input-content"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false);
                      resetForm();
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Agreement
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Investment Agreements</h1>
          <p className="text-muted-foreground">Create and manage investment agreements for investors</p>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : agreements && agreements.length > 0 ? (
          <div className="grid gap-4">
            {agreements.map((agreement) => {
              const investor = investors?.find(i => i.id === agreement.userId);
              return (
                <Card key={agreement.id} className="hover-elevate" data-testid={`agreement-${agreement.id}`}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileSignature className="w-5 h-5" />
                          {agreement.title}
                        </CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {investor?.name || `User #${agreement.userId}`} - {formatCurrency(agreement.investmentAmount)}
                        </CardDescription>
                      </div>
                      {getStatusBadge(agreement.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                      <p className="text-muted-foreground line-clamp-2">{agreement.content}</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
                      <span>Created: {new Date(agreement.createdAt).toLocaleDateString()}</span>
                      {agreement.signedAt && (
                        <span>Signed: {new Date(agreement.signedAt).toLocaleDateString()}</span>
                      )}
                    </div>

                    {agreement.status === 'signed' && agreement.signedPdfFilename && (
                      <Button 
                        variant="outline"
                        onClick={() => window.open(`/api/agreements/${agreement.id}/download`, '_blank')}
                        data-testid={`button-download-${agreement.id}`}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Signed PDF
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <FileSignature className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Agreements Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first investment agreement to get started.
              </p>
              <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Create Agreement
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
