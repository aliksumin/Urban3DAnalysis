import React, { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useStore } from '../components/Environment3D';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import { Check, X, MousePointer2 } from 'lucide-react';

export function ModelingLayer({ regionBounds, children }) {
    const { activeModelingTool, drawTempPoints, setDrawTempPoints, customBuildings, setCustomBuildings, customRoads, setCustomRoads, customPOIs, setCustomPOIs, setActiveModelingTool } = useStore();
    const { camera, raycaster, pointer } = useThree();
    const [previewPoint, setPreviewPoint] = useState(null);

    const getIntersectPos = (e) => {
        if (!e || !e.point) return null;
        return [e.point.x, e.point.z, e.point.y];
    };

    const handlePointerMove = (e) => {
        if (!activeModelingTool) return;
        const pos = getIntersectPos(e);
        if (pos) setPreviewPoint(pos);
    };

    const handlePointerUp = (e) => {
        // No-op for now since POI dragging was removed
    };

    const handleContextMenu = (e) => {
        if (!activeModelingTool || activeModelingTool === 'poi') {
            setActiveModelingTool(null);
            setDrawTempPoints([]);
            setPreviewPoint(null);
            return;
        }
        e.stopPropagation();

        if (drawTempPoints.length < 2) {
            setActiveModelingTool(null);
            setDrawTempPoints([]);
            setPreviewPoint(null);
            return;
        }
        
        const { cityW, cityD } = useStore.getState();
        const lPts = drawTempPoints.map(p => [p[0] + cityW / 2, cityD / 2 - p[1]]);

        if (activeModelingTool === 'building') {
            if (lPts.length < 3) {
                // Must be a polygon
                setActiveModelingTool(null);
                setDrawTempPoints([]);
                setPreviewPoint(null);
                return;
            }
            const minX = Math.min(...lPts.map(p => p[0]));
            const maxX = Math.max(...lPts.map(p => p[0]));
            const minY = Math.min(...lPts.map(p => p[1]));
            const maxY = Math.max(...lPts.map(p => p[1]));

            const newBld = {
                id: 'cbld_' + Date.now(),
                points: lPts,
                minX, maxX, minY, maxY,
                height: 12 + Math.random() * 10,
                renderType: 'building',
                tags: {}
            };
            setCustomBuildings([...customBuildings, newBld]);
        } else if (activeModelingTool === 'road') {
            const newRoad = {
                id: 'croad_' + Date.now(),
                points: lPts
            };
            setCustomRoads([...customRoads, newRoad]);
        }

        setActiveModelingTool(null);
        setDrawTempPoints([]);
        setPreviewPoint(null);
    };

    const handlePointerDown = (e) => {
        if (!activeModelingTool) return;
        e.stopPropagation();
        
        if (e.button === 2) {
            handleContextMenu(e);
            return;
        }

        if (e.button !== 0) return; // Only left click from here
        const pos = getIntersectPos(e);
        if (!pos) return;

        if (activeModelingTool === 'poi') {
            const { cityW, cityD } = useStore.getState();
            const newPOI = {
                id: 'poi_' + Date.now(),
                x: pos[0] + cityW / 2,
                z: cityD / 2 - pos[1],
                y: pos[2],
                tags: { function: 'New Function' },
                isPOI: true
            };
            setCustomPOIs([...customPOIs, newPOI]);
            setActiveModelingTool(null);
            setDrawTempPoints([]);
        } else {
            setDrawTempPoints([...drawTempPoints, pos]);
        }
    };

    const linePoints = previewPoint && activeModelingTool ? [...drawTempPoints, previewPoint] : drawTempPoints;
    const isPoly = activeModelingTool === 'building' && linePoints.length > 2;
    if (isPoly && previewPoint) {
        linePoints.push(drawTempPoints[0]);
    }

    const flatPoints = linePoints.map(p => {
        let { getEl } = useStore.getState();
        let height = getEl ? getEl(p[0], p[1]) || 0 : 0;
        return new THREE.Vector3(p[0], height + 10, p[1]);
    });

    return (
        <group
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onContextMenu={(e) => { e.nativeEvent.preventDefault(); handleContextMenu(e); }}
        >
            <mesh 
                name="groundPlane" 
                rotation={[-Math.PI/2, 0, 0]} 
                position={[0, -100, 0]} 
            >
                <planeGeometry args={[100000, 100000]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#ffffff" />
            </mesh>

            {children}

            {activeModelingTool && flatPoints.length > 1 && (
                <Line
                    points={flatPoints}
                    color="#3b82f6"
                    lineWidth={3}
                    dashed={activeModelingTool === 'building'}
                />
            )}
            
            {activeModelingTool && drawTempPoints.map((p, i) => {
                let { getEl } = useStore.getState();
                let height = getEl ? getEl(p[0], p[1]) || 0 : 0;
                return (
                    <mesh key={i} position={[p[0], height + 10, p[1]]}>
                        <sphereGeometry args={[8, 16, 16]} />
                        <meshBasicMaterial color="#ef4444" />
                    </mesh>
                );
            })}
        </group>
    );
}

export function ModelingHUD() {
    const { activeModelingTool, setActiveModelingTool, setDrawTempPoints } = useStore();

    if (!activeModelingTool) return null;

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <div className="bg-slate-900/95 backdrop-blur-md px-6 py-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] border border-slate-700/50 text-white flex items-center gap-6">
                <div className="flex flex-col">
                    <div className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                        <MousePointer2 size={16} className="text-blue-400" />
                        {activeModelingTool === 'building' && "Draw Building Footprint"}
                        {activeModelingTool === 'road' && "Draw Road Network"}
                        {activeModelingTool === 'poi' && "Drop Function Node"}
                    </div>
                    {activeModelingTool !== 'poi' ? (
                        <div className="text-[10px] text-slate-400 mt-1">Left Click to place points. Double-Click to finish shape.</div>
                    ) : (
                        <div className="text-[10px] text-slate-400 mt-1">Left Click anywhere to drop a node.</div>
                    )}
                </div>
                <div className="h-8 w-px bg-slate-700"></div>
                <button 
                    onClick={() => { setActiveModelingTool(null); setDrawTempPoints([]); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded transition-colors text-xs font-bold uppercase"
                >
                    <X size={14} /> Cancel
                </button>
            </div>
        </div>
    );
}
