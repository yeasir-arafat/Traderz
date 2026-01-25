import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Upload, X, Loader2, ImageIcon, Save, AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { listingsAPI, gamesAPI, uploadAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

const REGIONS = ['Global', 'North America', 'Europe', 'Asia', 'South America', 'Oceania', 'Middle East'];

export default function CreateListingPage() {
  const navigate = useNavigate();
  const { id } = useParams(); // For edit mode
  const isEditMode = !!id;
  
  const { user, isAuthenticated } = useAuthStore();
  
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    game_id: '',
    title: '',
    description: '',
    price_usd: '',
    platforms: [],
    regions: [],
    account_level: '',
    account_rank: '',
    account_features: '',
    images: [],
  });
  
  const [errors, setErrors] = useState({});
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!user?.roles?.includes('seller')) {
      navigate('/profile');
      toast.error('You need to be a seller to create listings');
      return;
    }
    if (user?.kyc_status !== 'approved') {
      navigate('/kyc');
      toast.error('Complete KYC verification to create listings');
      return;
    }
    
    fetchInitialData();
  }, [isAuthenticated, user, id]);
  
  const fetchInitialData = async () => {
    setInitialLoading(true);
    try {
      // Fetch games
      const gamesData = await gamesAPI.getAll();
      setGames(gamesData.games || []);
      
      // If edit mode, fetch listing
      if (isEditMode) {
        const listing = await listingsAPI.getById(id);
        setFormData({
          game_id: listing.game_id,
          title: listing.title,
          description: listing.description,
          price_usd: listing.price_usd.toString(),
          platforms: listing.platforms || [],
          regions: listing.regions || [],
          account_level: listing.account_level || '',
          account_rank: listing.account_rank || '',
          account_features: listing.account_features || '',
          images: listing.images || [],
        });
        
        // Set selected game for platforms
        const game = (gamesData.games || []).find(g => g.id === listing.game_id);
        setSelectedGame(game || null);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load data');
      navigate('/my-listings');
    } finally {
      setInitialLoading(false);
    }
  };
  
  const handleGameChange = (gameId) => {
    const game = games.find(g => g.id === gameId);
    setSelectedGame(game || null);
    setFormData({ ...formData, game_id: gameId, platforms: [] });
  };
  
  const togglePlatform = (platform) => {
    const newPlatforms = formData.platforms.includes(platform)
      ? formData.platforms.filter(p => p !== platform)
      : [...formData.platforms, platform];
    setFormData({ ...formData, platforms: newPlatforms });
  };
  
  const toggleRegion = (region) => {
    const newRegions = formData.regions.includes(region)
      ? formData.regions.filter(r => r !== region)
      : [...formData.regions, region];
    setFormData({ ...formData, regions: newRegions });
  };
  
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    if (formData.images.length + files.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }
    
    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const result = await uploadAPI.uploadListing(file);
        uploadedUrls.push(result.url);
      }
      setFormData({ ...formData, images: [...formData.images, ...uploadedUrls] });
      toast.success('Images uploaded successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };
  
  const removeImage = (index) => {
    const newImages = [...formData.images];
    newImages.splice(index, 1);
    setFormData({ ...formData, images: newImages });
  };
  
  const validate = () => {
    const newErrors = {};
    
    if (!formData.game_id) newErrors.game_id = 'Game is required';
    if (!formData.title || formData.title.length < 5) newErrors.title = 'Title must be at least 5 characters';
    if (!formData.description || formData.description.length < 20) newErrors.description = 'Description must be at least 20 characters';
    if (!formData.price_usd || parseFloat(formData.price_usd) <= 0) newErrors.price_usd = 'Valid price is required';
    if (formData.platforms.length === 0) newErrors.platforms = 'Select at least one platform';
    if (formData.regions.length === 0) newErrors.regions = 'Select at least one region';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        ...formData,
        price_usd: parseFloat(formData.price_usd),
      };
      
      if (isEditMode) {
        await listingsAPI.update(id, payload);
        toast.success('Listing updated successfully');
      } else {
        await listingsAPI.create(payload);
        toast.success('Listing created! It will be reviewed shortly.');
      }
      navigate('/my-listings');
    } catch (error) {
      toast.error(error.message || 'Failed to save listing');
    } finally {
      setLoading(false);
    }
  };
  
  if (initialLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/my-listings')} 
        className="mb-4"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to My Listings
      </Button>
      
      <h1 className="text-3xl font-heading font-bold mb-8">
        {isEditMode ? 'Edit Listing' : 'Create New Listing'}
      </h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Game Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Game Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="game">Game *</Label>
                <Select 
                  value={formData.game_id} 
                  onValueChange={handleGameChange}
                  disabled={isEditMode}
                >
                  <SelectTrigger className={errors.game_id ? 'border-red-500' : ''} data-testid="game-select">
                    <SelectValue placeholder="Select a game" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((game) => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.game_id && <p className="text-sm text-red-500 mt-1">{errors.game_id}</p>}
              </div>
              
              {selectedGame && selectedGame.platforms?.length > 0 && (
                <div>
                  <Label>Platforms *</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedGame.platforms.map((platform) => (
                      <Badge
                        key={platform.id}
                        variant={formData.platforms.includes(platform.name) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => togglePlatform(platform.name)}
                        data-testid={`platform-${platform.name}`}
                      >
                        {platform.name}
                      </Badge>
                    ))}
                  </div>
                  {errors.platforms && <p className="text-sm text-red-500 mt-1">{errors.platforms}</p>}
                </div>
              )}
              
              <div>
                <Label>Regions *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {REGIONS.map((region) => (
                    <Badge
                      key={region}
                      variant={formData.regions.includes(region) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleRegion(region)}
                      data-testid={`region-${region}`}
                    >
                      {region}
                    </Badge>
                  ))}
                </div>
                {errors.regions && <p className="text-sm text-red-500 mt-1">{errors.regions}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Listing Details */}
        <Card>
          <CardHeader>
            <CardTitle>Listing Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Level 100 Account with Rare Items"
                className={errors.title ? 'border-red-500' : ''}
                data-testid="title-input"
              />
              {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title}</p>}
            </div>
            
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the account in detail - what's included, special items, progress, etc."
                rows={5}
                className={errors.description ? 'border-red-500' : ''}
                data-testid="description-input"
              />
              {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description}</p>}
            </div>
            
            <div>
              <Label htmlFor="price">Price (USD) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_usd}
                onChange={(e) => setFormData({ ...formData, price_usd: e.target.value })}
                placeholder="0.00"
                className={errors.price_usd ? 'border-red-500' : ''}
                data-testid="price-input"
              />
              {errors.price_usd && <p className="text-sm text-red-500 mt-1">{errors.price_usd}</p>}
            </div>
          </CardContent>
        </Card>
        
        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="account_level">Account Level</Label>
                <Input
                  id="account_level"
                  value={formData.account_level}
                  onChange={(e) => setFormData({ ...formData, account_level: e.target.value })}
                  placeholder="e.g., 100"
                  data-testid="level-input"
                />
              </div>
              
              <div>
                <Label htmlFor="account_rank">Rank/Tier</Label>
                <Input
                  id="account_rank"
                  value={formData.account_rank}
                  onChange={(e) => setFormData({ ...formData, account_rank: e.target.value })}
                  placeholder="e.g., Diamond, Grandmaster"
                  data-testid="rank-input"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="account_features">Special Features</Label>
              <Textarea
                id="account_features"
                value={formData.account_features}
                onChange={(e) => setFormData({ ...formData, account_features: e.target.value })}
                placeholder="List any special items, skins, achievements, etc."
                rows={3}
                data-testid="features-input"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                {formData.images.map((url, index) => (
                  <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                    <img src={url} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      data-testid={`remove-image-${index}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                
                {formData.images.length < 5 && (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                    {uploading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <ImageIcon className="w-6 h-6 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">Upload</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploading}
                      data-testid="image-upload"
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload up to 5 images. Supported formats: JPG, PNG, WebP, GIF. Max 5MB each.
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Submit */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/my-listings')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1" data-testid="submit-btn">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isEditMode ? 'Update Listing' : 'Create Listing'}
          </Button>
        </div>
        
        {!isEditMode && (
          <p className="text-sm text-muted-foreground text-center">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            Your listing will be reviewed before being published
          </p>
        )}
      </form>
    </div>
  );
}
