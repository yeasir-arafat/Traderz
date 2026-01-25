import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Package, Truck, CheckCircle, AlertTriangle, XCircle, Clock,
  MessageCircle, Loader2, ChevronLeft, Copy
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { ordersAPI, chatsAPI } from '../lib/api';
import { useAuthStore, useCurrencyStore } from '../store';
import { formatCurrency, formatDateTime, getStatusColor } from '../lib/utils';
import { toast } from 'sonner';

export default function OrderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [showDeliver, setShowDeliver] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  
  const fetchOrder = async () => {
    try {
      const data = await ordersAPI.getById(id);
      setOrder(data);
    } catch (error) {
      toast.error('Failed to load order');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchOrder();
  }, [id]);
  
  const isBuyer = user?.id === order?.buyer_id;
  const isSeller = user?.id === order?.seller_id;
  
  const handleDeliver = async () => {
    if (deliveryInfo.length < 10) {
      toast.error('Please provide detailed delivery information');
      return;
    }
    setActionLoading(true);
    try {
      await ordersAPI.deliver(id, deliveryInfo);
      toast.success('Order delivered!');
      setShowDeliver(false);
      fetchOrder();
    } catch (error) {
      toast.error(error.message || 'Failed to deliver');
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleComplete = async () => {
    setActionLoading(true);
    try {
      await ordersAPI.complete(id);
      toast.success('Order completed! Seller will receive payment.');
      fetchOrder();
    } catch (error) {
      toast.error(error.message || 'Failed to complete');
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleDispute = async () => {
    if (disputeReason.length < 10) {
      toast.error('Please provide a detailed dispute reason');
      return;
    }
    setActionLoading(true);
    try {
      await ordersAPI.dispute(id, disputeReason);
      toast.success('Dispute opened. Admin will review.');
      setShowDispute(false);
      fetchOrder();
    } catch (error) {
      toast.error(error.message || 'Failed to open dispute');
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleOpenChat = async () => {
    try {
      const conversation = await chatsAPI.getOrderChat(id);
      navigate(`/chat/${conversation.id}`);
    } catch (error) {
      toast.error('Failed to open chat');
    }
  };
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  if (!order) return null;
  
  const statusSteps = [
    { status: 'created', label: 'Created', icon: Clock },
    { status: 'paid', label: 'Paid', icon: Package },
    { status: 'delivered', label: 'Delivered', icon: Truck },
    { status: 'completed', label: 'Completed', icon: CheckCircle },
  ];
  
  const currentStepIndex = statusSteps.findIndex(s => s.status === order.status);
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate('/orders')} className="mb-4">
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Orders
      </Button>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">{order.order_number}</h1>
          <p className="text-muted-foreground">
            {isBuyer ? 'Purchase' : 'Sale'} • {formatDateTime(order.created_at)}
          </p>
        </div>
        <Badge className={`text-lg px-4 py-1 ${getStatusColor(order.status)}`}>
          {order.status}
        </Badge>
      </div>
      
      {/* Status Progress */}
      {!['disputed', 'refunded', 'cancelled'].includes(order.status) && (
        <div className="mb-8">
          <div className="flex justify-between">
            {statusSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index <= currentStepIndex;
              return (
                <div key={step.status} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs mt-2 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="relative mt-2">
            <div className="absolute top-0 left-0 right-0 h-1 bg-muted rounded" />
            <div
              className="absolute top-0 left-0 h-1 bg-primary rounded transition-all"
              style={{ width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Listing Info */}
          <Card>
            <CardHeader>
              <CardTitle>Listing Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold mb-2">{order.listing?.title || 'Listing'}</p>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(order.amount_usd, currency, usdToBdtRate)}
              </div>
              {isSeller && (
                <p className="text-sm text-muted-foreground mt-2">
                  Your earnings: {formatCurrency(order.seller_earnings_usd, currency, usdToBdtRate)}
                  <span className="text-xs ml-2">(Fee: {order.effective_fee_percent?.toFixed(1)}%)</span>
                </p>
              )}
            </CardContent>
          </Card>
          
          {/* Delivery Info (shown after delivery) */}
          {order.delivery_info && (
            <Card>
              <CardHeader>
                <CardTitle>Delivery Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative bg-muted/50 p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm font-mono">{order.delivery_info}</pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(order.delivery_info)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Delivered at: {formatDateTime(order.delivered_at)}
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Dispute Info */}
          {order.status === 'disputed' && (
            <Card className="border-orange-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-500">
                  <AlertTriangle className="w-5 h-5" />
                  Dispute Open
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-2"><strong>Reason:</strong></p>
                <p className="text-muted-foreground">{order.dispute_reason}</p>
                <p className="text-xs text-muted-foreground mt-4">
                  Opened at: {formatDateTime(order.disputed_at)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Sidebar - Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Seller: Deliver */}
              {isSeller && order.status === 'paid' && (
                <Dialog open={showDeliver} onOpenChange={setShowDeliver}>
                  <DialogTrigger asChild>
                    <Button className="w-full" data-testid="deliver-btn">
                      <Truck className="w-4 h-4 mr-2" />
                      Deliver Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Deliver Order</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-muted-foreground">
                        Provide the account credentials and any relevant information.
                      </p>
                      <Textarea
                        placeholder="Account email, password, 2FA recovery codes, etc..."
                        value={deliveryInfo}
                        onChange={(e) => setDeliveryInfo(e.target.value)}
                        rows={6}
                        className="bg-muted/50"
                        data-testid="delivery-info-input"
                      />
                      <Button onClick={handleDeliver} disabled={actionLoading} className="w-full" data-testid="confirm-deliver-btn">
                        {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Confirm Delivery
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              
              {/* Buyer: Complete or Dispute */}
              {isBuyer && order.status === 'delivered' && (
                <>
                  <Button onClick={handleComplete} disabled={actionLoading} className="w-full neon-glow" data-testid="complete-btn">
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm & Complete
                  </Button>
                  
                  <Dialog open={showDispute} onOpenChange={setShowDispute}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="w-full" data-testid="dispute-btn">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Open Dispute
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Open Dispute</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                          Please explain the issue with this order. Admin will review your case.
                        </p>
                        <Textarea
                          placeholder="Describe the issue..."
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          rows={4}
                          className="bg-muted/50"
                          data-testid="dispute-reason-input"
                        />
                        <Button onClick={handleDispute} disabled={actionLoading} variant="destructive" className="w-full" data-testid="confirm-dispute-btn">
                          {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                          Submit Dispute
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
              
              {/* Chat */}
              <Button variant="outline" onClick={handleOpenChat} className="w-full" data-testid="open-chat-btn">
                <MessageCircle className="w-4 h-4 mr-2" />
                Open Chat
              </Button>
            </CardContent>
          </Card>
          
          {/* Parties */}
          <Card>
            <CardHeader>
              <CardTitle>Parties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Buyer</p>
                <p className="font-medium">{order.buyer?.username}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Seller</p>
                <p className="font-medium">{order.seller?.username}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
