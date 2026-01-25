import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet as WalletIcon, Plus, Minus, Gift, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { walletAPI } from '../lib/api';
import { useAuthStore, useCurrencyStore } from '../store';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { toast } from 'sonner';

export default function WalletPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [balance, setBalance] = useState({ available_usd: 0, pending_usd: 0, frozen_usd: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showGiftCard, setShowGiftCard] = useState(false);
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [isAuthenticated, navigate]);
  
  const fetchData = async () => {
    try {
      const [balanceData, historyData] = await Promise.all([
        walletAPI.getBalance(),
        walletAPI.getHistory({ page: 1, page_size: 50 }),
      ]);
      setBalance(balanceData);
      setTransactions(historyData?.transactions || []);
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    setProcessing(true);
    try {
      await walletAPI.deposit(parseFloat(depositAmount));
      toast.success('Deposit successful!');
      setShowDeposit(false);
      setDepositAmount('');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Deposit failed');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    if (parseFloat(withdrawAmount) > balance.available_usd) {
      toast.error('Insufficient balance');
      return;
    }
    setProcessing(true);
    try {
      await walletAPI.withdraw({
        amount_usd: parseFloat(withdrawAmount),
        withdrawal_method: 'bank_transfer',
      });
      toast.success('Withdrawal requested!');
      setShowWithdraw(false);
      setWithdrawAmount('');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Withdrawal failed');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleRedeemGiftCard = async () => {
    if (!giftCardCode.trim()) {
      toast.error('Enter gift card code');
      return;
    }
    setProcessing(true);
    try {
      await walletAPI.redeemGiftCard(giftCardCode.trim());
      toast.success('Gift card redeemed!');
      setShowGiftCard(false);
      setGiftCardCode('');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Invalid gift card');
    } finally {
      setProcessing(false);
    }
  };
  
  const getTransactionIcon = (type) => {
    const icons = {
      deposit: <ArrowDownLeft className="w-4 h-4 text-green-500" />,
      escrow_hold: <Minus className="w-4 h-4 text-yellow-500" />,
      escrow_release_pending: <Plus className="w-4 h-4 text-blue-500" />,
      escrow_release_available: <Plus className="w-4 h-4 text-green-500" />,
      refund: <ArrowDownLeft className="w-4 h-4 text-green-500" />,
      withdrawal_request: <ArrowUpRight className="w-4 h-4 text-red-500" />,
      admin_credit: <Plus className="w-4 h-4 text-green-500" />,
      admin_debit: <Minus className="w-4 h-4 text-red-500" />,
      giftcard_redeem: <Gift className="w-4 h-4 text-purple-500" />,
    };
    return icons[type] || <WalletIcon className="w-4 h-4" />;
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-heading font-bold mb-8">My Wallet</h1>
      
      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="border-primary/50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(balance.available_usd, currency, usdToBdtRate)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-500">
              {formatCurrency(balance.pending_usd, currency, usdToBdtRate)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Frozen</p>
            <p className="text-2xl font-bold text-red-500">
              {formatCurrency(balance.frozen_usd, currency, usdToBdtRate)}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
          <DialogTrigger asChild>
            <Button data-testid="deposit-btn">
              <Plus className="w-4 h-4 mr-2" />
              Deposit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deposit Funds</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm">Amount (USD)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="bg-muted/50"
                  data-testid="deposit-amount-input"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Note: This is a mock deposit for testing purposes.
              </p>
              <Button onClick={handleDeposit} disabled={processing} className="w-full" data-testid="confirm-deposit-btn">
                {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Deposit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="withdraw-btn">
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Withdraw
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw Funds</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Available: {formatCurrency(balance.available_usd, 'USD')}
              </p>
              <div className="space-y-2">
                <label className="text-sm">Amount (USD)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="bg-muted/50"
                  data-testid="withdraw-amount-input"
                />
              </div>
              <Button onClick={handleWithdraw} disabled={processing} className="w-full" data-testid="confirm-withdraw-btn">
                {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Request Withdrawal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <Dialog open={showGiftCard} onOpenChange={setShowGiftCard}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="redeem-gift-btn">
              <Gift className="w-4 h-4 mr-2" />
              Redeem Gift Card
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Redeem Gift Card</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm">Gift Card Code</label>
                <Input
                  placeholder="Enter code"
                  value={giftCardCode}
                  onChange={(e) => setGiftCardCode(e.target.value)}
                  className="bg-muted/50"
                  data-testid="gift-card-input"
                />
              </div>
              <Button onClick={handleRedeemGiftCard} disabled={processing} className="w-full" data-testid="confirm-redeem-btn">
                {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Redeem
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      {getTransactionIcon(tx.entry_type)}
                    </div>
                    <div>
                      <p className="font-medium text-sm capitalize">
                        {tx.entry_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.amount_usd >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.amount_usd >= 0 ? '+' : ''}{formatCurrency(tx.amount_usd, currency, usdToBdtRate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bal: {formatCurrency(tx.balance_available_after, currency, usdToBdtRate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
