import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Gamepad2, Search, Bell, ShoppingCart, ChevronRight, Shield, 
  Verified, ArrowRight, Grid3X3, Flame, Home, MessageCircle, 
  User, Plus, Globe, AtSign, MessageSquare
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuthStore, useCurrencyStore } from '../store';
import { listingsAPI, gamesAPI } from '../lib/api';
import { formatCurrency, truncateText } from '../lib/utils';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { currency, usdToBdtRate } = useCurrencyStore();
  const [featuredListings, setFeaturedListings] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listingsByGame, setListingsByGame] = useState({});
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [listingsRes, gamesRes] = await Promise.all([
          listingsAPI.getAll({ page: 1, page_size: 20 }),
          gamesAPI.getAll(),
        ]);
        setFeaturedListings(listingsRes?.listings || []);
        setGames(gamesRes?.games || gamesRes || []);
        
        // Group listings by game
        const grouped = {};
        (listingsRes?.listings || []).forEach(listing => {
          const gameId = listing.game_id;
          if (!grouped[gameId]) grouped[gameId] = [];
          grouped[gameId].push(listing);
        });
        setListingsByGame(grouped);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatPrice = (price) => {
    if (currency === 'BDT') {
      return `৳${(price * usdToBdtRate).toFixed(0)}`;
    }
    return `$${price?.toFixed(2) || '0.00'}`;
  };

  // Game color mapping for visual variety
  const gameColors = {
    'valorant': { bg: 'bg-[#FF4655]/20', text: 'text-[#FF4655]', border: 'border-[#FF4655]/20' },
    'league': { bg: 'bg-[#C1A87D]/20', text: 'text-[#C1A87D]', border: 'border-[#C1A87D]/20' },
    'fortnite': { bg: 'bg-[#9D4DFF]/20', text: 'text-[#9D4DFF]', border: 'border-[#9D4DFF]/20' },
    'csgo': { bg: 'bg-[#F7A800]/20', text: 'text-[#F7A800]', border: 'border-[#F7A800]/20' },
    'default': { bg: 'bg-white/10', text: 'text-white', border: 'border-white/20' },
  };

  const getGameColors = (gameName) => {
    const name = gameName?.toLowerCase() || '';
    if (name.includes('valorant')) return gameColors.valorant;
    if (name.includes('league') || name.includes('lol')) return gameColors.league;
    if (name.includes('fortnite')) return gameColors.fortnite;
    if (name.includes('cs') || name.includes('counter')) return gameColors.csgo;
    return gameColors.default;
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-black text-white font-sans antialiased pb-24 md:pb-0">
      {/* Hero Section */}
      <div className="relative w-full">
        <div className="relative h-[280px] w-full overflow-hidden md:h-[450px]">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&q=80')" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
          </div>
          
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 pb-12">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center rounded-full bg-[#13ec5b]/20 px-3 py-1 text-xs font-bold text-[#13ec5b] backdrop-blur-sm border border-[#13ec5b]/20 w-fit">
                <Flame className="w-3.5 h-3.5 mr-1 fill-current" />
                HOT DEAL
              </div>
              <h2 className="text-3xl md:text-5xl font-bold leading-tight text-white">
                Level Up Your Game<br className="hidden md:block" /> Rank Today
              </h2>
              <p className="text-sm md:text-lg text-zinc-400 max-w-[80%]">
                Secure escrow &amp; instant delivery on top-tier accounts with rare skins.
              </p>
              <div className="flex gap-3 pt-2">
                <Button 
                  onClick={() => navigate('/browse')}
                  className="bg-[#13ec5b] text-black hover:bg-[#13ec5b]/90 shadow-[0_0_20px_rgba(19,236,91,0.4)] hover:shadow-[0_0_30px_rgba(19,236,91,0.6)] font-bold px-6 py-3"
                  data-testid="browse-listings-btn"
                >
                  Browse Listings
                </Button>
                <Button 
                  variant="ghost"
                  className="bg-white/10 text-white hover:bg-white/20 backdrop-blur-md font-bold px-6 py-3"
                >
                  How It Works
                </Button>
              </div>
            </div>
          </div>
          
          {/* Carousel Indicators */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            <div className="h-1.5 w-6 rounded-full bg-[#13ec5b] shadow-[0_0_10px_rgba(19,236,91,0.6)]"></div>
            <div className="h-1.5 w-1.5 rounded-full bg-white/30"></div>
            <div className="h-1.5 w-1.5 rounded-full bg-white/30"></div>
          </div>
        </div>
      </div>

      {/* Game Sections */}
      <div className="space-y-8 py-8">
        {games.slice(0, 3).map((game) => {
          const gameListings = listingsByGame[game.id] || featuredListings.slice(0, 3);
          const colors = getGameColors(game.name);
          
          if (gameListings.length === 0) return null;
          
          return (
            <div key={game.id} className="flex flex-col gap-4">
              {/* Section Header */}
              <div className="px-4 md:px-8 flex justify-between items-end">
                <div className="flex items-center gap-3">
                  <div className={`flex size-10 items-center justify-center rounded-lg ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {game.icon_url ? (
                      <img src={game.icon_url} alt={game.name} className="w-6 h-6" />
                    ) : (
                      <span className="font-bold text-lg">{game.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{game.name}</h3>
                    <p className="text-xs text-zinc-500">{game.description || 'Premium accounts available'}</p>
                  </div>
                </div>
                <Link 
                  to={`/browse?game=${game.id}`}
                  className="flex items-center text-xs font-bold text-[#13ec5b] hover:text-white transition-colors uppercase tracking-wider"
                >
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
              
              {/* Horizontal Scroll Cards */}
              <div className="flex w-full overflow-x-auto no-scrollbar px-4 md:px-8 pb-4">
                <div className="flex gap-4">
                  {gameListings.slice(0, 4).map((listing) => (
                    <ListingCard 
                      key={listing.id} 
                      listing={listing} 
                      formatPrice={formatPrice}
                      onClick={() => navigate(`/listing/${listing.id}`)}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* Other Games Section */}
        {featuredListings.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="px-4 md:px-8 flex justify-between items-end">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-white/10 text-white border border-white/20">
                  <Grid3X3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Featured Listings</h3>
                  <p className="text-xs text-zinc-500">Handpicked top accounts</p>
                </div>
              </div>
              <Link 
                to="/browse"
                className="flex items-center text-xs font-bold text-[#13ec5b] hover:text-white transition-colors uppercase tracking-wider"
              >
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
            
            <div className="flex w-full overflow-x-auto no-scrollbar px-4 md:px-8 pb-4">
              <div className="flex gap-4">
                {featuredListings.slice(0, 6).map((listing) => (
                  <ListingCard 
                    key={listing.id} 
                    listing={listing} 
                    formatPrice={formatPrice}
                    onClick={() => navigate(`/listing/${listing.id}`)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Features Section */}
      <section className="px-4 md:px-8 py-12 border-t border-white/5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-[#13ec5b]/20 flex items-center justify-center mb-3">
              <Shield className="w-6 h-6 text-[#13ec5b]" />
            </div>
            <h4 className="font-bold text-white mb-1">Secure Escrow</h4>
            <p className="text-xs text-zinc-500">Protected payments</p>
          </div>
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3">
              <Verified className="w-6 h-6 text-blue-500" />
            </div>
            <h4 className="font-bold text-white mb-1">Verified Sellers</h4>
            <p className="text-xs text-zinc-500">Trusted accounts</p>
          </div>
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-3">
              <MessageCircle className="w-6 h-6 text-purple-500" />
            </div>
            <h4 className="font-bold text-white mb-1">Instant Chat</h4>
            <p className="text-xs text-zinc-500">Real-time messaging</p>
          </div>
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mb-3">
              <Gamepad2 className="w-6 h-6 text-orange-500" />
            </div>
            <h4 className="font-bold text-white mb-1">All Games</h4>
            <p className="text-xs text-zinc-500">Wide selection</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-zinc-950 px-6 pt-12 pb-24 md:pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[#13ec5b] text-black shadow-[0_0_10px_rgba(19,236,91,0.5)]">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <span className="text-2xl font-bold tracking-tight">PlayTraderz</span>
              </div>
              <p className="text-sm text-zinc-500 mb-6 max-w-xs leading-relaxed">
                The world's most secure marketplace for buying and selling gaming accounts. Verified sellers, instant delivery, and 24/7 support.
              </p>
              <div className="flex gap-3">
                <a href="#" className="flex size-8 items-center justify-center rounded-full bg-white/5 text-zinc-500 hover:bg-[#13ec5b] hover:text-black transition-colors">
                  <Globe className="w-4 h-4" />
                </a>
                <a href="#" className="flex size-8 items-center justify-center rounded-full bg-white/5 text-zinc-500 hover:bg-[#13ec5b] hover:text-black transition-colors">
                  <AtSign className="w-4 h-4" />
                </a>
                <a href="#" className="flex size-8 items-center justify-center rounded-full bg-white/5 text-zinc-500 hover:bg-[#13ec5b] hover:text-black transition-colors">
                  <MessageSquare className="w-4 h-4" />
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-[#13ec5b] transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-[#13ec5b] transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-[#13ec5b] transition-colors">Press Kit</a></li>
                <li><a href="#" className="hover:text-[#13ec5b] transition-colors">Blog</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-white mb-4">Support</h4>
              <ul className="space-y-3 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-[#13ec5b] transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-[#13ec5b] transition-colors">Safety Guide</a></li>
                <li><a href="#" className="hover:text-[#13ec5b] transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-[#13ec5b] transition-colors">Report Fraud</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-zinc-500">
                <li><Link to="/terms" className="hover:text-[#13ec5b] transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-[#13ec5b] transition-colors">Privacy Policy</Link></li>
                <li><a href="#" className="hover:text-[#13ec5b] transition-colors">Cookie Policy</a></li>
                <li><a href="#" className="hover:text-[#13ec5b] transition-colors">Escrow Rules</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-xs text-zinc-500 text-center md:text-left">© 2024 PlayTraderz Inc. All rights reserved.</p>
            <div className="flex items-center gap-3 opacity-60 grayscale hover:grayscale-0 transition-all">
              <div className="h-6 w-10 bg-white/10 rounded flex items-center justify-center"><span className="text-[8px] font-bold">VISA</span></div>
              <div className="h-6 w-10 bg-white/10 rounded flex items-center justify-center"><span className="text-[8px] font-bold">MC</span></div>
              <div className="h-6 w-10 bg-white/10 rounded flex items-center justify-center"><span className="text-[8px] font-bold">PAYPAL</span></div>
              <div className="h-6 w-10 bg-white/10 rounded flex items-center justify-center"><span className="text-[8px] font-bold">CRYPTO</span></div>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-black/95 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-around px-2 py-3">
          <button 
            onClick={() => navigate('/')}
            className="flex flex-col items-center gap-1 p-2 text-[#13ec5b]"
          >
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <button 
            onClick={() => navigate('/browse')}
            className="flex flex-col items-center gap-1 p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <Search className="w-6 h-6" />
            <span className="text-[10px] font-medium">Search</span>
          </button>
          <button 
            onClick={() => navigate(isAuthenticated ? '/seller/listings/new' : '/login')}
            className="flex flex-col items-center gap-1 p-2 -mt-6"
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-[#13ec5b] shadow-[0_0_15px_rgba(19,236,91,0.5)] text-black">
              <Plus className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-medium text-zinc-500 mt-1">Sell</span>
          </button>
          <button 
            onClick={() => navigate('/chat')}
            className="flex flex-col items-center gap-1 p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <div className="relative">
              <MessageCircle className="w-6 h-6" />
              <span className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">2</span>
            </div>
            <span className="text-[10px] font-medium">Chat</span>
          </button>
          <button 
            onClick={() => navigate(isAuthenticated ? '/profile' : '/login')}
            className="flex flex-col items-center gap-1 p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <User className="w-6 h-6" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
        <div className="h-1 w-full"></div>
      </nav>

      {/* Custom scrollbar hide style */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

// Listing Card Component
function ListingCard({ listing, formatPrice, onClick }) {
  const badges = [];
  
  if (listing.seller?.is_verified) badges.push({ text: 'Verified', color: 'text-[#13ec5b]', icon: true });
  if (listing.instant_delivery) badges.push({ text: 'Instant Delivery', color: 'text-zinc-400' });
  
  return (
    <div 
      onClick={onClick}
      className="group relative w-[260px] flex-none overflow-hidden rounded-xl bg-zinc-900 border border-white/5 hover:border-[#13ec5b]/50 transition-colors cursor-pointer"
      data-testid={`listing-card-${listing.id}`}
    >
      {/* Image */}
      <div className="relative aspect-video w-full bg-zinc-800 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
          style={{ 
            backgroundImage: listing.images?.[0] 
              ? `url('${listing.images[0]}')` 
              : `url('https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80')` 
          }}
        />
        {listing.featured && (
          <div className="absolute top-2 left-2 rounded bg-[#13ec5b] px-2 py-0.5 text-[10px] font-bold text-black">
            INSTANT
          </div>
        )}
        {listing.platform && (
          <div className="absolute top-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[10px] font-bold text-zinc-300 border border-white/10">
            {listing.platform.name || listing.platform}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <h4 className="text-sm font-bold text-white line-clamp-1">{listing.title}</h4>
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
          {listing.seller?.is_verified && (
            <>
              <span className="flex items-center gap-1">
                <Verified className="w-3.5 h-3.5 text-[#13ec5b]" />
                Verified
              </span>
              <span>•</span>
            </>
          )}
          <span>{listing.game?.name || 'Gaming'}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
          <span className="text-lg font-bold text-white">{formatPrice(listing.price_usd)}</span>
          <button 
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="rounded-lg bg-white/5 p-1.5 text-zinc-500 hover:bg-[#13ec5b] hover:text-black transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
