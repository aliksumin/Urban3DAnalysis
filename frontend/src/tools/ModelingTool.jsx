import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useStore } from '../components/Environment3D';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { X, MousePointer2, Grid, Magnet } from 'lucide-react';

export function ModelingLayer({ regionBounds, children }) {
    const { 
        activeModelingTool, 
        drawTempPoints, 
        setDrawTempPoints, 
        customBuildings, 
        setCustomBuildings, 
        customRoads, 
        setCustomRoads, 
        customPOIs, 
        setCustomPOIs, 
        setActiveModelingTool,
        minH,
        gridSnapEnabled,
        vertexSnapEnabled
    } = useStore();
    const { camera, raycaster, pointer, gl } = useThree();
    const [previewPoint, setPreviewPoint] = useState(null);

    // Hide system cursor over canvas when dropping POIs
    useEffect(() => {
        const glCanvas = gl?.domElement;
        if (activeModelingTool === 'poi' && glCanvas) {
            glCanvas.style.cursor = 'none';
        } else if (glCanvas) {
            glCanvas.style.cursor = 'default';
        }
        return () => {
            if (glCanvas) glCanvas.style.cursor = 'default';
        };
    }, [activeModelingTool, gl]);

    const getIntersectPos = (e) => {
        if (!e) return null;
        if (e.intersections && e.intersections.length > 0) {
            // Find terrain collision plane first
            const terrainIntersect = e.intersections.find(
                intersect => intersect.object.name === 'terrainCollisionMesh' || intersect.object.name === 'platformBaseMesh'
            );
            if (terrainIntersect) {
                return [terrainIntersect.point.x, terrainIntersect.point.z, terrainIntersect.point.y];
            }
            // Fallback to groundPlane
            const groundIntersect = e.intersections.find(
                intersect => intersect.object.name === 'groundPlane'
            );
            if (groundIntersect) {
                return [groundIntersect.point.x, groundIntersect.point.z, groundIntersect.point.y];
            }
        }
        if (e.point) {
            return [e.point.x, e.point.z, e.point.y];
        }
        return null;
    };

    const getPointHeight = (p) => {
        const { getEl, currentBounds, cityW, cityD } = useStore.getState();
        const w = cityW, d = cityD;
        const cb = currentBounds;
        if (cb && getEl && w && d) {
            const minLon = Math.min(cb[0], cb[2]);
            const maxLon = Math.max(cb[0], cb[2]);
            const minLat = Math.min(cb[1], cb[3]);
            const maxLat = Math.max(cb[1], cb[3]);
            
            const lX = p[0] + w/2;
            const lZ = d/2 - p[1];
            
            const lon = (lX / w) * (maxLon - minLon) + minLon;
            const lat = (lZ / d) * (maxLat - minLat) + minLat;
            const rawH = getEl(lon, lat) || 0;
            return rawH - (minH || 0);
        }
        return 0;
    };

    const snapPoint = (pos) => {
        if (!pos) return null;
        const { cityW, cityD } = useStore.getState();
        const w = cityW;
        const d = cityD;
        
        let lx = pos[0] + w / 2;
        let lz = d / 2 - pos[1];
        
        let snapped = false;
        let snapX = lx;
        let snapZ = lz;
        let minD = 10; // 10-meter auto snapping range

        const currentVertexSnapEnabled = useStore.getState().vertexSnapEnabled;

        if (currentVertexSnapEnabled) {
            // 1. Current drawing vertices (query latest store state to avoid closures)
            const currentDrawTempPoints = useStore.getState().drawTempPoints;
            currentDrawTempPoints.forEach(p => {
                const px = p[0] + w / 2;
                const pz = d / 2 - p[1];
                const dist = Math.hypot(lx - px, lz - pz);
                if (dist < minD) {
                    minD = dist;
                    snapX = px;
                    snapZ = pz;
                    snapped = true;
                }
            });

            // 2. Custom building vertices
            const currentCustomBuildings = useStore.getState().customBuildings;
            if (!snapped) {
                currentCustomBuildings.forEach(cb => {
                    cb.points.forEach(p => {
                        const dist = Math.hypot(lx - p[0], lz - p[1]);
                        if (dist < minD) {
                            minD = dist;
                            snapX = p[0];
                            snapZ = p[1];
                            snapped = true;
                        }
                    });
                });
            }

            // 3. Custom road vertices
            const currentCustomRoads = useStore.getState().customRoads;
            if (!snapped) {
                currentCustomRoads.forEach(cr => {
                    cr.points.forEach(p => {
                        const dist = Math.hypot(lx - p[0], lz - p[1]);
                        if (dist < minD) {
                            minD = dist;
                            snapX = p[0];
                            snapZ = p[1];
                            snapped = true;
                        }
                    });
                });
            }

            // 4. Custom POIs
            const currentCustomPOIs = useStore.getState().customPOIs;
            if (!snapped) {
                currentCustomPOIs.forEach(poi => {
                    const dist = Math.hypot(lx - poi.x, lz - poi.z);
                    if (dist < minD) {
                        minD = dist;
                        snapX = poi.x;
                        snapZ = poi.z;
                        snapped = true;
                    }
                });
            }
        }

        // 5. Grid Snap
        const currentGridSnapEnabled = useStore.getState().gridSnapEnabled;
        if (!snapped && currentGridSnapEnabled) {
            const gridSize = 5;
            snapX = Math.round(lx / gridSize) * gridSize;
            snapZ = Math.round(lz / gridSize) * gridSize;
        }

        const rx = snapX - w / 2;
        const rz = d / 2 - snapZ;
        const ry = getPointHeight([rx, rz]);

        return [rx, rz, ry];
    };

    const handlePointerMove = (e) => {
        const { activeModelingTool } = useStore.getState();
        if (!activeModelingTool) return;
        const pos = getIntersectPos(e);
        if (pos) {
            const snapped = snapPoint(pos);
            setPreviewPoint(snapped);
        }
    };

    const handlePointerUp = (e) => {
        // No-op for now
    };

    const handleContextMenu = (e) => {
        const { activeModelingTool, drawTempPoints, setDrawTempPoints, customBuildings, setCustomBuildings, customRoads, setCustomRoads, setActiveModelingTool } = useStore.getState();
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
        } else if (activeModelingTool === 'walkability_route') {
            useStore.getState().setWalkabilityCustomRoute(lPts);
            useStore.getState().setActiveModelingTool('walkability');
        }

        setActiveModelingTool(null);
        setDrawTempPoints([]);
        setPreviewPoint(null);
    };

    const handlePointerDown = (e) => {
        const { activeModelingTool, drawTempPoints, setDrawTempPoints, customPOIs, setCustomPOIs, setActiveModelingTool } = useStore.getState();
        if (!activeModelingTool) return;
        e.stopPropagation();
        
        // Resolve click button safely across R3F and DOM native pointer models
        const clickButton = e.button !== undefined ? e.button : e.nativeEvent?.button;

        if (clickButton === 2) {
            handleContextMenu(e);
            return;
        }

        if (clickButton !== 0) return; // Only trigger placements on left-click
        const pos = getIntersectPos(e);
        if (!pos) return;

        const snapped = snapPoint(pos);

        if (activeModelingTool === 'poi') {
            const { cityW, cityD } = useStore.getState();
            const newPOI = {
                id: 'poi_' + Date.now(),
                x: snapped[0] + cityW / 2,
                z: cityD / 2 - snapped[1],
                y: snapped[2],
                tags: { function: 'New Function' },
                isPOI: true
            };
            console.log('Placing custom POI:', newPOI);
            setCustomPOIs([...customPOIs, newPOI]);
            setActiveModelingTool(null);
            setDrawTempPoints([]);
        } else {
            setDrawTempPoints([...drawTempPoints, snapped]);
        }
    };

    const linePoints = previewPoint && activeModelingTool ? [...drawTempPoints, previewPoint] : drawTempPoints;
    const isPoly = activeModelingTool === 'building' && linePoints.length > 2;
    if (isPoly && previewPoint) {
        linePoints.push(drawTempPoints[0]);
    }

    const flatPoints = linePoints.map(p => {
        const height = getPointHeight(p);
        return new THREE.Vector3(p[0], height + 2, p[1]);
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
                onPointerMove={(e) => {}}
            >
                <planeGeometry args={[100000, 100000]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#ffffff" />
            </mesh>

            {children}

            {activeModelingTool === 'poi' && previewPoint && (
                <group position={[previewPoint[0], previewPoint[2], previewPoint[1]]}>
                    {/* A 3D Cone pointing down to represent the pin tip */}
                    <mesh 
                        position={[0, 4, 0]} 
                        rotation={[Math.PI, 0, 0]} 
                        raycast={() => null}
                    >
                        <coneGeometry args={[2, 8, 8]} />
                        <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} />
                    </mesh>
                    {/* A 3D Sphere at the top of the pin */}
                    <mesh 
                        position={[0, 8, 0]} 
                        raycast={() => null}
                    >
                        <sphereGeometry args={[3, 16, 16]} />
                        <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} />
                    </mesh>
                </group>
            )}

            {activeModelingTool && flatPoints.length > 1 && (
                <Line
                    points={flatPoints}
                    color="#3b82f6"
                    lineWidth={3}
                    dashed={activeModelingTool === 'building'}
                    raycast={() => null}
                />
            )}
            
            {activeModelingTool && drawTempPoints.map((p, i) => {
                const height = getPointHeight(p);
                return (
                    <mesh key={i} position={[p[0], height + 2, p[1]]} raycast={() => null}>
                        <sphereGeometry args={[4, 16, 16]} />
                        <meshBasicMaterial color="#ef4444" />
                    </mesh>
                );
            })}
        </group>
    );
}

