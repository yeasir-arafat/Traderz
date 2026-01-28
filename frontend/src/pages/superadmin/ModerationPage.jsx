import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, MessagesSquare, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

export default function ModerationPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [listingId, setListingId] = useState('');
  const [listingReason, setListingReason] = useState('');
  const [blockUserId, setBlockUserId] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [messageId, setMessageId] = useState('');
  const [messageReason, setMessageReason] = useState('');

  const [processingListing, setProcessingListing] = useState(false);
  const [processingUser, setProcessingUser] = useState(false);
  const [processingMessage, setProcessingMessage] = useState(false);

  const isSuperAdmin = user?.roles?.includes('super_admin');

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
    }
  }, [isAuthenticated, isSuperAdmin]);

  const handleHideListing = async () => {
    if (!listingId || !listingReason) {
      toast.error('Listing ID and reason are required.');
      return;
    }
    setProcessingListing(true);
    try {
      await superAdminAPI.hideListing(listingId, { reason: listingReason });
      toast.success('Listing hidden');
      setListingId('');
      setListingReason('');
    } catch (error) {
      toast.error(error.message || 'Failed to hide listing');
    } finally {
      setProcessingListing(false);
    }
  };

  const handleBlockSeller = async () => {
    if (!blockUserId || !blockReason || !adminPassword) {
      toast.error('User ID, reason, and your password are required.');
      return;
    }
    setProcessingUser(true);
    try {
      await superAdminAPI.updateUserStatus(blockUserId, {
        status: 'banned',
        reason: blockReason,
        admin_password: adminPassword,
      });
      toast.success('Seller blocked and set to banned status');
      setBlockUserId('');
      setBlockReason('');
      setAdminPassword('');
    } catch (error) {
      toast.error(error.message || 'Failed to block seller');
    } finally {
      setProcessingUser(false);
    }
  };

  const handleHideMessage = async () => {
    if (!messageId || !messageReason) {
      toast.error('Message ID and reason are required.');
      return;
    }
    setProcessingMessage(true);
    try {
      await superAdminAPI.hideMessage(messageId, { reason: messageReason });
      toast.success('Message soft-hidden');
      setMessageId('');
      setMessageReason('');
    } catch (error) {
      toast.error(error.message || 'Failed to hide message');
    } finally {
      setProcessingMessage(false);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl font-heading font-bold mb-4">Moderation</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Emergency tools for owner-level content and seller moderation. All actions are logged in the audit log.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Listing Moderation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EyeOff className="w-4 h-4" />
              Hide Listing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Listing ID (UUID)</Label>
              <Input
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                placeholder="listing UUID"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={listingReason}
                onChange={(e) => setListingReason(e.target.value)}
                placeholder="Explain why this listing is being hidden"
              />
            </div>
            <Button onClick={handleHideListing} disabled={processingListing}>
              {processingListing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Hide Listing
            </Button>
          </CardContent>
        </Card>

        {/* Block Seller */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Block Seller
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>User ID (UUID)</Label>
              <Input
                value={blockUserId}
                onChange={(e) => setBlockUserId(e.target.value)}
                placeholder="seller user UUID"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Explain why this seller is being blocked"
              />
            </div>
            <div>
              <Label>Your Password (confirmation)</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Super admin password"
              />
            </div>
            <Button variant="destructive" onClick={handleBlockSeller} disabled={processingUser}>
              {processingUser && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Block Seller
            </Button>
          </CardContent>
        </Card>

        {/* Chat Moderation */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessagesSquare className="w-4 h-4" />
              Chat Moderation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Message ID (UUID)</Label>
                <Input
                  value={messageId}
                  onChange={(e) => setMessageId(e.target.value)}
                  placeholder="chat message UUID"
                />
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea
                  value={messageReason}
                  onChange={(e) => setMessageReason(e.target.value)}
                  placeholder="Explain why this message is being hidden"
                />
              </div>
            </div>
            <Button onClick={handleHideMessage} disabled={processingMessage}>
              {processingMessage && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Soft‑hide Message
            </Button>
            <p className="text-xs text-muted-foreground pt-2">
              Future: a flagged-content queue will surface reported listings and messages here for review.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

