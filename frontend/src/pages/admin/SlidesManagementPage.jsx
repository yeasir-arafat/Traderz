import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slidesAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../../components/ui/dialog';
import { Plus, Pencil, Trash2, GripVertical, Image as ImageIcon } from 'lucide-react';

export default function SlidesManagementPage() {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [editingSlide, setEditingSlide] = useState(null);

    const { data: slides = [], isLoading } = useQuery({
        queryKey: ['slides', 'all'],
        queryFn: () => slidesAPI.getAll(false), // Fetch all, including inactive
    });

    const createMutation = useMutation({
        mutationFn: slidesAPI.create,
        onSuccess: () => {
            queryClient.invalidateQueries(['slides']);
            toast.success('Slide created successfully');
            setIsOpen(false);
            resetForm();
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to create slide');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => slidesAPI.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['slides']);
            toast.success('Slide updated successfully');
            setIsOpen(false);
            resetForm();
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to update slide');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: slidesAPI.delete,
        onSuccess: () => {
            queryClient.invalidateQueries(['slides']);
            toast.success('Slide deleted successfully');
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to delete slide');
        },
    });

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        image_url: '',
        link_url: '',
        description: '',
        is_active: true,
        display_order: 0,
    });

    const resetForm = () => {
        setFormData({
            title: '',
            image_url: '',
            link_url: '',
            description: '',
            is_active: true,
            display_order: 0,
        });
        setEditingSlide(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingSlide) {
            updateMutation.mutate({ id: editingSlide.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleEdit = (slide) => {
        setEditingSlide(slide);
        setFormData({
            title: slide.title || '',
            image_url: slide.image_url || '',
            link_url: slide.link_url || '',
            description: slide.description || '',
            is_active: slide.is_active,
            display_order: slide.display_order,
        });
        setIsOpen(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this slide?')) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Homepage Slides</h1>
                    <p className="text-zinc-400">Manage the hero carousel slides on the homepage</p>
                </div>
                <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="bg-[#13ec5b] text-black hover:bg-[#13ec5b]/90">
                            <Plus className="w-4 h-4 mr-2" /> Add Slide
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-900 border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle>{editingSlide ? 'Edit Slide' : 'Add New Slide'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="title">Title (Optional)</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. Summer Sale"
                                    className="bg-black/50 border-white/10"
                                />
                            </div>

                            <div>
                                <Label htmlFor="image_url">Image URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="image_url"
                                        value={formData.image_url}
                                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                        placeholder="https://..."
                                        className="bg-black/50 border-white/10"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">Recommended size: 1920x450px</p>
                            </div>

                            <div>
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Short description text..."
                                    className="bg-black/50 border-white/10"
                                />
                            </div>

                            <div>
                                <Label htmlFor="link_url">Link URL (Optional)</Label>
                                <Input
                                    id="link_url"
                                    value={formData.link_url}
                                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                                    placeholder="/browse or https://..."
                                    className="bg-black/50 border-white/10"
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="is_active"
                                        checked={formData.is_active}
                                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                    />
                                    <Label htmlFor="is_active">Active</Label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Label htmlFor="display_order">Order</Label>
                                    <Input
                                        id="display_order"
                                        type="number"
                                        value={formData.display_order}
                                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                                        className="w-20 bg-black/50 border-white/10"
                                    />
                                </div>
                            </div>

                            <Button type="submit" className="w-full bg-[#13ec5b] text-black hover:bg-[#13ec5b]/90">
                                {editingSlide ? 'Update Slide' : 'Create Slide'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-zinc-900 border border-white/5 rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="border-white/5 hover:bg-white/5">
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Image</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Link</TableHead>
                            <TableHead>Order</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell>
                            </TableRow>
                        ) : slides.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-zinc-500">No slides found</TableCell>
                            </TableRow>
                        ) : (
                            slides.sort((a, b) => a.display_order - b.display_order).map((slide) => (
                                <TableRow key={slide.id} className="border-white/5 hover:bg-white/5">
                                    <TableCell>
                                        <GripVertical className="w-4 h-4 text-zinc-600 cursor-move" />
                                    </TableCell>
                                    <TableCell>
                                        <div className="w-24 h-12 bg-black rounded overflow-hidden relative">
                                            {slide.image_url ? (
                                                <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="w-6 h-6 text-zinc-700 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-white">{slide.title || '-'}</TableCell>
                                    <TableCell className="text-zinc-400 max-w-[200px] truncate" title={slide.link_url}>{slide.link_url || '-'}</TableCell>
                                    <TableCell className="text-white">{slide.display_order}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${slide.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                            {slide.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(slide)}>
                                                <Pencil className="w-4 h-4 text-zinc-400 hover:text-white" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(slide.id)}>
                                                <Trash2 className="w-4 h-4 text-red-500/70 hover:text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
