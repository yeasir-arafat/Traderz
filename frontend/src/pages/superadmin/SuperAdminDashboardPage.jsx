import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield, Users, Package, FileCheck, AlertTriangle, ShoppingCart,
  Loader2, TrendingUp, TrendingDown, DollarSign, Wallet, Lock,
  Clock, CheckCircle, XCircle, Activity, Database, RefreshCw,
  ChevronRight, Eye, UserCog, Settings, ScrollText, Layers, Gavel
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore, useCurrencyStore } from '../../store';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// KPI Card Component
function KPICard({ icon: Icon, label, value, change, trend, color = 'primary', onClick, testId }) {
  const colorClasses = {
    primary: 'text-primary border-primary/30',
    green: 'text-green-500 border-green-500/30',
    blue: 'text-blue-500 border-blue-500/30',
    yellow: 'text-yellow-500 border-yellow-500/30',
    red: 'text-red-500 border-red-500/30',
    purple: 'text-purple-500 border-purple-500/30',
  };

  return (
    <Card 
      className={`hover:border-${color}/50 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={`w-6 h-6 ${colorClasses[color]?.split(' ')[0] || 'text-primary'}`} />
          {trend && (
            <div className={`flex items-center text-xs ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {change && `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
            </div>
          )}
        </div>
        <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

// Finance Stat Card
function FinanceCard({ label, value, icon: Icon, color = 'green' }) {
  const colorClasses = {
    green: 'text-green-500 bg-green-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    yellow: 'text-yellow-500 bg-yellow-500/10',
    red: 'text-red-500 bg-red-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// Action Queue Item
function ActionQueueItem({ title, subtitle, time, onAction, actionLabel = 'Review' }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
        <Button size="sm" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
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
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const finance = dashboard?.finance || {};
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Super Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Platform owner controls</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => navigate('/superadmin/users')}>
            <UserCog className="w-4 h-4 mr-2" />
            Users
          </Button>
          <Button size="sm" onClick={() => navigate('/superadmin/games-fees')}>
            <Layers className="w-4 h-4 mr-2" />
            Games & Fees
          </Button>
          <Button size="sm" onClick={() => navigate('/superadmin/moderation')}>
            <Gavel className="w-4 h-4 mr-2" />
            Moderation
          </Button>
          <Button size="sm" onClick={() => navigate('/superadmin/finance')}>
            <Wallet className="w-4 h-4 mr-2" />
            Finance
          </Button>
          <Button size="sm" onClick={() => navigate('/superadmin/config')}>
            <Settings className="w-4 h-4 mr-2" />
            Config
          </Button>
          <Button size="sm" onClick={() => navigate('/superadmin/legal')}>
            <ScrollText className="w-4 h-4 mr-2" />
            Legal
          </Button>
        </div>
      </div>
      
      {/* KPI Cards - Top Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KPICard
          icon={Users}
          label="Total Users"
          value={dashboard?.total_users || 0}
          color="blue"
          testId="kpi-total-users"
        />
        <KPICard
          icon={Users}
          label="Sellers"
          value={dashboard?.total_sellers || 0}
          color="purple"
          testId="kpi-sellers"
        />
        <KPICard
          icon={Package}
          label="Active Listings"
          value={dashboard?.active_listings || 0}
          color="green"
          testId="kpi-active-listings"
        />
        <KPICard
          icon={Clock}
          label="Pending Listings"
          value={dashboard?.pending_listings || 0}
          color="yellow"
          onClick={() => navigate('/admin/listings')}
          testId="kpi-pending-listings"
        />
        <KPICard
          icon={FileCheck}
          label="Pending KYC"
          value={dashboard?.pending_kyc || 0}
          color="blue"
          onClick={() => navigate('/admin/kyc')}
          testId="kpi-pending-kyc"
        />
        <KPICard
          icon={AlertTriangle}
          label="Disputes"
          value={dashboard?.disputed_orders || 0}
          color="red"
          onClick={() => navigate('/admin/disputes')}
          testId="kpi-disputes"
        />
        <KPICard
          icon={ShoppingCart}
          label="In Delivery"
          value={dashboard?.orders_in_delivery || 0}
          color="primary"
          testId="kpi-in-delivery"
        />
        <KPICard
          icon={DollarSign}
          label="Earnings (7d)"
          value={formatCurrency(dashboard?.platform_earnings_7d || 0, currency, usdToBdtRate)}
          color="green"
          testId="kpi-earnings"
        />
      </div>
      
      {/* Finance Section */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Finance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <FinanceCard
              icon={TrendingUp}
              label="Total Deposits"
              value={formatCurrency(finance.total_deposits_usd || 0, currency, usdToBdtRate)}
              color="green"
            />
            <FinanceCard
              icon={TrendingDown}
              label="Withdrawals Paid"
              value={formatCurrency(finance.total_withdrawals_usd || 0, currency, usdToBdtRate)}
              color="red"
            />
            <FinanceCard
              icon={Lock}
              label="Escrow Held"
              value={formatCurrency(finance.total_escrow_held_usd || 0, currency, usdToBdtRate)}
              color="yellow"
            />
            <FinanceCard
              icon={Clock}
              label="Seller Pending"
              value={formatCurrency(finance.total_seller_pending_usd || 0, currency, usdToBdtRate)}
              color="blue"
            />
            <FinanceCard
              icon={Lock}
              label="Frozen Funds"
              value={formatCurrency(finance.total_frozen_usd || 0, currency, usdToBdtRate)}
              color="red"
            />
            <FinanceCard
              icon={DollarSign}
              label="Fees (All-time)"
              value={formatCurrency(finance.platform_fee_all_time_usd || 0, currency, usdToBdtRate)}
              color="green"
            />
            <FinanceCard
              icon={DollarSign}
              label="Fees (30d)"
              value={formatCurrency(finance.platform_fee_30d_usd || 0, currency, usdToBdtRate)}
              color="purple"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Orders Over Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Orders (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboard?.orders_over_time || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#888', fontSize: 10 }}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    labelStyle={{ color: '#888' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', r: 3 }}
                    name="Orders"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Revenue Over Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Platform Revenue (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard?.revenue_over_time || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#888', fontSize: 10 }}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                    formatter={(val) => [`$${val.toFixed(2)}`, 'Revenue']}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Listing Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Listing Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboard?.listing_status_distribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {(dashboard?.listing_status_distribution || []).map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {(dashboard?.listing_status_distribution || []).map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <div 
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="capitalize">{entry.name}</span>
                    <span className="ml-auto font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* KYC Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">KYC Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboard?.kyc_status_distribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {(dashboard?.kyc_status_distribution || []).map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {(dashboard?.kyc_status_distribution || []).map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <div 
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="capitalize">{entry.name.replace('_', ' ')}</span>
                    <span className="ml-auto font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Action Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Pending Listings Queue */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-yellow-500" />
                Pending Listings
              </CardTitle>
              <Link to="/admin/listings">
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {(dashboard?.pending_listings_queue || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending listings</p>
            ) : (
              (dashboard?.pending_listings_queue || []).map((item) => (
                <ActionQueueItem
                  key={item.id}
                  title={item.title}
                  subtitle={`by ${item.seller}`}
                  time={formatTime(item.created_at)}
                  onAction={() => navigate('/admin/listings')}
                />
              ))
            )}
          </CardContent>
        </Card>
        
        {/* Pending KYC Queue */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-500" />
                Pending KYC
              </CardTitle>
              <Link to="/admin/kyc">
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {(dashboard?.pending_kyc_queue || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending KYC</p>
            ) : (
              (dashboard?.pending_kyc_queue || []).map((item) => (
                <ActionQueueItem
                  key={item.id}
                  title={item.user}
                  subtitle={item.doc_type?.replace('_', ' ')}
                  time={formatTime(item.created_at)}
                  onAction={() => navigate('/admin/kyc')}
                />
              ))
            )}
          </CardContent>
        </Card>
        
        {/* Recent Disputes */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Recent Disputes
              </CardTitle>
              <Link to="/admin/disputes">
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {(dashboard?.recent_disputes || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active disputes</p>
            ) : (
              (dashboard?.recent_disputes || []).map((item) => (
                <ActionQueueItem
                  key={item.id}
                  title={item.order_number}
                  subtitle={`$${item.amount?.toFixed(2)} • ${item.buyer} vs ${item.seller}`}
                  time=""
                  actionLabel="Resolve"
                  onAction={() => navigate('/admin/disputes')}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Bottom Row: Admin Actions & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Admin Actions */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-primary" />
                Recent Admin Actions
              </CardTitle>
              <Link to="/superadmin/audit-logs">
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(dashboard?.recent_admin_actions || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent actions</p>
              ) : (
                (dashboard?.recent_admin_actions || []).slice(0, 5).map((action) => (
                  <div key={action.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">
                        {action.action_type?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {action.actor_role}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(action.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* System Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-500" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Database Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-muted-foreground" />
                  <span>Database Connection</span>
                </div>
                {dashboard?.system_health?.db_connected ? (
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" /> Connected
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                    <XCircle className="w-3 h-3 mr-1" /> Disconnected
                  </Badge>
                )}
              </div>
              
              {/* Scheduler Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <span>Job Scheduler</span>
                </div>
                {dashboard?.system_health?.scheduler_running ? (
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" /> Running
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                    <XCircle className="w-3 h-3 mr-1" /> Stopped
                  </Badge>
                )}
              </div>
              
              {/* Scheduled Jobs */}
              {(dashboard?.system_health?.jobs || []).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Scheduled Jobs:</p>
                  <div className="space-y-2">
                    {(dashboard?.system_health?.jobs || []).map((job) => (
                      <div key={job.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/20">
                        <span>{job.name || job.id}</span>
                        <span className="text-muted-foreground">
                          Next: {job.next_run_time ? new Date(job.next_run_time).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
