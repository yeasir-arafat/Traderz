import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wallet, Search, Loader2, Plus, Minus, Lock, Unlock,
  DollarSign, AlertTriangle, CheckCircle
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Alert,
  AlertDescription,
} from '../../components/ui/alert';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore, useCurrencyStore } from '../../store';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

export default function FinanceConsolePage() {
  const navigate = useNavigate();
  const { user: admin, isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  
  // Action dialogs
  const [actionDialog, setActionDialog] = useState(null); // 'credit', 'debit', 'freeze', 'unfreeze'
  const [actionData, setActionData] = useState({});
  const [processing, setProcessing] = useState(false);
  
  const isSuperAdmin = admin?.roles?.includes('super_admin');
  
  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
  }, [isAuthenticated, isSuperAdmin]);
  
  const searchUsers = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const data = await superAdminAPI.getUsers({ q: searchQuery, page_size: 10 });
      setSearchResults(data.users || []);
    } catch (error) {
      toast.error(error.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };
  
  const selectUser = async (user) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearchQuery('');
    fetchLedger(user.id);
  };
  
  const fetchLedger = async (userId, page = 1) => {
    setLedgerLoading(true);
    try {
      const data = await superAdminAPI.getUserLedger(userId, { page, page_size: 20 });
      setLedger(data.entries || []);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch ledger');
    } finally {
      setLedgerLoading(false);
    }
  };
  
  const refreshUserDetail = async () => {
    if (!selectedUser) return;
    try {
      const detail = await superAdminAPI.getUserDetail(selectedUser.id);
      setSelectedUser(detail);
      fetchLedger(selectedUser.id);
    } catch (error) {
      console.error('Failed to refresh user detail');
    }
  };
  
  const handleWalletAction = async () => {
    if (!actionData.amount || !actionData.reason) {
      toast.error('Amount and reason are required');
      return;
    }
    
    // Validate confirmation for dangerous actions
    if (['debit', 'freeze'].includes(actionDialog)) {
      if (!actionData.admin_password) {
        toast.error('Password confirmation required');
        return;
      }
      
      if (parseFloat(actionData.amount) >= 1000 && !actionData.confirm_phrase) {
        toast.error(`Large amount requires typing 'CONFIRM ${actionDialog.toUpperCase()}'`);
        return;
      }
    }
    
    setProcessing(true);
    try {
      const payload = {
        user_id: selectedUser.id,
        amount_usd: parseFloat(actionData.amount),
        reason: actionData.reason,
        admin_password: actionData.admin_password,
        confirm_phrase: actionData.confirm_phrase
      };
      
      let result;
      const idempotencyKey = `${actionDialog}-${selectedUser.id}-${Date.now()}`;
      
      switch (actionDialog) {
        case 'credit':
          result = await superAdminAPI.creditWallet(payload, idempotencyKey);
          break;
        case 'debit':
          result = await superAdminAPI.debitWallet(payload, idempotencyKey);
          break;
        case 'freeze':
          result = await superAdminAPI.freezeFunds(payload, idempotencyKey);
          break;
        case 'unfreeze':
          result = await superAdminAPI.unfreezeFunds(payload, idempotencyKey);
          break;
      }
      
      toast.success(`${actionDialog} successful`);
      setActionDialog(null);
      setActionData({});
      refreshUserDetail();
    } catch (error) {
      toast.error(error.message || `${actionDialog} failed`);
    } finally {
      setProcessing(false);
    }
  };
  
  const entryTypeColors = {
    deposit: 'text-green-500',
    admin_credit: 'text-green-500',
    refund: 'text-green-500',
    escrow_release_available: 'text-green-500',
    admin_freeze_release: 'text-green-500',
    giftcard_redeem: 'text-green-500',
    escrow_hold: 'text-red-500',
    admin_debit: 'text-red-500',
    withdrawal_paid: 'text-red-500',
    platform_fee: 'text-red-500',
    admin_freeze_hold: 'text-yellow-500',
    escrow_release_pending: 'text-blue-500',
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button variant="ghost" onClick={() => navigate('/superadmin')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
      
      <div className="flex items-center gap-3 mb-6">
        <Wallet className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-heading font-bold">Finance Console</h1>
          <p className="text-sm text-muted-foreground">Wallet operations and ledger view</p>
        </div>
      </div>
      
      {/* User Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Find User</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={searchUsers} className="flex gap-2">
            <Input
              placeholder="Search by username, email, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </form>
          
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                  onClick={() => selectUser(user)}
                >
                  <div>
                    <p className="font-medium">{user.username}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Button variant="outline" size="sm">Select</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Selected User Panel */}
      {selectedUser && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {selectedUser.username}'s Wallet
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Balance Display */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(selectedUser.wallet_available || 0, currency, usdToBdtRate)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {formatCurrency(selectedUser.wallet_pending || 0, currency, usdToBdtRate)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-muted-foreground">Frozen</p>
                  <p className="text-2xl font-bold text-red-500">
                    {formatCurrency(selectedUser.wallet_frozen || 0, currency, usdToBdtRate)}
                  </p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setActionData({ amount: '', reason: '' });
                    setActionDialog('credit');
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Credit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setActionData({ amount: '', reason: '', admin_password: '', confirm_phrase: '' });
                    setActionDialog('debit');
                  }}
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Debit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActionData({ amount: '', reason: '', admin_password: '', confirm_phrase: '' });
                    setActionDialog('freeze');
                  }}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Freeze
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActionData({ amount: '', reason: '' });
                    setActionDialog('unfreeze');
                  }}
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Unfreeze
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Ledger History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ledger History</CardTitle>
            </CardHeader>
            <CardContent>
              {ledgerLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : ledger.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions found</p>
              ) : (
                <div className="space-y-2">
                  {ledger.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {entry.entry_type?.replace(/_/g, ' ')}
                          </Badge>
                          <span className={`font-bold ${entryTypeColors[entry.entry_type] || ''}`}>
                            {entry.amount_usd >= 0 ? '+' : ''}{formatCurrency(entry.amount_usd, currency, usdToBdtRate)}
                          </span>
                        </div>
                        {entry.reason && (
                          <p className="text-xs text-muted-foreground mt-1">{entry.reason}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>Avail: {formatCurrency(entry.balance_available_after, currency, usdToBdtRate)}</p>
                        <p>{new Date(entry.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      
      {/* Action Dialogs */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionDialog} Wallet</DialogTitle>
            <DialogDescription>
              {actionDialog === 'credit' && 'Add funds to user wallet'}
              {actionDialog === 'debit' && 'Remove funds from user wallet (requires confirmation)'}
              {actionDialog === 'freeze' && 'Freeze user funds (requires confirmation)'}
              {actionDialog === 'unfreeze' && 'Unfreeze user funds'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Amount (USD) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={actionData.amount || ''}
                onChange={(e) => setActionData({ ...actionData, amount: e.target.value })}
                className="mt-2"
              />
            </div>
            
            <div>
              <Label>Reason *</Label>
              <Textarea
                value={actionData.reason || ''}
                onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
                placeholder="Explain the reason for this action..."
                className="mt-2"
              />
            </div>
            
            {['debit', 'freeze'].includes(actionDialog) && (
              <>
                <div>
                  <Label>Your Password (confirmation) *</Label>
                  <Input
                    type="password"
                    value={actionData.admin_password || ''}
                    onChange={(e) => setActionData({ ...actionData, admin_password: e.target.value })}
                    className="mt-2"
                  />
                </div>
                
                {parseFloat(actionData.amount) >= 1000 && (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Amount ≥ $1,000 requires typing "CONFIRM {actionDialog?.toUpperCase()}"
                    </AlertDescription>
                  </Alert>
                )}
                
                {parseFloat(actionData.amount) >= 1000 && (
                  <div>
                    <Label>Confirmation Phrase *</Label>
                    <Input
                      value={actionData.confirm_phrase || ''}
                      onChange={(e) => setActionData({ ...actionData, confirm_phrase: e.target.value })}
                      placeholder={`Type: CONFIRM ${actionDialog?.toUpperCase()}`}
                      className="mt-2"
                    />
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              onClick={handleWalletAction}
              disabled={processing}
              className={actionDialog === 'credit' ? 'bg-green-600 hover:bg-green-700' : 
                        ['debit', 'freeze'].includes(actionDialog) ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirm {actionDialog}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
