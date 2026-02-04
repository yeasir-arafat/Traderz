import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  User, Star, Shield, ShieldCheck, MessageSquare, 
  Calendar, Package, Award, Loader2, ArrowLeft 
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import api from '../lib/api';
import { formatDate, cn } from '../lib/utils';
import { useAuthStore } from '../store';
import { toast } from 'sonner';

const LEVEL_COLORS = {
  bronze: 'bg-amber-700 text-white',
  silver: 'bg-gray-400 text-gray-900',
  gold: 'bg-yellow-500 text-yellow-900',
  platinum: 'bg-cyan-300 text-cyan-900',
  diamond: 'bg-purple-400 text-purple-900',
};

const LEVEL_ICONS = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
  diamond: '👑',
};

export default function SellerProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (username) {
      fetchSellerProfile();
    }
  }, [username]);

  const fetchSellerProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/users/seller/${username}`);
      setSeller(data);
    } catch (err) {
      setError(err.message || 'Seller not found');
    } finally {
      setLoading(false);
    }
  };

  const handleContactSeller = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to contact seller');
      navigate('/login');
      return;
    }
    
    if (user?.username === seller?.username) {
      toast.error("You can't message yourself");
      return;
    }
    
    navigate(`/chat`);
    toast.info('Start a conversation from an order page');
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    const hasHalfStar = (rating || 0) % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} className="w-4 h-4 fill-yellow-500/50 text-yellow-500" />);
      } else {
        stars.push(<Star key={i} className="w-4 h-4 text-muted-foreground" />);
      }
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-16 text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Seller Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || "This seller doesn't exist or is no longer active."}</p>
            <Button onClick={() => navigate('/browse')}>
              Browse Listings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button 
        variant="ghost" 
        onClick={() => navigate(-1)} 
        className="mb-6"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Seller Info Card */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl font-bold text-primary">
                    {seller.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h1 className="text-2xl font-bold" data-testid="seller-username">
                  {seller.username}
                </h1>
                {seller.full_name && (
                  <p className="text-muted-foreground">{seller.full_name}</p>
                )}
              </div>

              {/* Level Badge */}
              <div className="flex justify-center mb-6">
                <Badge className={cn("text-lg px-4 py-2", LEVEL_COLORS[seller.seller_level] || LEVEL_COLORS.bronze)}>
                  <span className="mr-2">{LEVEL_ICONS[seller.seller_level] || LEVEL_ICONS.bronze}</span>
                  {(seller.seller_level || 'bronze').charAt(0).toUpperCase() + (seller.seller_level || 'bronze').slice(1)} Seller
                </Badge>
              </div>

              {/* Stats */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rating</span>
                  <div className="flex items-center gap-1">
                    {renderStars(seller.seller_rating)}
                    <span className="ml-2 font-medium">
                      {(seller.seller_rating || 0).toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Reviews</span>
                  <span className="font-medium">{seller.total_reviews || 0}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Sales</span>
                  <span className="font-medium">{seller.total_sales || 0}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Listings</span>
                  <span className="font-medium">{seller.total_listings || 0}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Member Since</span>
                  <span className="font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(seller.member_since)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Verification</span>
                  {seller.kyc_verified ? (
                    <Badge variant="outline" className="text-green-500 border-green-500">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Shield className="w-3 h-3 mr-1" />
                      Unverified
                    </Badge>
                  )}
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleContactSeller}
                data-testid="contact-seller-btn"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Contact Seller
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Listings & Reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Listings */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Active Listings
                </h2>
                <span className="text-muted-foreground">{seller.total_listings || 0} listings</span>
              </div>

              {seller.listings?.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {seller.listings.map((listing) => (
                    <Link
                      key={listing.id}
                      to={`/listing/${listing.id}`}
                      className="block border border-border rounded-lg p-4 hover:border-primary transition-colors"
                      data-testid={`listing-${listing.id}`}
                    >
                      <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center overflow-hidden">
                        {listing.images?.[0] ? (
                          <img 
                            src={listing.images[0]} 
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      
                      <div>
                        <Badge variant="secondary" className="mb-2 text-xs">
                          {listing.game_name}
                        </Badge>
                        <h3 className="font-medium line-clamp-1">{listing.title}</h3>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-primary font-bold">
                            ${listing.price_usd?.toFixed(2)}
                          </span>
                          {listing.account_level && (
                            <span className="text-xs text-muted-foreground">
                              Level {listing.account_level}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No active listings
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Reviews
                </h2>
                <span className="text-muted-foreground">{seller.total_reviews || 0} reviews</span>
              </div>

              {seller.reviews?.length > 0 ? (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-4 pr-4">
                    {seller.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="border-b border-border pb-4 last:border-0"
                        data-testid={`review-${review.id}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-medium">{review.reviewer_username}</span>
                            <div className="flex items-center gap-1 mt-1">
                              {renderStars(review.rating)}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(review.created_at)}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-muted-foreground text-sm">
                            {review.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No reviews yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
