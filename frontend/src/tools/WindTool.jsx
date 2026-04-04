import React, { useState } from 'react';
import { PanelSection, PanelFooter, Button, Slider, Switch, Metric } from '../ui';
import { Wind, Play } from 'lucide-react';

export default function WindTool({ regionBounds }) {
    const [windSpeed, setWindSpeed] = useState(10);
    const [windDirection, setWindDirection] = useState(180);
    const [particleFlow, setParticleFlow] = useState(true);

    return (
        <>
            <PanelSection title="Meteorological Vector">
                <div className="flex flex-col gap-6">
                    <Slider label="Base Wind Velocity" min={0} max={30} step={1} value={windSpeed} onChange={setWindSpeed} suffix=" m/s" />
                    <Slider label="Azimuth Direction" min={0} max={360} step={5} value={windDirection} onChange={setWindDirection} suffix="°" />
                </div>
            </PanelSection>

            <PanelSection title="GAN Compute Node">
                <div className="flex flex-col gap-1">
                    <Metric label="Endpoint API" value="Eddy3D-GAN-Local" highlight />
                    <Metric label="Topology Density" value="High" />
                </div>
                <div className="mt-6 pt-5 border-t border-zinc-800/40">
                    <Switch checked={particleFlow} onChange={setParticleFlow} label="Render Live Particles" description="Simulate animated wind streamlines over the 3D surface graph." />
                </div>
            </PanelSection>

            <PanelSection title="Simulation Data" className="flex-1">
                <div className="flex flex-col gap-1">
                    <Metric label="Status" value="AWAITING COMPUTE" />
                    <Metric label="Grid Memory" value="--" />
                </div>
            </PanelSection>

            <PanelFooter>
                <Button variant="primary" className="w-full py-3">
                    <Play size={16} fill="currentColor" /> Execute GAN Simulation
                </Button>
            </PanelFooter>
        </>
    );
}
