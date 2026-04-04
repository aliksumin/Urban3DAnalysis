import React from 'react';

export const Panel = ({ children, className = '' }) => (
    <div className={`bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${className}`}>
        {children}
    </div>
);

export const PanelHeader = ({ title, icon, action, className = '' }) => (
    <div className={`px-5 py-4 border-b border-zinc-800/60 bg-zinc-900/40 flex items-center justify-between shrink-0 ${className}`}>
        <div className="flex items-center gap-3 text-zinc-100 font-medium text-[13px]">
            {icon && <span className="text-zinc-500 flex shrink-0">{icon}</span>}
            {title}
        </div>
        {action && <div className="flex items-center">{action}</div>}
    </div>
);

export const PanelSection = ({ children, title, className = '', noPadding = false }) => (
    <div className={`border-b border-zinc-800/40 shrink-0 last:border-0 ${noPadding ? '' : 'px-5 py-4'} ${className}`}>
        {title && <div className={`text-[10px] font-semibold text-zinc-500 tracking-[0.15em] uppercase ${noPadding ? 'mb-3' : 'mb-4'}`}>{title}</div>}
        {children}
    </div>
);

export const PanelFooter = ({ children, className = '' }) => (
    <div className={`px-5 py-4 border-t border-zinc-800/60 bg-zinc-900/20 mt-auto shrink-0 ${className}`}>
        {children}
    </div>
);

export const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
    const base = "inline-flex items-center justify-center gap-2 font-medium transition-all outline-none rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap";
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.25)] border border-blue-500/50",
        secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700",
        ghost: "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100",
        active: "bg-zinc-800 text-white border border-zinc-700 shadow-md"
    };
    const sizes = { sm: "px-3 py-1.5 text-[11px]", md: "px-4 py-2.5 text-xs", lg: "px-6 py-3 text-sm", icon: "p-2" };

    return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
};

export const Switch = ({ checked, onChange, label, description }) => (
    <label className="flex items-center gap-3 cursor-pointer group w-full">
        <div className="relative shrink-0">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
            <div className="w-[38px] h-5 bg-zinc-800 border border-zinc-700 rounded-full peer-checked:bg-blue-600 peer-checked:border-blue-500 transition-colors"></div>
            <div className={`absolute left-[3px] top-[3px] w-3.5 h-3.5 bg-zinc-400 peer-checked:bg-white rounded-full transition-transform ${checked ? 'translate-x-[18px] shadow-sm' : ''}`}></div>
        </div>
        <div className="flex flex-col">
            <span className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">{label}</span>
            {description && <span className="text-[10px] text-zinc-500 mt-0.5">{description}</span>}
        </div>
    </label>
);

export const Input = ({ label, className = '', ...props }) => (
    <div className="flex flex-col gap-2 w-full">
        {label && <label className="text-[10px] font-semibold tracking-[0.1em] text-zinc-500 uppercase">{label}</label>}
        <input className={`bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 font-mono placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all ${className}`} {...props} />
    </div>
);

export const Slider = ({ value, min = 0, max = 100, onChange, label, suffix = '', step = 1 }) => (
    <div className="flex flex-col gap-3 w-full">
        <div className="flex justify-between items-end">
            <span className="text-[10px] font-semibold text-zinc-500 tracking-[0.1em] uppercase">{label}</span>
            <span className="text-xs font-mono text-blue-400 bg-blue-950/30 px-2 py-0.5 rounded border border-blue-900/30 shrink-0">{value}{suffix}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
    </div>
);

export const Metric = ({ label, value, highlight = false }) => (
    <div className="flex justify-between items-center py-1.5">
        <span className="text-zinc-500 text-[11px] font-medium">{label}</span>
        <span className={`font-mono text-xs text-right whitespace-nowrap overflow-hidden text-ellipsis ml-2 ${highlight ? 'text-blue-400' : 'text-zinc-300'}`}>{value}</span>
    </div>
);
