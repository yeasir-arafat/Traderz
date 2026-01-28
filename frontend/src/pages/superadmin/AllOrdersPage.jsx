import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Loader2, Search, RefreshCw, Eye, ArrowUpDown } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  paid: 'bg-blue-500/20 text-blue-400',
  delivered: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-green-500/20 text-green-400',
  disputed: 'bg-red-500/20 text-red-400',
  refunded: 'bg-orange-500/20 text-orange-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

export default function AllOrdersPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const isSuperAdmin = user?.roles?.includes('super_admin');

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
    loadOrders();
  }, [isAuthenticated, isSuperAdmin, page, statusFilter]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 20 };
      if (statusFilter) params.status = statusFilter;
      if (search) params.q = search;
      
      const data = await superAdminAPI.getAllOrders(params);
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error(error.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadOrders();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return `$${(amount || 0).toFixed(2)}`;
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl" data-testid="all-orders-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">All Orders</h1>
            <p className="text-sm text-muted-foreground">
              View and manage all platform orders with escrow breakdown
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order number, buyer, seller..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="order-search-input"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px]" data-testid="status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Orders ({total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No orders found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="orders-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2">Order #</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Buyer</th>
                    <th className="text-left py-3 px-2">Seller</th>
                    <th className="text-right py-3 px-2">Amount</th>
                    <th className="text-right py-3 px-2">Fee</th>
                    <th className="text-right py-3 px-2">Seller Gets</th>
                    <th className="text-left py-3 px-2">Created</th>
                    <th className="text-center py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30" data-testid={`order-row-${order.id}`}>
                      <td className="py-3 px-2 font-mono text-xs">{order.order_number}</td>
                      <td className="py-3 px-2">
                        <Badge className={STATUS_COLORS[order.status] || 'bg-gray-500/20'}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">{order.buyer_username || '-'}</td>
                      <td className="py-3 px-2">{order.seller_username || '-'}</td>
                      <td className="py-3 px-2 text-right font-medium">{formatCurrency(order.amount_usd)}</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">{formatCurrency(order.platform_fee_usd)}</td>
                      <td className="py-3 px-2 text-right text-green-400">{formatCurrency(order.seller_earnings_usd)}</td>
                      <td className="py-3 px-2 text-xs text-muted-foreground">{formatDate(order.created_at)}</td>
                      <td className="py-3 px-2 text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedOrder(order)}
                          data-testid={`view-order-${order.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(total / 20)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= Math.ceil(total / 20)}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <Card className="max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Order Number</p>
                  <p className="font-mono">{selectedOrder.order_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={STATUS_COLORS[selectedOrder.status]}>{selectedOrder.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Buyer</p>
                  <p>{selectedOrder.buyer_username}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Seller</p>
                  <p>{selectedOrder.seller_username}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">{formatCurrency(selectedOrder.amount_usd)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Platform Fee</p>
                  <p>{formatCurrency(selectedOrder.platform_fee_usd)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Seller Earnings</p>
                  <p className="text-green-400">{formatCurrency(selectedOrder.seller_earnings_usd)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Listing</p>
                  <p className="truncate">{selectedOrder.listing_title || '-'}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(selectedOrder.created_at)}</p>
                </div>
                {selectedOrder.delivered_at && (
                  <div>
                    <p className="text-muted-foreground">Delivered</p>
                    <p>{formatDate(selectedOrder.delivered_at)}</p>
                  </div>
                )}
                {selectedOrder.completed_at && (
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p>{formatDate(selectedOrder.completed_at)}</p>
                  </div>
                )}
                {selectedOrder.disputed_at && (
                  <div>
                    <p className="text-muted-foreground">Disputed</p>
                    <p>{formatDate(selectedOrder.disputed_at)}</p>
                  </div>
                )}
              </div>

              {selectedOrder.dispute_reason && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Dispute Reason</p>
                  <p className="text-sm">{selectedOrder.dispute_reason}</p>
                </div>
              )}

              {selectedOrder.dispute_resolution && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Resolution</p>
                  <p className="text-sm">{selectedOrder.dispute_resolution}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>Close</Button>
                <Button onClick={() => navigate(`/order/${selectedOrder.id}`)}>
                  View Full Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
