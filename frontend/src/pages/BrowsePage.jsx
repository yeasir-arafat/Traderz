import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, Gamepad2, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { listingsAPI, gamesAPI } from '../lib/api';
import { useCurrencyStore } from '../store';
import { formatCurrency, getSellerLevelBadge, truncateText } from '../lib/utils';

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currency, usdToBdtRate } = useCurrencyStore();
  
  const [listings, setListings] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedGame, setSelectedGame] = useState(searchParams.get('game') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
  const [showFilters, setShowFilters] = useState(false);
  
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await gamesAPI.getAll();
        setGames(res?.games || []);
      } catch (error) {
        console.error('Failed to fetch games:', error);
      }
    };
    fetchGames();
  }, []);
  
  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      try {
        const params = {
          page,
          page_size: 20,
          ...(search && { search }),
          ...(selectedGame && selectedGame !== 'all' && { game_id: selectedGame }),
          ...(minPrice && { min_price: parseFloat(minPrice) }),
          ...(maxPrice && { max_price: parseFloat(maxPrice) }),
        };
        const res = await listingsAPI.getAll(params);
        setListings(res?.listings || []);
        setTotal(res?.total || 0);
      } catch (error) {
        console.error('Failed to fetch listings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, [page, search, selectedGame, minPrice, maxPrice]);
  
  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (selectedGame && selectedGame !== 'all') params.set('game', selectedGame);
    if (minPrice) params.set('min_price', minPrice);
    if (maxPrice) params.set('max_price', maxPrice);
    setSearchParams(params);
  };
  
  const clearFilters = () => {
    setSearch('');
    setSelectedGame('all');
    setMinPrice('');
    setMaxPrice('');
    setPage(1);
    setSearchParams({});
  };
  
  const hasFilters = search || (selectedGame && selectedGame !== 'all') || minPrice || maxPrice;
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-heading font-bold">Browse Listings</h1>
        
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search listings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/50"
              data-testid="search-input"
            />
          </div>
          <Button type="submit" data-testid="search-btn">Search</Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden"
          >
            <Filter className="w-4 h-4" />
          </Button>
        </form>
      </div>
      
      {/* Filters */}
      <div className={`mb-8 ${showFilters ? 'block' : 'hidden md:block'}`}>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-full sm:w-auto">
            <label className="text-sm text-muted-foreground mb-1 block">Game</label>
            <Select value={selectedGame} onValueChange={setSelectedGame}>
              <SelectTrigger className="w-full sm:w-48 bg-muted/50" data-testid="game-filter">
                <SelectValue placeholder="All Games" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Games</SelectItem>
                {games.map((game) => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Min Price</label>
              <Input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-24 bg-muted/50"
                data-testid="min-price-input"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Max Price</label>
              <Input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-24 bg-muted/50"
                data-testid="max-price-input"
              />
            </div>
          </div>
          
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>
      
      {/* Results */}
      <div className="text-sm text-muted-foreground mb-4">
        {total} listing{total !== 1 ? 's' : ''} found
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
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
      ) : listings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              to={`/listing/${listing.id}`}
              className="group"
              data-testid={`listing-card-${listing.id}`}
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
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span>{listing.game?.name || 'Game'}</span>
                    {listing.platforms?.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{listing.platforms.join(', ')}</span>
                      </>
                    )}
                  </div>
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
        <div className="text-center py-16">
          <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No listings found</h3>
          <p className="text-muted-foreground mb-4">Try adjusting your filters or search terms</p>
          {hasFilters && (
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
          )}
        </div>
      )}
      
      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button
            variant="outline"
            disabled={page >= Math.ceil(total / 20)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
