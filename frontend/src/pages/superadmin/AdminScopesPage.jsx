import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, RefreshCw, User, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

const ALL_SCOPES = [
  { id: 'LISTINGS_REVIEW', label: 'Listings Review', description: 'Approve/reject listings' },
  { id: 'KYC_REVIEW', label: 'KYC Review', description: 'Review KYC submissions' },
  { id: 'DISPUTE_RESOLVE', label: 'Dispute Resolution', description: 'Resolve order disputes' },
  { id: 'FAQ_EDIT', label: 'FAQ Edit', description: 'Manage FAQ content' },
  { id: 'FINANCE_VIEW', label: 'Finance View', description: 'View financial data' },
  { id: 'FINANCE_ACTION', label: 'Finance Action', description: 'Perform financial operations' },
];

const PRESETS = [
  { id: 'moderator', label: 'Moderator', scopes: ['LISTINGS_REVIEW', 'DISPUTE_RESOLVE'] },
  { id: 'kyc_reviewer', label: 'KYC Reviewer', scopes: ['KYC_REVIEW'] },
  { id: 'content_admin', label: 'Content Admin', scopes: ['FAQ_EDIT'] },
  { id: 'ops_admin', label: 'Ops Admin', scopes: ['LISTINGS_REVIEW', 'KYC_REVIEW', 'DISPUTE_RESOLVE', 'FAQ_EDIT'] },
];

export default function AdminScopesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Edit scopes
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [selectedScopes, setSelectedScopes] = useState([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = user?.roles?.includes('super_admin');

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
    loadAdmins();
  }, [isAuthenticated, isSuperAdmin, page]);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const data = await superAdminAPI.getAdmins({ page, page_size: 20 });
      // Filter to only show admins (not super_admins)
      const adminUsers = (data.admins || []).filter(a => 
        a.roles.includes('admin') && !a.roles.includes('super_admin')
      );
      setAdmins(adminUsers);
      setTotal(adminUsers.length);
    } catch (error) {
      toast.error(error.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const selectAdmin = async (admin) => {
    try {
      const data = await superAdminAPI.getAdminScopes(admin.id);
      setSelectedAdmin(admin);
      setSelectedScopes(data.admin_permissions || []);
      setAdminPassword('');
    } catch (error) {
      toast.error(error.message || 'Failed to load admin scopes');
    }
  };

  const toggleScope = (scopeId) => {
    setSelectedScopes(prev => 
      prev.includes(scopeId) 
        ? prev.filter(s => s !== scopeId)
        : [...prev, scopeId]
    );
  };

  const applyPreset = (preset) => {
    setSelectedScopes([...preset.scopes]);
  };

  const handleSaveScopes = async () => {
    if (!adminPassword) {
      toast.error('Password required');
      return;
    }

    setSaving(true);
    try {
      await superAdminAPI.updateAdminScopes(selectedAdmin.id, {
        scopes: selectedScopes,
        admin_password: adminPassword,
      });
      toast.success('Admin scopes updated');
      setSelectedAdmin(null);
      setAdminPassword('');
      loadAdmins();
    } catch (error) {
      toast.error(error.message || 'Failed to update scopes');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl" data-testid="admin-scopes-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Admin Permission Scopes</h1>
            <p className="text-sm text-muted-foreground">
              Assign granular permissions to admin users. Super admins bypass all scopes.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadAdmins} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Admin List */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Users</CardTitle>
            <CardDescription>Click on an admin to manage their permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : admins.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No admin users found. Create an admin from the Users Management page.
              </p>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedAdmin?.id === admin.id 
                        ? 'bg-primary/20 border border-primary/50' 
                        : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                    onClick={() => selectAdmin(admin)}
                    data-testid={`admin-${admin.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{admin.username}</p>
                        <p className="text-xs text-muted-foreground">{admin.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(admin.admin_permissions || []).length > 0 ? (
                        admin.admin_permissions.slice(0, 2).map(scope => (
                          <Badge key={scope} variant="outline" className="text-xs">
                            {scope.split('_')[0]}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">No scopes</Badge>
                      )}
                      {(admin.admin_permissions || []).length > 2 && (
                        <Badge variant="outline" className="text-xs">+{admin.admin_permissions.length - 2}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scope Editor */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedAdmin ? `Edit Scopes: ${selectedAdmin.username}` : 'Select an Admin'}
            </CardTitle>
            {selectedAdmin && (
              <CardDescription>
                Choose which actions this admin can perform
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedAdmin ? (
              <p className="text-center text-muted-foreground py-8">
                Select an admin from the list to manage their permissions
              </p>
            ) : (
              <div className="space-y-6">
                {/* Presets */}
                <div>
                  <Label className="mb-2 block">Quick Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset) => (
                      <Button
                        key={preset.id}
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset(preset)}
                        data-testid={`preset-${preset.id}`}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Individual Scopes */}
                <div>
                  <Label className="mb-2 block">Permission Scopes</Label>
                  <div className="space-y-3">
                    {ALL_SCOPES.map((scope) => (
                      <div
                        key={scope.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                      >
                        <Checkbox
                          id={scope.id}
                          checked={selectedScopes.includes(scope.id)}
                          onCheckedChange={() => toggleScope(scope.id)}
                          data-testid={`scope-${scope.id}`}
                        />
                        <div className="flex-1">
                          <label htmlFor={scope.id} className="font-medium cursor-pointer">
                            {scope.label}
                          </label>
                          <p className="text-xs text-muted-foreground">{scope.description}</p>
                        </div>
                        {selectedScopes.includes(scope.id) && (
                          <Check className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selected Summary */}
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Selected Scopes:</p>
                  {selectedScopes.length === 0 ? (
                    <p className="text-sm">None - this admin will have no special permissions</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {selectedScopes.map(scope => (
                        <Badge key={scope} className="bg-primary/20 text-primary">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div className="border-t border-border pt-4 space-y-4">
                  <div>
                    <Label>Your Password (confirmation)</Label>
                    <Input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Enter your password to confirm"
                      data-testid="confirm-password"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSelectedAdmin(null)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveScopes} disabled={saving}>
                      {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Save Scopes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scope Enforcement Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Scope Enforcement Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-0.5" />
              <span>Admins without required scope receive <code className="bg-muted px-1 rounded">403 INSUFFICIENT_SCOPE</code> error</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-0.5" />
              <span>UI buttons are hidden/disabled when scope is missing</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-0.5" />
              <span>Super Admins bypass all scope checks automatically</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-400 mt-0.5" />
              <span>All scope changes are logged in the audit trail</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
