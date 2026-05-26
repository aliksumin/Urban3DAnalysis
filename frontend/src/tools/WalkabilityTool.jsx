import React, { useState, useEffect } from 'react';
import { PanelSection, PanelFooter, Button, Slider, Metric } from '../ui';
import { Target, Crosshair, BrainCircuit, Loader2, Route, Play, Square, X, MousePointer2 } from 'lucide-react';
import { useStore } from '../components/Environment3D';

export function WalkabilityInfrastructurePanel() {
    const { walkabilityArcs, walkabilityAgentPos, timeOfDay, masterFunctions, isAnimatingRoute, setAnimatingRoute } = useStore();
    
    // Aggregate unique functions being targeted right now.
    const activeArcs = walkabilityArcs || [];
    const uniqueFuncs = [];
    const seen = new Set();
    activeArcs.forEach(a => {
        if (!seen.has(a.name.toLowerCase())) {
            uniqueFuncs.push(a);
            seen.add(a.name.toLowerCase());
        }
    });
    
    const trackables = (masterFunctions || []).filter(m => m.trackable).map(m => m.name.toLowerCase());
    const missingTrackables = trackables.filter(t => !seen.has(t));

    const isDay = timeOfDay > 6 && timeOfDay < 18;
    const themeColor = isDay ? '#00f3ff' : '#ffb700'; // Cyberpunk Blue/Gold
    const glowStyle = { textShadow: `0 0 8px ${themeColor}, 0 0 16px ${themeColor}`, color: '#ffffff' };

    return (
        <div className="flex flex-col h-full pointer-events-none">
            <div className="flex-1 flex flex-col min-h-0 shrink overflow-hidden">
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <span className="text-sm font-bold uppercase tracking-[0.3em]" style={glowStyle}>Target Tracking</span>
                </div>
                {walkabilityAgentPos ? (
                    <div className="flex flex-col gap-3 flex-1 min-h-[50px] overflow-y-auto custom-scrollbar opacity-90">
                        {uniqueFuncs.length > 0 ? uniqueFuncs.map((arc, i) => (
                            <div key={i} className="flex items-center gap-3 relative group">
                                <span className="text-sm font-mono font-bold uppercase tracking-wider" style={{ color: arc.color, textShadow: `0 0 8px ${arc.color}, 0 0 16px ${arc.color}` }}>{arc.name}</span>
                            </div>
                        )) : (
                            <div className="text-xs font-mono" style={{ color: themeColor, opacity: 0.6 }}>NO ACTIVE CONNECTIONS</div>
                        )}
                        {/* Display missing functions list count directly underneath the connected lists */}
                        {missingTrackables.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-red-500/20 text-xs font-mono font-bold tracking-widest" style={{ color: '#ff4444', textShadow: '0 0 8px rgba(255, 0, 0, 0.5)' }}>
                                {missingTrackables.length} FUNCTIONS MISSING
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-1 items-center font-mono tracking-widest" style={{ color: themeColor, opacity: 0.5, textShadow: `0 0 10px ${themeColor}` }}>
                        DEPLOY AGENT TO SCAN
                    </div>
                )}
            </div>
        </div>
    );
}

export default function WalkabilityTool({ regionBounds }) {
    const [radius, setRadius] = useState(15);
    const [speed, setSpeed] = useState(4.0);
    const { walkabilityActive, setWalkabilityActive, setWalkabilityRadiusMeters, walkabilityActiveNodes, walkabilityTargetFulfill, walkabilityAvgDist, aiProcessing, setAiProcessing, setAiProgressText, aiAbortController, setAiAbortController } = useStore();

    useEffect(() => {
        const maxDistMeters = (speed * 1000 / 60) * radius;
        setWalkabilityRadiusMeters(maxDistMeters);
    }, [radius, speed, setWalkabilityRadiusMeters]);

    const handleDeploy = () => {
        if (walkabilityActive) {
            useStore.getState().setWalkabilityAgentPos(null);
            useStore.getState().setWalkabilityConfig({ walkabilityGraphNodes: [], walkabilityPaths: [], walkabilityArcs: [] });
        }
        setWalkabilityActive(!walkabilityActive);
    };

    const handleAIAssignment = async () => {
        const { allBuildings, customBuildings, customPOIs, aiApiKey, aiModel, masterFunctions, setBuildingEdits, buildingEdits } = useStore.getState();
        if (!aiApiKey) {
            alert('Please configure Google Gemini API Key in Settings first.');
            return;
        }

        if (aiProcessing) {
            // If already processing, do not let them start a new one, but we have a Stop button now
            return;
        }

        const controller = new AbortController();
        setAiAbortController(controller);
        setAiProcessing(true);
        setAiProgressText('Initializing...');
        
        try {
            // Filter target buildings that need processing. To keep to context limits, process batched.
            const combinedBuildings = [...allBuildings, ...(customBuildings || []), ...(customPOIs || [])];
            const targetBuildings = combinedBuildings.filter(b => b.tags && Object.keys(b.tags).length > 0);
            
            // --- DATA AUGMENTATION INJECTION ---
            const { googlePlacesKey, amapApiKey, useGooglePlaces, useOvertureMaps } = useStore.getState();
            if (regionBounds) {
                const unproject = (lon, lat, minLon, minLat) => {
                    const R = 6378137;
                    const x = (lon - minLon) * (Math.PI / 180) * R * Math.cos(lat * Math.PI / 180);
                    const y = (lat - minLat) * (Math.PI / 180) * R;
                    return [x, y];
                };

                const [minLon, minLat, maxLon, maxLat] = regionBounds;
                const isChina = (maxLon > 73 && minLon < 135 && maxLat > 18 && minLat < 53);
                const cLon = (minLon + maxLon) / 2;
                const cLat = (minLat + maxLat) / 2;

                const externalPOIs = [];

                if (useOvertureMaps) {
                    setAiProgressText('Querying Overture Spatial Engine...');
                    try {
                        const ovRes = await fetch(`http://${window.location.hostname}:8005/api/overture`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bbox: regionBounds }), signal: controller.signal
                        });
                        if (ovRes.ok) {
                            const ovData = await ovRes.json();
                            if (ovData.features) {
                                ovData.features.forEach(f => {
                                    if(f.geometry && f.geometry.coordinates) {
                                        const cats = f.properties?.categories || {};
                                        const catName = cats.primary || (cats.alternate && cats.alternate[0]) || '';
                                        const title = f.properties?.names?.primary || '';
                                        externalPOIs.push({
                                            lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
                                            name: title, type: `overture: ${catName}`
                                        });
                                    }
                                });
                            }
                        }
                    } catch(e) { console.warn("Overture failed", e); }
                }

                if (isChina && amapApiKey) {
                    setAiProgressText('Querying Amap Regional Overlay...');
                    try {
                        const plg = `${minLon},${minLat}|${maxLon},${maxLat}`;
                        const aRes = await fetch(`http://${window.location.hostname}:8005/api/amap_places`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ api_key: amapApiKey, polygon: plg }), signal: controller.signal
                        });
                        if (aRes.ok) {
                            const aData = await aRes.json();
                            if (aData.pois) {
                                aData.pois.forEach(p => {
                                    const coords = p.location.split(',');
                                    externalPOIs.push({
                                        lon: parseFloat(coords[0]), lat: parseFloat(coords[1]),
                                        name: p.name, type: `amap: ${p.type}`
                                    });
                                });
                            }
                        }
                    } catch(e) { console.warn("Amap failed", e); }
                }

                if (useGooglePlaces && googlePlacesKey) {
                    setAiProgressText('Querying Google Places Context...');
                    try {
                        const gRes = await fetch(`http://${window.location.hostname}:8005/api/google_places`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ api_key: googlePlacesKey, lat: cLat, lng: cLon, radius: 1500 }), signal: controller.signal
                        });
                        if (gRes.ok) {
                            const gData = await gRes.json();
                            if (gData.results) {
                                gData.results.forEach(r => {
                                    externalPOIs.push({
                                        lon: r.geometry.location.lng, lat: r.geometry.location.lat,
                                        name: r.name, type: `google: ${(r.types || []).join(',')}`
                                    });
                                });
                            }
                        }
                    } catch(e) { console.warn("Google Maps failed", e); }
                }

                // Inject external POIs into corresponding buildings
                if (externalPOIs.length > 0) {
                    setAiProgressText('Fusing geometries...');
                    externalPOIs.forEach(poi => {
                        const [lx, lz] = unproject(poi.lon, poi.lat, minLon, minLat);
                        const bld = targetBuildings.find(b => b.minX <= lx && b.maxX >= lx && b.minY <= lz && b.maxY >= lz);
                        if (bld) {
                            bld.tags = { ...bld.tags, external_poi_name: poi.name, external_poi_type: poi.type };
                        }
                    });
                }
            }
            
            // Map the functions list into a neat string prompt.
            const allowedFunctionsStr = masterFunctions.map(f => f.name).join(', ');

            // Formulate chunks of 400 buildings
            const CHUNK_SIZE = 400;
            const newEdits = { ...buildingEdits };
            const chunks = [];

            for (let i = 0; i < targetBuildings.length; i += CHUNK_SIZE) {
                chunks.push(targetBuildings.slice(i, i + CHUNK_SIZE));
            }

            const fetchPromises = chunks.map(async (chunk) => {
                const promptData = chunk.map(b => ({
                    id: b.id,
                    tags: b.tags
                }));

                const prompt = `You are an AI performing urban function analysis. I have ${chunk.length} buildings represented by OpenStreetMap tags and geographically intersected enterprise POI data (such as Google Places, Amap, or Overture Maps).
Allowed Functions List: [${allowedFunctionsStr}]

For each building, determine the most applicable function(s) EXCLUSIVELY from the Allowed Functions List based on its tags.
- A building can have multiple functions if it's mixed use.
- IMPORTANT: If a building contains 'external_poi_name' or 'external_poi_type' tags, prioritize interpreting that over standard OSM tags, as it represents highly accurate proprietary data injected from external GIS providers.
- If no tags clearly map to a function on the list, default to "Residential".
- If the tags indicate a Commercial function, map it specifically to "Local Shop" if it is present in the Allowed Functions List; otherwise use standard semantic deduction to find the closest available option.
- If opening_hours tag exists, translate them to a range format "HH:mm-HH:mm" (e.g., "08:00-20:00"). If it doesn't exist, omit the openTime property to signify it will use the system default. 
Return ONLY a valid JSON array of objects representing the mappings. Schema:
[
  { "id": "building_id", "functions": [ { "name": "FunctionName", "openTime": "HH:mm-HH:mm" (optional) } ] }
]

Do not include any english explanations or markdown codeblocks formatting like \`\`\`json. Raw string of JSON.
Here are the buildings:
${JSON.stringify(promptData)}`;

                let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${aiApiKey}`;
                if (aiModel === 'Gemini 2.5 Pro') {
                    apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${aiApiKey}`;
                } else if (aiModel === 'Gemini 3.1 Pro') {
                    apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro:generateContent?key=${aiApiKey}`;
                }

                // Call gemini rest api directly
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.1,
                            responseMimeType: 'application/json'
                        }
                    })
                });

                if (!res.ok) {
                    const errorJson = await res.json();
                    throw new Error(errorJson?.error?.message || 'Gemini API Error');
                }

                const data = await res.json();
                let outputStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!outputStr) throw new Error("Empty response from AI");
                if (outputStr.startsWith('```json')) outputStr = outputStr.replace(/```json/g, '').replace(/```/g, '').trim();

                return JSON.parse(outputStr);
            });

            setAiProgressText(`Extracting features from ${targetBuildings.length} active structures using ${aiModel}...`);
            // Run in parallel
            const allResults = await Promise.all(fetchPromises);

            allResults.forEach(parsed => {
                // Map back to buildingEdits
                parsed.forEach(resItem => {
                    const mappedFuncs = resItem.functions.map(f => {
                         const mFn = masterFunctions.find(mf => mf.name === f.name);
                         return {
                             name: mFn ? mFn.name : 'Residential',
                             openTime: f.openTime || (mFn ? mFn.defaultOpeningTime : '-')
                         };
                    });
                    newEdits[resItem.id] = { ...(newEdits[resItem.id] || {}), functions: mappedFuncs };
                });
            });

            setBuildingEdits(newEdits);
            setAiProgressText('');
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('AI processing aborted by user');
            } else {
                 console.error(err);
                 alert("AI Analysis Failed: " + err.message);
            }
        } finally {
            setAiProcessing(false);
            setAiProgressText('');
            setAiAbortController(null);
        }
    };

    const handleStopAI = () => {
        if (aiAbortController) {
            aiAbortController.abort();
        }
    };

    return (
        <>
            <PanelSection title="Isochrone Matrix">
                <div className="flex flex-col gap-6">
                    <Slider label="Walkable Radius" min={5} max={45} step={1} value={radius} onChange={setRadius} suffix=" min" />
                    <Slider label="Agent Velocity" min={2.0} max={10.0} step={0.5} value={speed} onChange={setSpeed} suffix=" km/h" />
                </div>
            </PanelSection>

            <PanelSection title="AI Parameterization" className="mt-2">
                <div className="flex flex-col gap-3 text-xs text-slate-500">
                    <p className="leading-snug">Generate functional assignments natively via semantic inference over the OpenStreetMap tag space.</p>
                    
                    {!aiProcessing ? (
                        <Button variant="secondary" className="w-full py-2.5 justify-center gap-2 border-slate-200" onClick={handleAIAssignment}>
                            <BrainCircuit size={16} className="text-purple-500" />
                            Scan & Assign Properties
                        </Button>
                    ) : (
                        <Button onClick={handleStopAI} className="w-full py-2.5 justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/30 font-bold border" style={{ boxShadow: '0 0 10px rgba(239,68,68,0.2)' }}>
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            ABORT SCAN
                        </Button>
                    )}
                </div>
            </PanelSection>

            <PanelSection title="Network Diagnostic" className="flex-1 mt-2">
                <div className="flex flex-col gap-1">
                    <Metric label="Active Graph Nodes" value={walkabilityActiveNodes || "AWAITING DEPLOY"} />
                    <Metric label="Target Satisfiability" value={walkabilityTargetFulfill || "N/A"} />
                    <Metric label="Average Distance" value={walkabilityAvgDist + " m"} />
                </div>
            </PanelSection>

            <PanelSection title="Custom Animation" className="flex-1 mt-2">
                <div className="flex flex-col gap-2">
                    <Button 
                        variant={useStore.getState().activeModelingTool === 'walkability_route' ? "primary" : "secondary"} 
                        className={`w-full py-2.5 justify-center gap-2 ${useStore.getState().activeModelingTool === 'walkability_route' ? 'bg-blue-500 text-white' : 'border-slate-200'}`} 
                        onClick={() => {
                            useStore.getState().setWalkabilityCustomRoute([]);
                            useStore.getState().setActiveModelingTool(useStore.getState().activeModelingTool === 'walkability_route' ? 'walkability' : 'walkability_route');
                        }}
                    >
                        <Route size={16} /> Draw Custom Route
                    </Button>
                    <Button 
                        variant="secondary" 
                        disabled={!useStore.getState().walkabilityCustomRoute || useStore.getState().walkabilityCustomRoute.length < 2}
                        className={`w-full py-2.5 justify-center gap-2 ${useStore.getState().walkabilityCustomRoute && useStore.getState().walkabilityCustomRoute.length > 1 ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'opacity-50'}`} 
                        onClick={async () => {
                            try {
                                const resp = await fetch(`http://${window.location.hostname}:8005/api/next_animation_id`);
                                const data = await resp.json();
                                useStore.getState().setAnimMeta({ id: data.id, idx: 0 });
                                useStore.getState().setWalkabilityActive(true);
                                useStore.getState().setAnimatingRoute(true);
                            } catch (e) {
                                console.error("Could not reach backend for anim ID", e);
                            }
                        }}
                    >
                        <Play size={16} className={useStore.getState().walkabilityCustomRoute && useStore.getState().walkabilityCustomRoute.length > 1 ? "text-indigo-500" : ""} /> Animate Path
                    </Button>
                </div>
            </PanelSection>

            <PanelFooter>
                <Button variant={walkabilityActive ? "danger" : "primary"} className="w-full py-3" onClick={handleDeploy}>
                    {walkabilityActive ? <Crosshair size={16} /> : <Target size={16} />} 
                    {walkabilityActive ? "Cancel Agent Deploy" : "Deploy Active Agent"}
                </Button>
            </PanelFooter>
        </>
    );
}

