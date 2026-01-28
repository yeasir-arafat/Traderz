import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollText, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

export default function LegalPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [saving, setSaving] = useState(false);
  const [termsHtml, setTermsHtml] = useState('');
  const [privacyHtml, setPrivacyHtml] = useState('');
  const [termsVersion, setTermsVersion] = useState('');
  const [privacyVersion, setPrivacyVersion] = useState('');

  const isSuperAdmin = user?.roles?.includes('super_admin');

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
  }, [isAuthenticated, isSuperAdmin]);

  const handleSave = async () => {
    if (!termsHtml && !privacyHtml) {
      toast.error('Please provide Terms and/or Privacy content to update.');
      return;
    }

    if (termsHtml && !termsVersion) {
      toast.error('Please provide a version for Terms.');
      return;
    }
    if (privacyHtml && !privacyVersion) {
      toast.error('Please provide a version for Privacy.');
      return;
    }

    setSaving(true);
    try {
      await superAdminAPI.updateLegal({
        terms_html: termsHtml || undefined,
        terms_version: termsVersion || undefined,
        privacy_html: privacyHtml || undefined,
        privacy_version: privacyVersion || undefined,
      });
      toast.success('Legal documents updated. New versions will force users to re-accept.');
      setTermsHtml('');
      setPrivacyHtml('');
      setTermsVersion('');
      setPrivacyVersion('');
    } catch (error) {
      toast.error(error.message || 'Failed to update legal documents');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ScrollText className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Legal Documents</h1>
            <p className="text-sm text-muted-foreground">
              Edit Terms of Service and Privacy Policy HTML. Bumping versions forces users to re-accept.
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Version</Label>
              <Input
                placeholder="e.g. 1.1"
                value={termsVersion}
                onChange={(e) => setTermsVersion(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>HTML Content</Label>
              <Textarea
                placeholder="<h1>Terms of Service</h1>..."
                value={termsHtml}
                onChange={(e) => setTermsHtml(e.target.value)}
                className="mt-1 min-h-[220px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste sanitized HTML that will be rendered in the public Terms page.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Version</Label>
              <Input
                placeholder="e.g. 1.1"
                value={privacyVersion}
                onChange={(e) => setPrivacyVersion(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>HTML Content</Label>
              <Textarea
                placeholder="<h1>Privacy Policy</h1>..."
                value={privacyHtml}
                onChange={(e) => setPrivacyHtml(e.target.value)}
                className="mt-1 min-h-[220px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste sanitized HTML that will be rendered in the public Privacy page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

