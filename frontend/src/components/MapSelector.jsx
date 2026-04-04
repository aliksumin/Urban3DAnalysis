import React, { useState } from 'react';
import { Target } from 'lucide-react';

export default function MapSelector({ onRegionSelect }) {
    const [bbox, setBbox] = useState("-74.004,40.712,-73.996,40.718"); // Slightly tighter zoom for downtown NY

    const handleFetch = () => {
        const coords = bbox.split(',').map(Number);
        if (coords.length === 4) onRegionSelect(coords);
    };

    return (
        <div className="flex flex-col gap-4 text-[#c5c6c7] font-mono mt-2">
            <div className="text-[#00ccff] tracking-widest border-b border-[#00ccff]/30 pb-2 mb-2 font-bold flex items-center uppercase text-[11px] hud-text-glow">
                Region Control
            </div>
            <p className="text-[10px] text-gray-400 leading-4 mb-2">
                INPUT LONG LAT COORDINATES. SYSTEM WILL EXTRACT TOPOLOGICAL MASSES VIA OVERPASS RELAY.
            </p>

            <div className="flex flex-col gap-2">
                <label className="text-[10px] text-[#00ccff] tracking-widest uppercase font-bold">Extraction Vector (BBOX)</label>
                <input
                    type="text"
                    value={bbox}
                    onChange={(e) => setBbox(e.target.value)}
                    className="bg-black/50 border border-[#00ccff]/30 p-2 text-xs text-white focus:outline-none focus:border-[#00ccff] tracking-widest"
                />
            </div>

            <button
                onClick={handleFetch}
                className="mt-6 bg-[#00ccff]/10 border border-[#00ccff] text-[#00ccff] hover:bg-[#00ccff] hover:text-white transition-all py-2 text-[11px] font-bold flex items-center justify-center gap-2 tracking-[0.2em]"
            >
                <Target size={14} /> INTIALIZE EXTRACTION
            </button>
        </div>
    );
}
