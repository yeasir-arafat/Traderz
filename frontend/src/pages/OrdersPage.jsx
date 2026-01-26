import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Store, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ordersAPI } from '../lib/api';
import { useAuthStore, useCurrencyStore } from '../store';
import { formatCurrency, formatDate, getStatusColor } from '../lib/utils';

export default function OrdersPage() {
  const { user } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const isSeller = user?.roles?.includes('seller');
  
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const [purchasesRes, salesRes] = await Promise.all([
          ordersAPI.getMyPurchases({ page_size: 50 }),
          isSeller ? ordersAPI.getMySales({ page_size: 50 }) : Promise.resolve({ orders: [] }),
        ]);
        setPurchases(purchasesRes?.orders || []);
        setSales(salesRes?.orders || []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [isSeller]);
  
  const OrderCard = ({ order, type }) => (
    <Link to={`/order/${order.id}`} key={order.id} data-testid={`order-${order.order_number}`}>
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-mono text-sm text-muted-foreground">{order.order_number}</p>
              <p className="font-semibold">{order.listing?.title || 'Listing'}</p>
            </div>
            <Badge className={getStatusColor(order.status)}>
              {order.status}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatDate(order.created_at)}
            </span>
            <span className="font-semibold text-primary">
              {formatCurrency(order.amount_usd, currency, usdToBdtRate)}
            </span>
          </div>
          
          {type === 'sale' && (
            <p className="text-xs text-muted-foreground mt-2">
              Earnings: {formatCurrency(order.seller_earnings_usd, currency, usdToBdtRate)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-heading font-bold mb-8">My Orders</h1>
      
      <Tabs defaultValue="purchases">
        <TabsList className="mb-6">
          <TabsTrigger value="purchases" className="flex items-center gap-2" data-testid="purchases-tab">
            <ShoppingBag className="w-4 h-4" />
            Purchases ({purchases.length})
          </TabsTrigger>
          {isSeller && (
            <TabsTrigger value="sales" className="flex items-center gap-2" data-testid="sales-tab">
              <Store className="w-4 h-4" />
              Sales ({sales.length})
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="purchases">
          {purchases.length > 0 ? (
            <div className="space-y-4">
              {purchases.map((order) => (
                <OrderCard key={order.id} order={order} type="purchase" />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No purchases yet</h3>
              <p className="text-muted-foreground mb-4">
                Start browsing game accounts to make your first purchase!
              </p>
              <Button onClick={() => window.location.href = '/browse'}>
                Browse Listings
              </Button>
            </div>
          )}
        </TabsContent>
        
        {isSeller && (
          <TabsContent value="sales">
            {sales.length > 0 ? (
              <div className="space-y-4">
                {sales.map((order) => (
                  <OrderCard key={order.id} order={order} type="sale" />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Store className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No sales yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create a listing and start selling!
                </p>
                <Button onClick={() => window.location.href = '/sell/new'}>
                  Create Listing
                </Button>
              </div>
            )}s
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
