
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CosmicPalette, CosmicStructure } from '../../types';

interface ThreeCosmicSceneProps {
    speed?: number; 
    chaos?: number; 
    zoom?: number; 
    palette?: CosmicPalette;
    structure?: CosmicStructure;
    interactive?: boolean;
}

// --- ENHANCED PALETTES (FANTASY THEMED) ---
const PALETTES: Record<string, THREE.Color[]> = {
    // The "Fantasy" Default: A rich mix of deep space colors
    default: [
        new THREE.Color('#2E0249'), // Deep Purple
        new THREE.Color('#570A57'), // Magenta
        new THREE.Color('#A91079'), // Pink
        new THREE.Color('#F806CC'), // Neon Pink
        new THREE.Color('#4CC9F0')  // Cyan Highlight
    ], 
    cyberpunk: [new THREE.Color('#f72585'), new THREE.Color('#7209b7'), new THREE.Color('#3a0ca3'), new THREE.Color('#4361ee'), new THREE.Color('#4cc9f0')],
    golden: [new THREE.Color('#000000'), new THREE.Color('#5c4d3c'), new THREE.Color('#d4af37'), new THREE.Color('#f1e5ac'), new THREE.Color('#ffffff')],
    ice: [new THREE.Color('#03045e'), new THREE.Color('#0077b6'), new THREE.Color('#00b4d8'), new THREE.Color('#90e0ef'), new THREE.Color('#caf0f8')],
    nebula: [new THREE.Color('#2b2d42'), new THREE.Color('#8d99ae'), new THREE.Color('#ef233c'), new THREE.Color('#d90429'), new THREE.Color('#ffffff')],
    inferno: [new THREE.Color('#370617'), new THREE.Color('#6a040f'), new THREE.Color('#9d0208'), new THREE.Color('#e85d04'), new THREE.Color('#ffba08')],
    matrix: [new THREE.Color('#001a00'), new THREE.Color('#003300'), new THREE.Color('#006600'), new THREE.Color('#00cc00'), new THREE.Color('#66ff66')],
};

// Texture generator (Softer, star-like glow)
const generateSprite = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; 
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');       // Core
        gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.8)');   // Inner Glow
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');   // Outer Glow
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');             // Transparent
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
};

