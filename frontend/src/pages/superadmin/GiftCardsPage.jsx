import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Loader2, RefreshCw, Plus, Search, X, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { superAdminAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { toast } from 'sonner';

const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400',
  redeemed: 'bg-blue-500/20 text-blue-400',
  deactivated: 'bg-red-500/20 text-red-400',
};

export default function GiftCardsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [giftCards, setGiftCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [codeSearch, setCodeSearch] = useState('');

  // Generate form
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateCount, setGenerateCount] = useState(1);
  const [generateValue, setGenerateValue] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState([]);

  // Deactivate form
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivating, setDeactivating] = useState(false);

  const isSuperAdmin = user?.roles?.includes('super_admin');

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) {
      navigate('/');
      return;
    }
    loadGiftCards();
  }, [isAuthenticated, isSuperAdmin, page, statusFilter]);

  const loadGiftCards = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 50 };
      if (statusFilter) params.status = statusFilter;
      if (codeSearch) params.code = codeSearch;
      
      const data = await superAdminAPI.getGiftCards(params);
      setGiftCards(data.cards || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error(error.message || 'Failed to load gift cards');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadGiftCards();
  };

  const handleGenerate = async () => {
    if (generateCount < 1 || generateCount > 100) {
      toast.error('Count must be between 1 and 100');
      return;
    }
    if (generateValue <= 0 || generateValue > 10000) {
      toast.error('Value must be between 0.01 and 10000');
      return;
    }

    setGenerating(true);
    try {
      const data = await superAdminAPI.generateGiftCards({
        count: generateCount,
        value_usd: generateValue,
      });
      setGeneratedCards(data.cards || []);
      toast.success(`Generated ${data.count} gift card(s)`);
      loadGiftCards();
    } catch (error) {
      toast.error(error.message || 'Failed to generate gift cards');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateReason || deactivateReason.length < 5) {
      toast.error('Reason must be at least 5 characters');
      return;
    }

    setDeactivating(true);
    try {
      await superAdminAPI.deactivateGiftCard(selectedCard.id, { reason: deactivateReason });
      toast.success('Gift card deactivated');
      setShowDeactivateModal(false);
      setSelectedCard(null);
      setDeactivateReason('');
      loadGiftCards();
    } catch (error) {
      toast.error(error.message || 'Failed to deactivate gift card');
    } finally {
      setDeactivating(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Code', 'Value (USD)', 'Status', 'Created At', 'Redeemed By', 'Redeemed At'];
    const rows = giftCards.map(c => [
      c.code,
      c.amount_usd,
      c.status,
      c.created_at,
      c.redeemed_by_username || '',
      c.redeemed_at || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `giftcards_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const formatCurrency = (amount) => `$${(amount || 0).toFixed(2)}`;

  if (!isSuperAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl" data-testid="giftcards-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Gift Card Management</h1>
            <p className="text-sm text-muted-foreground">
              Generate, track, and deactivate gift cards
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={giftCards.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => { setShowGenerateModal(true); setGeneratedCards([]); }}>
            <Plus className="w-4 h-4 mr-2" />
            Generate
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code..."
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  className="pl-9"
                  data-testid="code-search"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px]" data-testid="status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="redeemed">Redeemed</SelectItem>
                <SelectItem value="deactivated">Deactivated</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button type="button" variant="outline" onClick={loadGiftCards} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Gift Cards Table */}
      <Card>
        <CardHeader>
          <CardTitle>Gift Cards ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : giftCards.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No gift cards found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="giftcards-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2">Code</th>
                    <th className="text-right py-3 px-2">Value</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Created</th>
                    <th className="text-left py-3 px-2">Redeemed By</th>
                    <th className="text-left py-3 px-2">Redeemed At</th>
                    <th className="text-center py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {giftCards.map((card) => (
                    <tr key={card.id} className="border-b border-border/50 hover:bg-muted/30" data-testid={`card-row-${card.id}`}>
                      <td className="py-3 px-2 font-mono text-xs">{card.code}</td>
                      <td className="py-3 px-2 text-right font-medium">{formatCurrency(card.amount_usd)}</td>
                      <td className="py-3 px-2">
                        <Badge className={STATUS_COLORS[card.status]}>{card.status}</Badge>
                      </td>
                      <td className="py-3 px-2 text-xs text-muted-foreground">{formatDate(card.created_at)}</td>
                      <td className="py-3 px-2">{card.redeemed_by_username || '-'}</td>
                      <td className="py-3 px-2 text-xs text-muted-foreground">{card.redeemed_at ? formatDate(card.redeemed_at) : '-'}</td>
                      <td className="py-3 px-2 text-center">
                        {card.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedCard(card); setShowDeactivateModal(true); }}
                            data-testid={`deactivate-${card.id}`}
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 50 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 50)}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowGenerateModal(false)}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Generate Gift Cards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Number of Cards (1-100)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={generateCount}
                  onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                  data-testid="generate-count"
                />
              </div>
              <div>
                <Label>Value per Card (USD)</Label>
                <Input
                  type="number"
                  min="0.01"
                  max="10000"
                  step="0.01"
                  value={generateValue}
                  onChange={(e) => setGenerateValue(parseFloat(e.target.value) || 0)}
                  data-testid="generate-value"
                />
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p>Total value: <strong>{formatCurrency(generateCount * generateValue)}</strong></p>
                <p className="text-xs text-muted-foreground mt-1">
                  Each card will have a unique 16-digit numeric code.
                </p>
              </div>

              {generatedCards.length > 0 && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-green-400 font-medium mb-2">Generated Codes:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {generatedCards.map((c, i) => (
                      <div key={i} className="font-mono text-xs flex justify-between">
                        <span>{c.code}</span>
                        <span className="text-muted-foreground">{formatCurrency(c.amount_usd)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
                  {generatedCards.length > 0 ? 'Close' : 'Cancel'}
                </Button>
                {generatedCards.length === 0 && (
                  <Button onClick={handleGenerate} disabled={generating}>
                    {generating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Generate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeactivateModal && selectedCard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowDeactivateModal(false)}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Deactivate Gift Card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p><strong>Code:</strong> {selectedCard.code}</p>
                <p><strong>Value:</strong> {formatCurrency(selectedCard.amount_usd)}</p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg text-sm">
                <p className="text-yellow-400 font-medium">Warning</p>
                <p className="text-muted-foreground">
                  Deactivating this card will prevent it from being redeemed. This action is irreversible.
                </p>
              </div>

              <div>
                <Label>Reason *</Label>
                <Textarea
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  placeholder="Why is this card being deactivated?"
                  data-testid="deactivate-reason"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowDeactivateModal(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeactivate} disabled={deactivating}>
                  {deactivating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Deactivate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
