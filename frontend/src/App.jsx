import React, { useState, useEffect } from 'react';
import Environment3D from './components/Environment3D';
import MapSelectorModal from './components/MapSelectorModal';
import { Navigation, Wind, Map as MapIcon, Layers, Settings } from 'lucide-react';
import WalkabilityTool from './tools/WalkabilityTool';
import WindTool from './tools/WindTool';
import { Panel, PanelHeader, PanelSection, Button, Metric } from './ui';

export default function App() {
  const [regionBounds, setRegionBounds] = useState(null);
  const [reliefEnabled, setReliefEnabled] = useState(false);
  const [isMapModalOpen, setMapModalOpen] = useState(true);
  const [activeTool, setActiveTool] = useState('walkability');

  useEffect(() => {
    const savedBounds = localStorage.getItem('urban_bounds');
    const savedRelief = localStorage.getItem('urban_relief');
    if (savedBounds) {
      const bounds = JSON.parse(savedBounds);
      setRegionBounds(bounds);
      setMapModalOpen(false);
    }
    if (savedRelief) setReliefEnabled(JSON.parse(savedRelief));
  }, []);

  const handleRegionSelect = (bounds, relief) => {
    localStorage.setItem('urban_bounds', JSON.stringify(bounds));
    localStorage.setItem('urban_relief', JSON.stringify(relief));
    setRegionBounds(bounds);
    setReliefEnabled(relief);
    setMapModalOpen(false);
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-zinc-950 text-sm font-sans selection:bg-blue-500 selection:text-white text-zinc-300">
      <div className="absolute inset-0 z-0">
        <Environment3D regionBounds={regionBounds} reliefEnabled={reliefEnabled} />
      </div>

      <div className="absolute top-6 left-6 z-10 flex gap-4 items-start pointer-events-none">
        <Panel className="w-[320px] pointer-events-auto">
          <PanelHeader
            icon={<Layers size={16} className="text-blue-500" />}
            title={<span>Arch<span className="font-light">Engine</span></span>}
          />

          <PanelSection className="pb-6">
            <Button variant="secondary" className="w-full mb-5" onClick={() => setMapModalOpen(true)}>
              <MapIcon size={14} /> Domain Extractor
            </Button>
            <div className="flex flex-col">
              <Metric label="Coordinate Bounds" value={regionBounds ? 'LOADED' : 'AWAITING'} highlight={!!regionBounds} />
              <Metric label="Base Topography" value={reliefEnabled ? '3D RELIEF' : 'FLAT DATUM'} />
              <Metric label="Active Module" value={activeTool.toUpperCase()} />
            </div>
          </PanelSection>

          <PanelSection title="Analysis Modules" className="flex flex-col gap-2 border-none">
            <Button
              variant={activeTool === 'walkability' ? 'active' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTool('walkability')}
            >
              <Navigation size={14} /> Walkability Network
            </Button>
            <Button
              variant={activeTool === 'wind' ? 'active' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTool('wind')}
            >
              <Wind size={14} /> Microclimate Simulation
            </Button>
          </PanelSection>
        </Panel>
      </div>

      {regionBounds && (
        <div className="absolute top-6 right-6 bottom-6 z-10 flex flex-col pointer-events-none">
          <Panel className="w-[400px] h-full pointer-events-auto">
            <PanelHeader
              icon={<Settings size={16} />}
              title={activeTool === 'walkability' ? 'Walkability Parameters' : 'Wind Analysis Controls'}
            />
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              {activeTool === 'walkability' ? <WalkabilityTool regionBounds={regionBounds} /> : <WindTool regionBounds={regionBounds} />}
            </div>
          </Panel>
        </div>
      )}

      <MapSelectorModal
        isOpen={isMapModalOpen}
        onClose={() => regionBounds && setMapModalOpen(false)}
        onRegionSelect={handleRegionSelect}
      />
    </div>
  );
}