export const ThreeCosmicScene: React.FC<ThreeCosmicSceneProps> = ({ 
    speed = 1, 
    chaos = 0.4, // Optimized default for "Fantasy" look
    zoom = 450,
    palette = 'default',
    structure = 'spiral',
    interactive = true
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const galaxyRef = useRef<THREE.Points | null>(null);
    
    // Physics Refs
    const mouseRef = useRef({ x: 9999, y: 9999 });
    const targetRotation = useRef({ x: 0, y: 0 });
    const requestRef = useRef<number>(0);
    const timeRef = useRef(0);
    const shockwaveRef = useRef({ active: false, time: 0, x: 0, y: 0 });

    // Caches
    const baseColorsRef = useRef<Float32Array | null>(null);
    const baseSizesRef = useRef<Float32Array | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Cleanup
        while(containerRef.current.firstChild){
            containerRef.current.removeChild(containerRef.current.firstChild);
        }

        // --- 1. SETUP SCENE ---
        const scene = new THREE.Scene();
        // Deep fog for depth blending
        scene.fog = new THREE.FogExp2(0x050505, 0.0015); 
        sceneRef.current = scene;

        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        const camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 4000);
        camera.position.z = zoom;
        // Tilt camera slightly for dramatic effect
        camera.rotation.x = -0.1;
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // --- 2. GENERATION LOGIC ---
        // Massive particle count for "Fantasy" density
        const particleCount = structure === 'universe' ? 12000 : 8000;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const randomness = new Float32Array(particleCount * 3); // For individual jitter
        const initialPos = new Float32Array(particleCount * 3); // Home position

        baseColorsRef.current = new Float32Array(particleCount * 3);
        baseSizesRef.current = new Float32Array(particleCount);

        const activeColors = PALETTES[palette] || PALETTES.default;

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            let x=0, y=0, z=0;

            // --- ADVANCED STRUCTURE GENERATORS ---
            if (structure === 'spiral') {
                // Fibonacci-like Spiral with vertical dispersion
                const radius = Math.random() * (400 + chaos * 600);
                const spinAngle = radius * (0.8 - chaos * 0.2); 
                const branchAngle = (i % 5) / 5 * Math.PI * 2; // 5 Arms for complex look
                
                // Chaos Injection
                const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (50 + chaos * 200);
                const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (50 + chaos * 200);
                const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (50 + chaos * 200);

                x = Math.cos(branchAngle + spinAngle) * radius + randomX;
                y = randomY * (0.5 + chaos); // Flattened disk by default, expands with chaos
                z = Math.sin(branchAngle + spinAngle) * radius + randomZ;
            } 
            else if (structure === 'atomic') {
                const shells = 4;
                const shellIndex = i % shells;
                const radius = (shellIndex + 1) * 150 + Math.random() * 50;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                
                x = radius * Math.sin(phi) * Math.cos(theta);
                y = radius * Math.sin(phi) * Math.sin(theta);
                z = radius * Math.cos(phi);
                
                // Add Orbital Rings
                if (Math.random() > 0.8) {
                    y *= 0.1; // Flatten some particles into rings
                }
            }
            else if (structure === 'universe') {
                const r = 800 * Math.cbrt(Math.random());
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
            }
            else { // Chaos
                const range = 1000;
                x = (Math.random() - 0.5) * range;
                y = (Math.random() - 0.5) * range;
                z = (Math.random() - 0.5) * range;
            }

            positions[i3] = x; positions[i3+1] = y; positions[i3+2] = z;
            initialPos[i3] = x; initialPos[i3+1] = y; initialPos[i3+2] = z;

            // --- COLOR MIXING ---
            // Select color based on distance + noise index
            const colorIndex = Math.floor(Math.random() * activeColors.length);
            const variation = Math.random() * 0.2; // slight variance
            
            const baseC = activeColors[colorIndex].clone();
            // Brighten center
            const dist = Math.sqrt(x*x + y*y + z*z);
            if (dist < 200) baseC.offsetHSL(0, 0, 0.2); 

            colors[i3] = Math.min(1, baseC.r + variation);
            colors[i3+1] = Math.min(1, baseC.g + variation);
            colors[i3+2] = Math.min(1, baseC.b + variation);

            baseColorsRef.current[i3] = colors[i3];
            baseColorsRef.current[i3+1] = colors[i3+1];
            baseColorsRef.current[i3+2] = colors[i3+2];

            randomness[i3] = Math.random();
            randomness[i3+1] = Math.random();
            randomness[i3+2] = Math.random();

            // Varied star sizes
            const size = Math.random() * 2.5 * (chaos + 0.8);
            sizes[i] = size;
            baseSizesRef.current[i] = size;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 3,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true,
            map: generateSprite(),
            transparent: true,
            opacity: 0.9
        });

        const galaxy = new THREE.Points(geometry, material);
        scene.add(galaxy);
        galaxyRef.current = galaxy;

        // --- 3. ANIMATION LOOP ---
        const animate = () => {
            requestRef.current = requestAnimationFrame(animate);
            timeRef.current += 0.005 * speed;

            if (galaxyRef.current && baseColorsRef.current && baseSizesRef.current) {
                const geom = galaxyRef.current.geometry;
                const posAttr = geom.attributes.position;
                const colAttr = geom.attributes.color;
                const sizeAttr = geom.attributes.size;
                
                const positions = posAttr.array as Float32Array;
                const colors = colAttr.array as Float32Array;
                const sizes = sizeAttr.array as Float32Array;
                const initials = initialPos;
                const baseCols = baseColorsRef.current;
                const baseSizes = baseSizesRef.current;

                // Slow Rotation of the whole system
                galaxyRef.current.rotation.y += 0.0003 * speed;
                galaxyRef.current.rotation.z += 0.0001 * speed * chaos;

                // Mouse 3D Position Projection
                const vector = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5);
                vector.unproject(camera);
                const dir = vector.sub(camera.position).normalize();
                const distance = -camera.position.z / dir.z;
                const mousePos3D = camera.position.clone().add(dir.multiplyScalar(distance));

                // Shockwave Logic
                let shockwaveRadius = 0;
                if (shockwaveRef.current.active) {
                    shockwaveRef.current.time += 0.5; // Wave expansion speed
                    shockwaveRadius = shockwaveRef.current.time * 20; // 20 units per frame
                    if (shockwaveRadius > 1500) shockwaveRef.current.active = false;
                }

                for(let i=0; i < particleCount; i++) {
                    const i3 = i * 3;
                    
                    // Current Position
                    let px = positions[i3];
                    let py = positions[i3+1];
                    let pz = positions[i3+2];

                    const ix = initials[i3];
                    const iy = initials[i3+1];
                    const iz = initials[i3+2];

                    // 1. Organic Drift (Breathing)
                    const driftX = Math.sin(timeRef.current * 0.5 + py * 0.005) * 2;
                    const driftY = Math.cos(timeRef.current * 0.3 + px * 0.005) * 2;
                    
                    // 2. Mouse Interaction (Magnetic + Glow)
                    const dx = mousePos3D.x - px;
                    const dy = mousePos3D.y - py;
                    const distToMouse = Math.sqrt(dx*dx + dy*dy);
                    
                    const hoverRadius = 250;
                    
                    if (interactive && distToMouse < hoverRadius) {
                        const force = (hoverRadius - distToMouse) / hoverRadius;
                        
                        // Push slightly away
                        px -= dx * force * 0.03;
                        py -= dy * force * 0.03;
                        
                        // Bloom Effect: Brighter & Larger
                        colors[i3] = Math.min(1, baseCols[i3] + 0.5 * force);
                        colors[i3+1] = Math.min(1, baseCols[i3+1] + 0.5 * force);
                        colors[i3+2] = Math.min(1, baseCols[i3+2] + 0.5 * force);
                        sizes[i] = baseSizes[i] * (1 + force * 2); 
                    } else {
                        // Return to normal
                        colors[i3] += (baseCols[i3] - colors[i3]) * 0.05;
                        colors[i3+1] += (baseCols[i3+1] - colors[i3+1]) * 0.05;
                        colors[i3+2] += (baseCols[i3+2] - colors[i3+2]) * 0.05;
                        sizes[i] += (baseSizes[i] - sizes[i]) * 0.1;
                    }

                    // 3. Shockwave Effect (Click)
                    if (shockwaveRef.current.active) {
                        const sx = px - shockwaveRef.current.x;
                        const sy = py - shockwaveRef.current.y;
                        const sz = pz; 
                        const sDist = Math.sqrt(sx*sx + sy*sy + sz*sz);
                        
                        // Wave band thickness = 100 units
                        if (Math.abs(sDist - shockwaveRadius) < 100) {
                            const shockForce = (100 - Math.abs(sDist - shockwaveRadius)) / 100;
                            const pushDir = sDist > 0 ? 1 : 0;
                            // Explode outwards
                            px += (sx/sDist) * shockForce * 40;
                            py += (sy/sDist) * shockForce * 40;
                            pz += (sz/sDist) * shockForce * 40;
                            
                            // Flash white
                            colors[i3] = 1; colors[i3+1] = 1; colors[i3+2] = 1;
                        }
                    }

                    // 4. Elastic Return to Home (with drift)
                    positions[i3] += (ix + driftX - px) * 0.03;
                    positions[i3+1] += (iy + driftY - py) * 0.03;
                    positions[i3+2] += (iz - pz) * 0.03;
                }
                posAttr.needsUpdate = true;
                colAttr.needsUpdate = true;
                sizeAttr.needsUpdate = true;
            }

            // Smooth Camera Parallax based on mouse
            targetRotation.current.x = (mouseRef.current.y * 0.2);
            targetRotation.current.y = (mouseRef.current.x * 0.2);
            
            camera.rotation.x += (targetRotation.current.x - camera.rotation.x) * 0.05;
            camera.rotation.y += (targetRotation.current.y - camera.rotation.y) * 0.05;

            renderer.render(scene, camera);
        };

        animate();

        // --- 4. EVENT HANDLERS ---
        const handleMouseMove = (e: MouseEvent) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            // Normalize mouse -1 to 1 relative to container center
            mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (!interactive) return;
            
            // Calculate click position in 3D space roughly
            const vector = new THREE.Vector3(mouseRef.current.x, mouseRef.current.y, 0.5);
            vector.unproject(cameraRef.current!);
            const dir = vector.sub(cameraRef.current!.position).normalize();
            const distance = -cameraRef.current!.position.z / dir.z;
            const clickPos = cameraRef.current!.position.clone().add(dir.multiplyScalar(distance));

            // Trigger Shockwave
            shockwaveRef.current = {
                active: true,
                time: 0,
                x: clickPos.x,
                y: clickPos.y
            };
        };

        const handleResize = () => {
            if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
        };

        window.addEventListener('resize', handleResize);
        if (interactive) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mousedown', handleMouseDown);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            geometry.dispose();
            material.dispose();
            if (rendererRef.current) rendererRef.current.dispose();
        };
    }, [speed, chaos, zoom, palette, structure, interactive]);

    return (
        <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden cursor-crosshair" />
    );
};
