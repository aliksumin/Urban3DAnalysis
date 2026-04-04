import React, { useState } from 'react';
import { PanelSection, PanelFooter, Button, Slider, Input, Switch, Metric } from '../ui';
import { Target } from 'lucide-react';

export default function WalkabilityTool({ regionBounds }) {
    const [radius, setRadius] = useState(15);
    const [speed, setSpeed] = useState(4.0);
    const [functions, setFunctions] = useState('retail, clinic, school');
    const [autoDistribute, setAutoDistribute] = useState(false);

    return (
        <>
            <PanelSection title="Isochrone Matrix">
                <div className="flex flex-col gap-6">
                    <Slider label="Walkable Radius" min={5} max={45} step={1} value={radius} onChange={setRadius} suffix=" min" />
                    <Slider label="Agent Velocity" min={2.0} max={10.0} step={0.5} value={speed} onChange={setSpeed} suffix=" km/h" />
                </div>
            </PanelSection>

            <PanelSection title="Required Infrastructure">
                <Input
                    value={functions}
                    onChange={e => setFunctions(e.target.value)}
                    placeholder="e.g. retail, school, hospital"
                />
                <div className="mt-6">
                    <Switch checked={autoDistribute} onChange={setAutoDistribute} label="Auto-Distribute Missing" description="Deploy generative node assignments if targets lack essential facilities." />
                </div>
            </PanelSection>

            <PanelSection title="Network Diagnostic" className="flex-1">
                <div className="flex flex-col gap-1">
                    <Metric label="Active Graph Nodes" value="AWAITING DEPLOY" />
                    <Metric label="Target Satisfiability" value="N/A" />
                    <Metric label="Average Distance" value="--" />
                </div>
            </PanelSection>

            <PanelFooter>
                <Button variant="primary" className="w-full py-3">
                    <Target size={16} /> Deploy Active Agent
                </Button>
            </PanelFooter>
        </>
    );
}
