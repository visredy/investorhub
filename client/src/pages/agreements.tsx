import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SignaturePad } from '@/components/signature-pad';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  FileSignature, 
  ArrowLeft, 
  Download, 
  Clock,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import type { Agreement } from '@shared/schema';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount);
}

export default function AgreementsPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);

  const { data: agreements, isLoading } = useQuery<Agreement[]>({
    queryKey: ['/api/agreements'],
  });

  const signMutation = useMutation({
    mutationFn: async ({ id, signatureData }: { id: number; signatureData: string }) => {
      return apiRequest('POST', `/api/agreements/${id}/sign`, { signatureData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agreements'] });
      setShowSignDialog(false);
      setSelectedAgreement(null);
      toast({
        title: 'Agreement Signed',
        description: 'Your investment agreement has been signed successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign agreement',
        variant: 'destructive',
      });
    },
  });

  const handleSign = (signatureData: string) => {
    if (!selectedAgreement) return;
    signMutation.mutate({ id: selectedAgreement.id, signatureData });
  };

  const openSignDialog = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    setShowSignDialog(true);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/dashboard')} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <FileSignature className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Investment Agreements</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium hidden sm:inline">{user?.name}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Your Agreements</h1>
          <p className="text-muted-foreground">Review and sign your investment agreements</p>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : agreements && agreements.length > 0 ? (
          <div className="grid gap-4">
            {agreements.map((agreement) => (
              <Card key={agreement.id} className="hover-elevate" data-testid={`agreement-${agreement.id}`}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileSignature className="w-5 h-5" />
                        {agreement.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Investment Amount: {formatCurrency(agreement.investmentAmount)}
                      </CardDescription>
                    </div>
                    {getStatusBadge(agreement.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                    <p className="text-muted-foreground line-clamp-3">{agreement.content}</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
                    <span>Created: {new Date(agreement.createdAt).toLocaleDateString()}</span>
                    {agreement.signedAt && (
                      <span>Signed: {new Date(agreement.signedAt).toLocaleDateString()}</span>
                    )}
                    {agreement.expiresAt && (
                      <span>Expires: {new Date(agreement.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {agreement.status === 'pending' && (
                      <Button 
                        onClick={() => openSignDialog(agreement)}
                        data-testid={`button-sign-${agreement.id}`}
                      >
                        <FileSignature className="w-4 h-4 mr-2" />
                        Sign Agreement
                      </Button>
                    )}
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <FileSignature className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Agreements</h3>
              <p className="text-muted-foreground">
                You don't have any investment agreements yet. Contact your administrator for new investment opportunities.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sign Agreement</DialogTitle>
            <DialogDescription>
              {selectedAgreement?.title}
            </DialogDescription>
          </DialogHeader>
          
          {selectedAgreement && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg max-h-64 overflow-y-auto">
                <h4 className="font-semibold mb-2">Agreement Terms</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedAgreement.content}
                </p>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Investment Amount</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(selectedAgreement.investmentAmount)}
                </p>
              </div>

              <SignaturePad
                onSign={handleSign}
                onCancel={() => setShowSignDialog(false)}
                disabled={signMutation.isPending}
              />
              
              {signMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing signature...</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
