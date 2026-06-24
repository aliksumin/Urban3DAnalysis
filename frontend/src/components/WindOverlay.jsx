import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useStore } from './Environment3D';
import { getBackendURL } from '../utils/backend';
import pako, { ungzip } from 'pako';
import { checkBackendAvailable, getWindEngine } from '../utils/onnxWindEngine';

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

export default function WindOverlay({ bounds, buildings, buildingEdits, minH, fullW, fullD, refEn }) {
    const { windSpeed, windDirection, windComfortMetric, setWalkabilityStats, getEl, currentBounds } = useStore();
    

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
            
            // Re-align the bounding box response mathematically safely reversing Y-down WebGL matrix negations globally
            tex.center.set(0.5, 0.5);
            const wRad = (useStore.getState().windDirection || 0) * Math.PI / 180;
            tex.rotation = wRad;
            
            tex.needsUpdate = true;
            setResultTex(tex);
        };
        img.src = ganImageUrl;
    }, [ganImageUrl]);

    // Build the Float32Array payload with rasterized buildings
    const buildPayload = () => {
        const size = N * N;
        const floatData = new Float32Array(3 * size);
        const windRad = windDirection * Math.PI / 180;
        
        const u = 1.0;
        const v = 0.0;

        // Initialize global deep air and baseline wind
        for (let i = 0; i < size; i++) {
            floatData[0 * size + i] = 1.0;
            floatData[1 * size + i] = u;
            floatData[2 * size + i] = v;
        }

        // Rasterize buildings onto canvas
        const gwX = bounds.cx - worldW / 2;
        const gwZ = bounds.cz - worldD / 2;

        const mapCanvas = document.createElement('canvas');
        mapCanvas.width = N;
        mapCanvas.height = N;
        const ctx = mapCanvas.getContext('2d');
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, N, N);
        
        // Rotate to emulate wind direction against GAN's L→R restriction
        ctx.save();
        ctx.translate(N/2, N/2);
        ctx.rotate(-windRad);
        ctx.translate(-N/2, -N/2);
        
        ctx.fillStyle = 'white';
        ctx.beginPath();
        buildings.forEach(b => {
            const isVolumetric = b.renderType === 'building' || String(b.id || "").startsWith('cbld') || (b.tags?.building && b.tags.building !== 'no');
            if (!isVolumetric) return;
            const pts = b.p || b.points;
            if (!pts) return;

            pts.forEach((pt, idx) => {
                const px = ((pt[0] - gwX) / worldW) * N;
                const pz = ((pt[1] - gwZ) / worldD) * N;
                if (idx === 0) ctx.moveTo(px, pz);
                else ctx.lineTo(px, pz);
            });
            ctx.closePath();
        });
        ctx.fill();
        ctx.restore();
        
        const imgData = ctx.getImageData(0, 0, N, N).data;
        
        for (let z = 0; z < N; z++) {
            for (let x = 0; x < N; x++) {
                const localIdx = (z * N + x);
                if (imgData[localIdx * 4] > 128) {
                     floatData[0 * size + localIdx] = -1.0;
                     floatData[1 * size + localIdx] = -1.0;
                     floatData[2 * size + localIdx] = -1.0;
                }
            }
        }

        return floatData;
    };

    // Submit via local Python backend (original path)
    const submitViaBackend = async (floatData) => {
        setWalkabilityStats({ walkabilityAvgDist: `Compressing Payload...` });

        const compressed = pako.gzip(new Uint8Array(floatData.buffer), { level: 1 });
        const b64 = bytesToBase64(compressed);
        
        setWalkabilityStats({ walkabilityAvgDist: `Transmitting Tensor API...` });

        const response = await fetch(`${getBackendURL()}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data_b64: b64, wind_speed: windSpeed, comfort_metric: windComfortMetric })
        });

        if (!response.ok) {
            throw new Error("HTTP Status " + response.status);
        }

        const jsonDecoded = await response.json();
        
        setGanImageUrl("data:image/png;base64," + jsonDecoded.image_base64);
        setWalkabilityStats({ walkabilityAvgDist: `GAN Predict: ${jsonDecoded.width}x${jsonDecoded.height}` });
    };

    // Submit via browser-side ONNX Runtime (GitHub Pages / demo path)
    const submitViaBrowserONNX = async (floatData) => {
        const engine = await getWindEngine((pct, statusText) => {
            setWalkabilityStats({ walkabilityAvgDist: statusText });
        });

        setWalkabilityStats({ walkabilityAvgDist: 'Running Inference...' });

        const canvas = await engine.predict(floatData, windSpeed, windComfortMetric);

        // Create Three.js texture directly from canvas (no base64 PNG round-trip)
        const tex = new THREE.CanvasTexture(canvas);
        tex.flipY = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.center.set(0.5, 0.5);
        const wRad = (useStore.getState().windDirection || 0) * Math.PI / 180;
        tex.rotation = wRad;
        tex.needsUpdate = true;
        setResultTex(tex);

        setWalkabilityStats({ walkabilityAvgDist: `GAN Predict: ${N}x${N}` });
    };

    // Construct the flat Float32Array payload containing R,G,B tensors
    const submitGANPayload = async () => {
        setIsFetching(true);
        setFetchError(null);
        
        try {
            const floatData = buildPayload();

            // Route to backend or browser ONNX based on availability
            const useBackend = await checkBackendAvailable();

            if (useBackend) {
                await submitViaBackend(floatData);
            } else {
                await submitViaBrowserONNX(floatData);
            }
            
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
    }, [windSpeed, windDirection, windComfortMetric, bounds, buildings, buildingEdits]);

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
            
            // Hover 10.5 meters exactly clearing all chunky voxel toposurface heights flawlessly
            pos.setY(i, smoothY + 10.5);
        }
        geo.computeVertexNormals();
        return geo;
    }, [worldW, worldD, bounds.cx, bounds.cz, fullW, fullD, minH, refEn, getEl, currentBounds]);

    if (fetchError && !ganImageUrl && !resultTex) {
        return null;
    }

    // Scale the absolute visual intensity of the non-dimensional GAN mapping
    // to dynamically reflect absolute wind speed states on the slider
    const dynamicOpacity = 1.0;

    return (
        <group>
            {/* Base Underlay Loading Plate */}
            {isFetching && (
                <mesh position={[bounds.cx, 0, -bounds.cz]} geometry={projectedGeometry}>
                     <meshBasicMaterial color="#0A1128" transparent opacity={0.8} depthWrite={false} blending={THREE.NormalBlending} side={THREE.DoubleSide} />
                </mesh>
            )}

            {/* Failsafe Graphic Heatmap (Guarantees Core Thermal Simulation Visibility) */}
            {resultTex && (
                <mesh position={[bounds.cx, 0, -bounds.cz]} geometry={projectedGeometry}>
                     <meshBasicMaterial map={resultTex} transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} blending={THREE.NormalBlending} />
                </mesh>
            )}


        </group>
    );
}
