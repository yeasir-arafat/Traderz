import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Gamepad2, Star, Shield, MessageCircle, ChevronLeft, ChevronRight,
  Eye, Clock, User as UserIcon, MapPin, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { listingsAPI, ordersAPI, chatsAPI, reviewsAPI } from '../lib/api';
import { useAuthStore, useCurrencyStore } from '../store';
import { formatCurrency, getSellerLevelBadge, formatDate } from '../lib/utils';
import { toast } from 'sonner';

export default function ListingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [sellerReviews, setSellerReviews] = useState([]);
  
  useEffect(() => {
    const fetchListing = async () => {
      try {
        const data = await listingsAPI.getById(id);
        setListing(data);
        
        if (data?.seller?.id) {
          const reviews = await reviewsAPI.getForSeller(data.seller.id, { page: 1, page_size: 3 });
          setSellerReviews(reviews?.reviews || []);
        }
      } catch (error) {
        toast.error('Failed to load listing');
        navigate('/browse');
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id, navigate]);
  
  const handleBuy = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to purchase');
      navigate('/login');
      return;
    }
    
    setBuying(true);
    try {
      const order = await ordersAPI.create(id);
      toast.success(`Order ${order.order_number} created!`);
      navigate(`/order/${order.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create order');
    } finally {
      setBuying(false);
    }
  };
  
  const handleContact = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to message seller');
      navigate('/login');
      return;
    }
    
    try {
      const conversation = await chatsAPI.start({
        recipient_id: listing.seller_id,
        listing_id: id,
      });
      navigate(`/chat/${conversation.id}`);
    } catch (error) {
      toast.error('Failed to start conversation');
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="aspect-video bg-muted rounded-lg max-w-2xl" />
          <div className="h-8 bg-muted rounded w-3/4 max-w-lg" />
          <div className="h-4 bg-muted rounded w-1/2 max-w-md" />
        </div>
      </div>
    );
  }
  
  if (!listing) return null;
  
  const isOwner = user?.id === listing.seller_id;
  const images = listing.images?.length > 0 ? listing.images : [];
  
  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-4"
        data-testid="back-btn"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back
      </Button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          <div className="relative">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              {images.length > 0 ? (
                <img
                  src={images[currentImage]}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Gamepad2 className="w-24 h-24 text-muted-foreground" />
                </div>
              )}
            </div>
            
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80"
                  onClick={() => setCurrentImage((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80"
                  onClick={() => setCurrentImage((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
                
                <div className="flex gap-2 mt-4">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentImage(i)}
                      className={`w-16 h-16 rounded overflow-hidden border-2 transition-colors ${
                        i === currentImage ? 'border-primary' : 'border-transparent'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
          {/* Title & Meta */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary">{listing.game?.name || 'Game'}</Badge>
              {listing.platforms?.map((p) => (
                <Badge key={p} variant="outline">{p}</Badge>
              ))}
              {listing.regions?.map((r) => (
                <Badge key={r} variant="outline">{r}</Badge>
              ))}
            </div>
            
            <h1 className="text-3xl font-heading font-bold mb-2">{listing.title}</h1>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {listing.view_count} views
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Listed {formatDate(listing.created_at)}
              </span>
            </div>
          </div>
          
          <Separator />
          
          {/* Description */}
          <div>
            <h2 className="text-xl font-heading font-semibold mb-3">Description</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
          </div>
          
          {/* Game-specific Buyer Note */}
          {listing.game?.buyer_note_html && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-yellow-500" />
                <h3 className="font-semibold text-yellow-500">Important Information for {listing.game.name} Buyers</h3>
              </div>
              <div 
                className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: listing.game.buyer_note_html }}
              />
            </div>
          )}
          
          {/* Account Video */}
          {listing.video_url && (
            <div>
              <h2 className="text-xl font-heading font-semibold mb-3">Account Video</h2>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                {listing.video_url.includes('youtube.com') || listing.video_url.includes('youtu.be') ? (
                  <iframe
                    src={listing.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                    title="Account Video"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <a 
                    href={listing.video_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full h-full flex items-center justify-center hover:bg-muted/80 transition-colors"
                  >
                    <div className="text-center">
                      <Gamepad2 className="w-12 h-12 mx-auto mb-2 text-primary" />
                      <p className="text-primary font-medium">View Account Video</p>
                      <p className="text-xs text-muted-foreground mt-1">Opens in new tab</p>
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}
          
          {/* Account Details - New dynamic format */}
          {listing.account_details?.length > 0 && (
            <div>
              <h2 className="text-xl font-heading font-semibold mb-3">Account Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {listing.account_details.map((detail, index) => (
                  <div key={index} className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">{detail.label}</p>
                    <p className="font-medium">{detail.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Legacy Account Details (for backward compatibility) */}
          {!listing.account_details?.length && (listing.account_level || listing.account_rank || listing.account_features) && (
            <div>
              <h2 className="text-xl font-heading font-semibold mb-3">Account Details</h2>
              <div className="grid grid-cols-2 gap-4">
                {listing.account_level && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Level</p>
                    <p className="font-medium">{listing.account_level}</p>
                  </div>
                )}
                {listing.account_rank && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Rank</p>
                    <p className="font-medium">{listing.account_rank}</p>
                  </div>
                )}
              </div>
              {listing.account_features && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Features</p>
                  <p className="text-sm">{listing.account_features}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Seller Reviews */}
          {sellerReviews.length > 0 && (
            <div>
              <h2 className="text-xl font-heading font-semibold mb-3">Recent Reviews</h2>
              <div className="space-y-3">
                {sellerReviews.map((review) => (
                  <div key={review.id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        by {review.reviewer_username || 'Buyer'}
                      </span>
                    </div>
                    {review.comment && <p className="text-sm">{review.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Price Card */}
          <Card className="border-primary/50">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-primary mb-4">
                {formatCurrency(listing.price_usd, currency, usdToBdtRate)}
              </div>
              
              {!isOwner && (
                <div className="space-y-3">
                  <Button
                    onClick={handleBuy}
                    className="w-full neon-glow font-bold"
                    disabled={buying}
                    data-testid="buy-now-btn"
                  >
                    {buying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Buy Now
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleContact}
                    className="w-full"
                    data-testid="contact-seller-btn"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contact Seller
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-primary" />
                Secure escrow protection
              </div>
            </CardContent>
          </Card>
          
          {/* Seller Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seller</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                to={`/seller/${listing.seller?.id}`}
                className="flex items-center gap-3 hover:text-primary transition-colors"
                data-testid="seller-profile-link"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{listing.seller?.username}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${getSellerLevelBadge(listing.seller?.seller_level)}`}>
                      {listing.seller?.seller_level}
                    </span>
                    {listing.seller?.kyc_status === 'approved' && (
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
              
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 bg-muted/50 rounded text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold">{listing.seller?.seller_rating?.toFixed(1) || '0.0'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{listing.seller?.total_reviews || 0} reviews</p>
                </div>
                <div className="p-2 bg-muted/50 rounded text-center">
                  <p className="font-semibold">{formatCurrency(listing.seller?.total_sales_volume_usd || 0, 'USD')}</p>
                  <p className="text-xs text-muted-foreground">Total sales</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
