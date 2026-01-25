import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Package, Eye, Edit, Trash2, Loader2, AlertCircle, CheckCircle,
  Clock, XCircle, Filter
} from 'lucide-react';
import { Button } from '../../components/ui/button';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';
import { listingsAPI } from '../../lib/api';
import { useAuthStore, useCurrencyStore } from '../../store';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

const statusIcons = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  sold: Package,
  inactive: AlertCircle,
};

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  approved: 'bg-green-500/10 text-green-500 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  sold: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  inactive: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export default function MyListingsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [deleting, setDeleting] = useState(null);
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!user?.roles?.includes('seller')) {
      navigate('/profile');
      toast.error('You need to be a seller to access this page');
      return;
    }
    fetchListings();
  }, [isAuthenticated, user, statusFilter]);
  
  const fetchListings = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, page_size: 20 };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await listingsAPI.getMy(params);
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
  
  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await listingsAPI.delete(id);
      toast.success('Listing deleted');
      fetchListings(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to delete listing');
    } finally {
      setDeleting(null);
    }
  };
  
  const isSeller = user?.roles?.includes('seller');
  const isKycApproved = user?.kyc_status === 'approved';
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold">My Listings</h1>
          <p className="text-muted-foreground">Manage your game account listings</p>
        </div>
        
        {isKycApproved ? (
          <Button onClick={() => navigate('/sell/new')} data-testid="create-listing-btn">
            <Plus className="w-4 h-4 mr-2" />
            Create Listing
          </Button>
        ) : (
          <Button variant="outline" onClick={() => navigate('/kyc')} data-testid="complete-kyc-btn">
            Complete KYC to create listings
          </Button>
        )}
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        
        <span className="text-sm text-muted-foreground ml-auto">
          {pagination.total} listing{pagination.total !== 1 ? 's' : ''}
        </span>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Listings Found</h3>
            <p className="text-muted-foreground mb-4">
              {statusFilter !== 'all' 
                ? 'No listings match the selected filter'
                : "You haven't created any listings yet"}
            </p>
            {isKycApproved && (
              <Button onClick={() => navigate('/sell/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Listing
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => {
            const StatusIcon = statusIcons[listing.status] || AlertCircle;
            return (
              <Card key={listing.id} className="hover:border-primary/30 transition-colors" data-testid={`listing-${listing.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Image */}
                    <div className="w-full md:w-40 h-32 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {listing.images?.[0] ? (
                        <img 
                          src={listing.images[0]} 
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="font-semibold truncate">{listing.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {listing.game?.name || 'Unknown Game'}
                          </p>
                        </div>
                        <Badge className={statusColors[listing.status] || ''}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {listing.status}
                        </Badge>
                      </div>
                      
                      <p className="text-lg font-bold text-primary mb-2">
                        {formatCurrency(listing.price_usd, currency, usdToBdtRate)}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {listing.platforms?.map((p) => (
                          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                      
                      {listing.rejection_reason && (
                        <p className="text-sm text-red-500 mb-3">
                          <AlertCircle className="w-4 h-4 inline mr-1" />
                          Rejected: {listing.rejection_reason}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Eye className="w-4 h-4" />
                        {listing.view_count} views
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex md:flex-col gap-2 flex-shrink-0">
                      <Link to={`/listing/${listing.id}`}>
                        <Button variant="outline" size="sm" className="w-full" data-testid={`view-${listing.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      
                      {listing.status !== 'sold' && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/sell/${listing.id}/edit`)}
                            data-testid={`edit-${listing.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={deleting === listing.id}
                                data-testid={`delete-${listing.id}`}
                              >
                                {deleting === listing.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Listing</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{listing.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(listing.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
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
    </div>
  );
}
