import React, { useState, useEffect, useRef } from 'react';
import Environment3D, { useStore } from './components/Environment3D';
import MapSelectorModal from './components/MapSelectorModal';
import { Navigation, Wind, Map as MapIcon, Layers, Settings, Save, FolderOpen, Building2, Droplet, PaintBucket, Tag, Sun } from 'lucide-react';
import WalkabilityTool, { WalkabilityInfrastructurePanel } from './tools/WalkabilityTool';
import WindTool from './tools/WindTool';
import { Panel, PanelHeader, PanelSection, Button, Metric, Input } from './ui';

export default function App() {
  const [regionBounds, setRegionBounds] = useState(null);
  const [reliefEnabled, setReliefEnabled] = useState(false);
  const [isMapModalOpen, setMapModalOpen] = useState(true);
  const [activeTool, setActiveTool] = useState(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [modulesMenuOpen, setModulesMenuOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isAnalysisMinimized, setAnalysisMinimized] = useState(false);
  const fileInputRef = useRef(null);

  const { selectedBuildingId, buildingEdits, setBuildingEdits, allBuildings, buildingColorMode, setBuildingColorMode, loadSceneConfig, setSelectedBuildingId, solidColor, setSolidColor, functionColors, setFunctionColors, osmStatus, showDiagnostics, setShowDiagnostics, timeOfDay, setTimeOfDay, weatherClear, setWeatherClear } = useStore();

  const selectedBuildingData = selectedBuildingId ? allBuildings.find(b => b.id === selectedBuildingId) : null;
  const currentEdits = selectedBuildingData ? (buildingEdits[selectedBuildingId] || {}) : {};

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

  const handleSaveScene = async () => {
    const data = {
      buildingEdits,
      buildingColorMode,
      bounds: regionBounds,
      relief: reliefEnabled
    };
    const jsonStr = JSON.stringify(data, null, 2);

    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `urban_scene_${Date.now()}.json`,
          types: [{
            description: 'JSON File',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
      } else {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `urban_scene_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error("Save failed", err);
    }
  };

  const handleOpenScene = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target.result);
        if(config.bounds) handleRegionSelect(config.bounds, config.relief);
        loadSceneConfig(config);
      } catch (err) {
        console.error("Failed to load scene", err);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-50 text-sm font-sans selection:bg-blue-500 selection:text-white text-slate-700">
      <div className="absolute inset-0 z-0">
        <Environment3D regionBounds={regionBounds} reliefEnabled={reliefEnabled} />
      </div>

      {osmStatus && (
        <div className="absolute inset-x-0 top-24 pointer-events-none z-50 flex justify-center">
            <div className="bg-white/95 backdrop-blur-md px-6 py-4 rounded-xl shadow-2xl border border-slate-200">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="font-mono text-xs text-slate-600 uppercase tracking-widest">{osmStatus}</div>
                </div>
            </div>
        </div>
      )}

      {(fileMenuOpen || modulesMenuOpen) && <div className="fixed inset-0 z-10" onClick={() => { setFileMenuOpen(false); setModulesMenuOpen(false); }} />}

      <div className="absolute top-4 left-4 z-20 flex gap-2 pointer-events-auto">
        <div className="relative">
           <button className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => { setFileMenuOpen(!fileMenuOpen); setModulesMenuOpen(false); }}>
              File
           </button>
           {fileMenuOpen && (
             <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg flex flex-col w-48 overflow-hidden z-30">
                <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { setMapModalOpen(true); setFileMenuOpen(false); }}><MapIcon size={14}/>Domain Extractor</button>
                <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { handleSaveScene(); setFileMenuOpen(false); }}><Save size={14}/>Save Scene</button>
                <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { fileInputRef.current?.click(); setFileMenuOpen(false); }}><FolderOpen size={14}/>Open Scene</button>
                <div className="border-t border-slate-100 my-1"></div>
                <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { setSettingsOpen(!isSettingsOpen); setFileMenuOpen(false); }}><Settings size={14}/>Settings</button>
                <div className="border-t border-slate-100 my-1"></div>
                <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center justify-between w-full" onClick={() => { setShowDiagnostics(!showDiagnostics); setFileMenuOpen(false); }}>
                    <div className="flex items-center gap-2"><Layers size={14}/>Diagnostics HUD</div>
                    <div className={`w-6 h-3 rounded-full transition-colors ${showDiagnostics ? 'bg-blue-500' : 'bg-slate-300'} relative`}>
                        <div className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-white transition-transform ${showDiagnostics ? 'translate-x-3' : 'translate-x-0'}`}></div>
                    </div>
                </button>
             </div>
           )}
        </div>

        <div className="relative">
           <button className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => { setModulesMenuOpen(!modulesMenuOpen); setFileMenuOpen(false); }}>
              Analysis Modules
           </button>
           {modulesMenuOpen && (
             <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg flex flex-col w-48 overflow-hidden z-30">
                <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { setActiveTool('walkability'); setModulesMenuOpen(false); setAnalysisMinimized(false); }}><Navigation size={14}/>Walkability Network</button>
                <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { setActiveTool('wind'); setModulesMenuOpen(false); setAnalysisMinimized(false); }}><Wind size={14}/>Microclimate</button>
             </div>
           )}
        </div>
      </div>

      <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleOpenScene} />

      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-4 pointer-events-none max-h-[calc(100vh-2rem)] pr-1">
         {isSettingsOpen && (
            <div className="pointer-events-auto bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg flex flex-col shrink-0" style={{ resize: 'both', overflow: 'hidden', direction: 'rtl', minWidth: '320px', maxWidth: '800px', minHeight: '300px', maxHeight: '90vh' }}>
              <div style={{ direction: 'ltr', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
               <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-2 font-medium text-slate-700 text-xs">
                     <Settings size={14} className="text-blue-500" /> Object Stylization
                  </div>
                  <button className="w-5 h-5 flex items-center justify-center hover:bg-red-100 hover:text-red-500 rounded text-slate-400 font-bold ml-1 text-sm bg-transparent border-0 cursor-pointer" onClick={() => setSettingsOpen(false)}>×</button>
               </div>
               <div className="p-5 flex flex-col gap-4 text-xs text-slate-600 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="colorMode" checked={buildingColorMode === 'solid'} onChange={() => setBuildingColorMode('solid')} className="accent-blue-500" />
                      <span className="font-semibold text-slate-700">Solid Color</span>
                    </label>
                    {buildingColorMode === 'solid' && (
                      <div className="pl-6 flex items-center gap-2">
                        <input type="color" value={solidColor} onChange={e => setSolidColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                        <span className="text-slate-500 font-mono">{solidColor}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="colorMode" checked={buildingColorMode === 'property'} onChange={() => setBuildingColorMode('property')} className="accent-blue-500" />
                      <span className="font-semibold text-slate-700">Custom Colors</span>
                    </label>
                    {buildingColorMode === 'property' && (
                      <span className="pl-6 block text-[10px] text-slate-400">Select a structure to impose an override</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                     <label className="flex items-center gap-2 cursor-pointer">
                       <input type="radio" name="colorMode" checked={buildingColorMode === 'function'} onChange={() => setBuildingColorMode('function')} className="accent-blue-500" />
                       <span className="font-semibold text-slate-700">Colorize by Function</span>
                     </label>
                     {buildingColorMode === 'function' && (
                        <div className="pl-6 mt-1 flex flex-col gap-1.5">
                          {Object.entries(functionColors).map(([fn, color]) => (
                            <div key={fn} className="flex justify-between items-center bg-slate-100/50 p-1.5 rounded">
                              <span className="capitalize text-slate-500 w-24">{fn}</span>
                              <input type="color" value={color} onChange={e => setFunctionColors(fn, e.target.value)} className="w-5 h-5 rounded cursor-pointer bg-transparent border-0" />
                            </div>
                          ))}
                        </div>
                     )}
                  </div>
               </div>
              </div>
            </div>
         )}

         {activeTool && regionBounds && (
            <div className="pointer-events-auto bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg flex flex-col shrink-0" style={{ resize: 'both', overflow: 'hidden', direction: 'rtl', minWidth: '320px', maxWidth: '800px', minHeight: '300px', maxHeight: '90vh' }}>
              <div style={{ direction: 'ltr', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
               <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-2 font-medium text-slate-700 text-xs uppercase tracking-wide">
                     {activeTool === 'walkability' ? <Navigation size={14} className="text-blue-500" /> : <Wind size={14} className="text-blue-500" />}
                     {activeTool === 'walkability' ? 'Walkability Params' : 'Microclimate Params'}
                  </div>
                  <div className="flex gap-1">
                     <button className="w-5 h-5 flex items-center justify-center hover:bg-slate-200 rounded text-slate-400 font-bold ml-1 bg-transparent border-0 cursor-pointer" onClick={() => setAnalysisMinimized(!isAnalysisMinimized)}>{isAnalysisMinimized ? '▼' : '▬'}</button>
                     <button className="w-5 h-5 flex items-center justify-center hover:bg-red-100 hover:text-red-500 rounded text-slate-400 font-bold ml-1 bg-transparent border-0 cursor-pointer text-sm" onClick={() => setActiveTool(null)}>×</button>
                  </div>
               </div>
               {!isAnalysisMinimized && (
                 <div className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
                   {activeTool === 'walkability' ? <WalkabilityTool regionBounds={regionBounds} /> : <WindTool regionBounds={regionBounds} />}
                 </div>
               )}
              </div>
            </div>
         )}
         
         {selectedBuildingData && (
            <div className="pointer-events-auto bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg flex flex-col shrink-0" style={{ resize: 'both', overflow: 'hidden', direction: 'rtl', minWidth: '320px', maxWidth: '800px', minHeight: '300px', maxHeight: '90vh' }}>
              <div style={{ direction: 'ltr', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
               <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-2 font-medium text-slate-700 text-xs">
                     <Building2 size={14} className="text-emerald-500" /> Building {selectedBuildingData.id.slice(0, 10)}
                  </div>
                  <button className="w-5 h-5 flex items-center justify-center hover:bg-red-100 hover:text-red-500 rounded text-slate-400 font-bold ml-1 text-sm bg-transparent border-0 cursor-pointer" onClick={() => setSelectedBuildingId(null)}>×</button>
               </div>
               <div className="p-5 flex flex-col gap-5 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="flex flex-col gap-2">
                     <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">HEIGHT OVERRIDE (m)</span>
                     <div className="flex gap-2 items-center">
                       <input 
                         type="range" min="3" max="300" step="1" 
                         value={currentEdits.height !== undefined ? currentEdits.height : selectedBuildingData.h} 
                         onChange={e => setBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], height: parseFloat(e.target.value) } }))}
                         className="flex-1 accent-blue-500 cursor-ew-resize h-1"
                       />
                       <input 
                         type="number" min="3" max="300" step="1" 
                         value={currentEdits.height !== undefined ? currentEdits.height : selectedBuildingData.h} 
                         onChange={e => setBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], height: parseFloat(e.target.value) } }))}
                         className="text-xs bg-white p-1 rounded font-mono w-14 text-center text-slate-700 shadow-sm border border-slate-300 outline-none focus:border-blue-500"
                       />
                     </div>
                  </div>
                  {buildingColorMode === 'property' && (
                     <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">COLOR OVERRIDE</span>
                        <div className="flex gap-2 items-center">
                           <input 
                              type="color" 
                              value={currentEdits.color || "#ffffff"}
                              onChange={e => setBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], color: e.target.value } }))}
                              className="w-8 h-8 rounded shrink-0 bg-transparent cursor-pointer border border-slate-300"
                           />
                           <input
                              type="text"
                              value={currentEdits.color || ""}
                              placeholder="Inherit"
                              onChange={e => setBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], color: e.target.value } }))}
                              className="bg-white shadow-sm border border-slate-200 px-2 py-1 flex-1 text-xs outline-none rounded font-mono"
                           />
                        </div>
                     </div>
                  )}
                  
                  {selectedBuildingData.tags && Object.keys(selectedBuildingData.tags).length > 0 && (
                    <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-slate-100">
                       <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">OSM Metadata</span>
                       <div className="flex flex-col gap-1.5">
                          {Object.entries({ ...selectedBuildingData.tags, ...(currentEdits.tags || {}) }).map(([k, v]) => (
                             <div key={k} className="flex justify-between items-center text-xs gap-2">
                                <span className="font-medium text-slate-400 capitalize w-1/3 truncate" title={k}>{k}</span>
                                <input 
                                   type="text"
                                   value={v}
                                   onChange={e => setBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], tags: { ...(prev[selectedBuildingId]?.tags || {}), [k]: e.target.value } } }))}
                                   className="bg-white shadow-sm border border-slate-200 px-2 py-1 flex-1 min-w-0 text-slate-700 outline-none rounded"
                                />
                             </div>
                          ))}
                       </div>
                    </div>
                  )}
               </div>
              </div>
            </div>
         )}
      </div>

      {activeTool === 'walkability' && (
         <div className="absolute top-20 left-6 z-10 pointer-events-none w-72 h-[450px]">
            <div className="pointer-events-auto bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg flex flex-col shrink-0 h-full" style={{ resize: 'both', overflow: 'hidden', minWidth: '250px', maxHeight: 'calc(100vh - 12rem)' }}>
               <WalkabilityInfrastructurePanel />
            </div>
         </div>
      )}

      <div className="absolute bottom-6 left-6 z-10 pointer-events-auto w-72">
         <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 bg-slate-50 font-medium text-slate-700 text-xs">
               <Sun size={14} className="text-amber-500" /> Environment Conditions
            </div>
            <div className="p-4 flex flex-col gap-6">
               <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                     <span>Time of Day</span>
                     <span className="text-amber-600 font-mono tracking-normal bg-amber-50 px-1.5 py-0.5 border border-amber-200 rounded">{`${Math.floor(timeOfDay).toString().padStart(2, '0')}:${Math.floor((timeOfDay % 1) * 60).toString().padStart(2, '0')}`}</span>
                  </div>
                  <input type="range" min="0" max="24" step="0.25" value={timeOfDay} onChange={(e) => setTimeOfDay(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-amber-500" />
               </div>
               <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                     <span>Weather</span>
                     <span className="text-blue-600 font-mono tracking-normal bg-blue-50 px-1.5 py-0.5 border border-blue-200 rounded">{weatherClear > 0.8 ? 'Clear' : weatherClear > 0.4 ? 'Overcast' : 'Stormy'}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.01" value={weatherClear} onChange={(e) => setWeatherClear(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-500" />
               </div>
            </div>
         </div>
      </div>

      <MapSelectorModal
        isOpen={isMapModalOpen}
        onClose={() => regionBounds && setMapModalOpen(false)}
        onRegionSelect={handleRegionSelect}
      />
    </div>
  );
}
