import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Shield, Package, FileCheck, AlertTriangle, ShoppingCart,
  Loader2, ChevronRight, Users, DollarSign, Lock
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { adminAPI, superAdminAPI } from '../../lib/api';
import { useAuthStore, useCurrencyStore, hasAdminScope } from '../../store';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [dashboard, setDashboard] = useState(null);
  const [superStats, setSuperStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  const isSuperAdmin = user?.roles?.includes('super_admin');
  
  // Scope checks
  const canReviewListings = hasAdminScope(user, 'LISTINGS_REVIEW');
  const canReviewKYC = hasAdminScope(user, 'KYC_REVIEW');
  const canResolveDisputes = hasAdminScope(user, 'DISPUTE_RESOLVE');
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!isAdmin) {
      navigate('/');
      toast.error('Access denied');
      return;
    }
    
    fetchDashboard();
  }, [isAuthenticated, isAdmin]);
  
  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getDashboard();
      setDashboard(data);
      
      // If super admin, fetch additional stats
      if (isSuperAdmin) {
        try {
          const stats = await superAdminAPI.getStats();
          setSuperStats(stats);
        } catch (e) {
          console.error('Failed to fetch super admin stats:', e);
        }
      }
    } catch (error) {
      toast.error(error.message || 'Failed to fetch dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-heading font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              {isSuperAdmin ? 'Super Admin Panel' : 'Admin Panel'}
            </p>
          </div>
        </div>
        {!isSuperAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Your Scopes:</span>
            {(user?.admin_permissions || []).map(scope => (
              <Badge key={scope} variant="outline" className="text-xs">{scope.split('_')[0]}</Badge>
            ))}
            {(user?.admin_permissions || []).length === 0 && (
              <Badge variant="outline" className="text-xs text-yellow-500">No Scopes</Badge>
            )}
          </div>
        )}
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link to="/admin/listings">
          <Card className="hover:border-yellow-500/50 transition-colors cursor-pointer" data-testid="pending-listings-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 text-yellow-500" />
                <span className="text-3xl font-bold text-yellow-500">
                  {dashboard?.pending_listings || 0}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Pending Listings</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/admin/kyc">
          <Card className="hover:border-blue-500/50 transition-colors cursor-pointer" data-testid="pending-kyc-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <FileCheck className="w-8 h-8 text-blue-500" />
                <span className="text-3xl font-bold text-blue-500">
                  {dashboard?.pending_kyc || 0}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Pending KYC</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/admin/disputes">
          <Card className="hover:border-red-500/50 transition-colors cursor-pointer" data-testid="disputed-orders-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <span className="text-3xl font-bold text-red-500">
                  {dashboard?.disputed_orders || 0}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Disputed Orders</p>
            </CardContent>
          </Card>
        </Link>
        
        <Card data-testid="active-orders-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <ShoppingCart className="w-8 h-8 text-green-500" />
              <span className="text-3xl font-bold text-green-500">
                {dashboard?.active_orders || 0}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Active Orders</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Pending Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Review and approve new listings submitted by sellers.
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/admin/listings')}
              data-testid="go-to-listings-btn"
            >
              Review Listings
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">KYC Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Verify seller identities and approve KYC submissions.
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/admin/kyc')}
              data-testid="go-to-kyc-btn"
            >
              Review KYC
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Dispute Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Handle order disputes between buyers and sellers.
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/admin/disputes')}
              data-testid="go-to-disputes-btn"
            >
              Resolve Disputes
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Super Admin Stats */}
      {isSuperAdmin && superStats && (
        <>
          <h2 className="text-xl font-heading font-bold mb-4">Platform Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="total-users-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-6 h-6 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {superStats.total_users || 0}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </CardContent>
            </Card>
            
            <Card data-testid="total-sellers-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-6 h-6 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {superStats.total_sellers || 0}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Verified Sellers</p>
              </CardContent>
            </Card>
            
            <Card data-testid="total-listings-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-6 h-6 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {superStats.total_listings || 0}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Active Listings</p>
              </CardContent>
            </Card>
            
            <Card data-testid="total-volume-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-6 h-6 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {formatCurrency(superStats.total_volume_usd || 0, currency, usdToBdtRate)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Total Volume</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
