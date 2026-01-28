import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User as UserIcon, Mail, Phone, MapPin, Shield, Lock, LogOut,
  Pencil, Save, Loader2, ChevronRight, ShoppingBag, Store
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { usersAPI, walletAPI } from '../lib/api';
import { useAuthStore, useCurrencyStore } from '../store';
import { formatCurrency, getSellerLevelBadge } from '../lib/utils';
import { toast } from 'sonner';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, updateUser, logout, isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState({ available_usd: 0, pending_usd: 0, frozen_usd: 0 });
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
  });
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
        address_line1: user.address_line1 || '',
        address_line2: user.address_line2 || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || '',
        postal_code: user.postal_code || '',
      });
    }
    
    const fetchBalance = async () => {
      try {
        const data = await walletAPI.getBalance();
        setBalance(data);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };
    fetchBalance();
  }, [user, isAuthenticated, navigate]);
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedUser = await usersAPI.updateProfile(formData);
      updateUser(updatedUser);
      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };
  
  const handleBecomeSeller = async () => {
    // Require basic profile fields before calling API
    const missingFields = [];
    if (!user.full_name) missingFields.push('full name');
    if (!user.phone_number) missingFields.push('phone number');
    if (!user.address_line1) missingFields.push('address');
    if (!user.city) missingFields.push('city');
    if (!user.country) missingFields.push('country');
    if (!user.postal_code) missingFields.push('postal code');

    if (missingFields.length > 0) {
      toast.error(
        `Please complete your profile before becoming a seller. Missing: ${missingFields.join(
          ', '
        )}`
      );
      setEditing(true);
      return;
    }
    
    try {
      const updatedUser = await usersAPI.becomeSeller();
      updateUser(updatedUser);
      toast.success('You are now a seller!');
      
      if (user?.kyc_status !== 'approved') {
        toast.info('Complete KYC to create listings');
        navigate('/kyc');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to become seller');
    }
  };
  
  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };
  
  const isKycApproved = user?.kyc_status === 'approved';
  const isSeller = user?.roles?.includes('seller');
  
  if (!user) return null;
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-heading font-bold mb-8">My Profile</h1>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link to="/wallet" data-testid="wallet-card">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(balance.available_usd, currency, usdToBdtRate)}
              </p>
              <p className="text-xs text-muted-foreground">Available Balance</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/orders" data-testid="orders-card">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 text-center">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-xs text-muted-foreground">My Orders</p>
            </CardContent>
          </Card>
        </Link>
        
        {isSeller && (
          <Link to="/my-listings" data-testid="listings-card">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 text-center">
                <Store className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-xs text-muted-foreground">My Listings</p>
              </CardContent>
            </Card>
          </Link>
        )}
        
        <Link to="/kyc" data-testid="kyc-card">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 text-center">
              <Shield className={`w-8 h-8 mx-auto mb-2 ${isKycApproved ? 'text-green-500' : 'text-muted-foreground'}`} />
              <p className="text-xs text-muted-foreground">
                KYC {user.kyc_status === 'not_submitted' ? 'Not Submitted' : user.kyc_status}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
      
      {/* Profile Card */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile Information</CardTitle>
          <Button
            variant={editing ? 'default' : 'outline'}
            size="sm"
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
            data-testid="edit-profile-btn"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : editing ? (
              <Save className="w-4 h-4 mr-1" />
            ) : (
              <Pencil className="w-4 h-4 mr-1" />
            )}
            {editing ? 'Save' : 'Edit'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Username & Email (read-only) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Username</Label>
              <div className="flex items-center gap-2 mt-1">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{user.username}</span>
                <Lock className="w-3 h-3 text-muted-foreground" title="Cannot be changed" />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{user.email}</span>
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Editable Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">
                Full Name
                {isKycApproved && <Lock className="w-3 h-3 inline ml-1 text-muted-foreground" />}
              </Label>
              {editing && !isKycApproved ? (
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="bg-muted/50"
                />
              ) : (
                <p className="py-2">{user.full_name || '-'}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              {editing ? (
                <Input
                  id="phone_number"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="bg-muted/50"
                />
              ) : (
                <p className="py-2">{user.phone_number || '-'}</p>
              )}
            </div>
          </div>
          
          <Separator />
          
          {/* Address */}
          <div className="space-y-4">
            <Label className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Address
              {isKycApproved && <Lock className="w-3 h-3 text-muted-foreground" />}
            </Label>
            
            {editing && !isKycApproved ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Address Line 1"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  className="bg-muted/50"
                />
                <Input
                  placeholder="Address Line 2"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  className="bg-muted/50"
                />
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="bg-muted/50"
                />
                <Input
                  placeholder="State"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="bg-muted/50"
                />
                <Input
                  placeholder="Country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="bg-muted/50"
                />
                <Input
                  placeholder="Postal Code"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="bg-muted/50"
                />
              </div>
            ) : (
              <p className="text-muted-foreground">
                {[user.address_line1, user.city, user.country].filter(Boolean).join(', ') || 'No address set'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Seller Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Seller Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isSeller ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded border ${getSellerLevelBadge(user.seller_level)}`}>
                  {user.seller_level} Seller
                </span>
                <Badge variant={isKycApproved ? 'default' : 'secondary'}>
                  KYC {user.kyc_status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="p-3 bg-muted/50 rounded">
                  <p className="text-muted-foreground">Rating</p>
                  <p className="font-semibold">{user.seller_rating?.toFixed(1) || '0.0'} / 5</p>
                </div>
                <div className="p-3 bg-muted/50 rounded">
                  <p className="text-muted-foreground">Reviews</p>
                  <p className="font-semibold">{user.total_reviews || 0}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded">
                  <p className="text-muted-foreground">Total Sales</p>
                  <p className="font-semibold">{formatCurrency(user.total_sales_volume_usd || 0, currency, usdToBdtRate)}</p>
                </div>
              </div>
              
              {!isKycApproved && (
                <Button onClick={() => navigate('/kyc')} variant="outline" data-testid="complete-kyc-btn">
                  Complete KYC to create listings
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Want to sell game accounts? Become a seller and start earning!
              </p>
              <Button onClick={handleBecomeSeller} data-testid="become-seller-btn">
                <Store className="w-4 h-4 mr-2" />
                Become a Seller
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button variant="outline" onClick={() => navigate('/change-password')} data-testid="change-password-btn">
          <Lock className="w-4 h-4 mr-2" />
          Change Password
        </Button>
        <Button variant="destructive" onClick={handleLogout} className="sm:ml-auto" data-testid="logout-btn">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
