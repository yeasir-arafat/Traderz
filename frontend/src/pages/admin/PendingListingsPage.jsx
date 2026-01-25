import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Package, CheckCircle, XCircle, Loader2, ExternalLink,
  Eye, Clock
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { listingsAPI } from '../../lib/api';
import { useAuthStore, useCurrencyStore } from '../../store';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

export default function PendingListingsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [reviewingListing, setReviewingListing] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!isAdmin) {
      navigate('/');
      toast.error('Access denied');
      return;
    }
    
    fetchListings();
  }, [isAuthenticated, isAdmin]);
  
  const fetchListings = async (page = 1) => {
    setLoading(true);
    try {
      const data = await listingsAPI.getPending({ page, page_size: 20 });
      setListings(data.listings || []);
      setPagination({
        page: data.page,
        total: data.total,
        totalPages: data.total_pages,
      });
    } catch (error) {
      toast.error(error.message || 'Failed to fetch listings');
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprove = async (listing) => {
    setProcessing(true);
    try {
      await listingsAPI.review(listing.id, { approved: true });
      toast.success(`Listing "${listing.title}" approved`);
      fetchListings(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to approve listing');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    
    setProcessing(true);
    try {
      await listingsAPI.review(reviewingListing.id, { 
        approved: false, 
        rejection_reason: rejectionReason 
      });
      toast.success(`Listing rejected`);
      setReviewingListing(null);
      setRejectionReason('');
      fetchListings(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to reject listing');
    } finally {
      setProcessing(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/admin')} 
        className="mb-4"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
      
      <div className="flex items-center gap-3 mb-8">
        <Package className="w-8 h-8 text-yellow-500" />
        <div>
          <h1 className="text-3xl font-heading font-bold">Pending Listings</h1>
          <p className="text-muted-foreground">
            Review and approve listing submissions
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {pagination.total} pending
        </Badge>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground">
              No pending listings to review at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => (
            <Card key={listing.id} className="hover:border-primary/30 transition-colors" data-testid={`listing-${listing.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Image */}
                  <div className="w-full lg:w-48 h-36 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    {listing.images?.[0] ? (
                      <img 
                        src={listing.images[0]} 
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{listing.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {listing.game?.name || 'Unknown Game'} • Seller: {listing.seller?.username || 'Unknown'}
                        </p>
                      </div>
                      <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                    
                    <p className="text-lg font-bold text-primary mb-2">
                      {formatCurrency(listing.price_usd, currency, usdToBdtRate)}
                    </p>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {listing.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      {listing.platforms?.map((p) => (
                        <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                      ))}
                      {listing.regions?.map((r) => (
                        <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                      ))}
                    </div>
                    
                    {listing.account_level && (
                      <p className="text-sm text-muted-foreground">
                        Level: {listing.account_level} {listing.account_rank && `• Rank: ${listing.account_rank}`}
                      </p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex lg:flex-col gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/listing/${listing.id}`, '_blank')}
                      data-testid={`view-${listing.id}`}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleApprove(listing)}
                      disabled={processing}
                      data-testid={`approve-${listing.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setReviewingListing(listing)}
                      disabled={processing}
                      data-testid={`reject-${listing.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => fetchListings(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchListings(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Rejection Dialog */}
      <Dialog open={!!reviewingListing} onOpenChange={() => setReviewingListing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Listing</DialogTitle>
            <DialogDescription>
              Rejecting: {reviewingListing?.title}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Rejection Reason *</label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this listing is being rejected..."
                rows={4}
                className="mt-2"
                data-testid="rejection-reason"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingListing(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={processing}
              data-testid="confirm-reject-btn"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Reject Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
