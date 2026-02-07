
import React, { Suspense, useEffect, useRef } from 'react';
import { SystemSettings } from '../../types';
import { ThreeCosmicScene } from './ThreeCosmicScene';

interface CosmicBackgroundProps {
    settings: SystemSettings | null;
    intensity?: 'normal' | 'high'; // high for login/welcome, normal for sidebar
    className?: string;
}

export const CosmicBackground: React.FC<CosmicBackgroundProps> = ({ settings, intensity = 'normal', className = '' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollStateRef = useRef({
        progress: 0,
        velocity: 0,
        intensity: 1
    });

    const patternStyle = settings?.sidebar_pattern_style || 'stars';
    const animationType = settings?.sidebar_animation || 'flow'; // Default to flow
    const isHigh = intensity === 'high';

    // Advanced Params (Default values tuned for Fantasy Space look)
    const chaos = settings?.cosmic_chaos_level ?? 0.4;
    const speed = settings?.cosmic_speed ?? 1;
    const zoom = settings?.cosmic_zoom ?? 450;
    const palette = settings?.cosmic_palette ?? 'default';
    const structure = settings?.cosmic_structure ?? 'spiral';

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const container = containerRef.current;
        if (!container) return;

        const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

        const findScrollTarget = () => {
            const el = document.querySelector('[data-cosmic-scroll]') as HTMLElement | null;
            return el || window;
        };

        let scrollEl: HTMLElement | Window = findScrollTarget();
        let lastScroll = 0;
        let targetProgress = 0;
        let targetVelocity = 0;
        let rafId = 0;

        const getScrollTop = (target: HTMLElement | Window) => {
            if (target === window) return window.scrollY || document.documentElement.scrollTop || 0;
            return target.scrollTop || 0;
        };

        const getScrollMax = (target: HTMLElement | Window) => {
            if (target === window) {
                const doc = document.documentElement;
                return Math.max(0, (doc.scrollHeight || 0) - window.innerHeight);
            }
            return Math.max(0, target.scrollHeight - target.clientHeight);
        };

        const updateTarget = () => {
            // Re-resolve scroll element in case layout mounted after this effect
            const resolved = findScrollTarget();
            if (resolved !== scrollEl) {
                if (scrollEl && scrollEl !== window) {
                    scrollEl.removeEventListener('scroll', updateTarget as EventListener);
                } else {
                    window.removeEventListener('scroll', updateTarget);
                }
                scrollEl = resolved;
                if (scrollEl === window) {
                    window.addEventListener('scroll', updateTarget, { passive: true });
                } else {
                    scrollEl.addEventListener('scroll', updateTarget as EventListener, { passive: true });
                }
                lastScroll = getScrollTop(scrollEl);
            }

            const current = getScrollTop(scrollEl);
            targetVelocity = current - lastScroll;
            lastScroll = current;
            const max = getScrollMax(scrollEl);
            targetProgress = max > 0 ? clamp(current / max, 0, 1) : 0;
        };

        const tick = () => {
            const patternFactor = patternStyle === 'stars' ? 1 : patternStyle === 'custom' ? 0.9 : 0.85;
            const animationFactor = animationType === 'static' ? 0.6 : animationType === 'pulse' ? 0.85 : animationType === 'spin' ? 0.95 : 1;
            const chaosFactor = 0.7 + clamp(chaos, 0, 1) * 0.7;
            const speedFactor = 0.75 + clamp(speed, 0.1, 5) * 0.08;
            const baseIntensity = isHigh ? 1.1 : 0.75;
            const motionIntensity = clamp(baseIntensity * patternFactor * animationFactor * chaosFactor * speedFactor, 0.4, 1.8);

            const state = scrollStateRef.current;
            state.intensity = motionIntensity;
            state.progress = lerp(state.progress, targetProgress, 0.08);
            state.velocity = lerp(state.velocity, targetVelocity, 0.2);
            targetVelocity *= 0.65;

            const velocityAbs = Math.min(Math.abs(state.velocity), 140);
            const velocityNorm = clamp(velocityAbs / 140, 0, 1);
            const zoom = 1 + (state.progress * 0.12 + velocityNorm * 0.09) * motionIntensity;
            const drift = (state.progress * 60 + velocityNorm * 140) * motionIntensity;
            const swirl = (state.velocity >= 0 ? 1 : -1) * velocityNorm * 2.5 * motionIntensity;
            const shiftX = Math.sin(state.progress * Math.PI * 2) * 6 * motionIntensity;
            const shiftY = -drift * 0.15;
            const brightness = 1 + velocityNorm * 0.2 * motionIntensity;

            container.style.setProperty('--cosmic-zoom', zoom.toFixed(3));
            container.style.setProperty('--cosmic-drift', drift.toFixed(2));
            container.style.setProperty('--cosmic-swirl', `${swirl.toFixed(2)}deg`);
            container.style.setProperty('--cosmic-shift-x', `${shiftX.toFixed(2)}px`);
            container.style.setProperty('--cosmic-shift-y', `${shiftY.toFixed(2)}px`);
            container.style.setProperty('--cosmic-brightness', brightness.toFixed(3));
            container.style.setProperty('--cosmic-velocity', velocityNorm.toFixed(3));

            rafId = window.requestAnimationFrame(tick);
        };

        updateTarget();
        if (scrollEl === window) {
            window.addEventListener('scroll', updateTarget, { passive: true });
        } else {
            scrollEl.addEventListener('scroll', updateTarget as EventListener, { passive: true });
        }
        window.addEventListener('resize', updateTarget);
        rafId = window.requestAnimationFrame(tick);

        return () => {
            window.removeEventListener('resize', updateTarget);
            if (scrollEl === window) {
                window.removeEventListener('scroll', updateTarget);
            } else {
                scrollEl.removeEventListener('scroll', updateTarget as EventListener);
            }
            window.cancelAnimationFrame(rafId);
        };
    }, [patternStyle, animationType, chaos, speed, isHigh]);

    const getPatternStyle = () => {
        if (patternStyle === 'custom' && settings?.sidebar_pattern_url) {
            return { backgroundImage: `url("${settings.sidebar_pattern_url}")`, backgroundSize: 'cover' };
        }
        if (patternStyle === 'grid') {
            return { 
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', 
                backgroundSize: '30px 30px', 
                opacity: 0.1 
            };
        }
        if (patternStyle === 'circuit') {
            return { 
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', 
                opacity: 0.1 
            };
        }
        return {}; 
    };

    // Use CSS animations for simple patterns or as fallback
    const getAnimationClass = () => {
        if (patternStyle === 'stars') return ''; // Stars handled by Three.js or CSS fallbacks
        
        switch (animationType) {
            case 'spin': return 'animate-spin-slow origin-center';
            case 'pulse': return 'animate-pulse-slow';
            case 'flow': return isHigh ? 'animate-float' : '';
            case 'static': return '';
            default: return '';
        }
    };

    const motionStyle: React.CSSProperties = {
        transform: 'translate3d(var(--cosmic-shift-x, 0px), var(--cosmic-shift-y, 0px), 0) scale(var(--cosmic-zoom, 1)) rotate(var(--cosmic-swirl, 0deg))',
        transformOrigin: 'center',
        willChange: 'transform, filter',
        filter: 'brightness(var(--cosmic-brightness, 1))'
    };

    // NOTE: pointer-events-none removed from main container to allow clicks on ThreeJS canvas
    return (
        <div ref={containerRef} className={`absolute inset-0 overflow-hidden select-none ${className}`}>
            {/* 1. Base Deep Gradient (using CSS vars from App.tsx) */}
            <div className={`absolute inset-0 bg-gradient-to-b from-[var(--sidebar-from)] to-[var(--sidebar-to)] transition-colors duration-1000 ${isHigh ? 'opacity-90' : 'opacity-100'}`}></div>
            
            {/* 2. Noise Texture for Realism (Grain) - Reduced opacity for cleaner look */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay z-[1] pointer-events-none"></div>

            {/* 3. Dynamic Pattern Layer with Variable Animation */}
            {patternStyle === 'stars' ? (
                <div className={`absolute inset-0 ${isHigh ? 'cosmic-container' : ''}`}>
                    <div className="absolute inset-0" style={motionStyle}>
                    
                        {/* Render 3D WebGL Scene if 'stars' is selected. 
                            We wrap in Suspense/Fallback in case Three.js fails to load or context is lost 
                        */}
                        <div className="absolute inset-0 z-0">
                            <ThreeCosmicScene 
                                speed={isHigh ? (speed * 1.2) : (speed * 0.5)} // Slightly faster on login
                                chaos={chaos}
                                zoom={isHigh ? zoom : (zoom + 200)} // Further back for sidebar
                                palette={palette}
                                structure={structure}
                                interactive={true} // Always interactive now
                                scrollStateRef={scrollStateRef}
                            />
                        </div>

                        {/* CSS Fallback / Overlay Layers (Subtle blending) */}
                        <div className="stars-lg absolute inset-0 opacity-10 pointer-events-none"></div>
                    
                        {/* Shooting Star Effect (Only for High Intensity) - CSS Overlay on top of 3D */}
                        {isHigh && (
                            <>
                                <div className="absolute top-0 right-0 w-[2px] h-[100px] bg-gradient-to-b from-transparent via-white to-transparent rotate-45 opacity-0 animate-ping-slow" style={{ animationDuration: '4s', right: '20%' }}></div>
                                <div className="absolute top-1/4 left-0 w-[2px] h-[150px] bg-gradient-to-b from-transparent via-cyan-200 to-transparent -rotate-45 opacity-0 animate-ping-slow" style={{ animationDuration: '7s', animationDelay: '2s' }}></div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="absolute inset-0" style={motionStyle}>
                    <div
                        className={`absolute inset-0 transition-all duration-500 ${getAnimationClass()}`}
                        style={{
                            ...getPatternStyle(),
                            backgroundPosition: 'calc(50% + var(--cosmic-shift-x, 0px)) calc(50% + var(--cosmic-shift-y, 0px))'
                        }}
                    ></div>
                </div>
            )}

            {/* 4. Ambient Glows (Nebula Effect via CSS for performance blending) */}
            <div className={`absolute -top-1/4 -right-1/4 w-[80%] h-[80%] bg-[var(--primary)] rounded-full blur-[120px] opacity-10 mix-blend-screen animate-pulse-slow pointer-events-none`}></div>
            <div className={`absolute -bottom-1/4 -left-1/4 w-[60%] h-[60%] bg-[var(--accent)] rounded-full blur-[100px] opacity-10 mix-blend-screen animate-pulse-slow pointer-events-none`}></div>
        </div>
    );
};
