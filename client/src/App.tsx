import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import PoolPerformancePage from "@/pages/pool-performance";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AddInvestorPage from "@/pages/admin/add-investor";
import InvestorDetailPage from "@/pages/admin/investor-detail";
import WaterfallPage from "@/pages/admin/waterfall";
import AgreementsPage from "@/pages/agreements";
import AdminAgreementsPage from "@/pages/admin/agreements";
import PoolsPage from "@/pages/admin/pools";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect logged in users from auth pages
  if (user && (location === '/login' || location === '/register' || location === '/')) {
    if (user.role === 'admin') {
      return <Redirect to="/admin" />;
    }
    return <Redirect to="/dashboard" />;
  }

  return (
    <Switch>
      <Route path="/">
        {user ? (
          user.role === 'admin' ? <Redirect to="/admin" /> : <Redirect to="/dashboard" />
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute adminOnly>
          <AdminDashboardPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/add-investor">
        <ProtectedRoute adminOnly>
          <AddInvestorPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/investor/:id">
        <ProtectedRoute adminOnly>
          <InvestorDetailPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/pool-performance">
        <ProtectedRoute>
          <PoolPerformancePage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/waterfall">
        <ProtectedRoute adminOnly>
          <WaterfallPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/agreements">
        <ProtectedRoute>
          <AgreementsPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/agreements">
        <ProtectedRoute adminOnly>
          <AdminAgreementsPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/pools">
        <ProtectedRoute adminOnly>
          <PoolsPage />
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
