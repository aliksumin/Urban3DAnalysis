import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, extend, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, Sphere, QuadraticBezierLine, Sky, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Water, GLTFExporter } from 'three-stdlib';
import { 
    Home, Store, Factory, Briefcase, GraduationCap, ShoppingCart, Cross, School, 
    Hotel, Bath, CircleParking, TreePine, Pill, Croissant, ShoppingBasket, Landmark, 
    Dumbbell, Film, Building2, Library, Mail, ShieldAlert, Flame, Hospital, 
    Stethoscope, Coffee, Utensils, Wine, Scissors, Bus, Train, Bike, Car, Zap, 
    Palmtree, Trophy, Waves, Church, Users, Laptop, WashingMachine, Baby, Dog, 
    Leaf, Scale, Music, SquarePlay, Theater, HelpCircle
} from 'lucide-react';
import { buildRoadGraph, computeWalkability } from '../utils/walkabilityGraph';
import WindOverlay from './WindOverlay';
import { ModelingLayer } from '../tools/ModelingTool';
extend({ Water });

export function getDefaultFunctions(bData, masterFunctions = []) {
    if (!bData || !bData.tags) return [];
    
    const tags = bData.tags || {};
    let parsed = 'unknown';
    
    if (tags.function) {
        // Special override for custom POIs
        return [{ name: tags.function, defaultOpeningTime: '00:00-24:00' }];
    }

    ['building', 'amenity', 'shop', 'leisure', 'office'].forEach(key => {
        const val = tags[key];
        if (val && val !== 'yes' && val !== 'building' && val !== 'unclassified' && parsed === 'unknown') {
            parsed = val.toLowerCase();
        }
    });

    if (parsed === 'yes') parsed = tags.amenity || 'unknown';
    if (parsed === 'apartments' || parsed === 'house') parsed = 'residential';
    if (parsed === 'shop' || parsed === 'supermarket') parsed = 'retail';
    if (parsed === 'warehouse') parsed = 'industrial';
    if (parsed === 'commercial') {
        if (masterFunctions.some(mf => mf.name.toLowerCase() === 'local shop')) {
            parsed = 'local shop';
        } else if (masterFunctions.some(mf => mf.name.toLowerCase() === 'retail')) {
            parsed = 'retail';
        }
        // otherwise leave as 'commercial'
    }
    if (parsed === 'university' || parsed === 'kindergarten') parsed = 'school';
    if (parsed === 'doctors') parsed = 'clinic';

    if (parsed !== 'unknown') {
        const mFn = masterFunctions.find(mf => mf.name.toLowerCase() === parsed);
        if (mFn) return [{ name: mFn.name, openTime: mFn.defaultOpeningTime }];
        const caps = parsed.charAt(0).toUpperCase() + parsed.slice(1);
        return [{ name: caps, openTime: '-' }];
    }
    
    return [];
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(persist((set) => ({
    currentBounds: null,
    getEl: null,
    showBuildings: true,
    showRoads: true,
    exportTriggerFlag: false,
    setShowBuildings: (val) => set({ showBuildings: val }),
    setShowRoads: (val) => set({ showRoads: val }),
    setExportTriggerFlag: (val) => set({ exportTriggerFlag: val }),
    selectedBuildingId: null,
    buildingEdits: {},
    buildingColorMode: 'solid',
    solidColor: '#ffffff',
    masterFunctions: [
        { id: 'func_0', name: 'Residential', color: '#3b82f6', defaultOpeningTime: '-', trackable: false },
        { id: 'func_1', name: 'Commercial', color: '#f97316', defaultOpeningTime: '08:00-18:00', trackable: true },
        { id: 'func_2', name: 'Industrial', color: '#64748b', defaultOpeningTime: '06:00-16:00', trackable: true },
        { id: 'func_3', name: 'Office', color: '#06b6d4', defaultOpeningTime: '08:00-18:00', trackable: true },
        { id: 'func_4', name: 'Educational', color: '#eab308', defaultOpeningTime: '08:00-16:00', trackable: true },
        { id: 'func_5', name: 'Retail', color: '#ef4444', defaultOpeningTime: '09:00-20:00', trackable: true },
        { id: 'func_6', name: 'Clinic', color: '#10b981', defaultOpeningTime: '08:00-20:00', trackable: true },
        { id: 'func_7', name: 'School', color: '#8b5cf6', defaultOpeningTime: '08:00-15:00', trackable: true },
        { id: 'func_8', name: 'Hotel', color: '#ec4899', defaultOpeningTime: '00:00-24:00', trackable: true },
        { id: 'func_9', name: 'Toilet', color: '#0ea5e9', defaultOpeningTime: '00:00-24:00', trackable: true },
        { id: 'func_10', name: 'Parking', color: '#94a3b8', defaultOpeningTime: '00:00-24:00', trackable: true },
        { id: 'func_11', name: 'Park', color: '#22c55e', defaultOpeningTime: '06:00-22:00', trackable: true },
        { id: 'func_12', name: 'Pharmacy', color: '#14b8a6', defaultOpeningTime: '08:00-22:00', trackable: true },
        { id: 'func_13', name: 'Bakery', color: '#d97706', defaultOpeningTime: '06:00-18:00', trackable: true },
        { id: 'func_14', name: 'Supermarket', color: '#dc2626', defaultOpeningTime: '08:00-22:00', trackable: true },
        { id: 'func_15', name: 'Bank', color: '#0284c7', defaultOpeningTime: '09:00-17:00', trackable: true },
        { id: 'func_16', name: 'Gym', color: '#4f46e5', defaultOpeningTime: '06:00-23:00', trackable: true },
        { id: 'func_17', name: 'Cinema', color: '#a855f7', defaultOpeningTime: '10:00-24:00', trackable: true },
        { id: 'func_18', name: 'Museum', color: '#c026d3', defaultOpeningTime: '10:00-18:00', trackable: true },
        { id: 'func_19', name: 'Library', color: '#ea580c', defaultOpeningTime: '09:00-20:00', trackable: true },
        { id: 'func_20', name: 'Post Office', color: '#2563eb', defaultOpeningTime: '08:00-18:00', trackable: true },
        { id: 'func_21', name: 'Police', color: '#1d4ed8', defaultOpeningTime: '00:00-24:00', trackable: true },
        { id: 'func_22', name: 'Fire Station', color: '#be123c', defaultOpeningTime: '00:00-24:00', trackable: true },
        { id: 'func_23', name: 'Hospital', color: '#e11d48', defaultOpeningTime: '00:00-24:00', trackable: true },
        { id: 'func_24', name: 'Dentist', color: '#0d9488', defaultOpeningTime: '08:00-18:00', trackable: true },
        { id: 'func_25', name: 'Cafe', color: '#b45309', defaultOpeningTime: '07:00-20:00', trackable: true },
        { id: 'func_26', name: 'Restaurant', color: '#be185d', defaultOpeningTime: '11:00-23:00', trackable: true },
        { id: 'func_27', name: 'Bar', color: '#7e22ce', defaultOpeningTime: '18:00-02:00', trackable: true },
        { id: 'func_28', name: 'Hairdresser', color: '#db2777', defaultOpeningTime: '09:00-19:00', trackable: true },
        { id: 'func_29', name: 'Bus Stop', color: '#fbbf24', defaultOpeningTime: '05:00-01:00', trackable: true },
        { id: 'func_30', name: 'Subway Station', color: '#f59e0b', defaultOpeningTime: '05:00-01:00', trackable: true },
        { id: 'func_31', name: 'Train Station', color: '#ea580c', defaultOpeningTime: '00:00-24:00', trackable: true },
        { id: 'func_32', name: 'Bicycle Rental', color: '#65a30d', defaultOpeningTime: '00:00-24:00', trackable: true },
        { id: 'func_33', name: 'Car Rental', color: '#0891b2', defaultOpeningTime: '08:00-20:00', trackable: true },
        { id: 'func_34', name: 'EV Charging', color: '#059669', defaultOpeningTime: '00:00-24:00', trackable: true },
        { id: 'func_35', name: 'Playground', color: '#84cc16', defaultOpeningTime: '08:00-20:00', trackable: true },
        { id: 'func_36', name: 'Sports Centre', color: '#4338ca', defaultOpeningTime: '06:00-22:00', trackable: true },
        { id: 'func_37', name: 'Swimming Pool', color: '#0284c7', defaultOpeningTime: '06:00-22:00', trackable: true },
        { id: 'func_38', name: 'Place of Worship', color: '#9d174d', defaultOpeningTime: '06:00-20:00', trackable: true },
        { id: 'func_39', name: 'Community Centre', color: '#c026d3', defaultOpeningTime: '09:00-21:00', trackable: true },
        { id: 'func_40', name: 'Coworking Space', color: '#0ea5e9', defaultOpeningTime: '00:00-24:00', trackable: true },
        { id: 'func_41', name: 'Laundromat', color: '#38bdf8', defaultOpeningTime: '06:00-23:00', trackable: true },
        { id: 'func_42', name: 'Kindergarten', color: '#f43f5e', defaultOpeningTime: '07:00-18:00', trackable: true },
        { id: 'func_43', name: 'Vet', color: '#10b981', defaultOpeningTime: '08:00-20:00', trackable: true },
        { id: 'func_44', name: 'Public Garden', color: '#16a34a', defaultOpeningTime: '06:00-22:00', trackable: true },
        { id: 'func_45', name: 'Courthouse', color: '#475569', defaultOpeningTime: '09:00-17:00', trackable: true },
        { id: 'func_46', name: 'Market', color: '#f59e0b', defaultOpeningTime: '06:00-16:00', trackable: true },
        { id: 'func_47', name: 'Concert Hall', color: '#9f1239', defaultOpeningTime: '18:00-24:00', trackable: true },
        { id: 'func_48', name: 'Stadium', color: '#9333ea', defaultOpeningTime: '10:00-23:00', trackable: true },
        { id: 'func_49', name: 'Theatre', color: '#b91c1c', defaultOpeningTime: '18:00-23:00', trackable: true }
    ],
    aiModel: 'Gemini 3.1 Pro',
    aiApiKey: '',
    setAiModel: (m) => set({ aiModel: m }),
    setAiApiKey: (k) => set({ aiApiKey: k }),
    osmStatus: '',
    setOsmStatus: (status) => set({ osmStatus: status }),
    diagnosticInfo: { ways: 0, bldgs: 0, err: '' },
    setDiagnosticInfo: (info) => set(state => ({ diagnosticInfo: { ...state.diagnosticInfo, ...info } })),
    cityW: 800,
    cityD: 800,
    setCityDimensions: (w, d) => set({ cityW: w, cityD: d }),
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
    setWalkabilityPaths: (paths) => set({ walkabilityPaths: paths }),
    walkabilityCustomRoute: [],
    setWalkabilityCustomRoute: (points) => set({ walkabilityCustomRoute: points }),
    isAnimatingRoute: false,
    setAnimatingRoute: (val) => set({ isAnimatingRoute: val }),
    animMeta: null,
    setAnimMeta: (meta) => set({ animMeta: meta }),

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
    windComfortMetric: 'speed',
    setWindComfortMetric: (val) => set({ windComfortMetric: val }),
    windDirection: 180,
    setWindDirection: (val) => set({ windDirection: val }),
    windParticleFlow: true,
    setWindParticleFlow: (val) => set({ windParticleFlow: val }),
    
    setAllBuildings: (blds) => set({ allBuildings: blds }),
    setSelectedBuildingId: (id) => set({ selectedBuildingId: id }),
    setBuildingEdits: (edits) => set((state) => ({ buildingEdits: typeof edits === 'function' ? edits(state.buildingEdits) : edits })),
    setBuildingColorMode: (mode) => set({ buildingColorMode: mode }),
    setSolidColor: (c) => set({ solidColor: c }),
    setMasterFunctions: (funcs) => set({ masterFunctions: funcs }),
    loadSceneConfig: (data) => set(state => ({ 
        buildingEdits: data.buildingEdits || {}, 
        buildingColorMode: data.buildingColorMode || 'solid',
        solidColor: data.solidColor || '#ffffff',
        masterFunctions: data.masterFunctions || state.masterFunctions,
        aiModel: data.aiModel || state.aiModel,
        manualBuildingEdits: data.manualBuildingEdits || {},
        customBuildings: data.customBuildings || [],
        customRoads: data.customRoads || [],
        customPOIs: data.customPOIs || [],
        deletedBuildingIds: data.deletedBuildingIds || []
    })),
    timeOfDay: 14,
    setTimeOfDay: (val) => set({ timeOfDay: val }),
    dayOfYear: 80,
    setDayOfYear: (val) => set({ dayOfYear: val }),
    weatherClear: 1.0,
    setWeatherClear: (val) => set({ weatherClear: val }),

    aiProcessing: false,
    setAiProcessing: (val) => set({ aiProcessing: val }),
    aiProgressText: '',
    setAiProgressText: (val) => set({ aiProgressText: val }),
    aiAbortController: null,
    setAiAbortController: (ac) => set({ aiAbortController: ac }),

    googlePlacesKey: '',
    setGooglePlacesKey: (val) => set({ googlePlacesKey: val }),
    amapApiKey: '',
    setAmapApiKey: (val) => set({ amapApiKey: val }),
    useGooglePlaces: false,
    setUseGooglePlaces: (val) => set({ useGooglePlaces: val }),
    useOvertureMaps: true,
    setUseOvertureMaps: (val) => set({ useOvertureMaps: val }),

    customBuildings: [],
    setCustomBuildings: (val) => set({ customBuildings: val }),
    customRoads: [],
    setCustomRoads: (val) => set({ customRoads: val }),
    customPOIs: [],
    setCustomPOIs: (val) => set({ customPOIs: val }),
    activeModelingTool: null,
    setActiveModelingTool: (val) => set({ activeModelingTool: val }),
    drawTempPoints: [],
    setDrawTempPoints: (val) => set({ drawTempPoints: val }),
    draggedPOIId: null,
    setDraggedPOIId: (val) => set({ draggedPOIId: val }),
    iconDisplayMode: 'connected',
    setIconDisplayMode: (val) => set({ iconDisplayMode: val }),
    deletedBuildingIds: [],
    setDeletedBuildingIds: (val) => set({ deletedBuildingIds: val }),
    timelineRegime: 'after',
    setTimelineRegime: (val) => set({ timelineRegime: val }),
    manualBuildingEdits: {},
    setManualBuildingEdits: (edits) => set((state) => ({ manualBuildingEdits: typeof edits === 'function' ? edits(state.manualBuildingEdits) : edits })),
    minH: 0,
    setMinH: (val) => set({ minH: val }),
    gridSnapEnabled: false,
    setGridSnapEnabled: (val) => set({ gridSnapEnabled: val }),
    vertexSnapEnabled: true,
    setVertexSnapEnabled: (val) => set({ vertexSnapEnabled: val })
}), {
    name: 'urban-settings-storage',
    partialize: (state) => ({
        masterFunctions: state.masterFunctions,
        aiModel: state.aiModel,
        aiApiKey: state.aiApiKey,
        googlePlacesKey: state.googlePlacesKey,
        amapApiKey: state.amapApiKey,
        useGooglePlaces: state.useGooglePlaces,
        useOvertureMaps: state.useOvertureMaps,
        buildingColorMode: state.buildingColorMode,
        solidColor: state.solidColor,
        timeOfDay: state.timeOfDay,
        weatherClear: state.weatherClear,
        customBuildings: state.customBuildings,
        customRoads: state.customRoads,
        customPOIs: state.customPOIs,
        iconDisplayMode: state.iconDisplayMode,
        deletedBuildingIds: state.deletedBuildingIds,
        manualBuildingEdits: state.manualBuildingEdits,
        gridSnapEnabled: state.gridSnapEnabled,
        vertexSnapEnabled: state.vertexSnapEnabled
    })
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
        <mesh name="platformBaseMesh" receiveShadow castShadow position={[0, 0, 0]} material={customMaterial} onPointerMove={(e) => {}}>
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
        
        // Generate pre-blurred brush for performance optimization
        const padPx = 24; // padding for 12px blur
        const brushSize = Math.ceil((radPx + padPx) * 2);
        const brushCanvas = document.createElement('canvas');
        brushCanvas.width = brushSize;
        brushCanvas.height = brushSize;
        const bctx = brushCanvas.getContext('2d');
        bctx.fillStyle = 'white';
        bctx.filter = 'blur(12px)';
        bctx.beginPath();
        bctx.arc(brushSize / 2, brushSize / 2, radPx, 0, 2 * Math.PI);
        bctx.fill();

        const halfBrush = brushSize / 2;
        nodes.forEach(n => {
            const cx = (n.x / w) * 1024;
            const cy = (n.y / d) * 1024; 
            ctx.drawImage(brushCanvas, cx - halfBrush, cy - halfBrush);
        });

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
        const geo = new THREE.PlaneGeometry(w, d, Math.max(1, Math.floor(w / 6.0)), Math.max(1, Math.floor(d / 6.0))); // optimized dense grid
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
function CollisionPlane({ w, d, bounds, getEl, minH, refEn }) {
    const gRef = useRef();

    useEffect(() => {
        if (!gRef.current) return;
        const pos = gRef.current.attributes.position.array;
        const cb = bounds;
        if (!cb || !getEl) return;

        const minLon = Math.min(cb[0], cb[2]);
        const maxLon = Math.max(cb[0], cb[2]);
        const minLat = Math.min(cb[1], cb[3]);
        const maxLat = Math.max(cb[1], cb[3]);

        for (let i = 0; i < pos.length; i += 3) {
            const lx = pos[i] + w / 2;
            const ly = d / 2 - pos[i + 1];
            const [lon, lat] = reproject(lx, ly, cb[0], cb[1]);
            const h = refEn ? getEl(lon, lat) || 0 : 0;
            pos[i + 2] = Math.max(0, h - minH);
        }
        gRef.current.computeVertexNormals();
        gRef.current.computeBoundingBox();
        gRef.current.computeBoundingSphere();
        gRef.current.attributes.position.needsUpdate = true;
    }, [w, d, bounds, getEl, minH, refEn]);

    return (
        <mesh 
            name="terrainCollisionMesh" 
            rotation={[-Math.PI / 2, 0, 0]} 
            position={[w / 2, 0, -d / 2]}
            onPointerMove={(e) => {}} // Dummy listener to ensure R3F raycasting target inclusion
        >
            <planeGeometry ref={gRef} args={[w, d, 100, 100]} />
            <meshBasicMaterial transparent={true} opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
    );
}

const EMPTY_ARRAY = [];

function OsmModel({ bounds, refEn }) {
    const [bldgs, setBldgs] = useState([]);
    const [hwys, setHwys] = useState([]);
    const [water, setWater] = useState([]);
    const [sand, setSand] = useState([]);
    const [w, setW] = useState(800);
    const [d, setD] = useState(800);

    const { minH, setMinH, getEl, timelineRegime, manualBuildingEdits, customBuildings, customRoads, customPOIs, deletedBuildingIds, buildingEdits, buildingColorMode, solidColor, masterFunctions, setSelectedBuildingId, selectedBuildingId, setOsmStatus, setDiagnosticInfo, showDiagnostics, walkabilityActive, walkabilityAgentPos, walkabilityRadiusMeters, setWalkabilityStats, walkabilityPaths, setWalkabilityAgentPos, walkabilityAutoDistribute, setBuildingEdits, setBuildingColorMode, walkabilityTargetFulfill, walkabilityArcs, windSimActive, windSimRunning, windSimBounds, timeOfDay, walkabilityCustomRoute } = useStore();
    const buildingMeshRef = useRef(null);
    const [roadGraph, setRoadGraph] = useState(null);

    const effCustomBuildings = timelineRegime === 'before' ? EMPTY_ARRAY : customBuildings;
    const effCustomRoads = timelineRegime === 'before' ? EMPTY_ARRAY : customRoads;
    const effCustomPOIs = timelineRegime === 'before' ? EMPTY_ARRAY : customPOIs;
    const effDeletedIds = timelineRegime === 'before' ? EMPTY_ARRAY : deletedBuildingIds;

    const mergedBuildingEdits = useMemo(() => {
        if (timelineRegime === 'before') return buildingEdits || {};
        const merged = { ...buildingEdits };
        for (let key in manualBuildingEdits) {
            merged[key] = { ...(merged[key] || {}), ...manualBuildingEdits[key] };
        }
        return merged;
    }, [buildingEdits, manualBuildingEdits, timelineRegime]);

    useEffect(() => {
        const allHwys = [...hwys];
        effCustomRoads.forEach(cr => {
            // Provide ls matching p so getEl falls back properly
            allHwys.push({ id: cr.id, p: cr.points, ls: cr.points });
        });
        if (allHwys.length > 0) setRoadGraph(buildRoadGraph(allHwys, getEl));
    }, [hwys, getEl, effCustomRoads]);

    useEffect(() => {
        if (!roadGraph || !walkabilityAgentPos) {
            // Clear stats to avoid rendering stale arcs/paths when no agent is active
            if (useStore.getState().walkabilityGraphNodes.length > 0 || useStore.getState().walkabilityPaths.length > 0) {
                setWalkabilityStats({
                    walkabilityActiveNodes: 0,
                    walkabilityTargetFulfill: 'N/A',
                    walkabilityAvgDist: '--',
                    walkabilityPaths: [],
                    walkabilityGraphNodes: [],
                    walkabilityArcs: []
                });
            }
            return;
        }
        const stats = computeWalkability(roadGraph, walkabilityAgentPos, walkabilityRadiusMeters);
        
        const reqFns = masterFunctions.filter(f => f.trackable).map(f => f.name.toLowerCase());
        const masterFuncsMap = {};
        masterFunctions.forEach(f => masterFuncsMap[f.name.toLowerCase()] = f);
        
        const withinBids = new Set();
        let satisfiability = {};
        reqFns.forEach(fn => satisfiability[fn] = 0);
        
        const editsToApply = { ...mergedBuildingEdits };
        let madeEdits = false;
        const newArcs = [];
        
        // Helper to check if open
        const isTimeInRange = (curTime, timeRangeStr) => {
            if (!timeRangeStr || timeRangeStr === '-') return false;
            const [start, end] = timeRangeStr.split('-').map(t => {
                const [h, m] = t.split(':').map(Number);
                return h + m/60;
            });
            if (start === undefined || end === undefined || isNaN(start) || isNaN(end)) return false;
            if (end < start) {
                return curTime >= start || curTime <= end;
            }
            return curTime >= start && curTime <= end;
        };

        const activeTargets = new Set();
        const closestTargets = {};

        // customPOIs is pulled from effCustomPOIs via the useStore destructured variables earlier
        const evalBldgs = [...bldgs, ...effCustomBuildings, ...(effCustomPOIs || [])].filter(b => !effDeletedIds.includes(b.id));

        evalBldgs.forEach(b => {
            const bx = b.x !== undefined ? b.x : (b.minX + b.maxX) / 2;
            const by = b.z !== undefined ? b.z : (b.minY + b.maxY) / 2;
            
            for (let node of stats.reachableNodes) {
                if (Math.hypot(bx - node.x, by - node.y) < 100) {
                    withinBids.add(b.id);
                    
                    const edit = editsToApply[b.id] || {};
                    let funcsArr = edit.functions;
                    
                    // Fallback to basic inference if not analyzed by agent
                    if (!funcsArr || !Array.isArray(funcsArr) || funcsArr.length === 0) {
                        funcsArr = getDefaultFunctions(b, masterFunctions);
                        // If no generic functions were resolved, give it a baseline residential identity
                        if (funcsArr.length === 0) funcsArr = [{ name: 'Residential', openTime: '-' }];
                    }
                    
                    // Map functions that are currently open
                    funcsArr.forEach(fnObj => {
                        const mFn = masterFuncsMap[(fnObj.name || '').toLowerCase()];
                        if (mFn && mFn.trackable && isTimeInRange(timeOfDay, fnObj.openTime)) {
                            const fnKey = mFn.name.toLowerCase();
                            satisfiability[fnKey]++;
                            
                            // Track only the CLOSEST instance of each function
                            const distToAgent = Math.hypot(bx - walkabilityAgentPos[0], by - walkabilityAgentPos[1]);
                            if (!closestTargets[fnKey] || distToAgent < closestTargets[fnKey].dist) {
                                // Calculate actual top height elevation relative to local ground (which is minH)
                                const targetHeight = b.isPOI && b.y !== undefined 
                                    ? b.y 
                                    : ((b.el !== undefined ? b.el : minH) - minH + (b.h || b.height || 0));

                                closestTargets[fnKey] = {
                                    dist: distToAgent,
                                    arcData: {
                                        bid: b.id,
                                        name: mFn.name,
                                        pos: [bx, targetHeight, -by],
                                        color: mFn.color,
                                        isPOI: !!b.isPOI
                                    }
                                };
                            }
                        }
                    });
                    
                    break;
                }
            }
        });

        // Insert exactly one arc targeting the closest instance per required function
        Object.values(closestTargets).forEach(ct => newArcs.push(ct.arcData));
        
        // Auto distribute missing
        if (walkabilityAutoDistribute && reqFns.length > 0) {
            let availableBids = Array.from(withinBids);
            for (let reqFn of reqFns) {
                if (satisfiability[reqFn] === 0 && availableBids.length > 0) {
                    const rndIdx = Math.floor(Math.random() * availableBids.length);
                    const bid = availableBids[rndIdx];
                    availableBids.splice(rndIdx, 1);
                    
                    const mFn = masterFuncsMap[reqFn];
                    if (mFn) {
                        const curFnArr = editsToApply[bid]?.functions || [];
                        editsToApply[bid] = { ...editsToApply[bid], functions: [...curFnArr, { name: mFn.name, openTime: mFn.defaultOpeningTime }] };
                        satisfiability[reqFn]++;
                        madeEdits = true;
                        
                        // Treat as immediately open if we auto-distributed
                        if (isTimeInRange(timeOfDay, mFn.defaultOpeningTime)) {
                            const targetB = bldgs.find(xb => xb.id === bid);
                            if (targetB) {
                                const bBaseLocal = (targetB.el !== undefined ? targetB.el : minH) - minH;
                                const bH = targetB.h || targetB.height || 0;
                                newArcs.push({
                                    bid: bid,
                                    name: mFn.name,
                                    pos: [(targetB.minX + targetB.maxX) / 2, bBaseLocal + bH, -(targetB.minY + targetB.maxY) / 2],
                                    color: mFn.color,
                                    isPOI: false
                                });
                            }
                        }
                    }
                }
            }
        }
        
        if (madeEdits) {
            setBuildingEdits(editsToApply);
            setBuildingColorMode('function');
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
    }, [walkabilityAgentPos, walkabilityRadiusMeters, roadGraph, masterFunctions, walkabilityAutoDistribute, timeOfDay, bldgs, customBuildings, customPOIs, buildingEdits, manualBuildingEdits, deletedBuildingIds]);

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
        useStore.getState().setCityDimensions(ext[0], ext[1]);

        const b = `v27_${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]}`;

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
                    [out:json][timeout:90];
                    (
                      way["building"](${minLat},${minLon},${maxLat},${maxLon});
                      way["leisure"](${minLat},${minLon},${maxLat},${maxLon});
                      way["amenity"](${minLat},${minLon},${maxLat},${maxLon});
                      way["shop"](${minLat},${minLon},${maxLat},${maxLon});
                      way["office"](${minLat},${minLon},${maxLat},${maxLon});
                      way["landuse"](${minLat},${minLon},${maxLat},${maxLon});
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
                      relation["leisure"](${minLat},${minLon},${maxLat},${maxLon});
                      relation["amenity"](${minLat},${minLon},${maxLat},${maxLon});
                      relation["landuse"](${minLat},${minLon},${maxLat},${maxLon});
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
                    let rawText = await res.text();
                    
                    if (!rawText || rawText.trim().length === 0) {
                        endpoint = 'OSM API Fallback';
                        res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${sMinLon},${sMinLat},${sMaxLon},${sMaxLat}`, { cache: 'no-store' });
                        if (!res.ok) throw new Error('OSM Fallback failed: ' + res.status);
                        rawText = await res.text();
                    }

                    const sample = rawText.length + " chars " + (rawText.substring(0, 30));
                    setDiagnosticInfo({ err: `Endpoint: ${endpoint}` });
                    setOsmStatus('Parsing geometry data...');

                    const nodes = {};
                    const wayMap = {};

                    if (rawText.trim().startsWith('{')) {
                        // Fast JSON path
                        const data = JSON.parse(rawText);
                        const elements = data.elements || [];
                        
                        elements.forEach(el => {
                            if (el.type === 'node') {
                                nodes[el.id] = { lon: el.lon, lat: el.lat };
                            }
                        });

                        elements.forEach(el => {
                            if (el.type === 'way') {
                                const tags = el.tags || {};
                                const nds = (el.nodes || []).map(ref => nodes[ref]).filter(Boolean);
                                if (nds.length > 2) allWays.push({ id: el.id, tags, geometry: nds });
                                wayMap[el.id] = nds;
                            } else if (el.type === 'relation') {
                                const tags = el.tags || {};
                                const members = (el.members || []).map(m => ({
                                    type: m.type,
                                    ref: m.ref,
                                    role: m.role || '',
                                    geometry: m.type === 'way' ? (wayMap[m.ref] || null) : null
                                }));
                                if (members.some(m => m.geometry)) {
                                    allRelations.push({ id: el.id, tags, members });
                                }
                            }
                        });
                    } else {
                        // XML Fallback
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(rawText, 'text/xml');
                        
                        Array.from(doc.getElementsByTagName('node')).forEach(n => {
                            nodes[n.getAttribute('id')] = { lon: parseFloat(n.getAttribute('lon')), lat: parseFloat(n.getAttribute('lat')) };
                        });
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
                    }
                    setDiagnosticInfo({ ways: allWays.length, xmlHead: sample });
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

                        const isBuilding = el.tags?.building && el.tags.building !== 'no';
                        const isPOI = isBuilding || el.tags?.amenity || el.tags?.shop || el.tags?.office;

                        if (isPOI && !isWater) {
                            let h = el.tags?.height ? parseFloat(el.tags.height) : (el.tags?.['building:levels'] ? parseInt(el.tags['building:levels']) * 3 : (isBuilding ? 10 : 2));
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

                    const relationHoles = [];

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

                        if (parsedHoles.length > 0) {
                            relationHoles.push(...parsedHoles);
                        }

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

                    // Strictly merge fragmented OpenStreetMap coastline vectors natively matching adjacent geographic endpoints (within 25m)
                    // This seamlessly links fragmented ocean vectors without mathematically looping parallel island rivers.
                    let changed = true;
                    while (changed && unclosedCoasts.length > 0) {
                        changed = false;
                        let best = { i: -1, j: -1, dist: Infinity };
                        for (let i = 0; i < unclosedCoasts.length; i++) {
                            for (let j = 0; j < unclosedCoasts.length; j++) {
                                let c1 = unclosedCoasts[i].p;
                                let c2 = unclosedCoasts[j].p;
                                let d = Math.pow(c1[c1.length - 1][0] - c2[0][0], 2) + Math.pow(c1[c1.length - 1][1] - c2[0][1], 2);
                                if (d < best.dist) best = { i, j, dist: d };
                            }
                        }

                        if (best.dist < 625 && best.i !== -1) {
                            if (best.i === best.j) {
                                // Coastline natively closes on itself completely within mapping extent!
                                let c = unclosedCoasts[best.i];
                                c.p.push(c.p[0]); // explicitly seal loop perfectly
                                closedCoasts.push(c);
                                unclosedCoasts.splice(best.i, 1);
                                changed = true;
                            } else {
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
                                changed = true;
                            }
                        }
                    }

                    let globalOceanHoles = [];
                    let localWaterBodies = [];

                    // 1. Separate naturally closed coastline loops (Islands vs Inner Lakes)
                    closedCoasts.forEach((coast) => {
                        let area = 0;
                        const pts = coast.p;
                        for (let i = 0; i < pts.length - 1; i++) {
                            area += (pts[i][0] * pts[i+1][1] - pts[i+1][0] * pts[i][1]);
                        }
                        // Island traces CCW cartesian -> Area < 0 -> Hole
                        if (area < 0) {
                            globalOceanHoles.push(coast.p);
                        } else {
                            localWaterBodies.push(coast);
                        }
                    });

                    // Merge fragmented Coastline slices to prevent errant localized lakes
                    const mergeCoastPaths = (lines) => {
                        let used = new Array(lines.length).fill(false);
                        let merged = [];
                        for (let i = 0; i < lines.length; i++) {
                            if (used[i]) continue;
                            let path = { p: [...lines[i].p], ls: lines[i].ls };
                            used[i] = true;
                            let added = true;
                            while (added) {
                                added = false;
                                let iStart = path.p[0];
                                let iEnd = path.p[path.p.length - 1];
                                for (let j = 0; j < lines.length; j++) {
                                    if (used[j]) continue;
                                    let jStart = lines[j].p[0];
                                    let jEnd = lines[j].p[lines[j].p.length - 1];
                                    const bEPS = 50.0;
                                    if (Math.abs(iEnd[0] - jStart[0]) < bEPS && Math.abs(iEnd[1] - jStart[1]) < bEPS) {
                                        path.p.push(...lines[j].p.slice(1)); used[j] = true; added = true; break;
                                    } else if (Math.abs(iEnd[0] - jEnd[0]) < bEPS && Math.abs(iEnd[1] - jEnd[1]) < bEPS) {
                                        path.p.push(...lines[j].p.slice(0, lines[j].p.length - 1).reverse()); used[j] = true; added = true; break;
                                    } else if (Math.abs(iStart[0] - jStart[0]) < bEPS && Math.abs(iStart[1] - jStart[1]) < bEPS) {
                                        path.p.unshift(...lines[j].p.slice(1).reverse()); used[j] = true; added = true; break;
                                    } else if (Math.abs(iStart[0] - jEnd[0]) < bEPS && Math.abs(iStart[1] - jEnd[1]) < bEPS) {
                                        path.p.unshift(...lines[j].p.slice(0, lines[j].p.length - 1)); used[j] = true; added = true; break;
                                    }
                                }
                            }
                            merged.push(path);
                        }
                        return merged;
                    };
                    
                    let mergedUnclosed = mergeCoastPaths(unclosedCoasts);

                    // 2. Map unclosed edge coastlines systematically using standard Distance Router
                    const perimeterDist = (pt) => { // traces Clockwise
                        if (pt[1] <= 5.0) return pt[0]; 
                        if (pt[0] >= wVal - 5.0) return wVal + pt[1];
                        if (pt[1] >= dVal - 5.0) return wVal + dVal + (wVal - pt[0]); 
                        return wVal + dVal + wVal + (dVal - pt[1]); 
                    };
                    const getPAnchor = (pt) => {
                        if (pt[1] <= 5.0) return [pt[0], 0];
                        if (pt[0] >= wVal - 5.0) return [wVal, pt[1]];
                        if (pt[1] >= dVal - 5.0) return [pt[0], dVal];
                        return [0, pt[1]];
                    };

                    let endpoints = [];
                    // Ensure unclosed lines actually touch bounds, otherwise snap shut native fractures
                    mergedUnclosed.forEach((coast, idx) => {
                        const first = coast.p[0];
                        const last = coast.p[coast.p.length - 1];
                        const onBoundary = (pt) => (pt[0] <= 50.0 || pt[0] >= wVal - 50.0 || pt[1] <= 50.0 || pt[1] >= dVal - 50.0);

                        if (!onBoundary(first) || !onBoundary(last)) {
                            // Errant floating lines inside continent snap shut locally
                            coast.p.push(first);
                            localWaterBodies.push(coast);
                        } else {
                            endpoints.push({ type: 'first', idx, dist: perimeterDist(first), pt: getPAnchor(first), original: coast });
                            endpoints.push({ type: 'last', idx, dist: perimeterDist(last), pt: getPAnchor(last), original: coast });
                        }
                    });

                    endpoints.sort((a, b) => a.dist - b.dist);

                    let used = new Set();
                    let needsGlobalOcean = false;
                    
                    endpoints.forEach((ep) => {
                        if (ep.type === 'last' && !used.has(ep.idx)) {
                            let curr = ep;
                            let cycleParts = [];
                            let safeBreaker = 0;

                            while (safeBreaker++ < 200) {
                                used.add(curr.idx);
                                cycleParts.push(curr.original);

                                let currentIndex = endpoints.indexOf(curr);
                                let nextFirst = null;
                                let searchIdx = (currentIndex + 1) % endpoints.length;

                                while (searchIdx !== currentIndex && safeBreaker < 200) {
                                    if (endpoints[searchIdx].type === 'first') {
                                        nextFirst = endpoints[searchIdx];
                                        break;
                                    }
                                    searchIdx = (searchIdx + 1) % endpoints.length;
                                }

                                if (!nextFirst) break;

                                let p0 = curr.pt;
                                let p1 = nextFirst.pt;

                                let cornersAdded = [];
                                const targetDist = nextFirst.dist < curr.dist ? nextFirst.dist + (wVal * 2 + dVal * 2) : nextFirst.dist;
                                
                                if (curr.dist < wVal && targetDist >= wVal) cornersAdded.push([wVal, 0]);
                                if (curr.dist < wVal + dVal && targetDist >= wVal + dVal) cornersAdded.push([wVal, dVal]);
                                if (curr.dist < 2 * wVal + dVal && targetDist >= 2 * wVal + dVal) cornersAdded.push([0, dVal]);
                                if (targetDist >= 2 * wVal + 2 * dVal) cornersAdded.push([0, 0]);
                                if (targetDist >= 3 * wVal + 2 * dVal) cornersAdded.push([wVal, 0]);
                                
                                let coastA = cycleParts[cycleParts.length - 1];
                                coastA.p.push(p0);
                                cornersAdded.forEach(c => coastA.p.push(c));
                                coastA.p.push(p1);

                                if (used.has(nextFirst.idx)) break; 

                                curr = endpoints.find(e => e.idx === nextFirst.idx && e.type === 'last');
                                if (!curr) break;
                            }

                            if (cycleParts.length > 0) {
                                let unifiedP = [];
                                cycleParts.forEach(cp => { cp.p.forEach(pt => { unifiedP.push(pt); }); });
                                
                                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                                unifiedP.forEach(pt => {
                                    if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0];
                                    if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1];
                                });

                                const pipTest = (point, vs) => {
                                    let px = point[0], py = point[1], inside = false;
                                    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                                        let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
                                        let intersect = ((yi > py) != (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
                                        if (intersect) inside = !inside;
                                    }
                                    return inside;
                                };

                                // Map Infrastructure Parity Discriminator
                                // Human infrastructure exclusively exists on the Landmass. If the generated topological wrapper encompasses
                                // a massive density of loaded buildings and roads, it is definitively the Continental Polygon.
                                let landHits = 0;
                                let objSample = Math.min(200, blds.length);
                                for (let i = 0; i < objSample; i++) {
                                    if (pipTest(blds[i].p[0], unifiedP)) landHits++;
                                }
                                let hwySample = Math.min(200, hwys.length);
                                for (let i = 0; i < hwySample; i++) {
                                    if (pipTest(hwys[i].p[0], unifiedP)) landHits++;
                                }
                                
                                let totalS = objSample + hwySample;
                                let landRatio = totalS > 0 ? (landHits / totalS) : 0;

                                if (landRatio > 0.15) {
                                    // wrapper structurally encompasses >15% of all human infrastructure! It IS the terrestrial Continent!
                                    needsGlobalOcean = true;
                                    globalOceanHoles.push(unifiedP);
                                } else {
                                    // wrapper contains virtually no infrastructure! It IS the flat Global Ocean!
                                    localWaterBodies.push({ p: unifiedP, h: globalOceanHoles, ls: cycleParts[0].ls, el: 0, minX, maxX, minY, maxY });
                                }
                            }
                        }
                    });
                    let globalOceanPolygons = [];
                    if (needsGlobalOcean) {
                        const massiveOcean = [[0,0], [wVal,0], [wVal,dVal], [0,dVal], [0,0]];
                        globalOceanPolygons.push({ p: massiveOcean, h: globalOceanHoles, el: 0, minX: 0, maxX: wVal, minY: 0, maxY: dVal });
                    }

                    localWaterBodies.forEach(b => {
                        if (!b.h || b.h.length === 0) b.h = globalOceanHoles;
                    });

                    const checkPointInPoly = (point, vs) => {
                        let x = point[0], y = point[1], inside = false;
                        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                            let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
                            let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                            if (intersect) inside = !inside;
                        }
                        return inside;
                    };

                    const allLandHoles = [...globalOceanHoles, ...relationHoles];
                    watr.forEach(w => {
                        const matchingHoles = allLandHoles.filter(hole => {
                            if (!w.p || w.p.length === 0 || !hole || hole.length === 0) return false;
                            return checkPointInPoly(hole[0], w.p);
                        });
                        w.h = [...(w.h || []), ...matchingHoles];
                    });

                    watr.push(...globalOceanPolygons);
                    watr.push(...localWaterBodies);

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
                                if (w.ls) {
                                    w.ls.forEach(pt => {
                                        // Remove bounding box constraint that arbitrarily rejected internal map lakes/ponds!
                                        const el = getEl(pt[0], pt[1]);
                                        if (!isNaN(el)) {
                                            if (el < minFound) minFound = el;
                                            if (el > maxFound) maxFound = el;
                                        }
                                    });
                                }
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
        const maxDim = Math.max(w, d);
        // Safely cap maximum grid density to guarantee maxVoxels stays well under memory limits
        // 2x smaller voxels for roads and buildings to increase detail dynamically!
        const resolutionCap = Math.max(maxDim / 700, 1.0); 
        const vSizeDetail = resolutionCap; 
        const vSizeBase = resolutionCap * 2.0;
        
        const cols = Math.floor(w / vSizeDetail) + 2;
        const rows = Math.floor(d / vSizeDetail) + 2;
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

        // Convert and append customBuildings
        const allBldgs = bldgs.filter(b => !effDeletedIds.includes(b.id));
        effCustomBuildings.forEach(cb => {
            if (effDeletedIds.includes(cb.id)) return;
            allBldgs.push({
                id: cb.id,
                p: cb.points,
                ls: cb.points,
                h: cb.height,
                minX: cb.minX, maxX: cb.maxX, minY: cb.minY, maxY: cb.maxY,
                tags: cb.tags,
                isCustom: true
            });
        });

        const allHwys = [...hwys];
        effCustomRoads.forEach(cr => {
            const minX = Math.min(...cr.points.map(p => p[0]));
            const maxX = Math.max(...cr.points.map(p => p[0]));
            const minY = Math.min(...cr.points.map(p => p[1]));
            const maxY = Math.max(...cr.points.map(p => p[1]));
            allHwys.push({
                id: cr.id,
                p: cr.points,
                minX, maxX, minY, maxY,
                isCustom: true
            });
        });

        water.forEach(w => addToGrid(w, watrGrid));
        allBldgs.forEach(b => addToGrid(b, bldgsGrid));
        allHwys.forEach(h => addToGrid(h, hwysGrid));
        sand.forEach(s => addToGrid(s, sandGrid));

        for (let xBase = 0; xBase <= w; xBase += vSizeBase) {
            for (let zBase = 0; zBase >= -d; zBase -= vSizeBase) {
                const minBx = xBase - vSizeBase / 2;
                const maxBx = xBase + vSizeBase / 2;
                const minBz = zBase - vSizeBase / 2; 
                const maxBz = zBase + vSizeBase / 2;

                const cx = Math.floor(xBase / CELL_SIZE);
                const cz = Math.floor(-zBase / CELL_SIZE);
                const cellKey = cx + "_" + cz;

                const cellWatr = watrGrid.get(cellKey) || [];
                const cellBldgs = bldgsGrid.get(cellKey) || [];
                const cellHwys = hwysGrid.get(cellKey) || [];
                const cellSand = sandGrid.get(cellKey) || [];

                let needsDetail = false;
                for (let b of cellBldgs) {
                    if (maxBx < b.minX || minBx > b.maxX || -minBz < b.minY || -maxBz > b.maxY) continue;
                    needsDetail = true; break;
                }
                if (!needsDetail) {
                    for (let h of cellHwys) {
                        if (maxBx < h.minX - 10 || minBx > h.maxX + 10 || -minBz < h.minY - 10 || -maxBz > h.maxY + 10) continue;
                        needsDetail = true; break;
                    }
                }

                const steps = needsDetail ? 
                    [ {x: xBase - vSizeDetail/2, z: zBase + vSizeDetail/2}, {x: xBase + vSizeDetail/2, z: zBase + vSizeDetail/2},
                      {x: xBase - vSizeDetail/2, z: zBase - vSizeDetail/2}, {x: xBase + vSizeDetail/2, z: zBase - vSizeDetail/2} ] :
                    [ {x: xBase, z: zBase} ];
                    
                const currentVSize = needsDetail ? vSizeDetail : vSizeBase;
                // Force vertical alignment grid to ALWAYS use the strict detail size 
                // so large base terrain blocks don't step vertically disconnected!
                const hSize = vSizeDetail;

                for (let step of steps) {
                    const x = step.x;
                    const z = step.z;
                    if (x < -currentVSize || x > w + currentVSize || z > currentVSize || z < -d - currentVSize) continue;

                    const lx = x;
                    const lz = -z;
                    const [lon, lat] = cb ? reproject(lx, lz, cb[0], cb[1]) : [0, 0];
                    let rawEl = refEn && getEl && cb ? getEl(lon, lat) : 0;
                    if (rawEl == null || isNaN(rawEl)) rawEl = 0;

                    let isBuilding = false, bHeight = 0, isWater = false, wtEl = 0, isRoad = false, isSand = false;
                    
                    // Priority 1: High-Performance Polygon Parity Even-Odd Loop
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
                                wtEl = wt.el || 0;
                                break;
                            }
                        }
                    }

                let matchedBuilding = null;
                // Priority 2: Building
                for (let b of cellBldgs) {
                    if (lx < b.minX || lx > b.maxX || lz < b.minY || lz > b.maxY) continue;
                    if (ptInPoly([lx, lz], b.p)) {
                        isBuilding = true; bHeight = b.h; matchedBuilding = b; break;
                    }
                }

                if (isBuilding) {
                    isWater = false;
                }

                // Priority 3: Road
                if (!isBuilding) {
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
                if (isWater && !isRoad && !isBuilding) {
                    baseTerrain -= 50; // Deeply sink terrain for water basins, but leave supports for bridges
                } else if (isSand && !isRoad && !isBuilding) {
                    baseTerrain -= 2; // Slight dip for beaches
                }

                let topY = Math.floor(Math.max(0, baseTerrain - minH) / hSize) * hSize;

                if (isWater) {
                    // Flush with the calculated depression without artificial building hSize inflation
                    let waterY = Math.floor(Math.max(0, wtEl - minH) / hSize) * hSize;
                    let wHeight = waterY - (-10) + hSize;
                    let wP_y = -10 + wHeight / 2 - hSize / 2;
                    setMatrix(wArr, wIdx, x, wP_y, z, currentVSize, wHeight, currentVSize);
                    wIdx += 16;
                } else {
                    let tHeight = topY - (-10) + hSize;
                    let tP_y = -10 + tHeight / 2 - hSize / 2;
                    setMatrix(tArr, tIdx, x, tP_y, z, currentVSize, tHeight, currentVSize);
                    tIdx += 16;
                }

                if (isBuilding) {
                    const bid = matchedBuilding.id;

                    // Apply visual vertical exaggeration to make buildings look proportionately correct in an isometric view
                    const visualScale = 1.8;
                    let bhY = topY + Math.floor((bHeight * visualScale) / hSize) * hSize;
                    if (bhY >= topY + hSize) {
                        let bH = bhY - (topY + hSize) + hSize;
                        let bP_y = (topY + hSize) + bH / 2 - hSize / 2;
                        setMatrix(bArr, bIdx, x, bP_y, z, currentVSize, bH, currentVSize);
                        
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
                    setMatrix(rArr, rIdx, x, rP_y, z, currentVSize, 0.6, currentVSize);
                    rIdx += 16;
                } else if (isSand) {
                    let sP_y = topY + hSize / 2;
                    setMatrix(sArr, sIdx, x, sP_y, z, currentVSize, hSize, currentVSize);
                    sIdx += 16;
                }
                } // End inner step loop
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
    }, [w, d, bldgs, water, sand, hwys, minH, refEn, getEl, effCustomBuildings, effCustomRoads, effDeletedIds]);

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
            const edit = mergedBuildingEdits[meta.bid] || {};

            const activeHeight = edit.height !== undefined ? edit.height : meta.bHeight;
            const visualScale = 1.8; // Match the visual exaggeration parameter used in geometry construction
            let bhY = meta.topY + Math.floor((activeHeight * visualScale) / meta.hSize) * meta.hSize;
            let bH = Math.max(0, bhY - (meta.topY + meta.hSize) + meta.hSize);
            let bP_y = (meta.topY + meta.hSize) + bH / 2 - meta.hSize / 2;

            if (effDeletedIds.includes(meta.bid)) {
                bH = 0;
            }

            if (matrixArray[i * 16 + 5] !== bH || matrixArray[i * 16 + 13] !== bP_y) {
                matrixArray[i * 16 + 5] = bH;
                matrixArray[i * 16 + 13] = bP_y;
                shouldUpdateMatrix = true;
            }

            let finalColorStr = solidColor;
            
            if (buildingColorMode === 'property') {
                if (edit.color) {
                    finalColorStr = edit.color;
                } else {
                    finalColorStr = meta.propCol || solidColor;
                }
            } else if (buildingColorMode === 'function') {
                let funcsArr = edit.functions;
                if (!funcsArr || funcsArr.length === 0) {
                    funcsArr = getDefaultFunctions(meta, masterFunctions);
                }
                
                if (funcsArr && funcsArr.length > 0) {
                    const primaryFnName = funcsArr[0].name;
                    const mf = masterFunctions.find(m => m.name === primaryFnName);
                    finalColorStr = mf ? mf.color : '#f1f5f9';
                } else {
                    finalColorStr = '#f1f5f9';
                }
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
        
    }, [buildingInstanceMeta, buildingIdsByInstance, mergedBuildingEdits, buildingColorMode, solidColor, masterFunctions, selectedBuildingId, walkabilityActive, walkabilityArcs, effDeletedIds]);


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
        const dayOfYear = useStore.getState().dayOfYear || 80;
        const bounds = useStore.getState().currentBounds;
        const lat = bounds ? ((bounds[1] + bounds[3]) / 2) * Math.PI / 180 : 0;
        const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI / 365 * (dayOfYear - 81));
        const hAngle = (t - 12) * 15 * Math.PI / 180;
        const sinElevation = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hAngle);
        const elevation = Math.asin(sinElevation);
        const sunIntensity = elevation > 0 ? Math.pow(Math.max(0, Math.sin(elevation)), 0.5) * (0.3 + 0.7 * w) : 0;
        const darkness = 1.0 - Math.min(1.0, sunIntensity * 1.5);
        if (buildingMaterial.userData?.uniforms) {
            buildingMaterial.userData.uniforms.uDarkness.value = darkness;
        }

        // Dynamically update water color in-place without rebuilding the material (fixes hot-swapping compilation lag)
        const frameDayFactor = Math.max(0, Math.min(1, Math.sin(((t - 6) / 24) * Math.PI * 2) * 3));
        const dayColor = new THREE.Color("#1e88e5");
        const nightColor = new THREE.Color("#0d1b2a"); // Deep navy blue
        waterMaterial.color.copy(dayColor).lerp(nightColor, 1 - frameDayFactor);

        // Dynamically update road emissive intensity in-place
        roadMaterial.emissiveIntensity = 1.0 + (1.0 - frameDayFactor) * 2.0;
    });


    // Compute dynamic aesthetic factors
    const dayFactor = Math.max(0, Math.min(1, Math.sin(((timeOfDay - 6) / 24) * Math.PI * 2) * 3));
    const netColor = useMemo(() => new THREE.Color('#ff4d00').lerp(new THREE.Color('#0033ff'), dayFactor), [dayFactor]);

    const terrainMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#388e3c", roughness: 0.9, flatShading: true, clippingPlanes: clipPlanes }), [clipPlanes]);
    const buildingMaterial = useMemo(() => {
        const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, metalness: 0.0, flatShading: true, clippingPlanes: clipPlanes });
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
                            totalEmissiveRadiance += winColor * uDarkness * 4.5; // Brighter window glow at night
                            diffuseColor.rgb *= 0.5; // Soft dimming of windows
                        } else {
                            diffuseColor.rgb *= clamp(1.0 - uDarkness * 0.3, 0.7, 1.0); // Don't let walls go pitch black so they capture moonlight shadows
                        }
                    }
                }
                `
            );
        };
        return mat;
    }, [clipPlanes]);
    const roadMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffd700", emissive: "#ff5500", emissiveIntensity: 1.0, roughness: 0.5, metalness: 0.1, flatShading: true, clippingPlanes: clipPlanes }), [clipPlanes]);
    const sandMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e5a93c", roughness: 1.0, flatShading: true, clippingPlanes: clipPlanes }), [clipPlanes]);
    const waterMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#1e88e5", roughness: 0.15, metalness: 0.3, flatShading: true, clippingPlanes: clipPlanes
    }), [clipPlanes]);

    const finalBldgsForWind = useMemo(() => {
        return [...bldgs, ...effCustomBuildings, ...(effCustomPOIs || [])].filter(b => !effDeletedIds.includes(b.id));
    }, [bldgs, effCustomBuildings, effCustomPOIs, effDeletedIds]);

    const walkabilityPathsGeom = useMemo(() => {
        if (!walkabilityPaths || walkabilityPaths.length === 0) return null;
        const pos = new Float32Array(walkabilityPaths.length * 6);
        let i = 0;
        for (const p of walkabilityPaths) {
            pos[i++] = p[0][0]; pos[i++] = minH + 5; pos[i++] = -p[0][1];
            pos[i++] = p[1][0]; pos[i++] = minH + 5; pos[i++] = -p[1][1];
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        return geom;
    }, [walkabilityPaths, minH]);

    const walkabilityCustomRouteGeom = useMemo(() => {
        if (!walkabilityCustomRoute || walkabilityCustomRoute.length < 2) return null;
        const pos = new Float32Array((walkabilityCustomRoute.length - 1) * 6);
        let i = 0;
        for (let j = 0; j < walkabilityCustomRoute.length - 1; j++) {
            const p1 = walkabilityCustomRoute[j];
            const p2 = walkabilityCustomRoute[j+1];
            const [lon1, lat1] = bounds && getEl ? reproject(p1[0], p1[1], bounds[0], bounds[1]) : [0,0];
            const [lon2, lat2] = bounds && getEl ? reproject(p2[0], p2[1], bounds[0], bounds[1]) : [0,0];
            pos[i++] = p1[0]; pos[i++] = (getEl ? getEl(lon1, lat1) : 0) + 1.0; pos[i++] = -p1[1];
            pos[i++] = p2[0]; pos[i++] = (getEl ? getEl(lon2, lat2) : 0) + 1.0; pos[i++] = -p2[1];
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        return geom;
    }, [walkabilityCustomRoute, getEl, bounds]);

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

                {bounds && (
                    <CollisionPlane 
                        w={w} 
                        d={d} 
                        bounds={bounds} 
                        getEl={getEl} 
                        minH={minH} 
                        refEn={refEn} 
                    />
                )}

                <group name="Layer_Terrain">
                    <InstancedVoxels data={terrainData} material={terrainMaterial} count={terrainData.length / 16} vGeom={vGeom} />
                </group>
                <group name="Layer_Sand">
                    <InstancedVoxels data={sandData} material={sandMaterial} count={sandData.length / 16} vGeom={vGeom} />
                </group>
                {walkabilityActive && walkabilityAgentPos && (
                    <IsochroneOverlay nodes={useStore.getState().walkabilityGraphNodes} w={w} d={d} minH={minH} refEn={refEn} getEl={getEl} cb={bounds} netColor={netColor} walkabilityAgentPos={walkabilityAgentPos} radiusMeters={useStore.getState().walkabilityRadiusMeters} />
                )}
                
                {windSimRunning && (
                    <WindOverlay bounds={windSimBounds} buildings={finalBldgsForWind} minH={minH} fullW={w} fullD={d} refEn={refEn} />
                )}

                <group visible={useStore((state)=>state.showBuildings)} name="Layer_Buildings">
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
                </group>
                <group visible={useStore((state)=>state.showRoads)} name="Layer_Roads">
                    <InstancedVoxels data={roadData} material={roadMaterial} count={roadData.length / 16} vGeom={vGeom} />
                </group>
                <group name="Layer_Water">
                    <InstancedVoxels data={waterData} material={waterMaterial} count={waterData.length / 16} vGeom={vGeom} />
                </group>
                
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
                            end={[arc.pos[0], arc.pos[1] + (arc.isPOI ? 5 : 10), arc.pos[2]]}
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
                {walkabilityPathsGeom && (
                    <lineSegments geometry={walkabilityPathsGeom}>
                        <lineBasicMaterial color={netColor} transparent opacity={0.5} blending={THREE.AdditiveBlending} />
                    </lineSegments>
                )}
                {walkabilityCustomRouteGeom && (
                    <lineSegments geometry={walkabilityCustomRouteGeom}>
                        <lineBasicMaterial color={"#ff00ff"} linewidth={2} toneMapped={false} />
                    </lineSegments>
                )}
            </group>
        </>
    );
}
function DynamicLighting() {
    const timeOfDay = useStore(state => state.timeOfDay);
    const dayOfYear = useStore(state => state.dayOfYear) || 80;
    const weatherClear = useStore(state => state.weatherClear);
    const bounds = useStore(state => state.currentBounds);
    const cityW = useStore(state => state.cityW) || 800;
    const cityD = useStore(state => state.cityD) || 800;

    const lat = bounds ? ((bounds[1] + bounds[3]) / 2) * Math.PI / 180 : 0;
    const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI / 365 * (dayOfYear - 81));
    const hAngle = (timeOfDay - 12) * 15 * Math.PI / 180;

    const sinElevation = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hAngle);
    const elevation = Math.asin(sinElevation);
    const isDay = elevation > 0;

    const cosAzimuth = (Math.sin(decl) - Math.sin(lat) * sinElevation) / (Math.cos(lat) * Math.cos(elevation));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth)));
    if (timeOfDay < 12) {
        azimuth = -azimuth;
    }

    const sunX = -Math.sin(azimuth) * Math.cos(elevation) * 1000;
    const sunY = Math.sin(elevation) * 1000;
    const sunZ = Math.cos(azimuth) * Math.cos(elevation) * 1000;

    const sunPos = new THREE.Vector3(sunX, sunY, sunZ);

    // Moonlight tracking (opposite of sun)
    const moonElevation = -elevation;
    const moonX = Math.sin(azimuth) * Math.cos(moonElevation) * 1000;
    const moonY = Math.sin(moonElevation) * 1000;
    const moonZ = -Math.cos(azimuth) * Math.cos(moonElevation) * 1000;
    const moonPos = new THREE.Vector3(moonX, moonY, moonZ);

    const sunIntensity = isDay ? Math.pow(Math.max(0, Math.sin(elevation)), 0.5) * (0.3 + 0.7 * weatherClear) : 0;
    const moonIntensity = !isDay ? Math.pow(Math.max(0, Math.sin(moonElevation)), 0.5) * (0.3 + 0.7 * weatherClear) : 0;

    // Ambient light higher for soft shadows & details
    const ambientInt = isDay ? (0.55 + 0.25 * sunIntensity) : (0.2 + 0.1 * moonIntensity);
    
    // Smooth transition from sunrise/sunset to clean noon white
    const sunColor = isDay ? new THREE.Color('#fff4eb').lerp(new THREE.Color('#ffffff'), Math.min(1, Math.sin(elevation) * 4)) : new THREE.Color('#223355');
    const moonColor = new THREE.Color('#9bbade');
    const ambientColor = isDay ? sunColor : new THREE.Color('#1b263b');

    // Studio style background: light neutral warm gray during day, deep indigo-slate room during night
    const fogColor = isDay ? new THREE.Color('#f4f4f6').lerp(new THREE.Color('#e2e5e9'), 1 - weatherClear) : new THREE.Color('#0a0e17');

    // Dynamically calculate shadow camera frustum based on city size
    const shadowSize = Math.max(cityW, cityD, 800);
    const halfShadowSize = shadowSize / 2 + 100;

    return (
        <>
            <color attach="background" args={[fogColor]} />
            <fog attach="fog" near={shadowSize * 1.5} far={shadowSize * 5} color={fogColor} />
            <ambientLight intensity={ambientInt} color={ambientColor} />
            {isDay ? (
                <directionalLight 
                    position={sunPos} 
                    intensity={1.3 * sunIntensity} 
                    color={sunColor} 
                    castShadow 
                    shadow-mapSize={[4096, 4096]} 
                    shadow-camera-left={-halfShadowSize} shadow-camera-right={halfShadowSize} 
                    shadow-camera-top={halfShadowSize} shadow-camera-bottom={-halfShadowSize} 
                    shadow-camera-near={10} shadow-camera-far={3000}
                    shadow-bias={-0.0002} shadow-normalBias={0.02} 
                />
            ) : (
                <directionalLight 
                    position={moonPos} 
                    intensity={0.45 * moonIntensity} 
                    color={moonColor} 
                    castShadow 
                    shadow-mapSize={[2048, 2048]} 
                    shadow-camera-left={-halfShadowSize} shadow-camera-right={halfShadowSize} 
                    shadow-camera-top={halfShadowSize} shadow-camera-bottom={-halfShadowSize} 
                    shadow-camera-near={10} shadow-camera-far={3000}
                    shadow-bias={-0.0002} shadow-normalBias={0.02} 
                />
            )}
            {/* Soft fixed fill light from the opposite direction to reveal detail in shadow areas */}
            <directionalLight 
                position={[-200, 300, -200]} 
                intensity={isDay ? 0.3 * weatherClear : 0.1 * weatherClear} 
                color="#ffffff" 
            />
        </>
    );
}

