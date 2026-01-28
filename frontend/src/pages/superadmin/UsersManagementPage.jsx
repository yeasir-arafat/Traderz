import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Search, Filter, Loader2, UserCog, Shield,
  Ban, CheckCircle, Eye, Lock, Unlock, LogOut, ChevronRight
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore, useCurrencyStore } from '../../store';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

const statusColors = {
  active: 'bg-green-500/10 text-green-500 border-green-500/20',
  suspended: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  banned: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const kycColors = {
  not_submitted: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  approved: 'bg-green-500/10 text-green-500 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export default function UsersManagementPage() {
  const navigate = useNavigate();
  const { user: admin, isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });
  
  // Filters
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all',
    kyc_status: 'all',
    q: ''
  });
  
  // Dialogs
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionDialog, setActionDialog] = useState(null); // 'status', 'roles', 'logout', 'unlock'
  const [actionData, setActionData] = useState({});
  const [processing, setProcessing] = useState(false);
  
  const isSuperAdmin = admin?.roles?.includes('super_admin');
  
  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [isAuthenticated, isSuperAdmin]);
  
  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, page_size: 20 };
      if (filters.role !== 'all') params.role = filters.role;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.kyc_status !== 'all') params.kyc_status = filters.kyc_status;
      if (filters.q) params.q = filters.q;
      
      const data = await superAdminAPI.getUsers(params);
      setUsers(data.users || []);
      setPagination({ page: data.page, total: data.total });
    } catch (error) {
      toast.error(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };
  
  const openUserDetail = async (userId) => {
    try {
      const detail = await superAdminAPI.getUserDetail(userId);
      setSelectedUser(detail);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch user details');
    }
  };
  
  const handleStatusChange = async () => {
    if (!actionData.status || !actionData.reason) {
      toast.error('Status and reason are required');
      return;
    }
    
    setProcessing(true);
    try {
      await superAdminAPI.updateUserStatus(selectedUser.id, {
        status: actionData.status,
        reason: actionData.reason,
        admin_password: actionData.admin_password
      });
      toast.success(`User ${actionData.status === 'active' ? 'unbanned' : actionData.status}`);
      setActionDialog(null);
      setSelectedUser(null);
      fetchUsers(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleRolesChange = async () => {
    if (!actionData.roles?.length || !actionData.reason || !actionData.admin_password) {
      toast.error('Roles, reason, and password are required');
      return;
    }
    
    setProcessing(true);
    try {
      await superAdminAPI.updateUserRoles(selectedUser.id, {
        roles: actionData.roles,
        reason: actionData.reason,
        admin_password: actionData.admin_password
      });
      toast.success('User roles updated');
      setActionDialog(null);
      setSelectedUser(null);
      fetchUsers(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to update roles');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleForceLogout = async () => {
    if (!actionData.reason) {
      toast.error('Reason is required');
      return;
    }
    
    setProcessing(true);
    try {
      await superAdminAPI.forceLogout(selectedUser.id, actionData.reason);
      toast.success('User sessions revoked');
      setActionDialog(null);
    } catch (error) {
      toast.error(error.message || 'Failed to force logout');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleUnlockProfile = async () => {
    if (!actionData.reason || !actionData.admin_password) {
      toast.error('Reason and password are required');
      return;
    }
    
    setProcessing(true);
    try {
      await superAdminAPI.unlockProfile(selectedUser.id, {
        reason: actionData.reason,
        admin_password: actionData.admin_password
      });
      toast.success('Profile unlocked for editing');
      setActionDialog(null);
      setSelectedUser(null);
      fetchUsers(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to unlock profile');
    } finally {
      setProcessing(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Button variant="ghost" onClick={() => navigate('/superadmin')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
      
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-heading font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage all platform users</p>
        </div>
        <Badge variant="secondary" className="ml-auto">{pagination.total} users</Badge>
      </div>
      
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by username, email, or name..."
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="w-full"
              />
            </div>
            <Select value={filters.role} onValueChange={(v) => setFilters({ ...filters, role: v })}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.kyc_status} onValueChange={(v) => setFilters({ ...filters, kyc_status: v })}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="KYC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All KYC</SelectItem>
                <SelectItem value="not_submitted">Not Submitted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">
                      {user.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{user.username}</p>
                      {user.roles?.includes('super_admin') && (
                        <Shield className="w-4 h-4 text-primary" />
                      )}
                      {user.roles?.includes('admin') && !user.roles?.includes('super_admin') && (
                        <UserCog className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge className={statusColors[user.status] || statusColors.active}>
                        {user.status || 'active'}
                      </Badge>
                      <Badge className={kycColors[user.kyc_status] || kycColors.not_submitted}>
                        KYC: {user.kyc_status?.replace('_', ' ')}
                      </Badge>
                      {user.roles?.map((role) => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => openUserDetail(user.id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Pagination */}
          {pagination.total > 20 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => fetchUsers(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm">
                Page {pagination.page} of {Math.ceil(pagination.total / 20)}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= Math.ceil(pagination.total / 20)}
                onClick={() => fetchUsers(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser && !actionDialog} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>{selectedUser?.username}</DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Full Name</p>
                  <p className="font-medium">{selectedUser.full_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedUser.status] || statusColors.active}>
                    {selectedUser.status || 'active'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">KYC Status</p>
                  <Badge className={kycColors[selectedUser.kyc_status] || kycColors.not_submitted}>
                    {selectedUser.kyc_status?.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Wallet Available</p>
                  <p className="font-medium text-green-500">
                    {formatCurrency(selectedUser.wallet_available || 0, currency, usdToBdtRate)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Wallet Frozen</p>
                  <p className="font-medium text-red-500">
                    {formatCurrency(selectedUser.wallet_frozen || 0, currency, usdToBdtRate)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Orders</p>
                  <p className="font-medium">{selectedUser.total_orders || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Listings</p>
                  <p className="font-medium">{selectedUser.total_listings || 0}</p>
                </div>
              </div>
              
              <div>
                <p className="text-muted-foreground text-sm mb-2">Roles</p>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.roles?.map((role) => (
                    <Badge key={role} variant="outline">{role}</Badge>
                  ))}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {selectedUser.status !== 'banned' && !selectedUser.roles?.includes('super_admin') && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setActionData({ status: 'banned', reason: '', admin_password: '' });
                      setActionDialog('status');
                    }}
                  >
                    <Ban className="w-4 h-4 mr-1" />
                    Ban User
                  </Button>
                )}
                {selectedUser.status === 'banned' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActionData({ status: 'active', reason: '', admin_password: '' });
                      setActionDialog('status');
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Unban
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionData({ roles: [...(selectedUser.roles || [])], reason: '', admin_password: '' });
                    setActionDialog('roles');
                  }}
                >
                  <UserCog className="w-4 h-4 mr-1" />
                  Edit Roles
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionData({ reason: '' });
                    setActionDialog('logout');
                  }}
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Force Logout
                </Button>
                {selectedUser.kyc_status === 'approved' && !selectedUser.profile_unlocked && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActionData({ reason: '', admin_password: '' });
                      setActionDialog('unlock');
                    }}
                  >
                    <Unlock className="w-4 h-4 mr-1" />
                    Unlock Profile
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Status Change Dialog */}
      <Dialog open={actionDialog === 'status'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionData.status === 'banned' ? 'Ban User' : 'Update Status'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Reason *</Label>
              <Textarea
                value={actionData.reason || ''}
                onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
                placeholder="Explain the reason for this action..."
                className="mt-2"
              />
            </div>
            {actionData.status === 'banned' && (
              <div>
                <Label>Your Password (confirmation) *</Label>
                <Input
                  type="password"
                  value={actionData.admin_password || ''}
                  onChange={(e) => setActionData({ ...actionData, admin_password: e.target.value })}
                  className="mt-2"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              variant={actionData.status === 'banned' ? 'destructive' : 'default'}
              onClick={handleStatusChange}
              disabled={processing}
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Roles Dialog */}
      <Dialog open={actionDialog === 'roles'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Roles</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['buyer', 'seller', 'admin'].map((role) => (
                  <Badge
                    key={role}
                    variant={actionData.roles?.includes(role) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const roles = actionData.roles || [];
                      if (roles.includes(role)) {
                        setActionData({ ...actionData, roles: roles.filter(r => r !== role) });
                      } else {
                        setActionData({ ...actionData, roles: [...roles, role] });
                      }
                    }}
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Reason *</Label>
              <Textarea
                value={actionData.reason || ''}
                onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Your Password *</Label>
              <Input
                type="password"
                value={actionData.admin_password || ''}
                onChange={(e) => setActionData({ ...actionData, admin_password: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleRolesChange} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Update Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Force Logout Dialog */}
      <Dialog open={actionDialog === 'logout'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Logout User</DialogTitle>
            <DialogDescription>This will revoke all active sessions</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Reason *</Label>
            <Textarea
              value={actionData.reason || ''}
              onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleForceLogout} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Force Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Unlock Profile Dialog */}
      <Dialog open={actionDialog === 'unlock'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock Profile</DialogTitle>
            <DialogDescription>Allow user to edit profile despite KYC approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Reason *</Label>
              <Textarea
                value={actionData.reason || ''}
                onChange={(e) => setActionData({ ...actionData, reason: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Your Password *</Label>
              <Input
                type="password"
                value={actionData.admin_password || ''}
                onChange={(e) => setActionData({ ...actionData, admin_password: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleUnlockProfile} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Unlock Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
