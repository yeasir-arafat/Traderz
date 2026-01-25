import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, AlertTriangle, CheckCircle, RefreshCw, Loader2, 
  User, MessageCircle, DollarSign, Clock, Package
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { adminAPI, ordersAPI } from '../../lib/api';
import { useAuthStore, useCurrencyStore } from '../../store';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

export default function DisputesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [resolvingOrder, setResolvingOrder] = useState(null);
  const [resolution, setResolution] = useState('complete');
  const [resolutionNote, setResolutionNote] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  
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
    
    fetchDisputes();
  }, [isAuthenticated, isAdmin]);
  
  const fetchDisputes = async (page = 1) => {
    setLoading(true);
    try {
      const data = await adminAPI.getDisputes({ page, page_size: 20 });
      setOrders(data.orders || []);
      setPagination({
        page: data.page,
        total: data.total,
        totalPages: data.total_pages,
      });
    } catch (error) {
      toast.error(error.message || 'Failed to fetch disputes');
    } finally {
      setLoading(false);
    }
  };
  
  const handleResolve = async () => {
    if (!resolutionNote.trim()) {
      toast.error('Please provide a resolution note');
      return;
    }
    
    setProcessing(true);
    try {
      await ordersAPI.resolveDispute(resolvingOrder.id, {
        resolution: resolution,
        resolution_note: resolutionNote,
      });
      toast.success(`Dispute resolved - ${resolution === 'refund' ? 'Buyer refunded' : 'Order completed'}`);
      setResolvingOrder(null);
      setResolutionNote('');
      setResolution('complete');
      fetchDisputes(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to resolve dispute');
    } finally {
      setProcessing(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/admin')} 
        className="mb-4"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
      
      <div className="flex items-center gap-3 mb-8">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <div>
          <h1 className="text-3xl font-heading font-bold">Dispute Resolution</h1>
          <p className="text-muted-foreground">
            Handle order disputes between buyers and sellers
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {pagination.total} disputes
        </Badge>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">No Active Disputes</h3>
            <p className="text-muted-foreground">
              All disputes have been resolved.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="hover:border-red-500/30 transition-colors" data-testid={`dispute-${order.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Disputed
                      </Badge>
                      <span className="font-mono text-sm text-muted-foreground">
                        {order.order_number}
                      </span>
                    </div>
                    
                    <h3 className="font-semibold mb-2">
                      {order.listing?.title || 'Unknown Listing'}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Buyer</p>
                        <p className="font-medium">{order.buyer?.username || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Seller</p>
                        <p className="font-medium">{order.seller?.username || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-bold text-primary">
                          {formatCurrency(order.amount_usd, currency, usdToBdtRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Disputed On</p>
                        <p className="font-medium">
                          {order.disputed_at ? new Date(order.disputed_at).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    
                    {order.dispute_reason && (
                      <div className="p-3 bg-red-500/10 rounded-lg">
                        <p className="text-sm font-medium text-red-500 mb-1">Dispute Reason:</p>
                        <p className="text-sm">{order.dispute_reason}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex lg:flex-col gap-2 flex-shrink-0">
                    <Link to={`/order/${order.id}`}>
                      <Button variant="outline" size="sm" className="w-full" data-testid={`view-order-${order.id}`}>
                        <Package className="w-4 h-4 mr-1" />
                        View Order
                      </Button>
                    </Link>
                    
                    <Button
                      size="sm"
                      onClick={() => {
                        setResolvingOrder(order);
                        setResolution('complete');
                        setResolutionNote('');
                      }}
                      data-testid={`resolve-${order.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Resolve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => fetchDisputes(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchDisputes(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Resolution Dialog */}
      <Dialog open={!!resolvingOrder} onOpenChange={() => setResolvingOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Order: {resolvingOrder?.order_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Dispute Details */}
            {resolvingOrder?.dispute_reason && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Dispute Reason:</p>
                <p className="text-sm text-muted-foreground">{resolvingOrder.dispute_reason}</p>
              </div>
            )}
            
            {/* Resolution Choice */}
            <div>
              <label className="text-sm font-medium mb-3 block">Resolution Decision</label>
              <RadioGroup value={resolution} onValueChange={setResolution}>
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:border-primary/50 transition-colors">
                  <RadioGroupItem value="complete" id="complete" data-testid="resolution-complete" />
                  <Label htmlFor="complete" className="flex-1 cursor-pointer">
                    <p className="font-medium">Complete Order</p>
                    <p className="text-xs text-muted-foreground">
                      Release funds to seller (favor seller)
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:border-primary/50 transition-colors mt-2">
                  <RadioGroupItem value="refund" id="refund" data-testid="resolution-refund" />
                  <Label htmlFor="refund" className="flex-1 cursor-pointer">
                    <p className="font-medium">Refund Buyer</p>
                    <p className="text-xs text-muted-foreground">
                      Return funds to buyer (favor buyer)
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Resolution Note */}
            <div>
              <label className="text-sm font-medium">Resolution Note *</label>
              <Textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Explain your decision..."
                rows={4}
                className="mt-2"
                data-testid="resolution-note"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolvingOrder(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleResolve}
              disabled={processing}
              className={resolution === 'refund' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
              data-testid="confirm-resolve-btn"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : resolution === 'refund' ? (
                <RefreshCw className="w-4 h-4 mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              {resolution === 'refund' ? 'Refund Buyer' : 'Complete Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
