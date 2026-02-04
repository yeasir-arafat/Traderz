import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, Package, FileCheck, AlertTriangle, ShoppingCart,
  Loader2, TrendingUp, TrendingDown, DollarSign, Wallet, Lock,
  Clock, CheckCircle, XCircle, Activity, RefreshCw, Store,
  ChevronRight, UserCog, Settings, ScrollText, Layers, Gavel,
  CreditCard, HeadphonesIcon, Plus, Home, BarChart3
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const isSuperAdmin = user?.roles?.includes('super_admin');
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!isSuperAdmin) {
      navigate('/');
      toast.error('Super admin access required');
      return;
    }
    
    fetchDashboard();
  }, [isAuthenticated, isSuperAdmin]);
  
  const fetchDashboard = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await superAdminAPI.getDashboard();
      setDashboard(data);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
    return `$${amount?.toFixed(2) || '0'}`;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#101722] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }
  
  const finance = dashboard?.finance || {};
  
  return (
    <div className="min-h-screen bg-[#101722] text-white font-sans antialiased pb-24" data-testid="superadmin-dashboard">
      {/* System Pulse Header */}
      <header className="sticky top-0 z-50 bg-[#101722]/90 backdrop-blur-md border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-blue-500/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#101722] rounded-full"></span>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight tracking-tight">Admin Hub</h2>
              <p className="text-xs text-slate-400 font-medium">Welcome back, {user?.username || 'Admin'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <p className="text-emerald-500 text-xs font-bold uppercase tracking-wide">System Stable</p>
            </div>
          </div>
        </div>
      </header>

      {/* Key Metrics Carousel */}
      <section className="mt-4">
        <div className="flex overflow-x-auto gap-4 px-4 pb-2 snap-x snap-mandatory scrollbar-hide">
          {/* Card 1: Total Users */}
          <div className="snap-center shrink-0 min-w-[240px] flex-1 flex flex-col gap-1 rounded-xl p-5 bg-[#1e2736]/80 backdrop-blur-md border border-white/5 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-sm font-medium">Total Users</p>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold tracking-tight">{(dashboard?.total_users || 0).toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <p className="text-emerald-500 text-sm font-bold">+12%</p>
              <p className="text-slate-500 text-xs ml-1">vs last month</p>
            </div>
          </div>

          {/* Card 2: Active Sellers */}
          <div className="snap-center shrink-0 min-w-[240px] flex-1 flex flex-col gap-1 rounded-xl p-5 bg-[#1e2736]/80 backdrop-blur-md border border-white/5 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-sm font-medium">Active Sellers</p>
              <Store className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold tracking-tight">{(dashboard?.total_sellers || 0).toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <p className="text-emerald-500 text-sm font-bold">+5%</p>
              <p className="text-slate-500 text-xs ml-1">vs last month</p>
            </div>
          </div>

          {/* Card 3: GMV Revenue */}
          <div className="snap-center shrink-0 min-w-[240px] flex-1 flex flex-col gap-1 rounded-xl p-5 bg-[#1e2736]/80 backdrop-blur-md border border-white/5 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-sm font-medium">GMV Revenue</p>
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold tracking-tight">{formatCurrency(finance?.total_volume_usd || 0)}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <p className="text-emerald-500 text-sm font-bold">+8.2%</p>
              <p className="text-slate-500 text-xs ml-1">vs last month</p>
            </div>
          </div>

          {/* Card 4: Orders */}
          <div className="snap-center shrink-0 min-w-[240px] flex-1 flex flex-col gap-1 rounded-xl p-5 bg-[#1e2736]/80 backdrop-blur-md border border-white/5 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all"></div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-sm font-medium">Total Orders</p>
              <ShoppingCart className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-3xl font-bold tracking-tight">{(dashboard?.total_orders || 0).toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <p className="text-slate-400 text-sm">{dashboard?.completed_orders || 0} completed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Action Center */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight">Action Center</h2>
          <button className="text-blue-500 text-sm font-bold hover:text-blue-400 transition-colors">View All</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* KYC Requests */}
          <button 
            onClick={() => navigate('/admin/kyc-reviews')}
            className="relative flex flex-col items-start justify-between h-40 p-5 rounded-2xl bg-gradient-to-br from-[#1e2736] to-[#161d29] border border-white/5 hover:border-blue-500/50 transition-colors active:scale-95 duration-200"
            data-testid="action-kyc"
          >
            <div className="bg-blue-500/20 p-3 rounded-full text-blue-400">
              <FileCheck className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-base font-bold text-white leading-tight">KYC Requests</p>
              <p className="text-sm text-slate-400 mt-1">Identity verification</p>
            </div>
            {dashboard?.pending_kyc > 0 && (
              <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg shadow-red-500/20">
                {dashboard.pending_kyc} Pending
              </div>
            )}
          </button>

          {/* Disputes */}
          <button 
            onClick={() => navigate('/superadmin/orders')}
            className="relative flex flex-col items-start justify-between h-40 p-5 rounded-2xl bg-gradient-to-br from-[#1e2736] to-[#161d29] border border-white/5 hover:border-orange-500/50 transition-colors active:scale-95 duration-200"
            data-testid="action-disputes"
          >
            <div className="bg-orange-500/20 p-3 rounded-full text-orange-400">
              <Gavel className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-base font-bold text-white leading-tight">Disputes</p>
              <p className="text-sm text-slate-400 mt-1">Resolution center</p>
            </div>
            {dashboard?.disputed_orders > 0 && (
              <div className="absolute top-4 right-4 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg shadow-orange-500/20">
                {dashboard.disputed_orders} Urgent
              </div>
            )}
          </button>

          {/* Listings */}
          <button 
            onClick={() => navigate('/admin/pending-listings')}
            className="relative flex flex-col items-start justify-between h-40 p-5 rounded-2xl bg-gradient-to-br from-[#1e2736] to-[#161d29] border border-white/5 hover:border-emerald-500/50 transition-colors active:scale-95 duration-200"
            data-testid="action-listings"
          >
            <div className="bg-emerald-500/20 p-3 rounded-full text-emerald-400">
              <Package className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-base font-bold text-white leading-tight">Listings</p>
              <p className="text-sm text-slate-400 mt-1">Quality control</p>
            </div>
            {dashboard?.pending_listings > 0 && (
              <div className="absolute top-4 right-4 bg-[#1e2736] border border-white/10 text-slate-300 text-[10px] font-bold px-2 py-1 rounded-full">
                {dashboard.pending_listings} Review
              </div>
            )}
          </button>

          {/* Withdrawals */}
          <button 
            onClick={() => navigate('/superadmin/withdrawals')}
            className="relative flex flex-col items-start justify-between h-40 p-5 rounded-2xl bg-gradient-to-br from-[#1e2736] to-[#161d29] border border-white/5 hover:border-purple-500/50 transition-colors active:scale-95 duration-200"
            data-testid="action-withdrawals"
          >
            <div className="bg-purple-500/20 p-3 rounded-full text-purple-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-base font-bold text-white leading-tight">Withdrawals</p>
              <p className="text-sm text-slate-400 mt-1">Payout requests</p>
            </div>
            {dashboard?.pending_withdrawals > 0 && (
              <div className="absolute top-4 right-4 bg-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg shadow-purple-500/20">
                {dashboard.pending_withdrawals} Pending
              </div>
            )}
          </button>
        </div>
      </section>

      {/* Financial Flow */}
      <section className="px-4 mt-8">
        <div className="rounded-2xl bg-[#1e2736] border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-medium text-slate-400">Financial Flow</h2>
              <div className="flex items-end gap-2 mt-1">
                <span className="text-2xl font-bold text-white">{formatCurrency(finance?.total_volume_usd || 0)}</span>
                <span className="text-sm font-medium text-emerald-500 mb-1">+12% this week</span>
              </div>
            </div>
            <button 
              onClick={() => navigate('/superadmin/finance')}
              className="bg-white/5 p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <BarChart3 className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Chart Area */}
          <div className="w-full h-32 relative">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 400 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,80 C50,80 50,40 100,40 C150,40 150,90 200,60 C250,30 250,60 300,50 C350,40 350,10 400,10 V120 H0 Z"
                fill="url(#chartGradient)"
              />
              <path
                d="M0,80 C50,80 50,40 100,40 C150,40 150,90 200,60 C250,30 250,60 300,50 C350,40 350,10 400,10"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            {/* Chart Labels */}
            <div className="flex justify-between mt-2 text-xs font-medium text-slate-500">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>

          {/* Mini Stats Row */}
          <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
            <div>
              <p className="text-xs text-slate-400 mb-1">Escrow Held</p>
              <p className="text-lg font-bold text-white">{formatCurrency(finance?.escrow_held_usd || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Platform Fees</p>
              <p className="text-lg font-bold text-white">{formatCurrency(finance?.platform_earnings_usd || 0)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions Grid */}
      <section className="px-4 mt-8">
        <h2 className="text-xl font-bold tracking-tight mb-4">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          <button 
            onClick={() => navigate('/superadmin/users')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#1e2736] border border-white/5 hover:border-blue-500/50 transition-all hover:bg-[#1e2736]/80"
          >
            <Users className="w-6 h-6 text-blue-500" />
            <span className="text-xs font-medium text-slate-300">Users</span>
          </button>
          <button 
            onClick={() => navigate('/superadmin/giftcards')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#1e2736] border border-white/5 hover:border-emerald-500/50 transition-all hover:bg-[#1e2736]/80"
          >
            <CreditCard className="w-6 h-6 text-emerald-500" />
            <span className="text-xs font-medium text-slate-300">Gift Cards</span>
          </button>
          <button 
            onClick={() => navigate('/superadmin/games-fees')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#1e2736] border border-white/5 hover:border-purple-500/50 transition-all hover:bg-[#1e2736]/80"
          >
            <Layers className="w-6 h-6 text-purple-500" />
            <span className="text-xs font-medium text-slate-300">Games</span>
          </button>
          <button 
            onClick={() => navigate('/superadmin/admin-scopes')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#1e2736] border border-white/5 hover:border-orange-500/50 transition-all hover:bg-[#1e2736]/80"
          >
            <Lock className="w-6 h-6 text-orange-500" />
            <span className="text-xs font-medium text-slate-300">Scopes</span>
          </button>
        </div>
      </section>

      {/* Recent Activity Feed */}
      <section className="px-4 mt-8 mb-4">
        <h2 className="text-xl font-bold tracking-tight mb-4">Recent Activity</h2>
        <div className="flex flex-col gap-4">
          {dashboard?.recent_actions?.slice(0, 5).map((action, index) => (
            <div key={action.id || index} className="flex gap-4 items-start">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs border border-white/10">
                  {action.actor_username?.slice(0, 2).toUpperCase() || 'SYS'}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[#101722] rounded-full p-0.5">
                  {action.action_type?.includes('approve') || action.action_type?.includes('complete') ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 bg-emerald-500/10 rounded-full p-0.5" />
                  ) : action.action_type?.includes('dispute') || action.action_type?.includes('reject') ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500 bg-orange-500/10 rounded-full p-0.5" />
                  ) : (
                    <Activity className="w-3.5 h-3.5 text-blue-500 bg-blue-500/10 rounded-full p-0.5" />
                  )}
                </div>
              </div>
              <div className={`flex-1 ${index < (dashboard?.recent_actions?.length || 0) - 1 ? 'border-b border-white/5 pb-4' : ''}`}>
                <p className="text-sm font-medium text-white">{action.action_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                <p className="text-xs text-slate-400 mt-0.5">{action.reason || 'No details'}</p>
              </div>
              <p className="text-xs font-bold text-slate-500 shrink-0">{formatTime(action.created_at)}</p>
            </div>
          )) || (
            <div className="flex gap-4 items-start">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs border border-white/10">
                  SYS
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">System Online</p>
                <p className="text-xs text-slate-400 mt-0.5">All systems operational</p>
              </div>
              <p className="text-xs font-bold text-slate-500 shrink-0">Now</p>
            </div>
          )}
        </div>
      </section>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-40 bg-[#101722]/80 backdrop-blur-xl border-t border-white/10 pt-2 pb-4">
        <div className="flex justify-around items-center px-2">
          <button 
            onClick={() => navigate('/superadmin')}
            className="flex flex-col items-center gap-1 p-2 text-blue-500"
          >
            <Home className="w-6 h-6" style={{ fill: 'currentColor', fillOpacity: 0.2 }} />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <button 
            onClick={() => navigate('/superadmin/users')}
            className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Users className="w-6 h-6" />
            <span className="text-[10px] font-medium">Users</span>
          </button>
          <button 
            onClick={() => navigate('/superadmin/orders')}
            className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <div className="bg-blue-500 w-12 h-12 rounded-full -mt-8 border-4 border-[#101722] flex items-center justify-center shadow-lg shadow-blue-500/30 text-white">
              <Plus className="w-6 h-6" />
            </div>
          </button>
          <button 
            onClick={() => navigate('/superadmin/finance')}
            className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Wallet className="w-6 h-6" />
            <span className="text-[10px] font-medium">Finance</span>
          </button>
          <button 
            onClick={() => navigate('/superadmin/config')}
            className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </div>
      </nav>

      {/* Hide scrollbar style */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
