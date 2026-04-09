import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useStore } from './Environment3D';
import pako from 'pako';

// Raw Base64 string encoding for typed arrays
function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return window.btoa(binary);
}

function reproject(x, y, minLon, minLat) {
    const R = 6378137;
    const lat = minLat + (y / R) * (180 / Math.PI);
    const lon = minLon + (x / (R * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);
    return [lon, lat];
}

export default function WindOverlay({ bounds, buildings, minH, fullW, fullD, refEn }) {
    const { windSpeed, windDirection, setWalkabilityStats, getEl, currentBounds } = useStore();
    
    // GAN target resolution
    const N = 512;
    const worldW = bounds.w;
    const worldD = bounds.d;

    // React state overrides
    const [ganImageUrl, setGanImageUrl] = useState(null);
    const [isFetching, setIsFetching] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    const [resultTex, setResultTex] = useState(null);

    // Hard-link async texture loading against React's synchronization graph explicitly
    useEffect(() => {
        if (!ganImageUrl) return;
        const img = new window.Image();
        img.onload = () => {
            const tex = new THREE.Texture(img);
            tex.flipY = false;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            
            // Re-align the bounding box response from the GAN natively matching the user slider
            tex.center.set(0.5, 0.5);
            const wRad = (useStore.getState().windDirection || 0) * Math.PI / 180;
            tex.rotation = wRad;
            
            tex.needsUpdate = true;
            setResultTex(tex);
        };
        img.src = ganImageUrl;
    }, [ganImageUrl]);

    // Construct the flat Float32Array payload containing R,G,B tensors
    const submitGANPayload = async () => {
        // We calculate and assign the dynamic mathematical rotation tracking inside the try block now
        setIsFetching(true);
        setFetchError(null);
        
        try {
            const size = N * N;
            const floatData = new Float32Array(3 * size);
            // Background wind vectors normalised. 
            // Meteorological wind direction implies where wind blows FROM.
            const windRad = windDirection * Math.PI / 180;
            
            // Extract native Cartesian flow vectors dynamically (0=North blows South(+V), 90=East blows West(-U))
            // The GAN is structurally restricted to Left-to-Right (+u) nominal bounding conditions. We rotate the city canvas instead!
            const u = 1.0;
            const v = 0.0;

            // Initialize global deep air and baseline wind
            for (let i = 0; i < size; i++) {
                floatData[0 * size + i] = 1.0; // Channel 0 (R): Geometry Mask (1.0 = Empty Air / Open Space)
                floatData[1 * size + i] = u;    // Channel 1 (G): X-Wind Vector
                floatData[2 * size + i] = v;    // Channel 2 (B): Z-Wind Vector
            }

            // Rasterize purely natively directly inside the bounding box. Geometric matrix stays locked tightly!
            const gwX = bounds.cx - worldW / 2;
            const gwZ = bounds.cz - worldD / 2;

            const mapCanvas = document.createElement('canvas');
            mapCanvas.width = N;
            mapCanvas.height = N;
            const ctx = mapCanvas.getContext('2d');
            
            // Static orthogonal locking
            
            // Background is pure black (0) representing Empty Air
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, N, N);
            
            // Rotate the extraction context to perfectly emulate wind vectors against the PyTorch restricted inputs
            ctx.save();
            ctx.translate(N/2, N/2);
            ctx.rotate(-windRad);
            ctx.translate(-N/2, -N/2);
            
            // Buildings are drawn pure white (255) representing Geometry
            ctx.fillStyle = 'white';
            ctx.beginPath();
            buildings.forEach(b => {
                // Ensure only physical volumetric structures block wind, omitting flat landuse/poi ground plates
                const isVolumetric = b.renderType === 'building' || b.id?.startsWith('cbld') || (b.tags?.building && b.tags.building !== 'no');
                if (!isVolumetric) return;
                const pts = b.p || b.points;
                if (!pts) return;

                pts.forEach((pt, idx) => {
                    const lX = pt[0];
                    const lY = pt[1];
                    const px = ((lX - gwX) / worldW) * N;
                    const pz = ((lY - gwZ) / worldD) * N;
                    
                    if (idx === 0) ctx.moveTo(px, pz);
                    else ctx.lineTo(px, pz);
                });
                ctx.closePath();
            });
            ctx.fill();
            
            ctx.restore(); // Ensure the rotation doesn't warp following state captures
            
            const imgData = ctx.getImageData(0, 0, N, N).data;
            
            for (let z = 0; z < N; z++) {
                for (let x = 0; x < N; x++) {
                    const localIdx = (z * N + x);
                    // Check RED pixel channel out of [R, G, B, A] sequential imageData logic from canvas context
                    const isBuilding = imgData[localIdx * 4] > 128;
                    
                    if (isBuilding) {
                         // Impose perfect solid occlusion logic for PyTorch Convolution bounds
                         floatData[0 * size + localIdx] = -1.0; // R: Block Geometry (Solid Black)
                         floatData[1 * size + localIdx] = -1.0; // G: Zero Flow Representation
                         floatData[2 * size + localIdx] = -1.0; // B: Zero Flow Representation
                    }
                }
            }

            setWalkabilityStats({ walkabilityAvgDist: `Compressing Payload...` });

            // Compress Float32 buffer wrapper bytes natively
            const compressed = pako.gzip(new Uint8Array(floatData.buffer), { level: 1 });
            const b64 = bytesToBase64(compressed);
            
            setWalkabilityStats({ walkabilityAvgDist: `Transmitting Tensor API...` });

            // Fire local python surrogate REST HTTP node
            const response = await fetch("http://localhost:8000/predict", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data_b64: b64, wind_speed: windSpeed })
            });

            if (!response.ok) {
                throw new Error("HTTP Status " + response.status);
            }

            const jsonDecoded = await response.json();
            
            // Map resultant PNG graphical fluid string
            setGanImageUrl("data:image/png;base64," + jsonDecoded.image_base64);
            setWalkabilityStats({ walkabilityAvgDist: `GAN Predict: ${jsonDecoded.width}x${jsonDecoded.height}` });
            
        } catch (err) {
            console.error("GAN Request Failed: ", err);
            setFetchError("API Offline or Unreachable.");
            setWalkabilityStats({ walkabilityAvgDist: `API Error: Retry` });
        } finally {
            setIsFetching(false);
        }
    };

    // Real-time calculation sequence dynamically debounced to prevent API swamping
    useEffect(() => {
        const debounceId = setTimeout(() => {
            submitGANPayload();
        }, 150); // 150ms structural UI debounce
        return () => clearTimeout(debounceId);
    }, [windSpeed, windDirection, bounds, buildings]);

    // Calculate High Fidelity topograph projection plane matching voxel intersections exactly
    const projectedGeometry = useMemo(() => {
        // High fidelity map bounds matrix (resolution bounds matching surface scale natively)
        const geo = new THREE.PlaneGeometry(worldW, worldD, Math.max(1, Math.floor(worldW / 3)), Math.max(1, Math.floor(worldD / 3)));
        geo.rotateX(-Math.PI / 2);
        
        const pos = geo.attributes.position;
        const uv = geo.attributes.uv;
        
        for (let i = 0; i < pos.count; i++) {
            const px = pos.getX(i);
            const pz = pos.getZ(i);
            
            // Mathematically emulate HTML5 Canvas coordinate structure precisely under static orthogonal setup
            const unrotU = px / worldW;
            const unrotV = -pz / worldD; // -pz precisely mirrors the lY = bounds.cz - pz canvas inversion
            
            // Lock flawlessly bounded absolute orthogonal output natively
            uv.setXY(i, unrotU + 0.5, unrotV + 0.5);
            
            // Reconstruct exact global map bounding parameters safely bypassing Canvas relative offsets
            const lX = px + bounds.cx;
            const lY = bounds.cz - pz;
            
            const [lon, lat] = currentBounds && refEn ? reproject(lX, lY, currentBounds[0], currentBounds[1]) : [0, 0];
            let rawEl = refEn && getEl && currentBounds ? getEl(lon, lat) : 0;
            if (rawEl == null || isNaN(rawEl)) rawEl = 0;
            
            let smoothY = Math.max(0, rawEl - minH);
            
            
            // Hover 4.5 meters organically above the discrete voxel mesh step layers securely mirroring topography (lifted above roads)
            pos.setY(i, smoothY + 4.5);
        }
        geo.computeVertexNormals();
        return geo;
    }, [worldW, worldD, bounds.cx, bounds.cz, fullW, fullD, minH, refEn, getEl, currentBounds]);

    if (fetchError && !ganImageUrl) {
        return null;
    }

    // Scale the absolute visual intensity of the non-dimensional GAN mapping
    // to dynamically reflect absolute wind speed states on the slider
    const dynamicOpacity = 1.0;

    return (
        <group>
            {/* Base Underlay Loading Plate */}
            {isFetching && (
                <mesh position={[bounds.cx, 0, -bounds.cz]}>
                     <primitive object={projectedGeometry} attach="geometry" />
                     <meshBasicMaterial color="#0A1128" transparent opacity={0.65} depthWrite={false} blending={THREE.NormalBlending} />
                </mesh>
            )}

            {/* AI Graphical Extracted Flow Output */}
            {resultTex && (
                <mesh position={[bounds.cx, 0, -bounds.cz]}>
                    <primitive object={projectedGeometry} attach="geometry" />
                    <meshBasicMaterial map={resultTex} transparent opacity={dynamicOpacity} depthWrite={true} side={THREE.DoubleSide} blending={THREE.NormalBlending} />
                </mesh>
            )}
        </group>
    );
}
