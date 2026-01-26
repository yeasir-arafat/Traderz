import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { User as UserIcon, Shield, Star, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { sellersAPI } from '../lib/api';
import { getSellerLevelBadge } from '../lib/utils';
import { toast } from 'sonner';

export default function SellerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate('/browse');
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const data = await sellersAPI.getProfile(id);
        setSeller(data);
      } catch (e) {
        toast.error(e?.message || 'Seller not found');
        navigate('/browse');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!seller) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seller</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">{seller.username}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded border ${getSellerLevelBadge(seller.seller_level)}`}>
                  {seller.seller_level}
                </span>
                {seller.kyc_status === 'approved' && (
                  <span className="text-xs text-green-600 flex items-center gap-0.5">
                    <Shield className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span>{Number(seller.seller_rating || 0).toFixed(1)}</span>
                <span>({seller.total_reviews || 0} reviews)</span>
              </div>
            </div>
          </div>
          <Button asChild className="mt-4">
            <Link to="/browse">Browse listings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
