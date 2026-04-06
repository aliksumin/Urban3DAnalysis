import React, { useState, useEffect } from 'react';
import { PanelSection, PanelFooter, Button, Slider, Input, Switch, Metric } from '../ui';
import { Target, Crosshair } from 'lucide-react';
import { useStore } from '../components/Environment3D';

export default function WalkabilityTool({ regionBounds }) {
    const [radius, setRadius] = useState(15);
    const [speed, setSpeed] = useState(4.0);
    const [functions, setFunctions] = useState('retail, clinic, school');
    const [autoDistribute, setAutoDistribute] = useState(false);

    const { functionColors, walkabilityActive, setWalkabilityActive, setWalkabilityRadiusMeters, walkabilityActiveNodes, walkabilityTargetFulfill, walkabilityAvgDist, setWalkabilityConfig } = useStore();

    useEffect(() => {
        // speed is km/h. radius is minutes. max distance in meters:
        // (speed * 1000 meters / 60 minutes) * radius
        const maxDistMeters = (speed * 1000 / 60) * radius;
        setWalkabilityRadiusMeters(maxDistMeters);
    }, [radius, speed, setWalkabilityRadiusMeters]);

    useEffect(() => {
        setWalkabilityConfig({ walkabilityReqFuncs: functions, walkabilityAutoDistribute: autoDistribute });
    }, [functions, autoDistribute, setWalkabilityConfig]);

    const handleDeploy = () => {
        setWalkabilityActive(!walkabilityActive);
    };

    const activeFuncsSet = new Set(functions.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));

    const handleToggle = (fn) => {
        const newSet = new Set(activeFuncsSet);
        if (newSet.has(fn)) newSet.delete(fn);
        else newSet.add(fn);
        setFunctions(Array.from(newSet).join(', '));
    };

    const handleAddCustom = (e) => {
        if (e.key === 'Enter' && e.target.value) {
            const val = e.target.value.toLowerCase().trim();
            if (val && val !== 'unknown') {
                const newSet = new Set(activeFuncsSet);
                newSet.add(val);
                setFunctions(Array.from(newSet).join(', '));
                e.target.value = '';
            }
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

            <PanelSection title="Required Infrastructure">
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto custom-scrollbar border border-slate-200 rounded p-1 mb-2 bg-slate-50">
                    {Object.entries(functionColors).filter(([fn]) => fn !== 'unknown').map(([fn, color]) => (
                        <label key={fn} className="flex items-center gap-3 p-1.5 hover:bg-slate-100 rounded cursor-pointer transition-colors">
                            <input 
                                type="checkbox" 
                                checked={activeFuncsSet.has(fn)}
                                onChange={() => handleToggle(fn)}
                                className="accent-blue-500 w-3.5 h-3.5"
                            />
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }}></div>
                            <span className="text-xs text-slate-700 capitalize flex-1 truncate">{fn}</span>
                        </label>
                    ))}
                    <div className="px-1.5 py-1 mt-1 border-t border-slate-200">
                        <input 
                            type="text" 
                            placeholder="+ Add new function (Press Enter)"
                            onKeyDown={handleAddCustom}
                            className="bg-transparent text-xs w-full outline-none text-slate-600 placeholder-slate-400"
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <Switch checked={autoDistribute} onChange={setAutoDistribute} label="Auto-Distribute Missing" description="Deploy generative node assignments if targets lack essential facilities." />
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
