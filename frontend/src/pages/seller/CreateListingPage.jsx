import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, Upload, X, Plus, Loader2, AlertCircle, Image, 
  Video, Trash2, Info, CheckCircle
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { gamesAPI, listingsAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

const MAX_IMAGES = 5;
const MAX_ACCOUNT_DETAILS = 10;
const RECOMMENDED_IMAGE_SIZE = '1280x720px (16:9 ratio)';

export default function CreateListingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const fileInputRef = useRef(null);
  
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  
  const [formData, setFormData] = useState({
    game_id: '',
    title: '',
    description: '',
    price_usd: '',
    platforms: [],
    regions: [],
    video_url: '',
    account_details: [{ label: '', value: '' }],
    images: []
  });
  
  const [imagePreviews, setImagePreviews] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const data = await gamesAPI.list();
      setGames(data.games || []);
    } catch (error) {
      toast.error('Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  const handleGameChange = (gameId) => {
    const game = games.find(g => g.id === gameId);
    setSelectedGame(game);
    setFormData(prev => ({
      ...prev,
      game_id: gameId,
      platforms: [],
      regions: []
    }));
  };

  const handlePlatformToggle = (platform) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
  };

  const handleRegionToggle = (region) => {
    setFormData(prev => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter(r => r !== region)
        : [...prev.regions, region]
    }));
  };

  const handleAccountDetailChange = (index, field, value) => {
    const newDetails = [...formData.account_details];
    newDetails[index] = { ...newDetails[index], [field]: value };
    setFormData(prev => ({ ...prev, account_details: newDetails }));
  };

  const addAccountDetail = () => {
    if (formData.account_details.length >= MAX_ACCOUNT_DETAILS) {
      toast.error(`Maximum ${MAX_ACCOUNT_DETAILS} account details allowed`);
      return;
    }
    setFormData(prev => ({
      ...prev,
      account_details: [...prev.account_details, { label: '', value: '' }]
    }));
  };

  const removeAccountDetail = (index) => {
    if (formData.account_details.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      account_details: prev.account_details.filter((_, i) => i !== index)
    }));
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const remainingSlots = MAX_IMAGES - formData.images.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    
    const filesToUpload = files.slice(0, remainingSlots);
    setUploadingImages(true);
    
    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        // Validate file
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image`);
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} exceeds 5MB limit`);
        }
        
        // Create preview
        const preview = URL.createObjectURL(file);
        
        // Upload to server
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/upload/listing`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formDataUpload
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Upload failed');
        }
        
        const data = await response.json();
        return { url: data.data.url, preview };
      });
      
      const results = await Promise.all(uploadPromises);
      
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...results.map(r => r.url)]
      }));
      setImagePreviews(prev => [...prev, ...results.map(r => r.preview)]);
      
      toast.success(`${results.length} image(s) uploaded`);
    } catch (error) {
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.game_id) newErrors.game_id = 'Please select a game';
    if (!formData.title || formData.title.length < 5) newErrors.title = 'Title must be at least 5 characters';
    if (!formData.description || formData.description.length < 20) newErrors.description = 'Description must be at least 20 characters';
    if (!formData.price_usd || parseFloat(formData.price_usd) <= 0) newErrors.price_usd = 'Price must be greater than 0';
    if (!formData.platforms.length) newErrors.platforms = 'Select at least one platform';
    if (!formData.regions.length) newErrors.regions = 'Select at least one region';
    if (!formData.video_url) newErrors.video_url = 'Video URL is required';
    
    // Validate account details
    const validDetails = formData.account_details.filter(d => d.label.trim() && d.value.trim());
    if (validDetails.length === 0) {
      newErrors.account_details = 'Add at least one account detail';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Filter out empty account details
      const validDetails = formData.account_details.filter(d => d.label.trim() && d.value.trim());
      
      const payload = {
        ...formData,
        price_usd: parseFloat(formData.price_usd),
        account_details: validDetails
      };
      
      await listingsAPI.create(payload);
      toast.success('Listing created successfully!');
      navigate('/seller/listings');
    } catch (error) {
      toast.error(error.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
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

  // Get platforms from selected game
  const availablePlatforms = selectedGame?.platforms?.map(p => p.platform_name) || [];
  const availableRegions = selectedGame?.regions || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Listing</h1>
        <p className="text-muted-foreground">
          List your game account for sale. All listings are reviewed before going live.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Game Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Game Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="game">Select Game *</Label>
              <Select value={formData.game_id} onValueChange={handleGameChange}>
                <SelectTrigger className={errors.game_id ? 'border-red-500' : ''} data-testid="game-select">
                  <SelectValue placeholder="Choose a game" />
                </SelectTrigger>
                <SelectContent>
                  {games.map(game => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.game_id && <p className="text-sm text-red-500">{errors.game_id}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Platform & Region */}
        {selectedGame && (
          <Card>
            <CardHeader>
              <CardTitle>Platform & Region</CardTitle>
              <CardDescription>Select where this account can be used</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Platforms */}
              <div className="space-y-3">
                <Label>Platforms * {errors.platforms && <span className="text-red-500 text-sm ml-2">{errors.platforms}</span>}</Label>
                <div className="flex flex-wrap gap-2">
                  {availablePlatforms.length > 0 ? (
                    availablePlatforms.map(platform => (
                      <Button
                        key={platform}
                        type="button"
                        variant={formData.platforms.includes(platform) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePlatformToggle(platform)}
                        data-testid={`platform-${platform}`}
                      >
                        {formData.platforms.includes(platform) && <CheckCircle className="w-4 h-4 mr-1" />}
                        {platform}
                      </Button>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No platforms configured for this game</p>
                  )}
                </div>
              </div>

              {/* Regions */}
              <div className="space-y-3">
                <Label>Regions * {errors.regions && <span className="text-red-500 text-sm ml-2">{errors.regions}</span>}</Label>
                <div className="flex flex-wrap gap-2">
                  {availableRegions.length > 0 ? (
                    availableRegions.map(region => (
                      <Button
                        key={region}
                        type="button"
                        variant={formData.regions.includes(region) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleRegionToggle(region)}
                        data-testid={`region-${region}`}
                      >
                        {formData.regions.includes(region) && <CheckCircle className="w-4 h-4 mr-1" />}
                        {region}
                      </Button>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No regions configured for this game</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Listing Details */}
        <Card>
          <CardHeader>
            <CardTitle>Listing Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Level 100 Account with Rare Skins"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className={errors.title ? 'border-red-500' : ''}
                data-testid="title-input"
              />
              {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe your account in detail. Include information about rare items, achievements, stats, etc."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className={`min-h-[120px] ${errors.description ? 'border-red-500' : ''}`}
                data-testid="description-input"
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (USD) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.price_usd}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_usd: e.target.value }))}
                  className={`pl-8 ${errors.price_usd ? 'border-red-500' : ''}`}
                  data-testid="price-input"
                />
              </div>
              {errors.price_usd && <p className="text-sm text-red-500">{errors.price_usd}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Video URL */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Account Video *
            </CardTitle>
            <CardDescription>
              Provide a video link showing your account. This helps verify the account and builds buyer trust.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="video_url">Video URL (YouTube, Vimeo, Streamable, etc.) *</Label>
              <Input
                id="video_url"
                placeholder="https://youtube.com/watch?v=... or https://streamable.com/..."
                value={formData.video_url}
                onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                className={errors.video_url ? 'border-red-500' : ''}
                data-testid="video-url-input"
              />
              {errors.video_url && <p className="text-sm text-red-500">{errors.video_url}</p>}
              <p className="text-xs text-muted-foreground">
                Supported: YouTube, Vimeo, Twitch, Streamable, Google Drive, Dropbox
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Account Details
            </CardTitle>
            <CardDescription>
              Add specific details about your account (up to {MAX_ACCOUNT_DETAILS} items)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.account_details && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.account_details}</AlertDescription>
              </Alert>
            )}
            
            {formData.account_details.map((detail, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="Label (e.g., Account Level)"
                    value={detail.label}
                    onChange={(e) => handleAccountDetailChange(index, 'label', e.target.value)}
                    data-testid={`detail-label-${index}`}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="Value (e.g., 100)"
                    value={detail.value}
                    onChange={(e) => handleAccountDetailChange(index, 'value', e.target.value)}
                    data-testid={`detail-value-${index}`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAccountDetail(index)}
                  disabled={formData.account_details.length <= 1}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            {formData.account_details.length < MAX_ACCOUNT_DETAILS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAccountDetail}
                className="w-full"
                data-testid="add-detail-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Detail
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5 text-primary" />
              Screenshots
            </CardTitle>
            <CardDescription>
              Upload up to {MAX_IMAGES} images. Recommended size: {RECOMMENDED_IMAGE_SIZE}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group aspect-video rounded-lg overflow-hidden border border-border">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <Badge className="absolute bottom-2 left-2 bg-black/70" variant="secondary">
                        {index + 1}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Upload Area */}
              {formData.images.length < MAX_IMAGES && (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    uploadingImages ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    {uploadingImages ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-10 h-10 text-muted-foreground" />
                        <p className="text-sm font-medium">Click to upload images</p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, WEBP up to 5MB each • {MAX_IMAGES - formData.images.length} remaining
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Recommended: {RECOMMENDED_IMAGE_SIZE}
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/seller/listings')}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="flex-1"
            data-testid="submit-listing-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Listing'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