export function ModelingHUD() {
    const { 
        activeModelingTool, 
        setActiveModelingTool, 
        setDrawTempPoints, 
        gridSnapEnabled, 
        setGridSnapEnabled,
        vertexSnapEnabled,
        setVertexSnapEnabled
    } = useStore();

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
                        {activeModelingTool === 'walkability_route' && "Draw Custom Walkability Route"}
                    </div>
                    {activeModelingTool !== 'poi' ? (
                        <div className="text-[10px] text-slate-400 mt-1">Left Click to place points. Double-Click or Right Click to finish.</div>
                    ) : (
                        <div className="text-[10px] text-slate-400 mt-1">Left Click anywhere to drop a node.</div>
                    )}
                </div>
                
                <div className="h-8 w-px bg-slate-700"></div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setGridSnapEnabled(!gridSnapEnabled)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-xs font-bold uppercase ${
                            gridSnapEnabled 
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                : 'bg-slate-800 hover:bg-slate-750 text-slate-400 border border-transparent'
                        }`}
                        title="Snap cursor to a 5-meter grid"
                    >
                        <Grid size={14} /> Grid Snap
                    </button>
                    <button
                        onClick={() => setVertexSnapEnabled(!vertexSnapEnabled)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-xs font-bold uppercase ${
                            vertexSnapEnabled 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : 'bg-slate-800 hover:bg-slate-750 text-slate-400 border border-transparent'
                        }`}
                        title="Auto-snaps cursor to nearby vertices (10m range)"
                    >
                        <Magnet size={14} /> Vertex Snap
                    </button>
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
