
import React, { Suspense } from 'react';
import { SystemSettings } from '../../types';
import { ThreeCosmicScene } from './ThreeCosmicScene';

interface CosmicBackgroundProps {
    settings: SystemSettings | null;
    intensity?: 'normal' | 'high'; // high for login/welcome, normal for sidebar
    className?: string;
}

export const CosmicBackground: React.FC<CosmicBackgroundProps> = ({ settings, intensity = 'normal', className = '' }) => {
    const patternStyle = settings?.sidebar_pattern_style || 'stars';
    const animationType = settings?.sidebar_animation || 'flow'; // Default to flow
    const isHigh = intensity === 'high';

    // Advanced Params (Default values tuned for Fantasy Space look)
    const chaos = settings?.cosmic_chaos_level ?? 0.4;
    const speed = settings?.cosmic_speed ?? 1;
    const zoom = settings?.cosmic_zoom ?? 450;
    const palette = settings?.cosmic_palette ?? 'default';
    const structure = settings?.cosmic_structure ?? 'spiral';

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

    // NOTE: pointer-events-none removed from main container to allow clicks on ThreeJS canvas
    return (
        <div className={`absolute inset-0 overflow-hidden select-none ${className}`}>
            {/* 1. Base Deep Gradient (using CSS vars from App.tsx) */}
            <div className={`absolute inset-0 bg-gradient-to-b from-[var(--sidebar-from)] to-[var(--sidebar-to)] transition-colors duration-1000 ${isHigh ? 'opacity-90' : 'opacity-100'}`}></div>
            
            {/* 2. Noise Texture for Realism (Grain) - Reduced opacity for cleaner look */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay z-[1] pointer-events-none"></div>

            {/* 3. Dynamic Pattern Layer with Variable Animation */}
            {patternStyle === 'stars' ? (
                <div className={`absolute inset-0 ${isHigh ? 'cosmic-container' : ''}`}>
                    
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
            ) : (
                <div className={`absolute inset-0 transition-all duration-500 ${getAnimationClass()}`} style={getPatternStyle()}></div>
            )}

            {/* 4. Ambient Glows (Nebula Effect via CSS for performance blending) */}
            <div className={`absolute -top-1/4 -right-1/4 w-[80%] h-[80%] bg-[var(--primary)] rounded-full blur-[120px] opacity-10 mix-blend-screen animate-pulse-slow pointer-events-none`}></div>
            <div className={`absolute -bottom-1/4 -left-1/4 w-[60%] h-[60%] bg-[var(--accent)] rounded-full blur-[100px] opacity-10 mix-blend-screen animate-pulse-slow pointer-events-none`}></div>
        </div>
    );
};
