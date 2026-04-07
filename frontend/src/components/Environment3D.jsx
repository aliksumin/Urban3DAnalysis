import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Html, Line, Sphere, QuadraticBezierLine, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { Water } from 'three-stdlib';
import { buildRoadGraph, computeWalkability } from '../utils/walkabilityGraph';
import WindOverlay from './WindOverlay';

extend({ Water });
import { create } from 'zustand';

export const useStore = create((set) => ({
    currentBounds: null,
    getEl: null,
    selectedBuildingId: null,
    buildingEdits: {},
    buildingColorMode: 'solid',
    solidColor: '#ffffff',
    functionColors: { residential: '#3b82f6', commercial: '#f97316', industrial: '#64748b', office: '#06b6d4', educational: '#eab308', retail: '#ef4444', clinic: '#10b981', school: '#8b5cf6' },
    osmStatus: '',
    setOsmStatus: (status) => set({ osmStatus: status }),
    diagnosticInfo: { ways: 0, bldgs: 0, err: '' },
    setDiagnosticInfo: (info) => set(state => ({ diagnosticInfo: { ...state.diagnosticInfo, ...info } })),
    allBuildings: [],
    showDiagnostics: false,
    walkabilityActive: false,
    walkabilityAgentPos: null,
    walkabilityRadiusMeters: 1000,
    walkabilityReqFuncs: 'retail, clinic, school',
    walkabilityAutoDistribute: false,
    walkabilityTargetFulfill: 'N/A',
    walkabilityActiveNodes: 0,
    walkabilityAvgDist: '--',
    walkabilityPaths: [],
    walkabilityArcs: [],
    walkabilityGraphNodes: [],
    setWalkabilityActive: (val) => set({ walkabilityActive: val }),
    setWalkabilityAgentPos: (pos) => set({ walkabilityAgentPos: pos }),
    setWalkabilityConfig: (conf) => set(state => ({ ...state, ...conf })),
    setWalkabilityRadiusMeters: (val) => set({ walkabilityRadiusMeters: val }),
    setWalkabilityStats: (stats) => set(state => ({ ...state, ...stats })),
    setShowDiagnostics: (show) => set({ showDiagnostics: show }),
    
    windSimActive: false,
    setWindSimActive: (val) => set({ windSimActive: val }),
    windSimBounds: { cx: 0, cz: 0, w: 300, d: 300 },
    setWindSimBounds: (bounds) => set(state => ({ windSimBounds: { ...state.windSimBounds, ...bounds } })),
    windSimRunning: false,
    setWindSimRunning: (val) => set({ windSimRunning: val }),
    windSpeed: 10,
    setWindSpeed: (val) => set({ windSpeed: val }),
    windDirection: 180,
    setWindDirection: (val) => set({ windDirection: val }),
    windParticleFlow: true,
    setWindParticleFlow: (val) => set({ windParticleFlow: val }),
    
    setAllBuildings: (blds) => set({ allBuildings: blds }),
    setSelectedBuildingId: (id) => set({ selectedBuildingId: id }),
    setBuildingEdits: (edits) => set((state) => ({ buildingEdits: typeof edits === 'function' ? edits(state.buildingEdits) : edits })),
    setBuildingColorMode: (mode) => set({ buildingColorMode: mode }),
    setSolidColor: (c) => set({ solidColor: c }),
    setFunctionColors: (fn, c) => set(state => ({ functionColors: { ...state.functionColors, [fn]: c } })),
    setFunctionColorsBatch: (dict) => set(state => ({ functionColors: { ...state.functionColors, ...dict } })),
    loadSceneConfig: (data) => set({ 
        buildingEdits: data.buildingEdits || {}, 
        buildingColorMode: data.buildingColorMode || 'solid',
        solidColor: data.solidColor || '#ffffff',
        functionColors: data.functionColors || { residential: '#3b82f6', commercial: '#f97316', industrial: '#64748b', office: '#06b6d4', educational: '#eab308', retail: '#ef4444', clinic: '#10b981', school: '#8b5cf6' }
    }),
    timeOfDay: 14,
    setTimeOfDay: (val) => set({ timeOfDay: val }),
    weatherClear: 1.0,
    setWeatherClear: (val) => set({ weatherClear: val })
}));

const InstancedVoxels = React.forwardRef(({ data, material, count, vGeom, colors, emissives, onClick, onPointerOver, onPointerOut }, forwardedRef) => {
    const internalMeshRef = useRef();
    const meshRef = forwardedRef || internalMeshRef;
    
    useEffect(() => {
        if (meshRef.current && data) {
            meshRef.current.instanceMatrix.array.set(data);
            meshRef.current.instanceMatrix.needsUpdate = true;
            meshRef.current.frustumCulled = false;
        }
        if (meshRef.current && emissives) {
            meshRef.current.geometry.setAttribute('instanceEmissive', new THREE.InstancedBufferAttribute(emissives, 3));
        }
    }, [data, count, emissives]);
    const internalColorRef = useRef();
    const activeColorRef = internalColorRef;

    if (!data || count === 0) return null;
    return (
        <instancedMesh ref={meshRef} args={[vGeom, material, count]} receiveShadow castShadow frustumCulled={false} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
            {colors && <instancedBufferAttribute ref={internalColorRef} attach="instanceColor" args={[colors, 3]} />}
        </instancedMesh>
    );
});


const dbPromise = new Promise((resolve) => {
    const request = indexedDB.open('UrbanOSM', 38);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains('cache')) db.deleteObjectStore('cache');
        db.createObjectStore('cache');
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
});

const saveToCache = async (key, data) => {
    const db = await dbPromise;
    if (!db) return;
    db.transaction('cache', 'readwrite').objectStore('cache').put(data, key);
};

const getFromCache = async (key) => {
    const db = await dbPromise;
    if (!db) return null;
    return new Promise((resolve) => {
        const req = db.transaction('cache', 'readonly').objectStore('cache').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
};

function unproject(lon, lat, minLon, minLat) {
    const R = 6378137;
    const x = (lon - minLon) * (Math.PI / 180) * R * Math.cos(lat * Math.PI / 180);
    const y = (lat - minLat) * (Math.PI / 180) * R;
    return [x, y];
}

function reproject(x, y, minLon, minLat) {
    const R = 6378137;
    const lat = minLat + (y / R) * (180 / Math.PI);
    const lon = minLon + (x / (R * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);
    return [lon, lat];
}

function PlatformBase({ w, d, refEn, minH, water }) {
    const gRef = useRef();
    const { getEl } = useStore();

    useEffect(() => {
        if (!gRef.current) return;
        const pos = gRef.current.attributes.position.array;

        const pointInPolygon = (point, vs) => {
            let x = point[0], y = point[1];
            let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
                let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };
        const cb = useStore.getState().currentBounds;
        for (let i = 0; i < pos.length; i += 3) {
            const lx = pos[i] + w / 2; // 0 to w
            const ly = d / 2 - pos[i + 2]; // 0 (South) to d (North), matching positive Y shape unproject
            const [lon, lat] = cb ? reproject(lx, ly, cb[0], cb[1]) : [0, 0];
            let h = refEn && getEl && cb ? getEl(lon, lat) : 0;

            if (water) {
                let isWater = false;
                for (let wt of water) {
                    if (pointInPolygon([lx, ly], wt.p)) {
                        let isHole = false;
                        if (wt.h) {
                            for (let hole of wt.h) {
                                if (pointInPolygon([lx, ly], hole)) { isHole = true; break; }
                            }
                        }
                        if (!isHole) { isWater = true; break; }
                    }
                }
                if (isWater) {
                    // Depress the terrain locally to ensure water bodies possess physical basin depths
                    h -= 200;
                }
            }

            const surfaceH = Math.max(0, h - minH);
            if (pos[i + 1] >= 0) {
                pos[i + 1] = surfaceH;
            } else {
                pos[i + 1] = -30;
            }
        }
        gRef.current.computeVertexNormals();
        gRef.current.attributes.position.needsUpdate = true;
    }, [w, d, refEn, minH, getEl]);

    const customMaterial = useMemo(() => {
        const mat = new THREE.MeshStandardMaterial({ color: "#18181b", roughness: 0.9, flatShading: true });
        if (refEn) {
            mat.onBeforeCompile = (shader) => {
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <common>',
                    `#include <common>\nvarying float vElevation;\n`
                ).replace(
                    '#include <begin_vertex>',
                    `#include <begin_vertex>\nvElevation = transformed.y;\n`
                );
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <common>',
                    `#include <common>\nvarying float vElevation;\n`
                ).replace(
                    '#include <color_fragment>',
                    `#include <color_fragment>\n
                     float contourInterval = 5.0;
                     float modDepth = mod(vElevation, contourInterval);
                     float dfdy = fwidth(vElevation);
                     float lineWeight = 0.5;
                     float line = smoothstep(lineWeight * dfdy, 0.0, modDepth) + smoothstep(lineWeight * dfdy, 0.0, contourInterval - modDepth);
                     diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.4, 0.45), line * 0.9);
                    `
                );
            };
        }
        return mat;
    }, [refEn]);

    return (
        <mesh receiveShadow castShadow position={[0, 0, 0]} material={customMaterial}>
            <boxGeometry ref={gRef} args={[w, 6, d, 250, 1, 250]} />
        </mesh>
    );
}

function IsochroneOverlay({ nodes, w, d, minH, refEn, getEl, cb, netColor, walkabilityAgentPos, radiusMeters }) {
    const [texture, setTexture] = useState(null);

    useEffect(() => {
        if (!nodes || nodes.length === 0) {
            setTexture(null);
            return;
        }

        // Only mask out the nodes spheres
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 1024, 1024);

        // Mathematical radius: 50 meters logic range
        // 50m / 800m = ~6.25% of map * 1024px = ~64px
        const radPx = (50 / w) * 1024;
        
        ctx.fillStyle = 'white';
        // Add a slight blur to create a more organic, continuous accessibility heat-zone
        ctx.filter = 'blur(12px)';
        nodes.forEach(n => {
            const cx = (n.x / w) * 1024;
            const cy = (n.y / d) * 1024; 
            ctx.beginPath();
            ctx.arc(cx, cy, radPx, 0, 2 * Math.PI); 
            ctx.fill();
        });
        ctx.filter = 'none';

        const tex = new THREE.CanvasTexture(canvas);
        tex.flipY = false;
        tex.anisotropy = 16;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        setTexture(tex);

        return () => { tex.dispose(); };
    }, [nodes, w, d]);

    const geometry = useMemo(() => {
        // High fidelity plane to gracefully hug voxel terrain elevations perfectly!
        const geo = new THREE.PlaneGeometry(w, d, Math.max(1, Math.floor(w / 3.5)), Math.max(1, Math.floor(d / 3.5))); // dense grid
        geo.rotateX(-Math.PI / 2); // Stand it upright into world coordinates (Y up)
        
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const lx = pos.getX(i) + w / 2;     // 0 to w
            const localZ = pos.getZ(i) - d / 2; // -d to 0
            const lz = -localZ;                 // 0 to d
            
            const [lon, lat] = cb && refEn ? reproject(lx, lz, cb[0], cb[1]) : [0, 0];
            let rawEl = refEn && getEl && cb ? getEl(lon, lat) : 0;
            if (rawEl == null || isNaN(rawEl)) rawEl = 0;
            
            let smoothY = Math.max(0, rawEl - minH);
            
            // Constantly follow the earth topography without artificial ballooning
            // Raised slightly higher to avoid clipping with the discrete voxel steps
            pos.setY(i, smoothY + 6.0);
        }
        geo.computeVertexNormals();
        return geo;
    }, [w, d, minH, refEn, getEl, cb]);

    if (!texture) return null;

    return (
        <mesh position={[w / 2, 0, -d / 2]} geometry={geometry}>
            <meshBasicMaterial 
                color={netColor || "#ffffff"} 
                alphaMap={texture} 
                alphaTest={0.05}
                transparent={true} 
                wireframe={true} 
                opacity={0.35} 
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </mesh>
    );
}

