import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Loader2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { gamesAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

export default function GamesFeesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [savingGame, setSavingGame] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [games, setGames] = useState([]);
  const [feeRules, setFeeRules] = useState([]);
  const [newGame, setNewGame] = useState({
    name: '',
    slug: '',
    description: '',
    image_url: '',
  });

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

  const handleCreateGame = async () => {
    if (!newGame.name || !newGame.slug) {
      toast.error('Name and slug are required for a new game');
      return;
    }
    setSavingGame(true);
    try {
      const created = await gamesAPI.create(newGame);
      setGames((prev) => [...prev, created]);
      setNewGame({ name: '', slug: '', description: '', image_url: '' });
      toast.success('Game created');
    } catch (error) {
      toast.error(error.message || 'Failed to create game');
    } finally {
      setSavingGame(false);
    }
  };

  const toggleGameActive = async (game) => {
    setSavingGame(true);
    try {
      const updated = await gamesAPI.update(game.id, { is_active: !game.is_active });
      setGames((prev) => prev.map((g) => (g.id === game.id ? updated : g)));
      toast.success(`Game ${updated.is_active ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update game');
    } finally {
      setSavingGame(false);
    }
  };

  const addDefaultFeeRule = async (game) => {
    setSavingRules(true);
    try {
      const rule = await gamesAPI.createFeeRule({
        game_id: game.id,
        platform_id: null,
        seller_level: null,
        fee_percent: 5,
        description: 'Default platform fee',
      });
      setFeeRules((prev) => [...prev, rule]);
      toast.success('Default fee rule created');
    } catch (error) {
      toast.error(error.message || 'Failed to create fee rule');
    } finally {
      setSavingRules(false);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Layers className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Games & Fees</h1>
            <p className="text-sm text-muted-foreground">
              Manage games, platforms, and platform fee rules. Seller-level discounts apply only to platform fees.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Reload
        </Button>
      </div>

      {/* Add Game */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add Game</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input
                value={newGame.name}
                onChange={(e) => setNewGame({ ...newGame, name: e.target.value })}
                placeholder="e.g. Valorant"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={newGame.slug}
                onChange={(e) => setNewGame({ ...newGame, slug: e.target.value })}
                placeholder="e.g. valorant"
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={newGame.description}
              onChange={(e) => setNewGame({ ...newGame, description: e.target.value })}
              placeholder="Short description for admins"
            />
          </div>
          <div>
            <Label>Image URL (optional)</Label>
            <Input
              value={newGame.image_url}
              onChange={(e) => setNewGame({ ...newGame, image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <Button onClick={handleCreateGame} disabled={savingGame}>
            {savingGame && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <Plus className="w-4 h-4 mr-1" />
            Create Game
          </Button>
        </CardContent>
      </Card>

      {/* Games & Fee Rules Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Games</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {games.length === 0 ? (
              <p className="text-sm text-muted-foreground">No games defined yet.</p>
            ) : (
              games.map((game) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{game.name}</span>
                      {!game.is_active && (
                        <Badge variant="outline" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {game.slug} • {game.platforms?.length || 0} platforms
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleGameActive(game)}
                      disabled={savingGame}
                    >
                      {game.is_active ? (
                        <>
                          <ToggleRight className="w-4 h-4 mr-1 text-green-500" />
                          Active
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 mr-1 text-muted-foreground" />
                          Inactive
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addDefaultFeeRule(game)}
                      disabled={savingRules}
                    >
                      Fee Rule
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fee Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {feeRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No fee rules configured. Create defaults from the games list.
              </p>
            ) : (
              feeRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {rule.game_name || 'Any Game'}{' '}
                      {rule.platform_name ? `• ${rule.platform_name}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fee: {rule.fee_percent}% • Seller level:{' '}
                      {rule.seller_level || 'any'}
                    </p>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {rule.description}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

