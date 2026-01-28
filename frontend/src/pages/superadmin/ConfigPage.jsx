import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore, useCurrencyStore } from '../../store';
import { toast } from 'sonner';

export default function ConfigPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const setRate = useCurrencyStore((state) => state.setRate);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    usd_to_bdt_rate: 120,
    dispute_window_hours: 24,
    seller_protection_days: 10,
    kyc_required_for_seller: true,
    listing_approval_required: true,
    max_image_size_mb: 5,
    max_images_per_listing: 5,
    default_fee_percent: 5,
    maintenance_mode: false,
  });

  const isSuperAdmin = user?.roles?.includes('super_admin');

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
    fetchConfig();
  }, [isAuthenticated, isSuperAdmin]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await superAdminAPI.getConfig();
      setConfig((prev) => ({ ...prev, ...data }));
      if (typeof data.usd_to_bdt_rate === 'number') {
        setRate(data.usd_to_bdt_rate);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load platform config');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await superAdminAPI.updateConfig(config);
      toast.success('Platform configuration updated');
      if (typeof config.usd_to_bdt_rate === 'number') {
        setRate(config.usd_to_bdt_rate);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleNumberChange = (key) => (e) => {
    const value = e.target.value;
    setConfig((prev) => ({
      ...prev,
      [key]: value === '' ? '' : Number(value),
    }));
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Platform Config</h1>
            <p className="text-sm text-muted-foreground">
              Control currency, protection windows, listing rules, and maintenance mode.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfig}
            disabled={loading || saving}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform & Currency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>USD → BDT rate</Label>
              <Input
                type="number"
                step="0.01"
                value={config.usd_to_bdt_rate}
                onChange={handleNumberChange('usd_to_bdt_rate')}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Default platform fee (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={config.default_fee_percent}
                onChange={handleNumberChange('default_fee_percent')}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Dispute window (hours)</Label>
              <Input
                type="number"
                min="6"
                max="168"
                value={config.dispute_window_hours}
                onChange={handleNumberChange('dispute_window_hours')}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Seller protection (days)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={config.seller_protection_days}
                onChange={handleNumberChange('seller_protection_days')}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Max image size (MB)</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={config.max_image_size_mb}
                onChange={handleNumberChange('max_image_size_mb')}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Max images per listing</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={config.max_images_per_listing}
                onChange={handleNumberChange('max_images_per_listing')}
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>KYC required to become seller</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, only KYC-approved users can sell.
                </p>
              </div>
              <Switch
                checked={config.kyc_required_for_seller}
                onCheckedChange={(val) =>
                  setConfig((prev) => ({ ...prev, kyc_required_for_seller: val }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Listing approval required</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, admins must approve listings before they go live.
                </p>
              </div>
              <Switch
                checked={config.listing_approval_required}
                onCheckedChange={(val) =>
                  setConfig((prev) => ({ ...prev, listing_approval_required: val }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance mode</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, the site can show a maintenance banner or restrict actions (front-end controlled).
                </p>
              </div>
              <Switch
                checked={config.maintenance_mode}
                onCheckedChange={(val) =>
                  setConfig((prev) => ({ ...prev, maintenance_mode: val }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

