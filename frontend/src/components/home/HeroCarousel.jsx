import React, { useEffect, useState, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { Button } from '../ui/button';
import { useNavigate } from 'react-router-dom';
import { slidesAPI } from '../../lib/api';
import { getUploadUrl } from '../../lib/utils';

export function HeroCarousel() {
    const navigate = useNavigate();
    const [slides, setSlides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000 })]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        const fetchSlides = async () => {
            try {
                const data = await slidesAPI.getAll(true);
                setSlides(data || []);
            } catch (error) {
                console.error('Failed to fetch slides:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSlides();
    }, []);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        emblaApi.on('select', onSelect);
        onSelect(); // Initial selection
    }, [emblaApi, onSelect]);

    const scrollTo = useCallback((index) => emblaApi && emblaApi.scrollTo(index), [emblaApi]);
    const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

    if (loading) {
        return <div className="h-[280px] md:h-[450px] w-full bg-zinc-900 animate-pulse" />;
    }

    // Fallback if no slides
    if (slides.length === 0) {
        return (
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
                                Secure escrow & instant delivery on top-tier accounts with rare skins.
                            </p>
                            <div className="flex gap-3 pt-2">
                                <Button
                                    onClick={() => navigate('/browse')}
                                    className="bg-[#13ec5b] text-black hover:bg-[#13ec5b]/90 shadow-[0_0_20px_rgba(19,236,91,0.4)] hover:shadow-[0_0_30px_rgba(19,236,91,0.6)] font-bold px-6 py-3"
                                >
                                    Browse Listings
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full group">
            <div className="relative h-[280px] w-full overflow-hidden md:h-[450px]" ref={emblaRef}>
                <div className="flex w-full h-full">
                    {slides.map((slide) => (
                        <div key={slide.id} className="relative flex-[0_0_100%] w-full h-full min-w-0">
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-700"
                                style={{ backgroundImage: `url('${getUploadUrl(slide.image_url)}')` }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
                            </div>

                            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 pb-12">
                                <div className="max-w-2xl space-y-4">
                                    {slide.title && (
                                        <h2 className="text-3xl md:text-5xl font-bold leading-tight text-white animate-in slide-in-from-bottom-5 fade-in duration-700">
                                            {slide.title}
                                        </h2>
                                    )}
                                    {slide.description && (
                                        <p className="text-sm md:text-lg text-zinc-400 max-w-[80%] animate-in slide-in-from-bottom-5 fade-in duration-700 delay-100">
                                            {slide.description}
                                        </p>
                                    )}

                                    {slide.link_url && (
                                        <div className="flex gap-3 pt-2 animate-in slide-in-from-bottom-5 fade-in duration-700 delay-200">
                                            <Button
                                                onClick={() => {
                                                    if (slide.link_url.startsWith('http')) {
                                                        window.open(slide.link_url, '_blank');
                                                    } else {
                                                        navigate(slide.link_url);
                                                    }
                                                }}
                                                className="bg-[#13ec5b] text-black hover:bg-[#13ec5b]/90 shadow-[0_0_20px_rgba(19,236,91,0.4)] hover:shadow-[0_0_30px_rgba(19,236,91,0.6)] font-bold px-6 py-3"
                                            >
                                                View More
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation Buttons */}
            <button
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                onClick={scrollPrev}
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
            <button
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                onClick={scrollNext}
            >
                <ChevronRight className="w-6 h-6" />
            </button>

            {/* Indicators */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        className={`h-1.5 transition-all duration-300 rounded-full ${index === selectedIndex
                            ? 'w-6 bg-[#13ec5b] shadow-[0_0_10px_rgba(19,236,91,0.6)]'
                            : 'w-1.5 bg-white/30 hover:bg-white/50'
                            }`}
                        onClick={() => scrollTo(index)}
                    />
                ))}
            </div>
        </div>
    );
}
