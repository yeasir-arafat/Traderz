import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ScrollText, Search, Loader2, Filter, Eye
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

const actionTypeLabels = {
  approve_listing: { label: 'Approve Listing', color: 'bg-green-500/10 text-green-500' },
  reject_listing: { label: 'Reject Listing', color: 'bg-red-500/10 text-red-500' },
  hide_listing: { label: 'Hide Listing', color: 'bg-yellow-500/10 text-yellow-500' },
  approve_kyc: { label: 'Approve KYC', color: 'bg-green-500/10 text-green-500' },
  reject_kyc: { label: 'Reject KYC', color: 'bg-red-500/10 text-red-500' },
  unlock_profile: { label: 'Unlock Profile', color: 'bg-blue-500/10 text-blue-500' },
  resolve_dispute: { label: 'Resolve Dispute', color: 'bg-purple-500/10 text-purple-500' },
  force_complete: { label: 'Force Complete', color: 'bg-green-500/10 text-green-500' },
  force_refund: { label: 'Force Refund', color: 'bg-red-500/10 text-red-500' },
  ban_user: { label: 'Ban User', color: 'bg-red-500/10 text-red-500' },
  unban_user: { label: 'Unban User', color: 'bg-green-500/10 text-green-500' },
  promote_role: { label: 'Promote Role', color: 'bg-blue-500/10 text-blue-500' },
  demote_role: { label: 'Demote Role', color: 'bg-yellow-500/10 text-yellow-500' },
  create_admin: { label: 'Create Admin', color: 'bg-blue-500/10 text-blue-500' },
  disable_admin: { label: 'Disable Admin', color: 'bg-red-500/10 text-red-500' },
  wallet_credit: { label: 'Wallet Credit', color: 'bg-green-500/10 text-green-500' },
  wallet_debit: { label: 'Wallet Debit', color: 'bg-red-500/10 text-red-500' },
  wallet_freeze: { label: 'Freeze Funds', color: 'bg-yellow-500/10 text-yellow-500' },
  wallet_unfreeze: { label: 'Unfreeze Funds', color: 'bg-green-500/10 text-green-500' },
  update_config: { label: 'Update Config', color: 'bg-blue-500/10 text-blue-500' },
  update_legal: { label: 'Update Legal', color: 'bg-purple-500/10 text-purple-500' },
};

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const { user: admin, isAuthenticated } = useAuthStore();
  
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });
  const [filters, setFilters] = useState({ action_type: 'all', target_type: 'all' });
  const [selectedAction, setSelectedAction] = useState(null);
  
  const isSuperAdmin = admin?.roles?.includes('super_admin');
  
  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
    fetchActions();
  }, [isAuthenticated, isSuperAdmin]);
  
  const fetchActions = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, page_size: 30 };
      if (filters.action_type !== 'all') params.action_type = filters.action_type;
      if (filters.target_type !== 'all') params.target_type = filters.target_type;
      
      const data = await superAdminAPI.getAdminActions(params);
      setActions(data.actions || []);
      setPagination({ page: data.page, total: data.total });
    } catch (error) {
      toast.error(error.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilters = () => {
    fetchActions(1);
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button variant="ghost" onClick={() => navigate('/superadmin')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
      
      <div className="flex items-center gap-3 mb-6">
        <ScrollText className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-heading font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Immutable record of all admin actions</p>
        </div>
        <Badge variant="secondary" className="ml-auto">{pagination.total} records</Badge>
      </div>
      
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Action Type</label>
              <Select value={filters.action_type} onValueChange={(v) => setFilters({ ...filters, action_type: v })}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="approve_listing">Approve Listing</SelectItem>
                  <SelectItem value="reject_listing">Reject Listing</SelectItem>
                  <SelectItem value="approve_kyc">Approve KYC</SelectItem>
                  <SelectItem value="reject_kyc">Reject KYC</SelectItem>
                  <SelectItem value="resolve_dispute">Resolve Dispute</SelectItem>
                  <SelectItem value="force_complete">Force Complete</SelectItem>
                  <SelectItem value="force_refund">Force Refund</SelectItem>
                  <SelectItem value="ban_user">Ban User</SelectItem>
                  <SelectItem value="wallet_credit">Wallet Credit</SelectItem>
                  <SelectItem value="wallet_debit">Wallet Debit</SelectItem>
                  <SelectItem value="wallet_freeze">Freeze Funds</SelectItem>
                  <SelectItem value="update_config">Update Config</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Target Type</label>
              <Select value={filters.target_type} onValueChange={(v) => setFilters({ ...filters, target_type: v })}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Targets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Targets</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="listing">Listing</SelectItem>
                  <SelectItem value="order">Order</SelectItem>
                  <SelectItem value="kyc">KYC</SelectItem>
                  <SelectItem value="config">Config</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={applyFilters}>
              <Filter className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Actions List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : actions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ScrollText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No audit logs found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => {
            const typeConfig = actionTypeLabels[action.action_type] || { label: action.action_type, color: 'bg-gray-500/10 text-gray-500' };
            
            return (
              <Card key={action.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Badge className={typeConfig.color}>
                      {typeConfig.label}
                    </Badge>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="text-muted-foreground">by</span>{' '}
                        <span className="font-medium">{action.actor_role}</span>
                        {action.target_type && (
                          <>
                            {' '}<span className="text-muted-foreground">on</span>{' '}
                            <span className="font-medium">{action.target_type}</span>
                          </>
                        )}
                      </p>
                      {action.reason && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {action.reason}
                        </p>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(action.created_at).toLocaleString()}
                      </p>
                      {action.ip_address && (
                        <p className="text-xs text-muted-foreground">
                          IP: {action.ip_address}
                        </p>
                      )}
                    </div>
                    
                    <Button variant="ghost" size="sm" onClick={() => setSelectedAction(action)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {/* Pagination */}
          {pagination.total > 30 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => fetchActions(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm">
                Page {pagination.page} of {Math.ceil(pagination.total / 30)}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= Math.ceil(pagination.total / 30)}
                onClick={() => fetchActions(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Action Detail Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Action Details</DialogTitle>
          </DialogHeader>
          
          {selectedAction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Action Type</p>
                  <p className="font-medium">{selectedAction.action_type?.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actor Role</p>
                  <p className="font-medium">{selectedAction.actor_role}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target Type</p>
                  <p className="font-medium">{selectedAction.target_type || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target ID</p>
                  <p className="font-medium font-mono text-xs">{selectedAction.target_id || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IP Address</p>
                  <p className="font-medium">{selectedAction.ip_address || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Timestamp</p>
                  <p className="font-medium">{new Date(selectedAction.created_at).toLocaleString()}</p>
                </div>
              </div>
              
              {selectedAction.reason && (
                <div>
                  <p className="text-muted-foreground text-sm">Reason</p>
                  <p className="p-3 bg-muted rounded-lg mt-1">{selectedAction.reason}</p>
                </div>
              )}
              
              {selectedAction.details && (
                <div>
                  <p className="text-muted-foreground text-sm">Details</p>
                  <pre className="p-3 bg-muted rounded-lg mt-1 text-xs overflow-auto">
                    {JSON.stringify(selectedAction.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
