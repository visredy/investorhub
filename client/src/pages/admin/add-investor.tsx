import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  LogOut,
  ChevronLeft,
  User,
  Mail,
  Lock,
  DollarSign,
  Percent,
  Loader2,
  Shield
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AddInvestorPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initialInvestment, setInitialInvestment] = useState('');
  const [roi, setRoi] = useState('');

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/admin/investor', data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create investor');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/investors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({ title: 'Success', description: 'Investor added successfully!' });
      setLocation('/admin');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      name,
      email,
      password,
      initialInvestment: parseFloat(initialInvestment) || 0,
      roi: parseFloat(roi) || 0,
    });
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
            <Button variant="ghost" size="icon" onClick={logout} data-testid="button-logout">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/admin')}
            className="mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Add New Investor</h1>
          <p className="text-muted-foreground">Create a new investor account with optional initial investment</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Enter the investor's details below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="John Smith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      required
                      data-testid="input-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="investor@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                      data-testid="input-password"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-medium mb-4">Initial Investment (Optional)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="investment">Investment Amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="investment"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={initialInvestment}
                        onChange={(e) => setInitialInvestment(e.target.value)}
                        className="pl-10"
                        data-testid="input-investment"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="roi">Annual ROI (%)</Label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="roi"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="0.0"
                        value={roi}
                        onChange={(e) => setRoi(e.target.value)}
                        className="pl-10"
                        data-testid="input-roi"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={mutation.isPending} data-testid="button-submit">
                  {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Add Investor
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation('/admin')}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
