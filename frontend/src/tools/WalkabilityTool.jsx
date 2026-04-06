import React, { useState, useEffect } from 'react';
import { PanelSection, PanelFooter, Button, Slider, Input, Switch, Metric } from '../ui';
import { Target, Crosshair } from 'lucide-react';
import { useStore } from '../components/Environment3D';

export function WalkabilityInfrastructurePanel() {
    const { functionColors, walkabilityArcs, walkabilityReqFuncs, walkabilityAutoDistribute, setWalkabilityConfig } = useStore();

    const activeFuncsSet = new Set((walkabilityReqFuncs || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));

    const handleToggle = (fn) => {
        const newSet = new Set(activeFuncsSet);
        if (newSet.has(fn)) newSet.delete(fn);
        else newSet.add(fn);
        setWalkabilityConfig({ walkabilityReqFuncs: Array.from(newSet).join(', ') });
    };

    const handleSelectAll = () => {
        const allFuncs = Object.keys(functionColors).filter(fn => fn !== 'unknown');
        const newSet = new Set([...activeFuncsSet, ...allFuncs]);
        setWalkabilityConfig({ walkabilityReqFuncs: Array.from(newSet).join(', ') });
    };

    const handleDeselectAll = () => {
        setWalkabilityConfig({ walkabilityReqFuncs: '' });
    };

    const handleAddCustom = (e) => {
        if (e.key === 'Enter' && e.target.value) {
            const val = e.target.value.toLowerCase().trim();
            if (val && val !== 'unknown') {
                const newSet = new Set(activeFuncsSet);
                newSet.add(val);
                setWalkabilityConfig({ walkabilityReqFuncs: Array.from(newSet).join(', ') });
                e.target.value = '';
            }
        }
    };

    const fulfilledColors = new Set((walkabilityArcs || []).map(a => a.color));

    return (
        <div className="flex flex-col h-full">
            <PanelSection title="Required Infrastructure" className="flex-1 flex flex-col min-h-0 shrink overflow-hidden" noPadding>
                <div className="flex flex-col h-full px-4 pt-3 pb-3">
                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Target Tracking</span>
                        <div className="flex gap-2">
                            <button onClick={handleSelectAll} className="text-[10px] text-blue-500 hover:text-blue-600 transition-colors">Select All</button>
                            <button onClick={handleDeselectAll} className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">None</button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1 min-h-[50px] overflow-y-auto custom-scrollbar border border-slate-200 rounded p-1 mb-2 bg-slate-50">
                    {Object.entries(functionColors).filter(([fn]) => fn !== 'unknown').map(([fn, color]) => {
                        const isTargeted = fulfilledColors.has(color);
                        return (
                            <label key={fn} className={`flex items-center gap-3 p-1.5 hover:bg-slate-100 rounded cursor-pointer transition-colors ${isTargeted ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'border border-transparent'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={activeFuncsSet.has(fn)}
                                    onChange={() => handleToggle(fn)}
                                    className="accent-blue-500 w-3.5 h-3.5"
                                />
                                <div className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-black/10" style={{ backgroundColor: color }}></div>
                                <span className={`text-xs capitalize flex-1 truncate ${isTargeted ? 'font-semibold text-blue-800' : 'text-slate-700'}`}>{fn}</span>
                            </label>
                        );
                    })}
                    <div className="px-1.5 py-1 mt-1 border-t border-slate-200">
                        <input 
                            type="text" 
                            placeholder="+ Add new function (Press Enter)"
                            onKeyDown={handleAddCustom}
                            className="bg-transparent text-xs w-full outline-none text-slate-600 placeholder-slate-400"
                        />
                    </div>
                </div>
                <div className="mt-4 shrink-0">
                    <Switch checked={walkabilityAutoDistribute} onChange={(v) => setWalkabilityConfig({ walkabilityAutoDistribute: v })} label="Auto-Distribute Missing" description="Deploy generative node assignments if targets lack essential facilities." />
                </div>
                </div>
            </PanelSection>
        </div>
    );
}

export default function WalkabilityTool({ regionBounds }) {
    const [radius, setRadius] = useState(15);
    const [speed, setSpeed] = useState(4.0);

    const { walkabilityActive, setWalkabilityActive, setWalkabilityRadiusMeters, walkabilityActiveNodes, walkabilityTargetFulfill, walkabilityAvgDist } = useStore();

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

    return (
        <>
            <PanelSection title="Isochrone Matrix">
                <div className="flex flex-col gap-6">
                    <Slider label="Walkable Radius" min={5} max={45} step={1} value={radius} onChange={setRadius} suffix=" min" />
                    <Slider label="Agent Velocity" min={2.0} max={10.0} step={0.5} value={speed} onChange={setSpeed} suffix=" km/h" />
                </div>
            </PanelSection>



            <PanelSection title="Network Diagnostic" className="flex-1">
                <div className="flex flex-col gap-1">
                    <Metric label="Active Graph Nodes" value={walkabilityActiveNodes || "AWAITING DEPLOY"} />
                    <Metric label="Target Satisfiability" value={walkabilityTargetFulfill || "N/A"} />
                    <Metric label="Average Distance" value={walkabilityAvgDist + " m"} />
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