function OsmModel({ bounds, refEn }) {
    const [bldgs, setBldgs] = useState([]);
    const [hwys, setHwys] = useState([]);
    const [water, setWater] = useState([]);
    const [sand, setSand] = useState([]);
    const [w, setW] = useState(800);
    const [d, setD] = useState(800);
    const [minH, setMinH] = useState(0);

    const { getEl, buildingEdits, buildingColorMode, solidColor, functionColors, setSelectedBuildingId, selectedBuildingId, setOsmStatus, setDiagnosticInfo, showDiagnostics, walkabilityActive, walkabilityAgentPos, walkabilityRadiusMeters, setWalkabilityStats, walkabilityPaths, setWalkabilityAgentPos, walkabilityReqFuncs, walkabilityAutoDistribute, setBuildingEdits, setBuildingColorMode, walkabilityTargetFulfill, walkabilityArcs, windSimActive, windSimRunning, windSimBounds } = useStore();
    const buildingMeshRef = useRef(null);
    const [roadGraph, setRoadGraph] = useState(null);

    useEffect(() => {
        if (hwys.length > 0) setRoadGraph(buildRoadGraph(hwys, getEl));
    }, [hwys, getEl]);

    useEffect(() => {
        if (!roadGraph || !walkabilityAgentPos) return;
        const stats = computeWalkability(roadGraph, walkabilityAgentPos, walkabilityRadiusMeters);
        
        const reqFns = walkabilityReqFuncs.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const withinBids = new Set();
        let satisfiability = {};
        reqFns.forEach(fn => satisfiability[fn] = 0);
        
        const editsToApply = { ...buildingEdits };
        let madeEdits = false;
        const newArcs = [];

        bldgs.forEach(b => {
            const bx = (b.minX + b.maxX) / 2;
            const by = (b.minY + b.maxY) / 2;
            
            for (let node of stats.reachableNodes) {
                if (Math.hypot(bx - node.x, by - node.y) < 100) {
                    withinBids.add(b.id);
                    
                    const edit = editsToApply[b.id] || {};
                    let currFunc = 'unknown';
                    
                    if (edit.func) {
                        currFunc = edit.func;
                    } else if (edit.tags || b.tags) {
                        const tags = { ...(b.tags || {}), ...(edit.tags || {}) };
                        const fT = tags.building || tags.amenity || 'unknown';
                        let parsed = fT.toLowerCase();
                        if (parsed === 'yes') parsed = tags.amenity || 'unknown';
                        if (parsed === 'apartments' || parsed === 'house') parsed = 'residential';
                        if (parsed === 'shop' || parsed === 'supermarket') parsed = 'retail';
                        if (parsed === 'warehouse') parsed = 'industrial';
                        if (parsed === 'university' || parsed === 'kindergarten') parsed = 'school';
                        if (parsed === 'doctors') parsed = 'clinic';
                        currFunc = parsed;
                    }
                    
                    if (satisfiability[currFunc] !== undefined) {
                        satisfiability[currFunc]++;
                        if (satisfiability[currFunc] === 1 || walkabilityTargetFulfill === 'N/A') { 
                            // Only draw an arc to the first one found, or maybe all of them?
                            // Let's just draw arcs to the first few to avoid visual clutter
                            if (satisfiability[currFunc] <= 2) {
                                newArcs.push({
                                    bid: b.id,
                                    pos: [bx, minH + 50, -by],
                                    color: functionColors[currFunc] || '#ff0055'
                                });
                            }
                        }
                    }
                    break;
                }
            }
        });
        
        if (walkabilityAutoDistribute && reqFns.length > 0) {
            let availableBids = Array.from(withinBids);
            for (let reqFn of reqFns) {
                if (satisfiability[reqFn] === 0 && availableBids.length > 0) {
                    const rndIdx = Math.floor(Math.random() * availableBids.length);
                    const bid = availableBids[rndIdx];
                    availableBids.splice(rndIdx, 1);
                    
                    const assignColor = functionColors[reqFn] || '#ff0055';
                    editsToApply[bid] = { ...editsToApply[bid], func: reqFn, color: assignColor };
                    satisfiability[reqFn]++;
                    madeEdits = true;
                    
                    const targetB = bldgs.find(xb => xb.id === bid);
                    if (targetB) {
                        newArcs.push({
                            bid: bid,
                            pos: [(targetB.minX + targetB.maxX) / 2, minH + 50, -(targetB.minY + targetB.maxY) / 2],
                            color: assignColor
                        });
                    }
                }
            }
        }
        
        if (madeEdits) {
            setBuildingEdits(editsToApply);
            setBuildingColorMode('property');
        }

        let totalRecs = 0;
        let fulfilled = 0;
        for (let v of Object.values(satisfiability)) {
            totalRecs++;
            if (v > 0) fulfilled++;
        }
        
        setWalkabilityStats({
            walkabilityActiveNodes: stats.reachableNodes.length,
            walkabilityTargetFulfill: `${fulfilled}/${totalRecs}`,
            walkabilityAvgDist: Math.floor(stats.reachableNodes.length > 0 ? (walkabilityRadiusMeters / 2) : 0),
            walkabilityPaths: stats.paths,
            walkabilityGraphNodes: stats.reachableNodes,
            walkabilityArcs: newArcs
        });
    }, [walkabilityAgentPos, walkabilityRadiusMeters, roadGraph, walkabilityReqFuncs, walkabilityAutoDistribute]);

    const loadTerrainHeights = async (minLon, minLat, maxLon, maxLat) => {
        const zoom = 14;
        const lat2tile = (lat, zoom) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
        const lon2tile = (lon, zoom) => Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
        const xMin = lon2tile(minLon, zoom), xMax = lon2tile(maxLon, zoom);
        const yMin = lat2tile(maxLat, zoom), yMax = lat2tile(minLat, zoom);

        const tiles = {};
        const promises = [];
        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                promises.push((async () => {
                    try {
                        const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`);
                        if (!res.ok) return;
                        const blob = await res.blob();
                        const img = new Image();
                        img.src = URL.createObjectURL(blob);
                        await new Promise(r => {
                            img.onload = r;
                            img.onerror = r;
                        });
                        const canvas = document.createElement('canvas');
                        canvas.width = 256; canvas.height = 256;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        tiles[`${x}_${y}`] = ctx.getImageData(0, 0, 256, 256).data;
                    } catch (e) { }
                })());
            }
        }
        await Promise.all(promises);

        useStore.setState({
            getEl: (rawLon, rawLat) => {
                const lon = Math.max(minLon, Math.min(rawLon, maxLon));
                const lat = Math.max(minLat, Math.min(rawLat, maxLat));
                const n = Math.pow(2, zoom);
                const xt = (lon + 180) / 360 * n;
                const yt = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
                const tx = Math.floor(xt), ty = Math.floor(yt);
                const px = Math.floor((xt - tx) * 256), py = Math.floor((yt - ty) * 256);
                const data = tiles[`${tx}_${ty}`];
                if (!data) return 0;
                const idx = (py * 256 + px) * 4;
                const rawH = (data[idx] * 256 + data[idx + 1] + data[idx + 2] / 256) - 32768;
                return rawH;
            }
        });
    };

    useEffect(() => {
        if (!bounds) return;
        useStore.setState({ currentBounds: bounds });
        if (refEn) {
            setOsmStatus('Extracting 3D Topographical Maps...');
            loadTerrainHeights(bounds[0], bounds[1], bounds[2], bounds[3]);
        }
        else useStore.setState({ getEl: () => 0 });
    }, [bounds, refEn]);

    useEffect(() => {
        if (!getEl || !bounds) return;

        const ext = unproject(Math.max(bounds[0], bounds[2]), Math.max(bounds[1], bounds[3]), Math.min(bounds[0], bounds[2]), Math.min(bounds[1], bounds[3]));
        setW(ext[0]); setD(ext[1]);

        const b = `${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]}`;

        getFromCache(b).then(cached => {
            if (cached && (cached.blds?.length > 0 || cached.hwys?.length > 0 || cached.watr?.length > 0 || cached.snd?.length > 0)) {
                setOsmStatus('');
                setMinH(cached.computedMinH);
                setBldgs(cached.blds); setHwys(cached.hwys); setWater(cached.watr); setSand(cached.snd);
                useStore.getState().setAllBuildings(cached.blds);
                return;
            }

            const fetchOsmData = async (minLon, minLat, maxLon, maxLat) => {
                setOsmStatus('Downloading geometry from Overpass (heavy)...');
                
                const query = `
                    [out:xml][timeout:90];
                    (
                      way["building"](${minLat},${minLon},${maxLat},${maxLon});
                      way["highway"](${minLat},${minLon},${maxLat},${maxLon});
                      way["natural"="coastline"](${minLat},${minLon},${maxLat},${maxLon});
                      way["natural"="water"](${minLat},${minLon},${maxLat},${maxLon});
                      way["natural"="sand"](${minLat},${minLon},${maxLat},${maxLon});
                      way["natural"="beach"](${minLat},${minLon},${maxLat},${maxLon});
                      way["waterway"](${minLat},${minLon},${maxLat},${maxLon});
                      way["water"](${minLat},${minLon},${maxLat},${maxLon});
                      way["landuse"="basin"](${minLat},${minLon},${maxLat},${maxLon});
                      way["landuse"="reservoir"](${minLat},${minLon},${maxLat},${maxLon});
                      relation["building"](${minLat},${minLon},${maxLat},${maxLon});
                      relation["natural"="water"](${minLat},${minLon},${maxLat},${maxLon});
                      relation["natural"="bay"](${minLat},${minLon},${maxLat},${maxLon});
                      relation["waterway"](${minLat},${minLon},${maxLat},${maxLon});
                      relation["water"](${minLat},${minLon},${maxLat},${maxLon});
                    );
                    (._;>;);
                    out body;
                `;
                
                const allWays = [];
                const allRelations = [];
                try {
                        let res;
                        let endpoint = 'Overpass POST';
                        try {
                            const params = new URLSearchParams();
                            params.append('data', query);
                            res = await fetch(`https://overpass-api.de/api/interpreter`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: params.toString(),
                                cache: 'no-store'
                            });
                            if (!res.ok) throw new Error('POST failed');
                        } catch (postErr) {
                            endpoint = 'Overpass GET';
                            res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { cache: 'no-store' });
                            
                            // If Overpass GET also fails or is empty, use OSM API directly
                            if (!res.ok) {
                                endpoint = 'OSM API';
                                res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${sMinLon},${sMinLat},${sMaxLon},${sMaxLat}`, { cache: 'no-store' });
                            }
                        }
                        
                    if (!res.ok) throw new Error(`${endpoint} failed: ` + res.status);
                    let xml = await res.text();
                    
                    if (!xml || xml.trim().length === 0) {
                        endpoint = 'OSM API Fallback';
                        res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${sMinLon},${sMinLat},${sMaxLon},${sMaxLat}`, { cache: 'no-store' });
                        if (!res.ok) throw new Error('OSM Fallback failed: ' + res.status);
                        xml = await res.text();
                    }

                    const xmlStrSample = xml.length + " chars " + (xml.substring(0, 30));
                    setDiagnosticInfo({ err: `Endpoint: ${endpoint}` });
                    setOsmStatus('Parsing XML nodes...');
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(xml, 'text/xml');

                    const nodes = {};
                    Array.from(doc.getElementsByTagName('node')).forEach(n => {
                        nodes[n.getAttribute('id')] = {
                            lon: parseFloat(n.getAttribute('lon')),
                            lat: parseFloat(n.getAttribute('lat'))
                        };
                    });

                    const wayMap = {};
                    Array.from(doc.getElementsByTagName('way')).forEach(way => {
                        const tags = {};
                        Array.from(way.getElementsByTagName('tag')).forEach(t => tags[t.getAttribute('k')] = t.getAttribute('v'));
                        const nds = Array.from(way.getElementsByTagName('nd')).map(nd => nodes[nd.getAttribute('ref')]).filter(Boolean);
                        if (nds.length > 2) allWays.push({ id: way.getAttribute('id'), tags, geometry: nds });
                        wayMap[way.getAttribute('id')] = nds;
                    });

                    Array.from(doc.getElementsByTagName('relation')).forEach(rel => {
                        const tags = {};
                        Array.from(rel.getElementsByTagName('tag')).forEach(t => tags[t.getAttribute('k')] = t.getAttribute('v'));
                        const members = Array.from(rel.getElementsByTagName('member')).map(m => ({
                            type: m.getAttribute('type'),
                            ref: m.getAttribute('ref'),
                            role: m.getAttribute('role') || '',
                            geometry: m.getAttribute('type') === 'way' ? (wayMap[m.getAttribute('ref')] || null) : null
                        }));
                        if (members.some(m => m.geometry)) {
                            allRelations.push({ id: rel.getAttribute('id'), tags, members });
                        }
                    });
                    setDiagnosticInfo({ ways: allWays.length, xmlHead: xmlStrSample });
                } catch (e) {
                    console.error("Overpass failed", e);
                    setDiagnosticInfo({ err: e.message });
                    setOsmStatus('ERROR: Overpass API Failed. You may be rate-limited.');
                    setTimeout(() => setOsmStatus(''), 8000);
                }
                return { ways: allWays, relations: allRelations };
            };

            const sMinLon = Math.min(bounds[0], bounds[2]);
            const sMinLat = Math.min(bounds[1], bounds[3]);
            const sMaxLon = Math.max(bounds[0], bounds[2]);
            const sMaxLat = Math.max(bounds[1], bounds[3]);

            fetchOsmData(sMinLon, sMinLat, sMaxLon, sMaxLat)
                .then(allWays => {
                    if (allWays.ways.length === 0) return; // Keep error on screen if threw
                    setOsmStatus('');
                    const blds = [], hwys = [], watr = [], snd = [];
                    const unclosedCoasts = [];
                    const closedCoasts = [];

                    const dLon = Math.abs(bounds[2] - bounds[0]);
                    const dLat = Math.abs(bounds[3] - bounds[1]);
                    const latMid = (bounds[1] + bounds[3]) / 2;
                    const wVal = dLon * 111320.0 * Math.cos(latMid * Math.PI / 180.0);
                    const dVal = dLat * 111320.0;

                    allWays.ways.forEach(el => {
                        let pts = el.geometry.map(g => [g.lon, g.lat]);
                        let ls = el.geometry.map(g => [g.lon, g.lat]);
                        pts = pts.map(p => unproject(p[0], p[1], sMinLon, sMinLat));

                        const isCoast = el.tags?.natural === 'coastline';
                        const isWater = el.tags?.natural === 'water' || el.tags?.waterway === 'riverbank' || el.tags?.waterway === 'dock' ||
                            el.tags?.water === 'lake' || el.tags?.water === 'river' || el.tags?.water === 'reservoir' ||
                            el.tags?.water === 'basin' || el.tags?.landuse === 'basin' || el.tags?.landuse === 'reservoir' || el.tags?.natural === 'bay' || el.tags?.water === 'sea' || 
                            el.tags?.building === 'reservoir' || el.tags?.building === 'pool' || el.tags?.amenity === 'water' || el.tags?.leisure === 'swimming_pool' || el.tags?.amenity === 'fountain';

                        if (el.tags?.building && !isWater) {
                            let h = el.tags?.height ? parseFloat(el.tags.height) : (el.tags?.['building:levels'] ? parseInt(el.tags['building:levels']) * 3 : 10);
                            if (isNaN(h) || h <= 0) h = 10;
                            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                            pts.forEach(p => {
                                if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
                                if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
                            });
                            
                            blds.push({ id: el.id, tags: el.tags, p: pts, h, ls, el: 0, minX, maxX, minY, maxY });
                        } else if (el.tags?.highway) {
                            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                            pts.forEach(p => {
                                if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
                                if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
                            });
                            hwys.push({ p: pts, ls, minX, maxX, minY, maxY });
                        } else if (el.tags?.natural === 'beach' || el.tags?.natural === 'sand') {
                            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                            pts.forEach(p => {
                                if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
                                if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
                            });
                            snd.push({ p: pts, ls, minX, maxX, minY, maxY });
                        } else {
                            if (isCoast || isWater) {
                                // Filter out linear centerlines natively by checking if the way is topologically closed.
                                const firstPt = pt => pt[0].toFixed(5) + ',' + pt[1].toFixed(5);
                                const isClosed = firstPt(pts[0]) === firstPt(pts[pts.length - 1]);

                                const originalFirst = el.geometry[0];
                                const originalLast = el.geometry[el.geometry.length - 1];
                                const isOnEdge = (lon, lat) => {
                                    const lonD = Math.min(Math.abs(lon - sMinLon), Math.abs(lon - sMaxLon));
                                    const latD = Math.min(Math.abs(lat - sMinLat), Math.abs(lat - sMaxLat));
                                    return lonD < 0.005 || latD < 0.005; // Generous 500-meter margin for tile gaps
                                };
                                const isClipped = isOnEdge(originalFirst.lon, originalFirst.lat) || isOnEdge(originalLast.lon, originalLast.lat);

                                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                                pts.forEach(p => {
                                    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
                                    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
                                });

                                // Coastlines are allowed to be open. Inland water ways MUST be closed OR geometrically clipped.
                                if (isCoast) {
                                    if (isClosed) closedCoasts.push({ p: pts, ls, el: 0, isCoast: true, h: [], minX, maxX, minY, maxY });
                                    else unclosedCoasts.push({ p: pts, ls, el: 0, isCoast: true, h: [], minX, maxX, minY, maxY });
                                } else if (isClosed || isClipped) {
                                    watr.push({ p: pts, ls, el: 0, isCoast: false, h: [], minX, maxX, minY, maxY });
                                } else {
                                    let closedPts = [...pts];
                                    closedPts.push(pts[0]);
                                    watr.push({ p: closedPts, ls: closedPts.map(p => [p[0], p[1]]), el: 0, isCoast: false, h: [], minX, maxX, minY, maxY });
                                }
                            }
                        }
                    });

                    // Process relations for multipolygon water (seas, bays, large lakes)
                    allWays.relations.forEach(rel => {
                        if (!rel.tags) return;
                        const isCoast = rel.tags.natural === 'coastline';
                        const isWater = rel.tags.natural === 'water' || rel.tags.waterway === 'riverbank' || rel.tags.waterway === 'dock' ||
                            rel.tags.water === 'lake' || rel.tags.water === 'river' || rel.tags.water === 'reservoir' || rel.tags.water === 'basin' || rel.tags.waterway === 'river' ||
                            rel.tags.landuse === 'basin' || rel.tags.landuse === 'reservoir' ||
                            (rel.tags.type === 'multipolygon' && (rel.tags.natural === 'water' || rel.tags.natural === 'bay' || rel.tags.waterway === 'river')) || rel.tags.natural === 'bay' || rel.tags.water === 'sea';

                        if (!isCoast && !isWater) return;

                        // Get outer member ways
                        const outerWays = rel.members.filter(m => m.role === 'outer' || m.role === '').map(m => m.geometry).filter(Boolean);

                        // Native chain algorithm for relations
                        const chains = [];
                        const used = new Set();
                        outerWays.forEach((wayGeom, idx) => {
                            if (used.has(idx) || wayGeom.length < 2) return;
                            used.add(idx);
                            let chain = [...wayGeom];
                            let changed = true;
                            while (changed) {
                                changed = false;
                                for (let j = 0; j < outerWays.length; j++) {
                                    if (used.has(j) || outerWays[j].length < 2) continue;
                                    const ow = outerWays[j];
                                    const last = chain[chain.length - 1];
                                    const first = chain[0];
                                    const EPS = 0.005;

                                    if (Math.abs(last.lon - ow[0].lon) < EPS && Math.abs(last.lat - ow[0].lat) < EPS) {
                                        chain = chain.concat(ow.slice(1));
                                        used.add(j); changed = true;
                                    } else if (Math.abs(last.lon - ow[ow.length - 1].lon) < EPS && Math.abs(last.lat - ow[ow.length - 1].lat) < EPS) {
                                        chain = chain.concat([...ow].reverse().slice(1));
                                        used.add(j); changed = true;
                                    } else if (Math.abs(first.lon - ow[ow.length - 1].lon) < EPS && Math.abs(first.lat - ow[ow.length - 1].lat) < EPS) {
                                        chain = ow.slice(0, ow.length - 1).concat(chain);
                                        used.add(j); changed = true;
                                    } else if (Math.abs(first.lon - ow[0].lon) < EPS && Math.abs(first.lat - ow[0].lat) < EPS) {
                                        chain = [...ow].reverse().slice(0, ow.length - 1).concat(chain);
                                        used.add(j); changed = true;
                                    }
                                }
                            }
                            chains.push(chain);
                        });

                        const innerWays = rel.members.filter(m => m.role === 'inner').map(m => m.geometry).filter(Boolean);
                        const innerChains = [];
                        const innerUsed = new Set();
                        innerWays.forEach((wayGeom, idx) => {
                            if (innerUsed.has(idx) || wayGeom.length < 2) return;
                            innerUsed.add(idx);
                            let chain = [...wayGeom];
                            let changed = true;
                            while (changed) {
                                changed = false;
                                for (let j = 0; j < innerWays.length; j++) {
                                    if (innerUsed.has(j) || innerWays[j].length < 2) continue;
                                    const ow = innerWays[j];
                                    const last = chain[chain.length - 1];
                                    const first = chain[0];
                                    const EPS = 0.005;

                                    if (Math.abs(last.lon - ow[0].lon) < EPS && Math.abs(last.lat - ow[0].lat) < EPS) {
                                        chain = chain.concat(ow.slice(1));
                                        innerUsed.add(j); changed = true;
                                    } else if (Math.abs(last.lon - ow[ow.length - 1].lon) < EPS && Math.abs(last.lat - ow[ow.length - 1].lat) < EPS) {
                                        chain = chain.concat([...ow].reverse().slice(1));
                                        innerUsed.add(j); changed = true;
                                    } else if (Math.abs(first.lon - ow[ow.length - 1].lon) < EPS && Math.abs(first.lat - ow[ow.length - 1].lat) < EPS) {
                                        chain = ow.slice(0, ow.length - 1).concat(chain);
                                        innerUsed.add(j); changed = true;
                                    } else if (Math.abs(first.lon - ow[0].lon) < EPS && Math.abs(first.lat - ow[0].lat) < EPS) {
                                        chain = [...ow].reverse().slice(0, ow.length - 1).concat(chain);
                                        innerUsed.add(j); changed = true;
                                    }
                                }
                            }
                            innerChains.push(chain);
                        });

                        const parsedHoles = innerChains.map(chain => {
                            if (chain.length < 3) return null;
                            return chain.map(g => unproject(g.lon, g.lat, sMinLon, sMinLat));
                        }).filter(Boolean);

                        chains.forEach(chain => {
                            if (chain.length < 3) return;
                            let pts = chain.map(g => unproject(g.lon, g.lat, sMinLon, sMinLat));
                            let ls = chain.map(g => [g.lon, g.lat]);

                            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                            pts.forEach(p => {
                                if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
                                if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
                            });

                            const pointInPolygon = (point, vs) => {
                                let x = point[0], y = point[1], inside = false;
                                for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                                    let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
                                    let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                                    if (intersect) inside = !inside;
                                }
                                return inside;
                            };

                            const validHoles = parsedHoles.filter(holePts => {
                                return pointInPolygon(holePts[0], pts);
                            });

                            if (isCoast) {
                                if (isClosed) closedCoasts.push({ p: pts, ls, el: 0, isCoast: true, h: validHoles, minX, maxX, minY, maxY });
                                else unclosedCoasts.push({ p: pts, ls, el: 0, isCoast: true, h: validHoles, minX, maxX, minY, maxY });
                            } else {
                                watr.push({ p: pts, ls, el: 0, isCoast: false, h: validHoles, minX, maxX, minY, maxY });
                            }
                        });
                    });

                    // Forcefully unify all disconnected coastline segments natively
                    while (unclosedCoasts.length > 1) {
                        let best = { i: -1, j: -1, dist: Infinity };
                        for (let i = 0; i < unclosedCoasts.length; i++) {
                            for (let j = 0; j < unclosedCoasts.length; j++) {
                                if (i === j) continue;
                                let c1 = unclosedCoasts[i].p;
                                let c2 = unclosedCoasts[j].p;
                                let d = Math.pow(c1[c1.length - 1][0] - c2[0][0], 2) + Math.pow(c1[c1.length - 1][1] - c2[0][1], 2);
                                if (d < best.dist) best = { i, j, dist: d };
                            }
                        }

                        if (best.dist > 100000) break; // Do not merge disjoint islands/coasts

                        let c1 = unclosedCoasts[best.i];
                        let c2 = unclosedCoasts[best.j];

                        let mergedP = c1.p.concat(c2.p.slice(1));
                        let mergedLs = c1.ls.concat(c2.ls.slice(1));
                        let mergedH = [...(c1.h || []), ...(c2.h || [])];
                        let minX = Math.min(c1.minX, c2.minX);
                        let maxX = Math.max(c1.maxX, c2.maxX);
                        let minY = Math.min(c1.minY, c2.minY);
                        let maxY = Math.max(c1.maxY, c2.maxY);

                        let mergedCoast = { p: mergedP, ls: mergedLs, el: 0, isCoast: true, h: mergedH, minX, maxX, minY, maxY };

                        unclosedCoasts.splice(Math.max(best.i, best.j), 1);
                        unclosedCoasts.splice(Math.min(best.i, best.j), 1);
                        unclosedCoasts.push(mergedCoast);
                    }

                    // Apply global boundary routing to ALL remaining unified coastline strings
                    unclosedCoasts.forEach(coast => {
                        let pts = coast.p;
                        const first = pts[0];
                        const last = pts[pts.length - 1];

                        const getEdge = (pt) => {
                            const EPS = 0.5;
                            if (pt[1] >= dVal - EPS) return 0; // Top boundary (North)
                            if (pt[0] >= wVal - EPS) return 1; // Right boundary (East)
                            if (pt[1] <= EPS) return 2;        // Bottom boundary (South)
                            if (pt[0] <= EPS) return 3;        // Left boundary (West)
                            return -1;
                        };

                        const nextCornerForEdge = {
                            0: { corner: [wVal, dVal], nextEdge: 1 },      // Top boundary exits East to Right boundary
                            1: { corner: [wVal, 0], nextEdge: 2 },         // Right boundary exits South to Bottom boundary
                            2: { corner: [0, 0], nextEdge: 3 },            // Bottom boundary exits West to Left boundary
                            3: { corner: [0, dVal], nextEdge: 0 }          // Left boundary exits North to Top boundary
                        };

                        let currEdge = getEdge(last);
                        let targetEdge = getEdge(first);

                        if (currEdge === -1) {
                            const eDists = [Math.abs(last[1] - dVal), Math.abs(last[0] - wVal), Math.abs(last[1]), Math.abs(last[0])];
                            currEdge = eDists.indexOf(Math.min(...eDists));
                        }
                        if (targetEdge === -1) {
                            const eDists = [Math.abs(first[1] - dVal), Math.abs(first[0] - wVal), Math.abs(first[1]), Math.abs(first[0])];
                            targetEdge = eDists.indexOf(Math.min(...eDists));
                        }

                        const clampToEdge = (pt, edge) => {
                            if (edge === 0) return [pt[0], dVal];
                            if (edge === 1) return [wVal, pt[1]];
                            if (edge === 2) return [pt[0], 0];
                            if (edge === 3) return [0, pt[1]];
                            return [pt[0], pt[1]];
                        };

                        const extLast = clampToEdge(last, currEdge);
                        const extFirst = clampToEdge(first, targetEdge);

                        pts.push(extLast);
                        if (currEdge === targetEdge) {
                            pts.push(extFirst);
                        } else {
                            while (currEdge !== targetEdge) {
                                let step = nextCornerForEdge[currEdge];
                                pts.push(step.corner);
                                currEdge = step.nextEdge;
                            }
                            pts.push(extFirst);
                        }
                        pts.push(pts[0]);

                        // IMPORTANT: Recalculate Bounding Box because we just appended corners extending to the map bounds!
                        for (let pt of pts) {
                            if (pt[0] < coast.minX) coast.minX = pt[0];
                            if (pt[0] > coast.maxX) coast.maxX = pt[0];
                            if (pt[1] < coast.minY) coast.minY = pt[1];
                            if (pt[1] > coast.maxY) coast.maxY = pt[1];
                        }

                        closedCoasts.push(coast);
                    });

                    // Push all naturally closed and synthetically rounded coastlines to output
                    watr.push(...closedCoasts);

                    if (blds.length || hwys.length || watr.length || snd.length) {
                        let computedMinH = 0;
                        if (refEn && getEl) {
                            let minHVal = Infinity;
                            blds.forEach(b => {
                                b.el = getEl(b.ls[0][0], b.ls[0][1]);
                                if (!isNaN(b.el)) minHVal = Math.min(minHVal, b.el);
                            });
                            watr.forEach(w => {
                                let minFound = Infinity;
                                let maxFound = -Infinity;
                                w.ls.forEach(pt => {
                                    // Remove bounding box constraint that arbitrarily rejected internal map lakes/ponds!
                                    const el = getEl(pt[0], pt[1]);
                                    if (!isNaN(el)) {
                                        if (el < minFound) minFound = el;
                                        if (el > maxFound) maxFound = el;
                                    }
                                });
                                if (minFound === Infinity) minFound = 0;
                                if (maxFound === -Infinity) maxFound = 0;

                                w.el = minFound;
                                w.bottom = minFound - 10;
                                if (!isNaN(w.bottom)) minHVal = Math.min(minHVal, w.bottom);
                            });
                            snd.forEach(s => { s.el = getEl(s.ls[0][0], s.ls[0][1]); minHVal = Math.min(minHVal, s.el); });
                            computedMinH = minHVal === Infinity ? 0 : Math.max(0, minHVal);
                        }
                        console.log('[WATER DEBUG] Buildings:', blds.length, 'Water:', watr.length, 'Roads:', hwys.length);
                        if (blds.length > 0) console.log('[WATER DEBUG] First building pt:', blds[0].p[0]);
                        if (watr.length > 0) console.log('[WATER DEBUG] First water pt:', watr[0].p[0], 'pts count:', watr[0].p.length);
                        setMinH(computedMinH);
                        setDiagnosticInfo({ bldgs: blds.length });
                        setBldgs(blds); setHwys(hwys); setWater(watr); setSand(snd);
                        useStore.getState().setAllBuildings(blds);
                        saveToCache(b, { blds, hwys, watr, snd, computedMinH });
                    } else { setOsmStatus('No vector data found in this area.'); setTimeout(() => setOsmStatus(''), 8000); }
                })
                .catch(err => {
                    setOsmStatus(`OSM Download Failed: ${err.message}`);
                    setBldgs([]); setHwys([]); setWater([]); setSand([]);
                    setTimeout(() => setOsmStatus(''), 8000);
                });
        });
    }, [bounds, refEn, getEl]);

    const clipPlanes = useMemo(() => [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), w / 2),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), w / 2),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), d / 2),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), d / 2)
    ], [w, d]);

    const { terrainData, waterData, buildingData, roadData, sandData, buildingIdsByInstance, buildingColors, buildingEmissives, buildingInstanceMeta } = useMemo(() => {
        if (!bldgs || !water || w === 0 || d === 0) return { terrainData: new Float32Array(0), waterData: new Float32Array(0), buildingData: new Float32Array(0), roadData: new Float32Array(0), sandData: new Float32Array(0), buildingIdsByInstance: [], buildingColors: null, buildingEmissives: null, buildingInstanceMeta: [] };
        const dummy = new THREE.Object3D();
        const cDummy = new THREE.Color();
        const vSize = Math.max(1, Math.floor(w / 800)); // Optimal high resolution
        const hSize = Math.max(1, Math.floor(w / 800));
        
        const cols = Math.floor(w / vSize) + 1;
        const rows = Math.floor(d / vSize) + 1;
        const maxVoxels = cols * rows;

        const tArr = new Float32Array(maxVoxels * 16);
        const wArr = new Float32Array(maxVoxels * 16);
        const bArr = new Float32Array(maxVoxels * 16);
        const rArr = new Float32Array(maxVoxels * 16);
        const sArr = new Float32Array(maxVoxels * 16);
        const bCol = new Float32Array(maxVoxels * 3);
        const bEmi = new Float32Array(maxVoxels * 3);
        const bInstIds = [];
        const bMeta = [];

        let tIdx = 0, wIdx = 0, bIdx = 0, rIdx = 0, sIdx = 0, bcIdx = 0;

        const cb = useStore.getState().currentBounds;

        const setMatrix = (arr, idx, px, py, pz, sx, sy, sz) => {
            arr[idx] = sx; arr[idx+1] = 0; arr[idx+2] = 0; arr[idx+3] = 0;
            arr[idx+4] = 0; arr[idx+5] = sy; arr[idx+6] = 0; arr[idx+7] = 0;
            arr[idx+8] = 0; arr[idx+9] = 0; arr[idx+10]= sz; arr[idx+11]= 0;
            arr[idx+12]= px; arr[idx+13]= py; arr[idx+14]= pz; arr[idx+15]= 1;
        };

        const ptInPoly = (point, vs) => {
            let x = point[0], y = point[1], inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
                let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        const distToSegmentSquared = (p, v, wPt) => {
            let l2 = Math.pow(v[0] - wPt[0], 2) + Math.pow(v[1] - wPt[1], 2);
            if (l2 === 0) return Math.pow(p[0] - v[0], 2) + Math.pow(p[1] - v[1], 2);
            let t = ((p[0] - v[0]) * (wPt[0] - v[0]) + (p[1] - v[1]) * (wPt[1] - v[1])) / l2;
            t = Math.max(0, Math.min(1, t));
            return Math.pow(p[0] - (v[0] + t * (wPt[0] - v[0])), 2) + Math.pow(p[1] - (v[1] + t * (wPt[1] - v[1])), 2);
        };

        const CELL_SIZE = 100;
        const bldgsGrid = new Map();
        const watrGrid = new Map();
        const hwysGrid = new Map();
        const sandGrid = new Map();

        const addToGrid = (item, grid) => {
            const minCx = Math.floor(item.minX / CELL_SIZE);
            const maxCx = Math.floor(item.maxX / CELL_SIZE);
            const minCz = Math.floor(item.minY / CELL_SIZE);
            const maxCz = Math.floor(item.maxY / CELL_SIZE);
            for(let cx=minCx; cx<=maxCx; cx++) {
                for(let cz=minCz; cz<=maxCz; cz++) {
                    const key = cx + "_" + cz;
                    if(!grid.has(key)) grid.set(key, []);
                    grid.get(key).push(item);
                }
            }
        };

        water.forEach(w => addToGrid(w, watrGrid));
        bldgs.forEach(b => addToGrid(b, bldgsGrid));
        hwys.forEach(h => addToGrid(h, hwysGrid));
        sand.forEach(s => addToGrid(s, sandGrid));

        for (let x = 0; x <= w; x += vSize) {
            for (let z = 0; z >= -d; z -= vSize) {
                const lx = x;
                const lz = -z;
                const [lon, lat] = cb ? reproject(lx, lz, cb[0], cb[1]) : [0, 0];
                let rawEl = refEn && getEl && cb ? getEl(lon, lat) : 0;
                if (rawEl == null || isNaN(rawEl)) rawEl = 0;

                let isBuilding = false, bHeight = 0, isWater = false, wtEl = 0, isRoad = false, isSand = false;
                
                const cx = Math.floor(lx / CELL_SIZE);
                const cz = Math.floor(lz / CELL_SIZE);
                const cellKey = cx + "_" + cz;

                const cellWatr = watrGrid.get(cellKey) || [];
                const cellBldgs = bldgsGrid.get(cellKey) || [];
                const cellHwys = hwysGrid.get(cellKey) || [];
                const cellSand = sandGrid.get(cellKey) || [];

                // Priority 1: Water
                for (let wt of cellWatr) {
                    if (lx < wt.minX || lx > wt.maxX || lz < wt.minY || lz > wt.maxY) continue;
                    if (ptInPoly([lx, lz], wt.p)) {
                        let isHole = false;
                        if (wt.h) {
                            for (let hole of wt.h) {
                                if (ptInPoly([lx, lz], hole)) { isHole = true; break; }
                            }
                        }
                        if (!isHole) {
                            isWater = true;
                            wtEl = wt.el;
                            break;
                        }
                    }
                }

                let matchedBuilding = null;
                // Priority 2: Building
                if (!isWater) {
                    for (let b of cellBldgs) {
                        if (lx < b.minX || lx > b.maxX || lz < b.minY || lz > b.maxY) continue;
                        if (ptInPoly([lx, lz], b.p)) {
                            isBuilding = true; bHeight = b.h; matchedBuilding = b; break;
                        }
                    }
                }

                // Priority 3: Road
                if (!isWater && !isBuilding) {
                    for (let h of cellHwys) {
                        if (lx < h.minX - 10 || lx > h.maxX + 10 || lz < h.minY - 10 || lz > h.maxY + 10) continue;
                        for (let i = 0; i < h.p.length - 1; i++) {
                            if (distToSegmentSquared([lx, lz], h.p[i], h.p[i + 1]) < 10) {
                                isRoad = true; break;
                            }
                        }
                        if (isRoad) break;
                    }
                }

                // Priority 4: Sand/Beach
                if (!isWater && !isBuilding && !isRoad) {
                    for (let s of cellSand) {
                        if (lx < s.minX || lx > s.maxX || lz < s.minY || lz > s.maxY) continue;
                        if (ptInPoly([lx, lz], s.p)) {
                            isSand = true; break;
                        }
                    }
                }

                let baseTerrain = rawEl;
                if (isWater) {
                    baseTerrain -= 50; // Deeply sink terrain for water basins
                } else if (isSand) {
                    baseTerrain -= 2; // Slight dip for beaches
                }

                let topY = Math.floor(Math.max(0, baseTerrain - minH) / hSize) * hSize;

                if (isWater) {
                    // Flush with the calculated depression without artificial building hSize inflation
                    let waterY = Math.floor(Math.max(0, wtEl - minH) / hSize) * hSize;
                    let wHeight = waterY - (-10) + hSize;
                    let wP_y = -10 + wHeight / 2 - hSize / 2;
                    setMatrix(wArr, wIdx, x, wP_y, z, vSize, wHeight, vSize);
                    wIdx += 16;
                } else {
                    let tHeight = topY - (-10) + hSize;
                    let tP_y = -10 + tHeight / 2 - hSize / 2;
                    setMatrix(tArr, tIdx, x, tP_y, z, vSize, tHeight, vSize);
                    tIdx += 16;
                }

                if (!isWater && isBuilding) {
                    const bid = matchedBuilding.id;

                    let bhY = topY + Math.floor(bHeight / hSize) * hSize;
                    if (bhY >= topY + hSize) {
                        let bH = bhY - (topY + hSize) + hSize;
                        let bP_y = (topY + hSize) + bH / 2 - hSize / 2;
                        setMatrix(bArr, bIdx, x, bP_y, z, vSize, bH, vSize);
                        
                        bInstIds.push(bid);
                        bIdx += 16;
                        
                        const funcTag = matchedBuilding.tags?.building || matchedBuilding.tags?.amenity || 'unknown';
                        let func = funcTag.toLowerCase();
                        if (func === 'yes') func = matchedBuilding.tags?.amenity || 'unknown';
                        if (func === 'apartments' || func === 'house') func = 'residential';
                        if (func === 'shop' || func === 'supermarket') func = 'retail';
                        if (func === 'warehouse') func = 'industrial';
                        if (func === 'university' || func === 'kindergarten') func = 'school';
                        if (func === 'doctors') func = 'clinic';
                        
                        const propCol = matchedBuilding.tags?.colour || matchedBuilding.tags?.['building:colour'];
                        bMeta.push({ bid, topY, hSize, bHeight, func, propCol, bP_y_base: bP_y, rawTags: matchedBuilding.tags || {} });
                        
                        bCol[bcIdx] = 1; bCol[bcIdx+1] = 1; bCol[bcIdx+2] = 1;
                        bEmi[bcIdx] = 0; bEmi[bcIdx+1] = 0; bEmi[bcIdx+2] = 0;
                        bcIdx += 3;
                    }
                } else if (isRoad) {
                    let rP_y = topY + hSize / 2 + 0.25;
                    setMatrix(rArr, rIdx, x, rP_y, z, vSize, 0.6, vSize);
                    rIdx += 16;
                } else if (isSand) {
                    let sP_y = topY + hSize / 2;
                    setMatrix(sArr, sIdx, x, sP_y, z, vSize, hSize, vSize);
                    sIdx += 16;
                }
            }
        }

        // Color buffer array for terrain
        const tCol = [];
        return {
            terrainData: tArr.slice(0, tIdx),
            waterData: wArr.slice(0, wIdx),
            buildingData: bArr.slice(0, bIdx),
            roadData: rArr.slice(0, rIdx),
            sandData: sArr.slice(0, sIdx),
            buildingIdsByInstance: bInstIds,
            buildingColors: bCol.slice(0, bcIdx),
            buildingEmissives: bEmi.slice(0, bcIdx),
            buildingInstanceMeta: bMeta
        };
    }, [w, d, bldgs, water, sand, hwys, minH, refEn, getEl]);

    useEffect(() => {
        if (!buildingMeshRef.current || !buildingInstanceMeta || !buildingIdsByInstance) return;
        const mesh = buildingMeshRef.current;
        const colorAttr = mesh.instanceColor || mesh.geometry?.attributes?.instanceColor;
        const emiAttr = mesh.geometry?.attributes?.instanceEmissive;
        if (!mesh || !colorAttr || !mesh.instanceMatrix) return;

        const matrixArray = mesh.instanceMatrix.array;
        const colorArray = colorAttr.array;
        const emiArray = emiAttr ? emiAttr.array : null;
        let c = new THREE.Color();
        let eCol = new THREE.Color();
        let shouldUpdateMatrix = false;
        let shouldUpdateColor = false;
        let shouldUpdateEmi = false;
        
        // Setup dynamic function extraction cache
        let newColorsDict = null;

        for (let i = 0; i < buildingInstanceMeta.length; i++) {
            const meta = buildingInstanceMeta[i];
            const edit = buildingEdits[meta.bid] || {};

            const activeHeight = edit.height !== undefined ? edit.height : meta.bHeight;
            let bhY = meta.topY + Math.floor(activeHeight / meta.hSize) * meta.hSize;
            let bH = Math.max(0, bhY - (meta.topY + meta.hSize) + meta.hSize);
            let bP_y = (meta.topY + meta.hSize) + bH / 2 - meta.hSize / 2;

            if (matrixArray[i * 16 + 5] !== bH || matrixArray[i * 16 + 13] !== bP_y) {
                matrixArray[i * 16 + 5] = bH;
                matrixArray[i * 16 + 13] = bP_y;
                shouldUpdateMatrix = true;
            }

            // Figure out active function
            let activeFunc = meta.func;
            if (edit.tags) {
                const fT = edit.tags.building || edit.tags.amenity || activeFunc;
                let parsed = fT.toLowerCase();
                if (parsed === 'yes') parsed = edit.tags.amenity || 'unknown';
                if (parsed === 'apartments' || parsed === 'house') parsed = 'residential';
                if (parsed === 'shop' || parsed === 'supermarket') parsed = 'retail';
                if (parsed === 'warehouse') parsed = 'industrial';
                if (parsed === 'university' || parsed === 'kindergarten') parsed = 'school';
                if (parsed === 'doctors') parsed = 'clinic';
                activeFunc = parsed;
            }
            
            // Assign random color if this function doesn't exist yet!
            if (!functionColors[activeFunc] && (!newColorsDict || !newColorsDict[activeFunc])) {
                if (!newColorsDict) newColorsDict = {};
                const hue = Math.floor(Math.random() * 360);
                newColorsDict[activeFunc] = `hsl(${hue}, 70%, 50%)`;
            }

            let finalColorStr = solidColor;
            
            if (buildingColorMode === 'property') {
                if (edit.color) {
                    finalColorStr = edit.color;
                } else {
                    finalColorStr = meta.propCol || solidColor;
                }
            } else if (buildingColorMode === 'function') {
                finalColorStr = (newColorsDict && newColorsDict[activeFunc]) || functionColors[activeFunc] || '#f1f5f9';
            }

            let isTarget = false;
            let targetColor = null;

            if (selectedBuildingId === meta.bid) {
                c.set('#ff0055'); // Highlight selection
            } else {
                try { c.set(finalColorStr); } catch(e) { c.set(solidColor); }
                
                // Emphasize walkability targets!
                if (walkabilityActive && walkabilityArcs && walkabilityArcs.length > 0) {
                    isTarget = walkabilityArcs.some(a => a.bid === meta.bid);
                    if (isTarget) {
                        targetColor = walkabilityArcs.find(a => a.bid === meta.bid).color;
                        c.set(targetColor); // Ensure it matches perfectly
                    } else {
                        // Dim visually non-involved infrastructure to create contrast
                        c.multiplyScalar(0.4);
                    }
                }
            }

            if (isTarget && targetColor) {
                eCol.set(targetColor).multiplyScalar(2.0); // Bright glow at night
            } else {
                eCol.setRGB(0, 0, 0);
            }

            if (colorArray[i * 3] !== c.r || colorArray[i * 3 + 1] !== c.g || colorArray[i * 3 + 2] !== c.b) {
                colorArray[i * 3] = c.r;
                colorArray[i * 3 + 1] = c.g;
                colorArray[i * 3 + 2] = c.b;
                shouldUpdateColor = true;
            }

            if (emiArray && (emiArray[i * 3] !== eCol.r || emiArray[i * 3 + 1] !== eCol.g || emiArray[i * 3 + 2] !== eCol.b)) {
                emiArray[i * 3] = eCol.r;
                emiArray[i * 3 + 1] = eCol.g;
                emiArray[i * 3 + 2] = eCol.b;
                shouldUpdateEmi = true;
            }
        }

        if (shouldUpdateMatrix) mesh.instanceMatrix.needsUpdate = true;
        if (shouldUpdateColor) colorAttr.needsUpdate = true;
        if (shouldUpdateEmi && emiAttr) emiAttr.needsUpdate = true;
        
        if (newColorsDict) {
            useStore.getState().setFunctionColorsBatch(newColorsDict);
        }

    }, [buildingInstanceMeta, buildingIdsByInstance, buildingEdits, buildingColorMode, solidColor, functionColors, selectedBuildingId, walkabilityActive, walkabilityArcs]);


    const vGeom = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
    const [normals, setNormals] = useState(null);
    useEffect(() => {
        new THREE.TextureLoader().load('/waternormals.jpg', tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            setNormals(tex);
        });
    }, []);

    useFrame((state, delta) => {
        if (normals) {
            normals.offset.x += delta * 0.05;
            normals.offset.y += delta * 0.05;
        }
        
        const t = useStore.getState().timeOfDay;
        const w = useStore.getState().weatherClear;
        const theta = ((t - 6) / 24) * Math.PI * 2;
        const elevation = Math.sin(theta);
        const sunIntensity = elevation > 0 ? Math.pow(Math.max(0, elevation), 0.5) * (0.3 + 0.7 * w) : 0;
        const darkness = 1.0 - Math.min(1.0, sunIntensity * 1.5);
        if (buildingMaterial.userData?.uniforms) {
            buildingMaterial.userData.uniforms.uDarkness.value = darkness;
        }
    });


    const terrainMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#88cc99", roughness: 0.9, flatShading: true, clippingPlanes: clipPlanes }), [clipPlanes]);
    const buildingMaterial = useMemo(() => {
        const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3, flatShading: true, clippingPlanes: clipPlanes });
        mat.userData.uniforms = { uDarkness: { value: 0.0 } };
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uDarkness = mat.userData.uniforms.uDarkness;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                varying vec3 vWorldPos;
                attribute vec3 instanceEmissive;
                varying vec3 vInstanceEmissive;`
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
#ifdef USE_INSTANCING
                vInstanceEmissive = instanceEmissive;
                vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
                vInstanceEmissive = vec3(0.0);
                vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
                `
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                uniform float uDarkness;
                varying vec3 vWorldPos;
                varying vec3 vInstanceEmissive;
                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                totalEmissiveRadiance += vInstanceEmissive;
                vec3 worldNormal = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
                if (abs(worldNormal.y) < 0.5 && uDarkness > 0.01) {
                    vec2 winUv = abs(worldNormal.z) > 0.5 ? vWorldPos.xy : vWorldPos.zy;
                    float floorHeight = 4.0;
                    float windowWidth = 3.0;
                    vec2 id = vec2(floor(winUv.x / windowWidth), floor(winUv.y / floorHeight));
                    vec2 extUv = vec2(fract(winUv.x / windowWidth), fract(winUv.y / floorHeight));
                    
                    if (extUv.x > 0.2 && extUv.x < 0.8 && extUv.y > 0.3 && extUv.y < 0.8) {
                        float rnd = random(id + vec2(abs(worldNormal.x), abs(worldNormal.z)));
                        float threshold = 1.0 - uDarkness * 0.9;
                        if (rnd > threshold) {
                            vec3 winColor = mix(vec3(1.0, 0.7, 0.3), vec3(0.9, 0.9, 1.0), random(id + 1.0));
                            totalEmissiveRadiance += winColor * uDarkness * 3.0; // Use += to preserve existing emissive
                            diffuseColor.rgb *= 0.1;
                        } else {
                            diffuseColor.rgb *= clamp(1.0 - uDarkness, 0.1, 1.0);
                        }
                    }
                }
                `
            );
        };
        return mat;
    }, [clipPlanes]);
    const roadMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffd700", emissive: "#ffaa00", emissiveIntensity: 2.0, roughness: 0.2, metalness: 0.8, flatShading: true, clippingPlanes: clipPlanes }), [clipPlanes]);
    const sandMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e6c280", roughness: 1.0, flatShading: true, clippingPlanes: clipPlanes }), [clipPlanes]);
    const waterMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#66ccff", transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.8, normalMap: normals, clippingPlanes: clipPlanes
    }), [normals, clipPlanes]);

    // Compute dynamic aesthetic color for walkability representations
    const timeOfDay = useStore(state => state.timeOfDay);
    const dayFactor = Math.max(0, Math.min(1, Math.sin(((timeOfDay - 6) / 24) * Math.PI * 2) * 3));
    const netColor = useMemo(() => new THREE.Color('#ff4d00').lerp(new THREE.Color('#0033ff'), dayFactor), [dayFactor]);

    return (
        <>
            {showDiagnostics && (
                <Html position={[-w/2 + 20, 100, -d/2 + 20]}>
                    <div className="bg-black/80 text-green-400 p-2 font-mono text-xs whitespace-nowrap pointer-events-none rounded border border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                        <div><b>DIAGNOSTICS</b></div>
                        <div>W: {Math.floor(w)} D: {Math.floor(d)} MinH: {Math.floor(minH)}</div>
                        <div>Bldgs array: {bldgs.length} Water: {water.length} Hwys: {hwys.length}</div>
                        <div>Instanced Terrain: {terrainData.length / 16}</div>
                        <div>Instanced Bldgs: {buildingData.length / 16}</div>
                        <div>Data Ways: {useStore.getState().diagnosticInfo.ways}</div>
                        <div>Error: {useStore.getState().diagnosticInfo.err || 'None'}</div>
                        <div style={{maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis'}}>XML Head: {useStore.getState().diagnosticInfo.xmlHead}</div>
                    </div>
                </Html>
            )}
            <group 
                position={[-w / 2, 0, d / 2]}
                onPointerDown={(e) => {
                    const store = useStore.getState();
                    const isFirstTime = !store.walkabilityAgentPos;
                    const isValidLeftClick = isFirstTime && e.nativeEvent.button === 0;
                    const isMiddleClick = e.nativeEvent.button === 1;

                    if (walkabilityActive && (isMiddleClick || isValidLeftClick) && e.intersections.length > 0) {
                        e.stopPropagation();
                        // For raycasts hitting descendants (terrain/roads)
                        // Group position is [-w/2, 0, d/2]
                        // World point = Group + Local -> Local = World - Group
                        const pt = e.point;
                        const lX = pt.x + w / 2;
                        const lY = -(pt.z - d / 2);

                        const [lon, lat] = bounds && refEn ? reproject(lX, lY, bounds[0], bounds[1]) : [0, 0];
                        let rawEl = refEn && store.getEl && bounds ? store.getEl(lon, lat) : 0;
                        if (rawEl == null || isNaN(rawEl)) rawEl = 0;
                        let agentY = Math.max(0, rawEl - minH);

                        setWalkabilityAgentPos([lX, lY, agentY]);
                    }

                    if (store.windSimActive && !store.windSimRunning && e.nativeEvent.button === 0 && e.intersections.length > 0) {
                        e.stopPropagation();
                        const pt = e.point;
                        const lX = pt.x + w / 2;
                        const lY = -(pt.z - d / 2);
                        store.setWindSimBounds({ cx: lX, cz: lY, w: 300, d: 300 });
                    }
                }}
                onClick={(e) => {
                    useStore.getState().setSelectedBuildingId(null);
                }}
            >
                {windSimActive && windSimBounds && !windSimRunning && (
                    <mesh position={[windSimBounds.cx, minH + 50, -windSimBounds.cz]}>
                        <boxGeometry args={[windSimBounds.w, 100, windSimBounds.d]} />
                        <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} />
                    </mesh>
                )}

                <InstancedVoxels data={terrainData} material={terrainMaterial} count={terrainData.length / 16} vGeom={vGeom} />
                <InstancedVoxels data={sandData} material={sandMaterial} count={sandData.length / 16} vGeom={vGeom} />
                <IsochroneOverlay nodes={useStore.getState().walkabilityGraphNodes} w={w} d={d} minH={minH} refEn={refEn} getEl={getEl} cb={bounds} netColor={netColor} walkabilityAgentPos={walkabilityAgentPos} radiusMeters={useStore.getState().walkabilityRadiusMeters} />
                
                {windSimRunning && (
                    <WindOverlay bounds={windSimBounds} buildings={bldgs} minH={minH} fullW={w} fullD={d} refEn={refEn} />
                )}

                <InstancedVoxels 
                    ref={buildingMeshRef}
                    data={buildingData} 
                    material={buildingMaterial} 
                    count={buildingData.length / 16} 
                    vGeom={vGeom} 
                    colors={buildingColors}
                    emissives={buildingEmissives}
                    onClick={(e) => {
                        e.stopPropagation();
                        if(buildingIdsByInstance && buildingIdsByInstance[e.instanceId]) {
                            setSelectedBuildingId(buildingIdsByInstance[e.instanceId]);
                        }
                    }}
                    onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
                    onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = 'default'; }}
                />
                <InstancedVoxels data={roadData} material={roadMaterial} count={roadData.length / 16} vGeom={vGeom} />
                <InstancedVoxels data={waterData} material={waterMaterial} count={waterData.length / 16} vGeom={vGeom} />
                
                {useStore.getState().walkabilityArcs && useStore.getState().walkabilityArcs.map((arc, idx) => {
                    const midPt = [
                        (walkabilityAgentPos[0] + arc.pos[0]) / 2,
                        Math.max(walkabilityAgentPos[2], arc.pos[1]) + 150, // Arc rises 150m up
                        (-walkabilityAgentPos[1] + arc.pos[2]) / 2
                    ];
                    return (
                        <QuadraticBezierLine 
                            key={`arc-${idx}`}
                            start={[walkabilityAgentPos[0], walkabilityAgentPos[2] + 15, -walkabilityAgentPos[1]]}
                            end={[arc.pos[0], arc.pos[1] + 15, arc.pos[2]]}
                            mid={midPt}
                            color={netColor}
                            lineWidth={2.5}
                            dashed={true}
                            dashScale={50}
                            dashSize={1}
                            gapSize={0.5}
                            transparent
                            opacity={1.0}
                            blending={THREE.AdditiveBlending}
                        />
                    );
                })}

                {walkabilityAgentPos && (
                    <group position={[walkabilityAgentPos[0], walkabilityAgentPos[2], -walkabilityAgentPos[1]]}>
                        <mesh position={[-2, 5, 0]}>
                            <boxGeometry args={[1.5, 10, 1.5]} />
                            <meshBasicMaterial color={netColor} wireframe={true} opacity={0.9} transparent />
                        </mesh>
                        <mesh position={[2, 5, 0]}>
                            <boxGeometry args={[1.5, 10, 1.5]} />
                            <meshBasicMaterial color={netColor} wireframe={true} opacity={0.9} transparent />
                        </mesh>
                        <mesh position={[0, 15, 0]}>
                            <boxGeometry args={[6, 10, 3]} />
                            <meshBasicMaterial color={netColor} wireframe={true} transparent opacity={1.0} />
                        </mesh>
                        <mesh position={[0, 22, 0]}>
                            <boxGeometry args={[4, 4, 4]} />
                            <meshBasicMaterial color={netColor} wireframe={true} opacity={1.0} transparent />
                        </mesh>
                        <mesh position={[0, 15, 0]}>
                            <sphereGeometry args={[2, 8, 8]} />
                            <meshBasicMaterial color={netColor} />
                        </mesh>
                    </group>
                )}
                {walkabilityPaths && walkabilityPaths.map((path, idx) => {
                    const points = [
                        new THREE.Vector3(path[0][0], minH + 5, -path[0][1]),
                        new THREE.Vector3(path[1][0], minH + 5, -path[1][1])
                    ];
                    return <Line key={idx} points={points} color={netColor} lineWidth={1} transparent opacity={0.5} blending={THREE.AdditiveBlending} />;
                })}
            </group>
        </>
    );
}
function DynamicLighting() {
    const timeOfDay = useStore(state => state.timeOfDay);
    const weatherClear = useStore(state => state.weatherClear);

    const theta = ((timeOfDay - 6) / 24) * Math.PI * 2;
    const elevation = Math.sin(theta);
    const azimuth = Math.cos(theta);
    
    const isDay = elevation > 0;
    const sunIntensity = isDay ? Math.pow(Math.max(0, elevation), 0.5) * (0.3 + 0.7 * weatherClear) : 0;
    
    const sunPos = new THREE.Vector3(azimuth * 1000, elevation * 1000, azimuth * 500);

    const ambientInt = (0.2 + (isDay ? 0.6 * sunIntensity : 0.0)) * (weatherClear > 0.5 ? 1.0 : 0.7);
    
    // Smooth transition from sunrise/sunset orange to noon white to midnight blue
    const sunColor = isDay ? new THREE.Color('#ff8a66').lerp(new THREE.Color('#ffffff'), Math.min(1, elevation * 4)) : new THREE.Color('#223355');
    const fogColor = isDay ? new THREE.Color('#f0f5fa').lerp(new THREE.Color('#778899'), 1 - weatherClear) : new THREE.Color('#05070a');

    return (
        <>
            <color attach="background" args={[fogColor]} />
            <fog attach="fog" near={500} far={15000} color={fogColor} />
            <ambientLight intensity={ambientInt} color={sunColor} />
            {isDay && (
                <directionalLight 
                    position={sunPos} 
                    intensity={1.8 * sunIntensity} 
                    color={sunColor} 
                    castShadow 
                    shadow-mapSize={[2048, 2048]} 
                    shadow-camera-left={-1000} shadow-camera-right={1000} 
                    shadow-camera-top={1000} shadow-camera-bottom={-1000} 
                    shadow-bias={-0.001} shadow-normalBias={0.05} 
                />
            )}
            <directionalLight position={[-200, 200, -200]} intensity={isDay ? 0.3 * weatherClear : 0.1} color="#ffffff" />
            <Sky distance={450000} sunPosition={sunPos} turbidity={10 - weatherClear * 8} rayleigh={isDay ? 1.5 : 0.1} mieCoefficient={0.005} mieDirectionalG={0.8} />
        </>
    );
}

export default function Environment3D({ regionBounds, reliefEnabled }) {
    return (
        <Canvas 
            onPointerMissed={() => useStore.getState().setSelectedBuildingId(null)}
            gl={{ localClippingEnabled: true, antialias: true, logarithmicDepthBuffer: true }} 
            camera={{ position: [0, 400, 800], fov: 35, near: 1, far: 20000 }} 
            shadows
        >
            <DynamicLighting />

            {regionBounds ? <OsmModel bounds={regionBounds} refEn={reliefEnabled} /> : <PlatformBase w={800} d={800} refEn={false} minH={0} />}

            <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
        </Canvas>
    );
}
