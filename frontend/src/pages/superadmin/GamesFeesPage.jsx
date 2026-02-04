import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Layers, Loader2, Plus, ToggleLeft, ToggleRight, Edit, Trash2, 
  Upload, X, Save, Monitor, Globe, Image as ImageIcon
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { gamesAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

const DEFAULT_PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile', 'iOS', 'Android'];
const DEFAULT_REGIONS = ['Global', 'North America', 'Europe', 'Asia', 'South America', 'Oceania', 'SEA', 'Middle East'];

export default function GamesFeesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [savingGame, setSavingGame] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [games, setGames] = useState([]);
  const [feeRules, setFeeRules] = useState([]);
  
  // New game form
  const [newGame, setNewGame] = useState({
    name: '',
    slug: '',
    image_url: '',
    buyer_note_html: '',
    platforms: [],
    regions: [],
  });
  const [newImagePreview, setNewImagePreview] = useState(null);

  // Edit game modal
  const [editingGame, setEditingGame] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const isSuperAdmin = user?.roles?.includes('super_admin');

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
    loadData();
  }, [isAuthenticated, isSuperAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [gamesData, rulesData] = await Promise.all([
        gamesAPI.getAll(true),
        gamesAPI.getFeeRules(),
      ]);
      setGames(gamesData.games || gamesData || []);
      setFeeRules(rulesData.rules || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load games/fee rules');
    } finally {
      setLoading(false);
    }
  };

  // Image upload handler
  const handleImageUpload = async (file, isEdit = false) => {
    if (!file) return null;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return null;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return null;
    }
    
    setUploadingImage(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/upload/listing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      const imageUrl = data.data.url;
      
      // Set preview
      const preview = URL.createObjectURL(file);
      if (isEdit) {
        setEditImagePreview(preview);
        setEditForm(prev => ({ ...prev, image_url: imageUrl }));
      } else {
        setNewImagePreview(preview);
        setNewGame(prev => ({ ...prev, image_url: imageUrl }));
      }
      
      toast.success('Image uploaded');
      return imageUrl;
    } catch (error) {
      toast.error('Failed to upload image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleNewImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file, false);
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file, true);
  };

  const togglePlatform = (platform, isEdit = false) => {
    if (isEdit) {
      setEditForm(prev => ({
        ...prev,
        platforms: prev.platforms?.includes(platform)
          ? prev.platforms.filter(p => p !== platform)
          : [...(prev.platforms || []), platform]
      }));
    } else {
      setNewGame(prev => ({
        ...prev,
        platforms: prev.platforms.includes(platform)
          ? prev.platforms.filter(p => p !== platform)
          : [...prev.platforms, platform]
      }));
    }
  };

  const toggleRegion = (region, isEdit = false) => {
    if (isEdit) {
      setEditForm(prev => ({
        ...prev,
        regions: prev.regions?.includes(region)
          ? prev.regions.filter(r => r !== region)
          : [...(prev.regions || []), region]
      }));
    } else {
      setNewGame(prev => ({
        ...prev,
        regions: prev.regions.includes(region)
          ? prev.regions.filter(r => r !== region)
          : [...prev.regions, region]
      }));
    }
  };

  const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleCreateGame = async () => {
    if (!newGame.name) {
      toast.error('Game name is required');
      return;
    }
    if (!newGame.slug) {
      toast.error('Slug is required');
      return;
    }
    if (newGame.platforms.length === 0) {
      toast.error('Select at least one platform');
      return;
    }
    if (newGame.regions.length === 0) {
      toast.error('Select at least one region');
      return;
    }
    
    setSavingGame(true);
    try {
      const created = await gamesAPI.create(newGame);
      setGames(prev => [...prev, created]);
      setNewGame({ name: '', slug: '', image_url: '', buyer_note_html: '', platforms: [], regions: [] });
      setNewImagePreview(null);
      toast.success('Game created successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to create game');
    } finally {
      setSavingGame(false);
    }
  };

  const openEditModal = (game) => {
    setEditingGame(game);
    setEditForm({
      name: game.name,
      slug: game.slug,
      image_url: game.image_url || '',
      buyer_note_html: game.buyer_note_html || '',
      platforms: game.platforms?.map(p => p.platform_name) || [],
      regions: game.regions || [],
      is_active: game.is_active,
    });
    setEditImagePreview(game.image_url || null);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name || !editForm.slug) {
      toast.error('Name and slug are required');
      return;
    }
    
    setSavingEdit(true);
    try {
      const updated = await gamesAPI.update(editingGame.id, editForm);
      setGames(prev => prev.map(g => g.id === editingGame.id ? updated : g));
      setEditingGame(null);
      toast.success('Game updated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to update game');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleGameActive = async (game) => {
    setSavingGame(true);
    try {
      const updated = await gamesAPI.update(game.id, { is_active: !game.is_active });
      setGames(prev => prev.map(g => g.id === game.id ? updated : g));
      toast.success(`Game ${updated.is_active ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update game');
    } finally {
      setSavingGame(false);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl" data-testid="games-fees-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Layers className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Games & Fees</h1>
            <p className="text-sm text-muted-foreground">
              Manage games, platforms, regions, and fee rules.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Reload
        </Button>
      </div>

      {/* Add New Game */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New Game
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Game Name *</Label>
              <Input
                value={newGame.name}
                onChange={(e) => {
                  setNewGame({ 
                    ...newGame, 
                    name: e.target.value,
                    slug: generateSlug(e.target.value)
                  });
                }}
                placeholder="e.g. Valorant"
                data-testid="new-game-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input
                value={newGame.slug}
                onChange={(e) => setNewGame({ ...newGame, slug: e.target.value })}
                placeholder="e.g. valorant"
                data-testid="new-game-slug"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Game Image</Label>
            <div className="flex items-start gap-4">
              <div 
                className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingImage ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : newImagePreview || newGame.image_url ? (
                  <img src={newImagePreview || newGame.image_url} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-1">Upload</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleNewImageChange}
              />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Upload a game icon or cover image. Recommended: 256x256px or 512x512px.
                </p>
                {(newImagePreview || newGame.image_url) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 text-red-500"
                    onClick={() => {
                      setNewImagePreview(null);
                      setNewGame(prev => ({ ...prev, image_url: '' }));
                    }}
                  >
                    <X className="w-4 h-4 mr-1" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Platforms */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Platforms *
            </Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_PLATFORMS.map(platform => (
                <Button
                  key={platform}
                  type="button"
                  variant={newGame.platforms.includes(platform) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => togglePlatform(platform, false)}
                >
                  {platform}
                </Button>
              ))}
            </div>
          </div>

          {/* Regions */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Regions *
            </Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_REGIONS.map(region => (
                <Button
                  key={region}
                  type="button"
                  variant={newGame.regions.includes(region) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleRegion(region, false)}
                >
                  {region}
                </Button>
              ))}
            </div>
          </div>

          {/* Buyer Note */}
          <div className="space-y-2">
            <Label>Buyer Note (HTML - shown on listings)</Label>
            <Textarea
              value={newGame.buyer_note_html}
              onChange={(e) => setNewGame({ ...newGame, buyer_note_html: e.target.value })}
              placeholder="<p>Important information for buyers about this game...</p>"
              className="font-mono text-xs min-h-[100px]"
            />
          </div>

          <Button onClick={handleCreateGame} disabled={savingGame} className="w-full md:w-auto">
            {savingGame && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <Plus className="w-4 h-4 mr-1" />
            Create Game
          </Button>
        </CardContent>
      </Card>

      {/* Games List */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Games ({games.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : games.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No games added yet.</p>
          ) : (
            <div className="space-y-3">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                  data-testid={`game-${game.id}`}
                >
                  {/* Image */}
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {game.image_url ? (
                      <img src={game.image_url} alt={game.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{game.name}</span>
                      <Badge variant="outline" className="text-xs">{game.slug}</Badge>
                      {!game.is_active && (
                        <Badge variant="destructive" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {game.platforms?.slice(0, 3).map(p => (
                        <Badge key={p.platform_name || p} variant="secondary" className="text-xs">
                          {p.platform_name || p}
                        </Badge>
                      ))}
                      {game.platforms?.length > 3 && (
                        <Badge variant="secondary" className="text-xs">+{game.platforms.length - 3}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {game.regions?.length || 0} regions
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(game)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant={game.is_active ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleGameActive(game)}
                      disabled={savingGame}
                    >
                      {game.is_active ? (
                        <ToggleRight className="w-4 h-4 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fee Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Rules ({feeRules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {feeRules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No fee rules configured yet.
            </p>
          ) : (
            <div className="space-y-2">
              {feeRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/40"
                >
                  <div>
                    <p className="font-medium">
                      {rule.game_name || 'All Games'}
                      {rule.platform_name ? ` • ${rule.platform_name}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fee: {rule.fee_percent}% • Seller level: {rule.seller_level || 'Any'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Game Modal */}
      {editingGame && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditingGame(null)}>
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Edit Game: {editingGame.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Game Name *</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    data-testid="edit-game-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug *</Label>
                  <Input
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    data-testid="edit-game-slug"
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Game Image</Label>
                <div className="flex items-start gap-4">
                  <div 
                    className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden"
                    onClick={() => editFileInputRef.current?.click()}
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    ) : editImagePreview || editForm.image_url ? (
                      <img src={editImagePreview || editForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                        <p className="text-xs text-muted-foreground mt-1">Upload</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleEditImageChange}
                  />
                  {(editImagePreview || editForm.image_url) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500"
                      onClick={() => {
                        setEditImagePreview(null);
                        setEditForm(prev => ({ ...prev, image_url: '' }));
                      }}
                    >
                      <X className="w-4 h-4 mr-1" /> Remove
                    </Button>
                  )}
                </div>
              </div>

              {/* Platforms */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Platforms
                </Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_PLATFORMS.map(platform => (
                    <Button
                      key={platform}
                      type="button"
                      variant={editForm.platforms?.includes(platform) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => togglePlatform(platform, true)}
                    >
                      {platform}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Regions */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Regions
                </Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_REGIONS.map(region => (
                    <Button
                      key={region}
                      type="button"
                      variant={editForm.regions?.includes(region) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleRegion(region, true)}
                    >
                      {region}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Buyer Note */}
              <div className="space-y-2">
                <Label>Buyer Note (HTML)</Label>
                <Textarea
                  value={editForm.buyer_note_html}
                  onChange={(e) => setEditForm({ ...editForm, buyer_note_html: e.target.value })}
                  placeholder="<p>Important information...</p>"
                  className="font-mono text-xs min-h-[100px]"
                />
              </div>

              {/* Preview */}
              {editForm.buyer_note_html && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div 
                    className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4"
                    dangerouslySetInnerHTML={{ __html: editForm.buyer_note_html }}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setEditingGame(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  <Save className="w-4 h-4 mr-1" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
