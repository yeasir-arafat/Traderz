import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Shield, Upload, CheckCircle, Clock, XCircle, 
  Loader2, FileImage, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { kycAPI, uploadAPI } from '../lib/api';
import { useAuthStore } from '../store';
import { toast } from 'sonner';

const DOC_TYPES = [
  { value: 'national_id', label: 'National ID Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
];

const statusConfig = {
  approved: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  not_submitted: { icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted' },
};

export default function KycPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  
  const [kycStatus, setKycStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState({ front: false, back: false, selfie: false });
  
  const [formData, setFormData] = useState({
    doc_type: '',
    doc_front_url: '',
    doc_back_url: '',
    selfie_url: '',
  });
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    fetchKycStatus();
  }, [isAuthenticated]);
  
  const fetchKycStatus = async () => {
    setLoading(true);
    try {
      const data = await kycAPI.getMy();
      setKycStatus(data);
    } catch (error) {
      console.error('Failed to fetch KYC status:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpload = async (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading({ ...uploading, [field]: true });
    try {
      const result = await uploadAPI.uploadKYC(file);
      setFormData({ ...formData, [field]: result.url });
      toast.success('Document uploaded');
    } catch (error) {
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading({ ...uploading, [field]: false });
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.doc_type) {
      toast.error('Please select a document type');
      return;
    }
    if (!formData.doc_front_url) {
      toast.error('Please upload the front of your document');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await kycAPI.submit(formData);
      setKycStatus(response);
      updateUser({ kyc_status: 'pending' });
      toast.success('KYC submitted for review');
    } catch (error) {
      toast.error(error.message || 'Failed to submit KYC');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const status = kycStatus?.status || 'not_submitted';
  const StatusIcon = statusConfig[status]?.icon || AlertCircle;
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/profile')} 
        className="mb-4"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Profile
      </Button>
      
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-heading font-bold">KYC Verification</h1>
          <p className="text-muted-foreground">
            Identity verification is required for sellers
          </p>
        </div>
      </div>
      
      {/* Current Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Verification Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex items-center gap-3 p-4 rounded-lg ${statusConfig[status]?.bg}`}>
            <StatusIcon className={`w-8 h-8 ${statusConfig[status]?.color}`} />
            <div>
              <p className="font-semibold capitalize">{status.replace('_', ' ')}</p>
              <p className="text-sm text-muted-foreground">
                {status === 'approved' && 'Your identity has been verified. You can now create listings.'}
                {status === 'pending' && 'Your documents are being reviewed. This usually takes 24-48 hours.'}
                {status === 'rejected' && 'Your submission was rejected. Please submit again with valid documents.'}
                {status === 'not_submitted' && 'Submit your identity documents to start selling.'}
              </p>
            </div>
          </div>
          
          {kycStatus?.review_note && status === 'rejected' && (
            <div className="mt-4 p-3 bg-red-500/10 rounded-lg">
              <p className="text-sm font-medium text-red-500">Rejection Reason:</p>
              <p className="text-sm">{kycStatus.review_note}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Submission Form - Only show if not approved or pending */}
      {(status === 'not_submitted' || status === 'rejected') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Document Type */}
              <div>
                <Label>Document Type *</Label>
                <Select 
                  value={formData.doc_type} 
                  onValueChange={(v) => setFormData({ ...formData, doc_type: v })}
                >
                  <SelectTrigger className="mt-2" data-testid="doc-type-select">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Document Front */}
              <div>
                <Label>Document Front *</Label>
                <div className="mt-2">
                  {formData.doc_front_url ? (
                    <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                      <img 
                        src={formData.doc_front_url} 
                        alt="Document Front" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, doc_front_url: '' })}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      {uploading.front ? (
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Upload front of document</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUpload('doc_front_url', e)}
                        className="hidden"
                        disabled={uploading.front}
                        data-testid="doc-front-upload"
                      />
                    </label>
                  )}
                </div>
              </div>
              
              {/* Document Back (optional) */}
              <div>
                <Label>Document Back (optional)</Label>
                <div className="mt-2">
                  {formData.doc_back_url ? (
                    <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                      <img 
                        src={formData.doc_back_url} 
                        alt="Document Back" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, doc_back_url: '' })}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      {uploading.back ? (
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Upload back of document</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUpload('doc_back_url', e)}
                        className="hidden"
                        disabled={uploading.back}
                        data-testid="doc-back-upload"
                      />
                    </label>
                  )}
                </div>
              </div>
              
              {/* Selfie (optional) */}
              <div>
                <Label>Selfie with Document (optional but recommended)</Label>
                <div className="mt-2">
                  {formData.selfie_url ? (
                    <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                      <img 
                        src={formData.selfie_url} 
                        alt="Selfie" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, selfie_url: '' })}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      {uploading.selfie ? (
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Upload selfie holding your document</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUpload('selfie_url', e)}
                        className="hidden"
                        disabled={uploading.selfie}
                        data-testid="selfie-upload"
                      />
                    </label>
                  )}
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={submitting}
                data-testid="submit-kyc-btn"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                Submit for Verification
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      
      {/* Guidelines */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              Use a clear, high-quality photo of your document
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              All text and photo on the document must be visible
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              Document must not be expired
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              Your selfie should clearly show your face and the document
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