export function WalkabilityHUD() {
    const { 
        walkabilityActive, 
        walkabilityAgentPos, 
        setWalkabilityAgentPos, 
        setWalkabilityActive, 
        setWalkabilityConfig,
        activeModelingTool
    } = useStore();

    if (!walkabilityActive || activeModelingTool) return null;

    const handleCancel = () => {
        setWalkabilityAgentPos(null);
        setWalkabilityConfig({ walkabilityGraphNodes: [], walkabilityPaths: [], walkabilityArcs: [] });
        setWalkabilityActive(false);
    };

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <div className="bg-slate-900/95 backdrop-blur-md px-6 py-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] border border-slate-700/50 text-white flex items-center gap-6">
                <div className="flex flex-col">
                    <div className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                        <MousePointer2 size={16} className="text-blue-400 animate-pulse" />
                        Walkability Agent Deployment
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                        {walkabilityAgentPos 
                            ? "Agent placed. Use Middle Mouse Click on terrain to move the agent." 
                            : "Click Left Mouse Button on terrain to place the agent (or Middle Mouse Click)."}
                    </div>
                </div>
                
                <div className="h-8 w-px bg-slate-700"></div>

                <button 
                    onClick={handleCancel}
                    className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded transition-colors text-xs font-bold uppercase"
                >
                    <X size={14} /> Cancel
                </button>
            </div>
        </div>
    );
}
