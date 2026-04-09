import React, { useState, useEffect, useRef } from 'react';
import Environment3D, { useStore, getDefaultFunctions } from './components/Environment3D';
import MapSelectorModal from './components/MapSelectorModal';
import { Navigation, Wind, Map as MapIcon, Layers, Settings, Save, FolderOpen, Building2, Droplet, PaintBucket, Tag, Sun, Plus, BrainCircuit, PenTool, Route, MapPin, Trash2 } from 'lucide-react';
import WalkabilityTool, { WalkabilityInfrastructurePanel } from './tools/WalkabilityTool';
import WindTool from './tools/WindTool';
import { ModelingHUD } from './tools/ModelingTool';
import { Panel, PanelHeader, PanelSection, Button, Metric, Input } from './ui';

export default function App() {
  const [regionBounds, setRegionBounds] = useState(null);
  const [reliefEnabled, setReliefEnabled] = useState(false);
  const [isMapModalOpen, setMapModalOpen] = useState(true);
  const [activeTool, setActiveTool] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [modulesMenuOpen, setModulesMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isRightPanelMinimized, setRightPanelMinimized] = useState(false);
  const [isWalkabilityMinimized, setWalkabilityMinimized] = useState(false);
  const [isEnvMinimized, setEnvMinimized] = useState(false);
  const fileInputRef = useRef(null);

  const { selectedBuildingId, buildingEdits, setBuildingEdits, allBuildings, buildingColorMode, setBuildingColorMode, loadSceneConfig, setSelectedBuildingId, solidColor, setSolidColor, masterFunctions, setMasterFunctions, aiModel, setAiModel, aiApiKey, setAiApiKey, osmStatus, showDiagnostics, setShowDiagnostics, timeOfDay, setTimeOfDay, weatherClear, setWeatherClear, aiProgressText, googlePlacesKey, setGooglePlacesKey, amapApiKey, setAmapApiKey, useGooglePlaces, setUseGooglePlaces, useOvertureMaps, setUseOvertureMaps, timelineRegime, setTimelineRegime, manualBuildingEdits, setManualBuildingEdits } = useStore();

  const selectedBuildingData = selectedBuildingId ? 
      (allBuildings.find(b => b.id === selectedBuildingId) || 
       (timelineRegime === 'after' ? useStore.getState().customBuildings.find(b => b.id === selectedBuildingId) : undefined) || 
       (timelineRegime === 'after' ? useStore.getState().customPOIs.find(b => b.id === selectedBuildingId) : undefined)) 
      : null;
      
  const currentEdits = selectedBuildingData ? 
      (timelineRegime === 'before' ? 
          (buildingEdits[selectedBuildingId] || {}) : 
          { ...(buildingEdits[selectedBuildingId] || {}), ...(manualBuildingEdits[selectedBuildingId] || {}) }) 
      : {};

  const displayedFunctions = currentEdits.functions || (() => {
      let defaults = getDefaultFunctions(selectedBuildingData, masterFunctions);
      if (!defaults || defaults.length === 0) return []; // Leave empty as fallback base if no defaults
      return defaults;
  })();

  useEffect(() => {
    if (selectedBuildingId) {
      setActiveRightTab('building');
    }
  }, [selectedBuildingId]);

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

  const getPanelSize = (key) => {
      try {
          return JSON.parse(localStorage.getItem(key) || "{}");
      } catch { return {}; }
  };

  const savePanelSize = (e, key) => {
      if (e.currentTarget.style.width && e.currentTarget.style.height) {
          localStorage.setItem(key, JSON.stringify({ width: e.currentTarget.style.width, height: e.currentTarget.style.height }));
      }
  };

  const handleSaveScene = async () => {
    const data = {
      buildingEdits: useStore.getState().buildingEdits,
      buildingColorMode: useStore.getState().buildingColorMode,
      solidColor: useStore.getState().solidColor,
      masterFunctions: useStore.getState().masterFunctions,
      aiModel: useStore.getState().aiModel,
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

      {aiProgressText && (
        <div className="absolute inset-x-0 top-40 pointer-events-none z-50 flex justify-center">
            <div className="bg-slate-900/95 backdrop-blur-md px-6 py-4 rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.2)] border border-purple-500/30">
                <div className="flex flex-col items-center gap-3">
                    <div className="flex gap-2">
                         <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                         <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                         <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <div className="font-mono text-xs text-purple-200 uppercase tracking-widest">{aiProgressText}</div>
                </div>
            </div>
        </div>
      )}

      {(fileMenuOpen || modulesMenuOpen || toolsMenuOpen) && <div className="fixed inset-0 z-10" onClick={() => { setFileMenuOpen(false); setModulesMenuOpen(false); setToolsMenuOpen(false); }} />}

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
                <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { setSettingsOpen(!isSettingsOpen); setActiveRightTab('settings'); setFileMenuOpen(false); }}><Settings size={14}/>Settings</button>
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
               <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { setActiveTool('walkability'); setActiveRightTab('analysis'); useStore.getState().setWalkabilityActive(true); useStore.getState().setWindSimActive(false); setModulesMenuOpen(false); setRightPanelMinimized(false); }}><Navigation size={14}/>Walkability Network</button>
               <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { setActiveTool('wind'); setActiveRightTab('analysis'); useStore.getState().setWalkabilityActive(false); useStore.getState().setWindSimActive(true); setModulesMenuOpen(false); setRightPanelMinimized(false); }}><Wind size={14}/>Wind Analysis</button>
             </div>
           )}
        </div>

        <div className="relative">
           <button className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => { setToolsMenuOpen(!toolsMenuOpen); setFileMenuOpen(false); setModulesMenuOpen(false); }}>
              Tools
           </button>
           {toolsMenuOpen && (
             <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg flex flex-col w-56 overflow-hidden z-30">
               <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { useStore.getState().setActiveModelingTool('building'); setToolsMenuOpen(false); useStore.getState().setTimelineRegime('after'); }}><Building2 size={14}/>Place Building</button>
               <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { useStore.getState().setActiveModelingTool('road'); setToolsMenuOpen(false); useStore.getState().setTimelineRegime('after'); }}><Route size={14}/>Draw Road</button>
               <button className="px-4 py-2.5 text-left hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-2" onClick={() => { useStore.getState().setActiveModelingTool('poi'); setToolsMenuOpen(false); useStore.getState().setTimelineRegime('after'); }}><MapPin size={14}/>Place Function Node</button>
             </div>
           )}
        </div>

        <div className="flex bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-sm overflow-hidden p-1 gap-1 ml-2">
            <button className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${timelineRegime === 'before' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`} onClick={() => setTimelineRegime('before')}>Before</button>
            <button className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${timelineRegime === 'after' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`} onClick={() => setTimelineRegime('after')}>After</button>
        </div>
      </div>

      <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleOpenScene} />

      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-4 pointer-events-none max-h-[calc(100vh-2rem)] pr-1">
         {(() => {
            const openTabs = [];
            if (isSettingsOpen) openTabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={14} className="text-blue-500" /> });
            if (activeTool && regionBounds) openTabs.push({ 
                id: 'analysis', 
                label: activeTool === 'walkability' ? 'Walkability Params' : 'Wind Analysis',
                icon: activeTool === 'walkability' ? <Navigation size={14} className="text-blue-500" /> : <Wind size={14} className="text-blue-500" />
            });
            if (selectedBuildingData) openTabs.push({ 
                id: 'building', 
                label: `Building ${selectedBuildingData.id.slice(0, 10)}`,
                icon: <Building2 size={14} className="text-emerald-500" /> 
            });

            if (openTabs.length === 0) return null;
            let currentTab = activeRightTab;
            if (!openTabs.find(t => t.id === currentTab)) currentTab = openTabs[0].id;

            return (
              <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg flex flex-col shrink-0" 
                   style={{ direction: 'rtl', overflow: 'hidden', minWidth: '320px', maxWidth: '800px', maxHeight: '90vh', ...getPanelSize('unified_panel'), resize: isRightPanelMinimized ? 'none' : 'both', minHeight: isRightPanelMinimized ? 'auto' : '300px', height: isRightPanelMinimized ? 'auto' : (getPanelSize('unified_panel').height || undefined) }} 
                   onMouseUp={(e) => savePanelSize(e, 'unified_panel')}>
                <div style={{ direction: 'ltr', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  
                  {/* Tab Navigation header */}
                  <div className="flex border-b border-slate-200 bg-slate-50 items-center shrink-0">
                      <div className="flex overflow-x-auto custom-scrollbar no-scrollbar flex-1 pt-1 pl-1 gap-1">
                          {openTabs.map(tab => (
                              <button key={tab.id} 
                                 onClick={() => { setActiveRightTab(tab.id); setRightPanelMinimized(false); }}
                                 className={`px-3 py-2.5 flex items-center gap-2 text-xs font-medium tracking-wide whitespace-nowrap rounded-t-md transition-colors ${currentTab === tab.id ? 'text-slate-800 bg-white border border-slate-200 border-b-0 -mb-[1px] z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]' : 'border border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                                 {tab.icon} {tab.label}
                              </button>
                          ))}
                      </div>
                      <div className="flex items-center gap-1 px-2 border-l border-slate-200 h-full shrink-0">
                         <button className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 rounded text-slate-400 font-bold bg-transparent border-0 cursor-pointer text-[10px]" onClick={() => setRightPanelMinimized(!isRightPanelMinimized)}>{isRightPanelMinimized ? '▼' : '▬'}</button>
                         <button className="w-6 h-6 flex items-center justify-center hover:bg-red-100 hover:text-red-500 rounded text-slate-400 font-bold bg-transparent border-0 cursor-pointer text-sm" onClick={() => {
                             if (currentTab === 'settings') setSettingsOpen(false);
                             if (currentTab === 'analysis') { setActiveTool(null); useStore.getState().setWalkabilityActive(false); useStore.getState().setWindSimActive(false); }
                             if (currentTab === 'building') setSelectedBuildingId(null);
                         }}>×</button>
                      </div>
                  </div>

                  {/* Settings Content Tab */}
                  {(currentTab === 'settings' && !isRightPanelMinimized) && (
                     <div className="p-5 flex flex-col gap-6 text-xs text-slate-600 flex-1 overflow-y-auto custom-scrollbar bg-white">
                        
                        <div className="flex flex-col gap-3 pb-4 border-b border-slate-100">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><BrainCircuit size={12}/> AI Analysis Configuration</span>
                           <div className="flex flex-col gap-2">
                               <label className="text-xs font-medium text-slate-700">Model Selection</label>
                               <select value={aiModel || 'Gemini 2.5 Flash'} onChange={e => setAiModel(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-blue-500 transition-colors cursor-pointer">
                                   <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (Fastest)</option>
                                   <option value="Gemini 2.5 Pro">Gemini 2.5 Pro (Standard)</option>
                                   <option value="Gemini 3.1 Pro">Gemini 3.1 Pro (High)</option>
                               </select>
                           </div>
                           <div className="flex flex-col gap-2">
                               <label className="text-xs font-medium text-slate-700">API Key</label>
                               <input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} placeholder="AIzaSy..." className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-blue-500 transition-colors font-mono text-[10px]" />
                           </div>
                        </div>

                        <div className="flex flex-col gap-3 pb-4 border-b border-slate-100">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Layers size={12}/> Data Augmentation Providers</span>
                           
                           <label className="flex items-center justify-between cursor-pointer mt-1 opacity-70">
                               <div className="flex flex-col">
                                   <span className="font-medium text-slate-700">Overture Maps Engine</span>
                                   <span className="text-[10px] text-slate-400 font-mono">ONNX/DuckDB Base</span>
                               </div>
                               <input type="checkbox" checked={useOvertureMaps} onChange={e => setUseOvertureMaps(e.target.checked)} className="accent-blue-500" disabled />
                           </label>

                           <div className="flex flex-col gap-2 mt-2">
                               <label className="flex items-center justify-between cursor-pointer">
                                   <span className="font-medium text-slate-700">Google Places Context API</span>
                                   <input type="checkbox" checked={useGooglePlaces} onChange={e => setUseGooglePlaces(e.target.checked)} className="accent-blue-500" />
                               </label>
                               {useGooglePlaces && (
                                   <input type="password" value={googlePlacesKey} onChange={e => setGooglePlacesKey(e.target.value)} placeholder="Google Maps Services Key" className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-blue-500 transition-colors font-mono text-[10px]" />
                               )}
                           </div>

                           <div className="flex flex-col gap-2 mt-2">
                               <div className="flex flex-col">
                                   <span className="font-medium text-slate-700">Amap (Gaode) Regional Overlay</span>
                                   <span className="text-[10px] text-slate-400 font-mono">Triggers automatically in China Bounding Boxes</span>
                               </div>
                               <input type="password" value={amapApiKey} onChange={e => setAmapApiKey(e.target.value)} placeholder="Amap Web Service Key" className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-blue-500 transition-colors font-mono text-[10px]" />
                           </div>
                        </div>

                        <div className="flex flex-col gap-2 pb-4 border-b border-slate-100">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Layers size={12}/> Global Color Overrides</span>
                           <label className="flex items-center gap-2 cursor-pointer mt-1">
                             <input type="radio" name="colorMode" checked={buildingColorMode === 'solid'} onChange={() => setBuildingColorMode('solid')} className="accent-blue-500" />
                             <span className="font-medium text-slate-700">Solid Color Extrusion</span>
                           </label>
                           {buildingColorMode === 'solid' && (
                             <div className="pl-6 flex items-center gap-2">
                               <input type="color" value={solidColor} onChange={e => setSolidColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
                               <span className="text-slate-500 font-mono text-[10px]">{solidColor}</span>
                             </div>
                           )}

                           <label className="flex items-center gap-2 cursor-pointer mt-1">
                             <input type="radio" name="colorMode" checked={buildingColorMode === 'property'} onChange={() => setBuildingColorMode('property')} className="accent-blue-500" />
                             <span className="font-medium text-slate-700">Per-Building Modifications</span>
                           </label>
                           
                           <label className="flex items-center gap-2 cursor-pointer mt-1">
                             <input type="radio" name="colorMode" checked={buildingColorMode === 'function'} onChange={() => setBuildingColorMode('function')} className="accent-blue-500" />
                             <span className="font-medium text-slate-700">Colorize by Function</span>
                           </label>
                        </div>

                        <div className="flex flex-col gap-2 pb-4 border-b border-slate-100">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><MapPin size={12}/> Function Icon Rendering</span>
                           <label className="flex items-center gap-2 cursor-pointer mt-1">
                             <input type="radio" name="iconMode" checked={useStore.getState().iconDisplayMode === 'none'} onChange={() => useStore.getState().setIconDisplayMode('none')} className="accent-blue-500" />
                             <span className="font-medium text-slate-700">Hide Icons</span>
                           </label>
                           <label className="flex items-center gap-2 cursor-pointer mt-1">
                             <input type="radio" name="iconMode" checked={useStore.getState().iconDisplayMode === 'connected'} onChange={() => useStore.getState().setIconDisplayMode('connected')} className="accent-blue-500" />
                             <span className="font-medium text-slate-700">Show Connected by Arcs Only</span>
                           </label>
                           <label className="flex items-center gap-2 cursor-pointer mt-1">
                             <input type="radio" name="iconMode" checked={useStore.getState().iconDisplayMode === 'all'} onChange={() => useStore.getState().setIconDisplayMode('all')} className="accent-blue-500" />
                             <span className="font-medium text-slate-700">Show for All Buildings</span>
                           </label>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                           <div className="flex justify-between items-center">
                               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Tag size={12}/> Master 15-Min Functions</span>
                               <button onClick={() => setMasterFunctions([{ id: 'func_'+Date.now(), name: 'New Function', color: '#ff00ff', defaultOpeningTime: '08:00-18:00', trackable: true }, ...masterFunctions])} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors">+ Add</button>
                           </div>
                           <div className="flex flex-col gap-1.5 mt-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                               {masterFunctions.map((mFn, i) => (
                                   <div key={mFn.id} className="flex flex-col gap-2 p-2 bg-slate-50 border border-slate-200 rounded">
                                       <div className="flex items-center gap-2">
                                           <input type="color" value={mFn.color} onChange={e => { const nw = [...masterFunctions]; nw[i].color = e.target.value; setMasterFunctions(nw); }} className="w-5 h-5 shrink-0 rounded cursor-pointer bg-transparent border-0" />
                                           <input type="text" value={mFn.name} onChange={e => { const nw = [...masterFunctions]; nw[i].name = e.target.value; setMasterFunctions(nw); }} className="flex-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded outline-none font-medium text-slate-700" />
                                           <button className="text-red-400 hover:text-red-600 px-1" onClick={() => { const nw = [...masterFunctions]; nw.splice(i, 1); setMasterFunctions(nw); }}>×</button>
                                       </div>
                                       <div className="flex gap-2 items-center pl-7 text-[10px]">
                                            <input type="text" value={mFn.defaultOpeningTime} onChange={e => { const nw = [...masterFunctions]; nw[i].defaultOpeningTime = e.target.value; setMasterFunctions(nw); }} placeholder="00:00-24:00" className="w-20 bg-white border border-slate-200 px-1 py-0.5 rounded outline-none font-mono text-center" />
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input type="checkbox" checked={mFn.trackable} onChange={e => { const nw = [...masterFunctions]; nw[i].trackable = e.target.checked; setMasterFunctions(nw); }} className="accent-blue-500" />
                                                <span className="text-slate-500">Track Arc</span>
                                            </label>
                                       </div>
                                   </div>
                               ))}
                           </div>
                        </div>
                     </div>
                  )}

                  {/* Analysis Content Tab */}
                  {(currentTab === 'analysis' && !isRightPanelMinimized) && (
                     <div className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar bg-white">
                        {activeTool === 'walkability' ? <WalkabilityTool regionBounds={regionBounds} /> : <WindTool regionBounds={regionBounds} />}
                     </div>
                  )}

                  {/* Building Information Content Tab */}
                  {(currentTab === 'building' && !isRightPanelMinimized) && (
                     <div className="p-5 flex flex-col gap-5 flex-1 overflow-y-auto custom-scrollbar bg-white relative">
                        {timelineRegime === 'before' && (
                            <div className="absolute inset-0 z-10 bg-white/20 flex flex-col items-center justify-end pb-6 rounded-b-lg pointer-events-auto">
                                <div className="text-xs text-slate-700 font-bold bg-white/80 px-4 py-2 rounded-lg backdrop-blur-sm shadow-sm text-center border border-slate-200 max-w-[90%]">Switch to "After" timeline to edit object overrides manually.</div>
                            </div>
                        )}
                        <div className={`flex flex-col gap-5 ${timelineRegime === 'before' ? 'opacity-70 pointer-events-none select-none' : ''}`}>
                        {!selectedBuildingData.isPOI && (
                            <div className="flex flex-col gap-2">
                               <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">HEIGHT OVERRIDE (m)</span>
                               <div className="flex gap-2 items-center">
                                 <input 
                                   type="range" min="3" max="300" step="1" 
                                   value={currentEdits.height !== undefined ? currentEdits.height : (selectedBuildingData.h || selectedBuildingData.height || 10)} 
                                   onChange={e => setManualBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], height: parseFloat(e.target.value) } }))}
                                   className="flex-1 accent-blue-500 cursor-ew-resize h-1"
                                 />
                                 <input 
                                   type="number" min="3" max="300" step="1" 
                                   value={currentEdits.height !== undefined ? currentEdits.height : (selectedBuildingData.h || selectedBuildingData.height || 10)} 
                                   onChange={e => setManualBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], height: parseFloat(e.target.value) } }))}
                                   className="text-xs bg-white p-1 rounded font-mono w-14 text-center text-slate-700 shadow-sm border border-slate-300 outline-none focus:border-blue-500"
                                 />
                               </div>
                            </div>
                        )}
                        {!selectedBuildingData.isPOI && buildingColorMode === 'property' && (
                           <div className="flex flex-col gap-2">
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">COLOR OVERRIDE</span>
                              <div className="flex gap-2 items-center">
                                 <input 
                                    type="color" 
                                    value={currentEdits.color || "#ffffff"}
                                    onChange={e => setManualBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], color: e.target.value } }))}
                                    className="w-8 h-8 rounded shrink-0 bg-transparent cursor-pointer border border-slate-300"
                                 />
                                 <input
                                    type="text"
                                    value={currentEdits.color || ""}
                                    placeholder="Inherit"
                                    onChange={e => setManualBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], color: e.target.value } }))}
                                    className="bg-white shadow-sm border border-slate-200 px-2 py-1 flex-1 text-xs outline-none rounded font-mono"
                                 />
                              </div>
                           </div>
                        )}
                        
                        <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-slate-100">
                           <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Functions & Utilization</span>
                           <div className="flex flex-col gap-1.5">
                               {displayedFunctions.map((f, i) => (
                                   <div key={i} className="flex flex-col gap-1 bg-slate-50 p-2 rounded border border-slate-200">
                                       <div className="flex justify-between items-center text-xs gap-2">
                                           <select 
                                               value={f.name}
                                               onChange={e => {
                                                   const newF = [...displayedFunctions];
                                                   newF[i].name = e.target.value;
                                                   const mFn = masterFunctions.find(mf => mf.name === e.target.value);
                                                   if (mFn) newF[i].openTime = mFn.defaultOpeningTime;
                                                   setManualBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], functions: newF } }));
                                               }}
                                               className="bg-white shadow-sm border border-slate-200 px-2 py-1 flex-1 min-w-0 text-slate-700 outline-none rounded font-medium"
                                           >
                                             {[...masterFunctions].sort((a,b) => a.name.localeCompare(b.name)).map(mf => <option key={mf.id} value={mf.name}>{mf.name}</option>)}
                                             {!masterFunctions.find(mf => mf.name === f.name) && <option value={f.name}>{f.name}</option>}
                                           </select>
                                           <button className="text-red-400 hover:text-red-600 bg-white border border-slate-200 rounded w-6 h-6 flex items-center justify-center font-bold" onClick={() => {
                                                const newF = [...displayedFunctions].filter((_, idx) => idx !== i);
                                                setManualBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], functions: newF } }));
                                           }}>×</button>
                                       </div>
                                       <div className="flex items-center text-xs gap-2">
                                            <span className="text-[10px] text-slate-400 w-16 uppercase font-bold tracking-wider">Open Time</span>
                                            <input 
                                                type="text"
                                                value={f.openTime}
                                                placeholder="HH:mm-HH:mm or -"
                                                onChange={e => {
                                                   const newF = [...displayedFunctions];
                                                   newF[i].openTime = e.target.value;
                                                   setManualBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], functions: newF } }));
                                                }}
                                                className="bg-white shadow-sm border border-slate-200 px-2 py-1 flex-1 min-w-0 text-slate-700 outline-none rounded font-mono text-center tracking-widest text-[10px]"
                                            />
                                       </div>
                                   </div>
                               ))}
                               <button 
                                   onClick={() => {
                                        const newF = [...displayedFunctions, { name: 'Residential', openTime: '-' }];
                                        setManualBuildingEdits(prev => ({ ...prev, [selectedBuildingId]: { ...prev[selectedBuildingId], functions: newF } }));
                                   }}
                                   className="text-xs mt-1 bg-white border border-dashed border-slate-300 text-slate-500 py-2 rounded hover:bg-slate-50 hover:text-blue-500 hover:border-blue-300 transition-colors font-medium flex items-center justify-center gap-2"
                               >
                                 <Plus size={14}/> Add Function
                               </button>
                           </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
                            <button 
                                onClick={() => {
                                    useStore.getState().setDeletedBuildingIds([...useStore.getState().deletedBuildingIds, selectedBuildingId]);
                                    setSelectedBuildingId(null);
                                    setActiveRightTab(null);
                                }}
                                className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-md transition-colors text-xs font-bold w-full justify-center"
                            >
                                <Trash2 size={16}/> Delete Object
                            </button>
                        </div>
                        </div>
                     </div>
                  )}
                </div>
              </div>
            );
         })()}
      </div>

      {activeTool === 'walkability' && !isWalkabilityMinimized && (
         <div className="absolute top-20 left-6 z-10 pointer-events-none w-72">
            <div className="pointer-events-auto flex flex-col shrink-0" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
                <WalkabilityInfrastructurePanel />
            </div>
         </div>
      )}

      <div className="absolute bottom-6 left-6 z-10 pointer-events-auto w-72">
         <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
               <div className="flex items-center gap-2 font-medium text-slate-700 text-xs">
                  <Sun size={14} className="text-amber-500" /> Environment Conditions
               </div>
               <button className="w-5 h-5 flex items-center justify-center hover:bg-slate-200 rounded text-slate-400 font-bold bg-transparent border-0 cursor-pointer text-[10px]" onClick={() => setEnvMinimized(!isEnvMinimized)}>{isEnvMinimized ? '▼' : '▬'}</button>
            </div>
            {!isEnvMinimized && (
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
            )}
         </div>
      </div>
      <ModelingHUD />

      <MapSelectorModal
        isOpen={isMapModalOpen}
        onClose={() => regionBounds && setMapModalOpen(false)}
        onRegionSelect={handleRegionSelect}
      />
    </div>
  );
}
