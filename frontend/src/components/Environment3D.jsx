import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Water } from 'three-stdlib';

extend({ Water });
import { create } from 'zustand';

export const useStore = create((set) => ({
    currentBounds: null,
    getEl: null,
}));

const InstancedVoxels = ({ data, material, count, vGeom, colors }) => {
    const meshRef = useRef();
    useEffect(() => {
        if (meshRef.current && data) {
            meshRef.current.instanceMatrix.array.set(data);
            meshRef.current.instanceMatrix.needsUpdate = true;
            meshRef.current.frustumCulled = false;
        }
    }, [data, count]);
    if (!data || count === 0) return null;
    return (
        <instancedMesh ref={meshRef} args={[vGeom, material, count]} receiveShadow castShadow frustumCulled={false}>
            {colors && <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />}
        </instancedMesh>
    );
};


const dbPromise = new Promise((resolve) => {
    const request = indexedDB.open('UrbanOSM', 35);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains('cache')) db.deleteObjectStore('cache');
        db.createObjectStore('cache');
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = () => resolve(null);
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

function OsmModel({ bounds, refEn }) {
    const [bldgs, setBldgs] = useState([]);
    const [hwys, setHwys] = useState([]);
    const [water, setWater] = useState([]);
    const [sand, setSand] = useState([]);
    const [w, setW] = useState(800);
    const [d, setD] = useState(800);
    const [minH, setMinH] = useState(0);
    const [osmStatus, setOsmStatus] = useState('Awaiting Geographic Boundaries...');

    const { getEl } = useStore();

    const loadTerrainHeights = async (minLon, minLat, maxLon, maxLat) => {
        const zoom = 14;
        const lat2tile = (lat, zoom) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
        const lon2tile = (lon, zoom) => Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
        const xMin = lon2tile(minLon, zoom), xMax = lon2tile(maxLon, zoom);
        const yMin = lat2tile(maxLat, zoom), yMax = lat2tile(minLat, zoom);

        const tiles = {};
        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                try {
                    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`);
                    if (!res.ok) continue;
                    const blob = await res.blob();
                    const img = new Image();
                    img.src = URL.createObjectURL(blob);
                    await new Promise(r => img.onload = r);
                    const canvas = document.createElement('canvas');
                    canvas.width = 256; canvas.height = 256;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    tiles[`${x}_${y}`] = ctx.getImageData(0, 0, 256, 256).data;
                } catch (e) { }
            }
        }

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
        useStore.setState({ currentBounds: bounds });
        if (refEn) loadTerrainHeights(bounds[0], bounds[1], bounds[2], bounds[3]);
        else useStore.setState({ getEl: () => 0 });
    }, [bounds, refEn]);

    useEffect(() => {
        if (!getEl || !bounds) return;

        const ext = unproject(Math.max(bounds[0], bounds[2]), Math.max(bounds[1], bounds[3]), Math.min(bounds[0], bounds[2]), Math.min(bounds[1], bounds[3]));
        setW(ext[0]); setD(ext[1]);

        const b = `${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]}`;

        getFromCache(b).then(cached => {
            if (cached) {
                setOsmStatus('');
                setMinH(cached.computedMinH);
                setBldgs(cached.blds); setHwys(cached.hwys); setWater(cached.watr); setSand(cached.snd);
                return;
            }

            const fetchOsmData = async (minLon, minLat, maxLon, maxLat) => {
                const TILE_DEG = 0.02;
                const tiles = [];
                for (let lon = minLon; lon < maxLon; lon += TILE_DEG) {
                    for (let lat = minLat; lat < maxLat; lat += TILE_DEG) {
                        tiles.push([
                            lon, lat,
                            Math.min(lon + TILE_DEG, maxLon),
                            Math.min(lat + TILE_DEG, maxLat)
                        ]);
                    }
                }
                setOsmStatus(`Downloading OSM data (${tiles.length} tiles)...`);
                const allWays = [];
                const allRelations = [];
                let done = 0;
                for (const [tMinLon, tMinLat, tMaxLon, tMaxLat] of tiles) {
                    try {
                        const res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${tMinLon},${tMinLat},${tMaxLon},${tMaxLat}`);
                        if (!res.ok) { done++; continue; }
                        const xml = await res.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(xml, 'text/xml');

                        const nodes = {};
                        doc.querySelectorAll('node').forEach(n => {
                            nodes[n.getAttribute('id')] = {
                                lon: parseFloat(n.getAttribute('lon')),
                                lat: parseFloat(n.getAttribute('lat'))
                            };
                        });

                        const wayMap = {};
                        doc.querySelectorAll('way').forEach(way => {
                            const tags = {};
                            way.querySelectorAll('tag').forEach(t => tags[t.getAttribute('k')] = t.getAttribute('v'));
                            const nds = Array.from(way.querySelectorAll('nd')).map(nd => nodes[nd.getAttribute('ref')]).filter(Boolean);
                            if (nds.length > 2) allWays.push({ tags, geometry: nds });
                            wayMap[way.getAttribute('id')] = nds;
                        });

                        // Parse relations for multipolygon water
                        doc.querySelectorAll('relation').forEach(rel => {
                            const tags = {};
                            rel.querySelectorAll(':scope > tag').forEach(t => tags[t.getAttribute('k')] = t.getAttribute('v'));
                            const members = Array.from(rel.querySelectorAll('member')).map(m => ({
                                type: m.getAttribute('type'),
                                ref: m.getAttribute('ref'),
                                role: m.getAttribute('role') || '',
                                geometry: m.getAttribute('type') === 'way' ? (wayMap[m.getAttribute('ref')] || null) : null
                            }));
                            if (members.some(m => m.geometry)) {
                                allRelations.push({ tags, members });
                            }
                        });

                        done++;
                        setOsmStatus(`Downloading OSM data (${done}/${tiles.length} tiles)...`);
                    } catch (e) { done++; }
                }
                return { ways: allWays, relations: allRelations };
            };

            const sMinLon = Math.min(bounds[0], bounds[2]);
            const sMinLat = Math.min(bounds[1], bounds[3]);
            const sMaxLon = Math.max(bounds[0], bounds[2]);
            const sMaxLat = Math.max(bounds[1], bounds[3]);

            fetchOsmData(sMinLon, sMinLat, sMaxLon, sMaxLat)
                .then(allWays => {
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

                        if (el.tags?.building) {
                            let h = el.tags?.height ? parseFloat(el.tags.height) : (el.tags?.['building:levels'] ? parseInt(el.tags['building:levels']) * 3 : 10);
                            if (isNaN(h) || h <= 0) h = 10;
                            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                            pts.forEach(p => {
                                if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
                                if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
                            });
                            
                            const eps = 0.5;
                            const isOnBorder = minX <= eps || maxX >= wVal - eps || minY <= eps || maxY >= dVal - eps;
                            if (!isOnBorder) {
                                blds.push({ p: pts, h, ls, el: 0, minX, maxX, minY, maxY });
                            }
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
                            const isCoast = el.tags?.natural === 'coastline';
                            const isWater = el.tags?.natural === 'water' || el.tags?.waterway === 'riverbank' || el.tags?.waterway === 'dock' ||
                                el.tags?.water === 'lake' || el.tags?.water === 'river' || el.tags?.water === 'reservoir' ||
                                el.tags?.water === 'basin' || el.tags?.landuse === 'basin' || el.tags?.landuse === 'reservoir' || el.tags?.natural === 'bay' || el.tags?.water === 'sea';

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
                                    const lonD = Math.min(Math.abs(pt[0] - bounds[0]), Math.abs(pt[0] - bounds[2]));
                                    const latD = Math.min(Math.abs(pt[1] - bounds[1]), Math.abs(pt[1] - bounds[3]));
                                    if (lonD > 0.005 && latD > 0.005) {
                                        const el = getEl(pt[0], pt[1]);
                                        if (!isNaN(el)) {
                                            if (el < minFound) minFound = el;
                                            if (el > maxFound) maxFound = el;
                                        }
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
                        setBldgs(blds); setHwys(hwys); setWater(watr); setSand(snd);
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

    const { terrainData, waterData, buildingData, roadData, sandData } = useMemo(() => {
        if (!bldgs || !water || w === 0 || d === 0) return { terrainData: new Float32Array(0), waterData: new Float32Array(0), buildingData: new Float32Array(0), roadData: new Float32Array(0), sandData: new Float32Array(0) };
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

        let tIdx = 0, wIdx = 0, bIdx = 0, rIdx = 0, sIdx = 0;

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

                // Priority 2: Building
                if (!isWater) {
                    for (let b of cellBldgs) {
                        if (lx < b.minX || lx > b.maxX || lz < b.minY || lz > b.maxY) continue;
                        if (ptInPoly([lx, lz], b.p)) {
                            isBuilding = true; bHeight = b.h; break;
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
                    let waterY = Math.floor(Math.max(0, wtEl - minH + 0.1) / hSize) * hSize + hSize;
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
                    let bhY = topY + Math.floor(bHeight / hSize) * hSize;
                    if (bhY >= topY + hSize) {
                        let bH = bhY - (topY + hSize) + hSize;
                        let bP_y = (topY + hSize) + bH / 2 - hSize / 2;
                        setMatrix(bArr, bIdx, x, bP_y, z, vSize, bH, vSize);
                        bIdx += 16;
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
            sandData: sArr.slice(0, sIdx)
        };
    }, [w, d, bldgs, water, sand, hwys, minH, refEn, getEl]);


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
    });


    const terrainMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#88cc99", roughness: 0.9, flatShading: true, clippingPlanes: clipPlanes }), [clipPlanes]);
    const buildingMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3, flatShading: true, clippingPlanes: clipPlanes }), [clipPlanes]);
    const roadMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffd700", emissive: "#ffaa00", emissiveIntensity: 2.0, roughness: 0.2, metalness: 0.8, flatShading: true, clippingPlanes: clipPlanes }), [clipPlanes]);
    const sandMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e6c280", roughness: 1.0, flatShading: true, clippingPlanes: clipPlanes }), [clipPlanes]);
    const waterMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#66ccff", transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.8, normalMap: normals, clippingPlanes: clipPlanes
    }), [normals, clipPlanes]);

    return (
        <>
            {osmStatus && (
                <Html center position={[0, Math.max(-minH, 0) + 100, 0]}>
                    <div className="bg-white/90 backdrop-blur-md border border-slate-200 text-slate-800 px-6 py-3 rounded-lg shadow-lg font-mono text-xs whitespace-nowrap pointer-events-none">
                        [DIAGNOSTIC] {osmStatus}
                    </div>
                </Html>
            )}
            <group position={[-w / 2, 0, d / 2]}>
                <InstancedVoxels data={terrainData} material={terrainMaterial} count={terrainData.length / 16} vGeom={vGeom} />
                <InstancedVoxels data={sandData} material={sandMaterial} count={sandData.length / 16} vGeom={vGeom} />
                <InstancedVoxels data={buildingData} material={buildingMaterial} count={buildingData.length / 16} vGeom={vGeom} />
                <InstancedVoxels data={roadData} material={roadMaterial} count={roadData.length / 16} vGeom={vGeom} />
                <InstancedVoxels data={waterData} material={waterMaterial} count={waterData.length / 16} vGeom={vGeom} />
            </group>
        </>
    );
}


export default function Environment3D({ regionBounds, reliefEnabled }) {
    return (
        <Canvas gl={{ localClippingEnabled: true, antialias: true, logarithmicDepthBuffer: true }} camera={{ position: [0, 400, 800], fov: 35, near: 1, far: 20000 }} shadows>
            <color attach="background" args={['#f8fafc']} />
            <ambientLight intensity={1.2} color="#ffffff" />
            <directionalLight position={[400, 800, 200]} intensity={1.5} color="#ffffff" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-1000} shadow-camera-right={1000} shadow-camera-top={1000} shadow-camera-bottom={-1000} shadow-bias={-0.001} shadow-normalBias={0.05} />
            <directionalLight position={[-200, 200, -200]} intensity={0.5} color="#ffffff" />

            {regionBounds ? <OsmModel bounds={regionBounds} refEn={reliefEnabled} /> : <PlatformBase w={800} d={800} refEn={false} minH={0} />}

            <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
        </Canvas>
    );
}
