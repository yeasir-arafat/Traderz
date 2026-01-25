import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Wallet, MessageCircle, Star, Gamepad2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { useAuthStore, useCurrencyStore } from '../store';
import { listingsAPI, gamesAPI } from '../lib/api';
import { formatCurrency, getSellerLevelBadge, truncateText } from '../lib/utils';

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  const [featuredListings, setFeaturedListings] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [listingsRes, gamesRes] = await Promise.all([
          listingsAPI.getAll({ page: 1, page_size: 8 }),
          gamesAPI.getAll(),
        ]);
        setFeaturedListings(listingsRes?.listings || []);
        setGames(gamesRes?.games || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  
  const features = [
    {
      icon: Shield,
      title: 'Secure Escrow',
      description: 'Your payment is protected until you confirm delivery',
    },
    {
      icon: Wallet,
      title: 'Multi-Currency',
      description: 'Trade in USD or BDT with real-time rates',
    },
    {
      icon: MessageCircle,
      title: 'Real-time Chat',
      description: 'Communicate directly with sellers instantly',
    },
    {
      icon: Star,
      title: 'Trusted Sellers',
      description: 'Verified sellers with ratings and reviews',
    },
  ];
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1728330458318-70438beffc44?w=1920&q=80"
            alt="Gaming background"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-heading font-bold tracking-tight uppercase mb-6">
              <span className="text-primary neon-text">Trade</span> Game Accounts
              <br />
              <span className="text-secondary">Securely</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl">
              The premier marketplace for buying and selling game accounts. Secure escrow, verified sellers, instant chat.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                onClick={() => navigate('/browse')}
                className="neon-glow font-bold uppercase tracking-wide"
                data-testid="browse-listings-btn"
              >
                Browse Listings
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              {!isAuthenticated && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/register')}
                  className="font-bold uppercase tracking-wide"
                  data-testid="get-started-btn"
                >
                  Get Started
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
      
      {/* Features */}
      <section className="py-16 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group border-border/50 bg-card/50 hover:border-primary/50 transition-all duration-300"
              >
                <CardContent className="p-6 text-center">
                  <feature.icon className="w-10 h-10 mx-auto mb-4 text-primary group-hover:scale-110 transition-transform" />
                  <h3 className="font-heading font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* Games */}
      <section className="py-16 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-heading font-bold">Popular Games</h2>
            <Link to="/browse" className="text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {games.slice(0, 8).map((game) => (
              <Link
                key={game.id}
                to={`/browse?game=${game.id}`}
                className="group flex flex-col items-center p-4 rounded-lg border border-border/50 bg-card/50 hover:border-primary/50 transition-all"
                data-testid={`game-${game.slug}`}
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Gamepad2 className="w-8 h-8 text-primary" />
                </div>
                <span className="text-sm font-medium text-center">{game.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      
      {/* Featured Listings */}
      <section className="py-16 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-heading font-bold">Featured Listings</h2>
            <Link to="/browse" className="text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="aspect-video bg-muted" />
                  <CardContent className="p-4 space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-6 bg-muted rounded w-1/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : featuredListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredListings.map((listing) => (
                <Link
                  key={listing.id}
                  to={`/listing/${listing.id}`}
                  className="group"
                  data-testid={`listing-${listing.id}`}
                >
                  <Card className="overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {listing.images?.[0] ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Gamepad2 className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                        {truncateText(listing.title, 40)}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        {listing.game?.name || 'Game'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(listing.price_usd, currency, usdToBdtRate)}
                        </span>
                        {listing.seller && (
                          <span className={`text-xs px-2 py-0.5 rounded border ${getSellerLevelBadge(listing.seller.seller_level)}`}>
                            {listing.seller.seller_level}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No listings available yet. Be the first to sell!
            </div>
          )}
        </div>
      </section>
      
      {/* CTA */}
      {!isAuthenticated && (
        <section className="py-20 border-t border-border/50">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Ready to Start Trading?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Join thousands of gamers buying and selling accounts securely.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/register')}
              className="neon-glow font-bold uppercase tracking-wide"
              data-testid="cta-signup-btn"
            >
              Create Free Account
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
