import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Search, Maximize } from 'lucide-react';
import { Panel, PanelHeader, Switch, Button } from '../ui';

function MapController({ setBounds, boxW, boxH }) {
    const map = useMap();
    const updateBounds = useCallback(() => {
        const c = map.getContainer().getBoundingClientRect();
        const pW = c.width * (boxW / 100);
        const pH = c.height * (boxH / 100);
        const topL = map.containerPointToLatLng([(c.width - pW) / 2, (c.height - pH) / 2]);
        const botR = map.containerPointToLatLng([(c.width + pW) / 2, (c.height + pH) / 2]);
        setBounds([topL.lng, botR.lat, botR.lng, topL.lat]);
    }, [map, setBounds, boxW, boxH]);

    useMapEvents({ move: updateBounds, moveend: updateBounds, zoomend: updateBounds });

    useEffect(() => {
        window.leafletMap = map;
        setTimeout(() => map.invalidateSize(), 300);
        updateBounds();
    }, [map, boxW, boxH, updateBounds]);

    return null;
}

function ResizableFrame({ boxW, boxH, setBoxW, setBoxH }) {
    const [dragState, setDragState] = useState(null);
    const containerRef = useRef();

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!dragState || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const deltaX = Math.abs(e.clientX - centerX);
            const deltaY = Math.abs(e.clientY - centerY);

            const newW = Math.max(10, Math.min(95, (deltaX * 2 / rect.width) * 100));
            const newH = Math.max(10, Math.min(95, (deltaY * 2 / rect.height) * 100));

            if (dragState.includes('e') || dragState.includes('w')) setBoxW(newW);
            if (dragState.includes('n') || dragState.includes('s')) setBoxH(newH);
        };
        const handleMouseUp = () => setDragState(null);

        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, setBoxW, setBoxH]);

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none flex items-center justify-center z-[1000]">
            <div className="border border-solid border-blue-500 bg-blue-500/5 relative flex items-center justify-center shadow-[0_0_0_9999px_rgba(9,9,11,0.7)] box-content transition-transform" style={{ width: `${boxW}%`, height: `${boxH}%` }}>
                <Maximize className="text-blue-500/50" size={32} strokeWidth={1.5} />
                <div onMouseDown={(e) => { e.preventDefault(); setDragState('nw'); }} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-zinc-900 cursor-nwse-resize pointer-events-auto rounded-[2px] shadow-sm"></div>
                <div onMouseDown={(e) => { e.preventDefault(); setDragState('ne'); }} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-zinc-900 cursor-nesw-resize pointer-events-auto rounded-[2px] shadow-sm"></div>
                <div onMouseDown={(e) => { e.preventDefault(); setDragState('sw'); }} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-zinc-900 cursor-nesw-resize pointer-events-auto rounded-[2px] shadow-sm"></div>
                <div onMouseDown={(e) => { e.preventDefault(); setDragState('se'); }} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-zinc-900 cursor-nwse-resize pointer-events-auto rounded-[2px] shadow-sm"></div>
                <div onMouseDown={(e) => { e.preventDefault(); setDragState('n'); }} className="absolute -top-1.5 left-4 right-4 h-3 cursor-ns-resize pointer-events-auto"></div>
                <div onMouseDown={(e) => { e.preventDefault(); setDragState('s'); }} className="absolute -bottom-1.5 left-4 right-4 h-3 cursor-ns-resize pointer-events-auto"></div>
                <div onMouseDown={(e) => { e.preventDefault(); setDragState('w'); }} className="absolute -left-1.5 top-4 bottom-4 w-3 cursor-ew-resize pointer-events-auto"></div>
                <div onMouseDown={(e) => { e.preventDefault(); setDragState('e'); }} className="absolute -right-1.5 top-4 bottom-4 w-3 cursor-ew-resize pointer-events-auto"></div>
            </div>
        </div>
    );
}

export default function MapSelectorModal({ isOpen, onClose, onRegionSelect }) {
    const [bounds, setBounds] = useState(() => {
        const saved = localStorage.getItem('urban_bounds');
        return saved ? JSON.parse(saved) : [-74.01, 40.70, -74.00, 40.71];
    });
    const [reliefEnabled, setReliefEnabled] = useState(() => {
        const saved = localStorage.getItem('urban_relief');
        return saved ? JSON.parse(saved) : true;
    });
    const initialCenter = useMemo(() => [(bounds[1] + bounds[3]) / 2, (bounds[0] + bounds[2]) / 2], [bounds]);

    const [searchQuery, setSearchQuery] = useState('');
    const [boxW, setBoxW] = useState(40), [boxH, setBoxH] = useState(40);

    if (!isOpen) return null;

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (data?.[0] && window.leafletMap) window.leafletMap.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 14);
        } catch (err) { }
    };

    // Mobile note: every responsive tweak in this file is a small base value
    // plus an `md:` override carrying the original one, so anything 768px and
    // wider renders exactly as it did before. p-10 alone left a 375px phone
    // only 295px of modal to work with.
    return (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-200/50 backdrop-blur-md p-3 md:p-10">
            <Panel className="w-full max-w-[1200px] h-full max-h-[800px] shadow-2xl relative">

                <PanelHeader
                    title="Geographic Domain Extractor"
                    action={<Button variant="ghost" size="icon" onClick={onClose}><X size={16} /></Button>}
                />

                <div className="flex-1 relative bg-white overflow-hidden group">
                    <div className="absolute inset-0">
                        <MapContainer center={initialCenter} zoom={14} style={{ width: '100%', height: '100%', backgroundColor: '#f8fafc' }} zoomControl={false}>
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                            <MapController setBounds={setBounds} boxW={boxW} boxH={boxH} />
                        </MapContainer>
                    </div>

                    <ResizableFrame boxW={boxW} boxH={boxH} setBoxW={setBoxW} setBoxH={setBoxH} />

                    {/* The w-64 field plus its button needed ~300px, wider than
                        the map pane on a phone, so the search ran off the edge.
                        Span the pane instead and let the field flex. */}
                    <div className="absolute top-3 left-3 right-3 md:top-5 md:left-5 md:right-auto pointer-events-none z-[1000] drop-shadow-2xl">
                        <form onSubmit={handleSearch} className="flex gap-2 pointer-events-auto bg-white/90 backdrop-blur-md border border-slate-200 p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent border-none text-slate-800 px-3 py-1.5 text-xs w-full min-w-0 md:w-64 focus:outline-none placeholder-slate-400 font-mono" placeholder="Query region array..." />
                            <Button variant="secondary" size="icon" type="submit" className="rounded-xl"><Search size={14} /></Button>
                        </form>
                    </div>
                </div>

                {/* Side by side, the w-64 switch and the button needed ~406px
                    against the 293px a phone leaves, which cut "Extract Core
                    Geometry" off at the edge. Stack them below md. */}
                <div className="px-4 py-4 md:px-6 md:py-5 border-t border-slate-200/80 bg-slate-50/50 flex flex-col gap-3 items-stretch md:flex-row md:justify-between md:items-center">
                    <div className="w-full md:w-64">
                        <Switch checked={reliefEnabled} onChange={setReliefEnabled} label="3D Topography Rendering" />
                    </div>

                    <Button className="w-full md:w-auto" onClick={() => { onRegionSelect(bounds, reliefEnabled); onClose(); }}>
                        Extract Core Geometry
                    </Button>
                </div>
            </Panel>
        </div>
    );
}