function IconOverlay() {
    const { iconDisplayMode, allBuildings, customBuildings, customPOIs, buildingEdits, masterFunctions, walkabilityArcs, cityW, cityD, deletedBuildingIds, timelineRegime, manualBuildingEdits, walkabilityActive, walkabilityAgentPos } = useStore();
    
    const effCustomBuildings = timelineRegime === 'before' ? EMPTY_ARRAY : customBuildings;
    const effCustomPOIs = timelineRegime === 'before' ? EMPTY_ARRAY : customPOIs;
    const effDeletedIds = timelineRegime === 'before' ? EMPTY_ARRAY : deletedBuildingIds;
    
    const mergedBuildingEdits = useMemo(() => {
        if (timelineRegime === 'before') return buildingEdits || {};
        const merged = { ...buildingEdits };
        for (let key in manualBuildingEdits) {
            merged[key] = { ...(merged[key] || {}), ...manualBuildingEdits[key] };
        }
        return merged;
    }, [buildingEdits, manualBuildingEdits, timelineRegime]);
    
    const iconMap = useMemo(() => ({
        'residential': Home, 'commercial': Store, 'industrial': Factory, 'office': Briefcase, 
        'educational': GraduationCap, 'retail': ShoppingCart, 'clinic': Cross, 'school': School, 
        'hotel': Hotel, 'park': TreePine, 'parking': CircleParking, 'toilet': Bath,
        'pharmacy': Pill, 'bakery': Croissant, 'supermarket': ShoppingBasket, 'bank': Landmark,
        'gym': Dumbbell, 'cinema': Film, 'museum': Building2, 'library': Library,
        'post office': Mail, 'police': ShieldAlert, 'fire station': Flame, 'hospital': Hospital,
        'dentist': Stethoscope, 'cafe': Coffee, 'restaurant': Utensils, 'bar': Wine,
        'hairdresser': Scissors, 'bus stop': Bus, 'subway station': Train, 'train station': Train,
        'bicycle rental': Bike, 'car rental': Car, 'ev charging': Zap, 'playground': Palmtree,
        'sports centre': Trophy, 'swimming pool': Waves, 'place of worship': Church,
        'community centre': Users, 'coworking space': Laptop, 'laundromat': WashingMachine,
        'kindergarten': Baby, 'vet': Dog, 'public garden': Leaf, 'courthouse': Scale,
        'market': Store, 'concert hall': Music, 'stadium': SquarePlay, 'theatre': Theater
    }), []);

    if (iconDisplayMode === 'none') return null;
    const combinedList = [...(allBuildings||[]), ...(effCustomBuildings||[]), ...(effCustomPOIs||[])].filter(b => !effDeletedIds.includes(b.id));
    const iconsToRender = [];
    const connectedBids = new Set(walkabilityArcs.map(a => a.bid));

    combinedList.forEach(b => {
        // If walkability is active and the agent is placed, hide POIs/buildings that are not reachable (not in connectedBids)
        if (walkabilityActive && walkabilityAgentPos) {
            if (!connectedBids.has(b.id)) return;
        } else {
            // When agent is NOT placed, buildings/POIs are visible unless walkability is inactive and iconDisplayMode is explicitly 'connected'
            if (iconDisplayMode === 'connected' && !walkabilityActive && !b.isPOI) return;
        }
        
        let buildingFns = mergedBuildingEdits[b.id]?.functions;
        if (!buildingFns || buildingFns.length === 0) {
            buildingFns = getDefaultFunctions(b, masterFunctions);
        }

        if (buildingFns && buildingFns.length > 0) {
            let posX = b.x !== undefined ? b.x : (b.minX + b.maxX)/2;
            let posZ = b.z !== undefined ? b.z : (b.minY + b.maxY)/2;
            
            // Clip off out-of-bounds tags!
            if (posX < 0 || posX > cityW || posZ < 0 || posZ > cityD) return;
            
            let posY = b.y !== undefined ? b.y + 2 : ((b.height || b.h || 0) + (b.isPOI ? 2 : 15));

            iconsToRender.push(
                <Html key={b.id} position={[posX, posY, -posZ]} center>
                    <div 
                        className="flex flex-row items-end justify-center -space-x-4 hover:space-x-1 transition-all duration-300 pointer-events-auto cursor-pointer drop-shadow-xl opacity-95"
                        onClick={(e) => {
                            e.stopPropagation();
                            useStore.getState().setSelectedBuildingId(b.id);
                        }}
                    >
                        {buildingFns.map((fn, idx) => {
                            let fnName = fn.name.toLowerCase();
                            if (!iconMap[fnName]) fnName = 'retail';
                            let mFn = masterFunctions.find(mf => mf.name.toLowerCase() === fnName);
                            let pColor = mFn ? mFn.color : '#3b82f6';
                            const IconComponent = iconMap[fnName] || HelpCircle;
                            
                            // Ensure the first item is naturally elevated or subsequent items scale dynamically
                            const isPrimary = idx === 0;

                            return (
                                <div key={idx} className="relative flex flex-col items-center justify-end transition-transform hover:-translate-y-2" style={{ zIndex: 10 - idx }}>
                                    <svg viewBox="0 0 24 24" className="w-[46px] h-[46px]" style={{ color: pColor }} fill="currentColor" stroke="white" strokeWidth="1.5">
                                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                                    </svg>
                                    <div className="absolute top-[17px] left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none text-white drop-shadow-sm">
                                        <IconComponent size={18} strokeWidth={2.5} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Html>
            );

            // Hidden hit mesh removed as drag-to-move is disabled and Html handles clicking.
        }
    });

    return <group position={[-cityW / 2, 0, cityD / 2]}>{iconsToRender}</group>;
}

function AnimationPusher() {
    const { isAnimatingRoute, setAnimatingRoute, walkabilityCustomRoute, animMeta, setWalkabilityAgentPos, getEl, cityW, cityD } = useStore();
    const { gl, camera, controls } = useThree();
    
    const [progressDist, setProgressDist] = useState(0);
    const [initialOffset, setInitialOffset] = useState(null);
    const [isProcessingFrame, setIsProcessingFrame] = useState(false);
    
    useEffect(() => {
        if (isAnimatingRoute && walkabilityCustomRoute && walkabilityCustomRoute.length > 0) {
            setProgressDist(0);
            setIsProcessingFrame(false);
            
            const startP = walkabilityCustomRoute[0];
            const bounds = useStore.getState().currentBounds;
            const [lon, lat] = bounds && getEl ? reproject(startP[0], startP[1], bounds[0], bounds[1]) : [0,0];
            const startY = (getEl ? getEl(lon, lat) : 0) + 1.0;
            const absoluteStartPos = new THREE.Vector3(startP[0] - cityW/2, startY, cityD/2 - startP[1]);
            setInitialOffset(camera.position.clone().sub(absoluteStartPos));
            
            if (controls) controls.enabled = false;
        } else {
            if (controls) controls.enabled = true;
        }
    }, [isAnimatingRoute, walkabilityCustomRoute, getEl, cityW, cityD, camera, controls]);

    useFrame(() => {
        if (!isAnimatingRoute || !walkabilityCustomRoute || walkabilityCustomRoute.length < 2 || isProcessingFrame) return;
        
        let totalLen = 0;
        let pos = null;
        for (let i = 0; i < walkabilityCustomRoute.length - 1; i++) {
            const p1 = walkabilityCustomRoute[i];
            const p2 = walkabilityCustomRoute[i+1];
            const dx = p2[0] - p1[0];
            const dz = p2[1] - p1[1];
            const segDist = Math.sqrt(dx*dx + dz*dz);
            if (progressDist <= totalLen + segDist) {
                const t = (progressDist - totalLen) / segDist;
                pos = [ p1[0] + dx * t, p1[1] + dz * t ];
                break;
            }
            totalLen += segDist;
        }
        
        if (!pos) {
            setAnimatingRoute(false);
            if (controls) controls.enabled = true;
            return;
        }
        
        const bounds = useStore.getState().currentBounds;
        const [lon, lat] = bounds && getEl ? reproject(pos[0], pos[1], bounds[0], bounds[1]) : [0,0];
        const yPos = (getEl ? getEl(lon, lat) : 0) + 1.0;
        setWalkabilityAgentPos([pos[0], pos[1], yPos]);
        
        if (initialOffset) {
            const absPos = new THREE.Vector3(pos[0] - cityW/2, yPos, cityD/2 - pos[1]);
            camera.position.copy(absPos.clone().add(initialOffset));
            if (controls) controls.target.copy(absPos);
            camera.lookAt(absPos);
        }
        
        setIsProcessingFrame(true);
        
        requestAnimationFrame(() => {
            setTimeout(async () => {
                const baseCanvas = gl.domElement;
                const canvas = document.createElement('canvas');
                canvas.width = baseCanvas.width;
                canvas.height = baseCanvas.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(baseCanvas, 0, 0);

                const store = useStore.getState();
                const arcs = store.walkabilityArcs || [];
                const seen = new Set();
                const uniqueFuncs = [];
                arcs.forEach(a => {
                    if (!seen.has(a.name.toLowerCase())) {
                        uniqueFuncs.push(a);
                        seen.add(a.name.toLowerCase());
                    }
                });

                const isDay = store.timeOfDay > 6 && store.timeOfDay < 18;
                const themeColor = isDay ? '#00f3ff' : '#ffb700';

                // --- 2D Screen Coordinate Tag Projection Engine ---
                const { iconDisplayMode, allBuildings, customBuildings, customPOIs, buildingEdits, masterFunctions, cityW, cityD, deletedBuildingIds, timelineRegime, manualBuildingEdits } = store;
                if (iconDisplayMode !== 'none') {
                    const effCustomBuildings = timelineRegime === 'before' ? [] : (customBuildings||[]);
                    const effCustomPOIs = timelineRegime === 'before' ? [] : (customPOIs||[]);
                    const effDeletedIds = timelineRegime === 'before' ? [] : (deletedBuildingIds||[]);
                    
                    const mergedBuildingEdits = { ...(buildingEdits||{}) };
                    if (timelineRegime !== 'before' && manualBuildingEdits) {
                        for (let k in manualBuildingEdits) {
                            mergedBuildingEdits[k] = { ...mergedBuildingEdits[k], ...manualBuildingEdits[k] };
                        }
                    }

                    const combinedList = [...(allBuildings||[]), ...effCustomBuildings, ...effCustomPOIs].filter(b => !effDeletedIds.includes(b.id));
                    const connectedBids = new Set((arcs||[]).map(a => a.bid));

                    combinedList.forEach(b => {
                        if (iconDisplayMode === 'connected' && !connectedBids.has(b.id)) return;
                        
                        let buildingFns = mergedBuildingEdits[b.id]?.functions;
                        if (!buildingFns || buildingFns.length === 0) {
                            buildingFns = getDefaultFunctions(b, masterFunctions) || [];
                        }

                        if (buildingFns && buildingFns.length > 0) {
                            let posX = b.x !== undefined ? b.x : (b.minX + b.maxX)/2;
                            let posZ = b.z !== undefined ? b.z : (b.minY + b.maxY)/2;
                            if (posX < 0 || posX > cityW || posZ < 0 || posZ > cityD) return;
                            let posY = b.y !== undefined ? b.y + 2 : ((b.height || b.h || 0) + (b.isPOI ? 2 : 15));
                            
                            const vec = new THREE.Vector3(posX - cityW/2, posY, -posZ + cityD/2);
                            vec.project(camera);
                            
                            // discard off-screen / behind camera pins
                            if (vec.z > 1 || vec.z < -1) return;
                            
                            const screenX = (vec.x * 0.5 + 0.5) * canvas.width;
                            const screenY = (-(vec.y * 0.5) + 0.5) * canvas.height;

                            // Base pin properties
                            ctx.shadowBlur = Math.max(4, Math.floor(canvas.height * 0.01));
                            ctx.shadowColor = 'rgba(0,0,0,0.5)';
                            ctx.lineWidth = 1.5;
                            ctx.strokeStyle = 'white';

                            buildingFns.forEach((fn, idx) => {
                                let mFn = masterFunctions.find(mf => mf.name.toLowerCase() === fn.name.toLowerCase());
                                let pColor = mFn ? mFn.color : '#3b82f6';
                                
                                // Overlay stacking overlap
                                const px = screenX + (idx * 16) - ((buildingFns.length-1)*8);
                                const py = screenY;
                                
                                ctx.beginPath();
                                ctx.arc(Math.floor(px), Math.floor(py) - 15, 8, 0, Math.PI * 2);
                                ctx.moveTo(Math.floor(px) - 8, Math.floor(py) - 13);
                                ctx.lineTo(Math.floor(px), Math.floor(py) + 3);
                                ctx.lineTo(Math.floor(px) + 8, Math.floor(py) - 13);
                                ctx.fillStyle = pColor;
                                ctx.fill();
                                ctx.stroke();
                            });
                            
                            ctx.shadowBlur = 0; // reset for next ops
                        }
                    });
                }
                // --- End Projection Engine ---

                const fSz = Math.max(16, Math.floor(canvas.height * 0.025));
                ctx.font = `bold ${fSz}px monospace`;
                const xPad = Math.floor(canvas.width * 0.02);
                let yPad = Math.floor(canvas.height * 0.05);

                ctx.fillStyle = themeColor;
                ctx.shadowColor = themeColor;
                ctx.shadowBlur = 10;
                ctx.fillText('TARGET TRACKING', xPad, yPad);

                yPad += Math.floor(fSz * 1.8);
                if (uniqueFuncs.length > 0) {
                    uniqueFuncs.forEach(arc => {
                        ctx.fillStyle = arc.color || '#ffffff';
                        ctx.shadowColor = arc.color || '#ffffff';
                        ctx.fillText(arc.name.toUpperCase(), xPad, yPad);
                        yPad += Math.floor(fSz * 1.5);
                    });
                } else {
                    ctx.fillStyle = themeColor;
                    ctx.shadowColor = themeColor;
                    ctx.globalAlpha = 0.6;
                    ctx.fillText('NO ACTIVE CONNECTIONS', xPad, yPad);
                    ctx.globalAlpha = 1.0;
                }

                const trackables = (store.masterFunctions || []).filter(m => m.trackable).map(m => m.name.toLowerCase());
                const missingTrackables = trackables.filter(t => !seen.has(t));
                if (missingTrackables.length > 0) {
                    yPad += Math.floor(fSz * 0.8);
                    ctx.fillStyle = '#ff4444';
                    ctx.shadowColor = '#ff4444';
                    ctx.fillText(`${missingTrackables.length} FUNCTIONS MISSING`, xPad, yPad);
                }

                const b64 = canvas.toDataURL("image/png");

                try {
                    await fetch(`http://${window.location.hostname}:8005/api/save_frame`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            anim_id: animMeta.id,
                            frame_idx: Math.floor(progressDist / 3.0),
                            b64_data: b64
                        })
                    });
                    setProgressDist(d => d + 3.0);
                } catch(e) {
                    console.error('Frame drop export', e);
                } finally {
                    setIsProcessingFrame(false);
                }
            }, 500);
        });
    });
    
    return null;
}

export default function Environment3D({ regionBounds, reliefEnabled }) {
    return (
        <Canvas 
            onPointerMissed={() => useStore.getState().setSelectedBuildingId(null)}
            gl={{ localClippingEnabled: true, antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true }} 
            camera={{ position: [0, 400, 800], fov: 35, near: 1, far: 20000 }} 
            shadows={{ type: THREE.PCFSoftShadowMap }}
        >
            <SceneExporter />
            <DynamicLighting />
            <AnimationPusher />
            <ModelingLayer regionBounds={regionBounds}>
                {regionBounds ? <OsmModel bounds={regionBounds} refEn={reliefEnabled} /> : <PlatformBase w={800} d={800} refEn={false} minH={0} />}
                <IconOverlay />
            </ModelingLayer>
            <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
        </Canvas>
    );
}

function flattenInstancedMesh(instancedMesh) {
    const baseGeom = instancedMesh.geometry;
    const basePositions = baseGeom.attributes.position.array;
    const baseNormals = baseGeom.attributes.normal?.array;
    const baseIndices = baseGeom.index?.array;
    
    const instanceMatrix = instancedMesh.instanceMatrix.array;
    const instanceColor = instancedMesh.instanceColor?.array;
    const count = instancedMesh.count;
    
    const numVerts = basePositions.length / 3;
    const numIndices = baseIndices ? baseIndices.length : 0;
    
    const outPositions = new Float32Array(count * numVerts * 3);
    const outNormals = baseNormals ? new Float32Array(count * numVerts * 3) : null;
    const outColors = new Float32Array(count * numVerts * 3);
    const outIndices = baseIndices ? new Uint32Array(count * numIndices) : null;
    
    // Check if three is available
    if (typeof window === 'undefined') return new Object();
    
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const im = new THREE.Matrix3();
    const c = new THREE.Color();
    const matColor = (instancedMesh.material && instancedMesh.material.color) ? instancedMesh.material.color : new THREE.Color(1,1,1);
    
    for (let i = 0; i < count; i++) {
        m.fromArray(instanceMatrix, i * 16);
        im.getNormalMatrix(m);
        
        if (instanceColor) {
            c.fromArray(instanceColor, i * 3);
        } else {
            c.copy(matColor);
        }
        
        for (let j = 0; j < numVerts; j++) {
            const outVertIdx = i * numVerts + j;
            v.set(basePositions[j*3], basePositions[j*3+1], basePositions[j*3+2]);
            v.applyMatrix4(m);
            outPositions[outVertIdx * 3] = v.x;
            outPositions[outVertIdx * 3 + 1] = v.y;
            outPositions[outVertIdx * 3 + 2] = v.z;
            
            if (outNormals) {
                n.set(baseNormals[j*3], baseNormals[j*3+1], baseNormals[j*3+2]);
                n.applyMatrix3(im).normalize();
                outNormals[outVertIdx * 3] = n.x;
                outNormals[outVertIdx * 3 + 1] = n.y;
                outNormals[outVertIdx * 3 + 2] = n.z;
            }
            
            outColors[outVertIdx * 3] = c.r;
            outColors[outVertIdx * 3 + 1] = c.g;
            outColors[outVertIdx * 3 + 2] = c.b;
        }
        
        if (outIndices) {
            for (let j = 0; j < numIndices; j++) {
                outIndices[i * numIndices + j] = baseIndices[j] + i * numVerts;
            }
        }
    }
    
    const targetGeom = new THREE.BufferGeometry();
    targetGeom.setAttribute('position', new THREE.BufferAttribute(outPositions, 3));
    if (outNormals) targetGeom.setAttribute('normal', new THREE.BufferAttribute(outNormals, 3));
    targetGeom.setAttribute('color', new THREE.BufferAttribute(outColors, 3));
    if (outIndices) targetGeom.setIndex(new THREE.BufferAttribute(outIndices, 1));
    
    return targetGeom;
}

function SceneExporter() {
    const { scene } = useThree();
    const shouldExport = useStore(state => state.exportTriggerFlag);
    useEffect(() => {
        if (shouldExport) {
            const exportScene = new THREE.Scene();
            scene.traverseVisible((child) => {
                if (child.isInstancedMesh && child.count > 0) {
                    const targetGeom = flattenInstancedMesh(child);
                    const mat = child.material.clone ? child.material.clone() : new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide });
                    if (Array.isArray(mat)) {
                        mat.forEach(m => m.vertexColors = true);
                    } else {
                        mat.vertexColors = true;
                    }
                    const mesh = new THREE.Mesh(targetGeom, mat);
                    mesh.name = child.parent?.name || "Geometry_Layer";
                    child.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
                    exportScene.add(mesh);
                }
            });

            const exporter = new GLTFExporter();
            exporter.parse(
                exportScene,
                (gltf) => {
                    const blob = new Blob([gltf], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.style.display = 'none';
                    link.href = url;
                    link.download = 'Urban3D_Export.glb';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    useStore.getState().setExportTriggerFlag(false);
                },
                (error) => {
                    console.error('An error happened during parsing', error);
                    useStore.getState().setExportTriggerFlag(false);
                },
                { binary: true } // Export as GLB for universal compact loading
            );
        }
    }, [shouldExport, scene]);
    return null;
}
