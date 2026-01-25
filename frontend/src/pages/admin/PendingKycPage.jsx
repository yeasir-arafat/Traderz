import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileCheck, CheckCircle, XCircle, Loader2, 
  User, FileImage, Clock, ExternalLink
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
import { kycAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

export default function PendingKycPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [reviewingKyc, setReviewingKyc] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  
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
    
    fetchSubmissions();
  }, [isAuthenticated, isAdmin]);
  
  const fetchSubmissions = async (page = 1) => {
    setLoading(true);
    try {
      const data = await kycAPI.getPending({ page, page_size: 20 });
      setSubmissions(data.submissions || []);
      setPagination({
        page: data.page,
        total: data.total,
        totalPages: Math.ceil((data.total || 0) / 20),
      });
    } catch (error) {
      toast.error(error.message || 'Failed to fetch KYC submissions');
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprove = async () => {
    setProcessing(true);
    try {
      await kycAPI.review(reviewingKyc.id, { 
        approved: true, 
        review_note: reviewNote || 'Approved' 
      });
      toast.success('KYC approved');
      setReviewingKyc(null);
      setReviewNote('');
      fetchSubmissions(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to approve KYC');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleReject = async () => {
    if (!reviewNote.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    
    setProcessing(true);
    try {
      await kycAPI.review(reviewingKyc.id, { 
        approved: false, 
        review_note: reviewNote 
      });
      toast.success('KYC rejected');
      setReviewingKyc(null);
      setReviewNote('');
      fetchSubmissions(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to reject KYC');
    } finally {
      setProcessing(false);
    }
  };
  
  const formatDocType = (type) => {
    const types = {
      national_id: 'National ID',
      passport: 'Passport',
      driving_license: 'Driving License',
    };
    return types[type] || type;
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
        <FileCheck className="w-8 h-8 text-blue-500" />
        <div>
          <h1 className="text-3xl font-heading font-bold">KYC Verification</h1>
          <p className="text-muted-foreground">
            Review and verify seller identity documents
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
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground">
              No pending KYC submissions to review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <Card key={submission.id} className="hover:border-primary/30 transition-colors" data-testid={`kyc-${submission.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">User ID: {submission.user_id?.slice(0, 8)}...</p>
                        <p className="text-sm text-muted-foreground">
                          Submitted: {new Date(submission.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className="ml-auto bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                    
                    <p className="text-sm mb-3">
                      <span className="text-muted-foreground">Document Type:</span>{' '}
                      <span className="font-medium">{formatDocType(submission.doc_type)}</span>
                    </p>
                    
                    {/* Documents */}
                    <div className="flex flex-wrap gap-3">
                      {submission.doc_front_url && (
                        <div 
                          className="w-24 h-24 rounded-lg bg-muted overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all"
                          onClick={() => setViewingImage(submission.doc_front_url)}
                        >
                          <img 
                            src={submission.doc_front_url} 
                            alt="Document Front"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity">
                            Front
                          </div>
                        </div>
                      )}
                      
                      {submission.doc_back_url && (
                        <div 
                          className="w-24 h-24 rounded-lg bg-muted overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all"
                          onClick={() => setViewingImage(submission.doc_back_url)}
                        >
                          <img 
                            src={submission.doc_back_url} 
                            alt="Document Back"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {submission.selfie_url && (
                        <div 
                          className="w-24 h-24 rounded-lg bg-muted overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all"
                          onClick={() => setViewingImage(submission.selfie_url)}
                        >
                          <img 
                            src={submission.selfie_url} 
                            alt="Selfie"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex md:flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setReviewingKyc(submission);
                        setReviewNote('');
                      }}
                      data-testid={`review-${submission.id}`}
                    >
                      <FileCheck className="w-4 h-4 mr-1" />
                      Review
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
                onClick={() => fetchSubmissions(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchSubmissions(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Review Dialog */}
      <Dialog open={!!reviewingKyc} onOpenChange={() => setReviewingKyc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review KYC Submission</DialogTitle>
            <DialogDescription>
              {formatDocType(reviewingKyc?.doc_type)} verification
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Document Preview */}
            <div className="flex gap-2 justify-center">
              {reviewingKyc?.doc_front_url && (
                <img 
                  src={reviewingKyc.doc_front_url} 
                  alt="Document Front"
                  className="w-32 h-32 object-cover rounded-lg cursor-pointer"
                  onClick={() => setViewingImage(reviewingKyc.doc_front_url)}
                />
              )}
              {reviewingKyc?.doc_back_url && (
                <img 
                  src={reviewingKyc.doc_back_url} 
                  alt="Document Back"
                  className="w-32 h-32 object-cover rounded-lg cursor-pointer"
                  onClick={() => setViewingImage(reviewingKyc.doc_back_url)}
                />
              )}
              {reviewingKyc?.selfie_url && (
                <img 
                  src={reviewingKyc.selfie_url} 
                  alt="Selfie"
                  className="w-32 h-32 object-cover rounded-lg cursor-pointer"
                  onClick={() => setViewingImage(reviewingKyc.selfie_url)}
                />
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium">Review Note (required for rejection)</label>
              <Textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Add a note about your decision..."
                rows={3}
                className="mt-2"
                data-testid="review-note"
              />
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setReviewingKyc(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={processing}
              data-testid="reject-kyc-btn"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={processing}
              data-testid="approve-kyc-btn"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Image Viewer */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-3xl">
          <img 
            src={viewingImage} 
            alt="Document"
            className="w-full h-auto max-h-[80vh] object-contain"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
