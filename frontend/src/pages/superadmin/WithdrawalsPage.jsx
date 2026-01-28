import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Loader2, Check, X, RefreshCw, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

export default function WithdrawalsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  
  // Processing state
  const [processingId, setProcessingId] = useState(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [processAction, setProcessAction] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const isSuperAdmin = user?.roles?.includes('super_admin');

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
    loadWithdrawals();
  }, [isAuthenticated, isSuperAdmin, page, statusFilter]);

  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 20 };
      if (statusFilter) params.status = statusFilter;
      
      const data = await superAdminAPI.getWithdrawals(params);
      setWithdrawals(data.requests || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error(error.message || 'Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const openProcessModal = (withdrawal, action) => {
    setSelectedWithdrawal(withdrawal);
    setProcessAction(action);
    setAdminPassword('');
    setRejectionReason('');
    setAdminNotes('');
    setShowProcessModal(true);
  };

  const handleProcess = async () => {
    if (!adminPassword) {
      toast.error('Password required');
      return;
    }
    if (processAction === 'reject' && !rejectionReason) {
      toast.error('Rejection reason required');
      return;
    }

    setProcessingId(selectedWithdrawal.id);
    try {
      await superAdminAPI.processWithdrawal(selectedWithdrawal.id, {
        action: processAction,
        admin_password: adminPassword,
        rejection_reason: rejectionReason || null,
        admin_notes: adminNotes || null,
      });
      toast.success(`Withdrawal ${processAction === 'approve' ? 'approved' : 'rejected'}`);
      setShowProcessModal(false);
      loadWithdrawals();
    } catch (error) {
      toast.error(error.message || 'Failed to process withdrawal');
    } finally {
      setProcessingId(null);
    }
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
    <div className="container mx-auto px-4 py-8 max-w-6xl" data-testid="withdrawals-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Withdrawals Management</h1>
            <p className="text-sm text-muted-foreground">
              Review, approve, and reject user withdrawal requests
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadWithdrawals} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-4 mb-6">
        <Select value={statusFilter || 'all'} onValueChange={(val) => { setStatusFilter(val === 'all' ? '' : val); setPage(1); }}>
          <SelectTrigger className="w-[180px]" data-testid="status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-2">{statusFilter === 'pending' ? total : '-'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawals List */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Requests ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : withdrawals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No withdrawal requests found</p>
          ) : (
            <div className="space-y-4">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-muted/30 border border-border gap-4"
                  data-testid={`withdrawal-${w.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={STATUS_COLORS[w.status]}>{w.status}</Badge>
                      <span className="font-bold text-lg">{formatCurrency(w.amount_usd)}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">User</p>
                        <p>{w.username}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="truncate">{w.email}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Method</p>
                        <p className="capitalize">{w.payment_method}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Requested</p>
                        <p className="text-xs">{formatDate(w.created_at)}</p>
                      </div>
                    </div>
                    {w.payment_details && (
                      <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        <strong>Payment Details:</strong> {w.payment_details}
                      </div>
                    )}
                    {w.rejection_reason && (
                      <div className="mt-2 text-xs text-red-400 bg-red-500/10 p-2 rounded">
                        <strong>Rejection:</strong> {w.rejection_reason}
                      </div>
                    )}
                  </div>

                  {w.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => openProcessModal(w, 'approve')}
                        disabled={processingId === w.id}
                        data-testid={`approve-${w.id}`}
                      >
                        {processingId === w.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-1" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openProcessModal(w, 'reject')}
                        disabled={processingId === w.id}
                        data-testid={`reject-${w.id}`}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Modal */}
      {showProcessModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowProcessModal(false)}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>
                {processAction === 'approve' ? 'Approve' : 'Reject'} Withdrawal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p><strong>Amount:</strong> {formatCurrency(selectedWithdrawal.amount_usd)}</p>
                <p><strong>User:</strong> {selectedWithdrawal.username}</p>
                <p><strong>Method:</strong> {selectedWithdrawal.payment_method}</p>
              </div>

              {processAction === 'approve' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg text-sm">
                  <p className="text-yellow-400 font-medium">Warning</p>
                  <p className="text-muted-foreground">
                    Approving will debit {formatCurrency(selectedWithdrawal.amount_usd)} from the user's wallet.
                    Make sure you've processed the actual payment externally.
                  </p>
                </div>
              )}

              {processAction === 'reject' && (
                <div>
                  <Label>Rejection Reason *</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this withdrawal is being rejected"
                    data-testid="rejection-reason"
                  />
                </div>
              )}

              <div>
                <Label>Admin Notes (optional)</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes..."
                />
              </div>

              <div>
                <Label>Your Password (confirmation) *</Label>
                <Input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter your password"
                  data-testid="admin-password"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowProcessModal(false)}>Cancel</Button>
                <Button
                  variant={processAction === 'reject' ? 'destructive' : 'default'}
                  onClick={handleProcess}
                  disabled={processingId}
                >
                  {processingId && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {processAction === 'approve' ? 'Approve Withdrawal' : 'Reject Withdrawal'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
