import React from 'react';

export const Panel = ({ children, className = '' }) => (
    <div className={`bg-white/70 backdrop-blur-3xl border border-slate-200/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col overflow-hidden ${className}`}>
        {children}
    </div>
);

export const PanelHeader = ({ title, icon, action, className = '' }) => (
    <div className={`px-5 py-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between shrink-0 ${className}`}>
        <div className="flex items-center gap-3 text-slate-800 font-medium text-[13px]">
            {icon && <span className="text-slate-500 flex shrink-0">{icon}</span>}
            {title}
        </div>
        {action && <div className="flex items-center">{action}</div>}
    </div>
);

export const PanelSection = ({ children, title, className = '', noPadding = false }) => (
    <div className={`border-b border-slate-200/60 shrink-0 last:border-0 ${noPadding ? '' : 'px-5 py-4'} ${className}`}>
        {title && <div className={`text-[10px] font-semibold text-slate-500 tracking-[0.15em] uppercase ${noPadding ? 'mb-3' : 'mb-4'}`}>{title}</div>}
        {children}
    </div>
);

export const PanelFooter = ({ children, className = '' }) => (
    <div className={`px-5 py-4 border-t border-slate-200/80 bg-slate-50/50 mt-auto shrink-0 ${className}`}>
        {children}
    </div>
);

export const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
    const base = "inline-flex items-center justify-center gap-2 font-medium transition-all outline-none rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap";
    const variants = {
        primary: "bg-gradient-to-tr from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-md border border-blue-500/50",
        secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm",
        ghost: "bg-transparent hover:bg-slate-100/80 text-slate-500 hover:text-slate-800",
        active: "bg-slate-800 text-white border border-slate-700 shadow-md shadow-slate-200"
    };
    const sizes = { sm: "px-3 py-1.5 text-[11px]", md: "px-4 py-2.5 text-xs", lg: "px-6 py-3 text-sm", icon: "p-2" };

    return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
};

export const Switch = ({ checked, onChange, label, description }) => (
    <label className="flex items-center gap-3 cursor-pointer group w-full">
        <div className="relative shrink-0">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
            <div className="w-[38px] h-5 bg-slate-200 border border-slate-300 rounded-full peer-checked:bg-blue-500 peer-checked:border-blue-400 transition-colors shadow-inner"></div>
            <div className={`absolute left-[3px] top-[3px] w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${checked ? 'translate-x-[18px]' : ''}`}></div>
        </div>
        <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>
            {description && <span className="text-[10px] text-slate-500 mt-0.5">{description}</span>}
        </div>
    </label>
);

export const Input = ({ label, className = '', ...props }) => (
    <div className="flex flex-col gap-2 w-full">
        {label && <label className="text-[10px] font-semibold tracking-[0.1em] text-slate-500 uppercase">{label}</label>}
        <input className={`bg-white shadow-sm border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all ${className}`} {...props} />
    </div>
);

export const Slider = ({ value, min = 0, max = 100, onChange, label, suffix = '', step = 1 }) => (
    <div className="flex flex-col gap-3 w-full">
        <div className="flex justify-between items-end">
            <span className="text-[10px] font-semibold text-slate-500 tracking-[0.1em] uppercase">{label}</span>
            <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 shrink-0 shadow-sm">{value}{suffix}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-500 shadow-inner" />
    </div>
);

export const Metric = ({ label, value, highlight = false }) => (
    <div className="flex justify-between items-center py-1.5">
        <span className="text-slate-500 text-[11px] font-medium">{label}</span>
        <span className={`font-mono text-xs text-right whitespace-nowrap overflow-hidden text-ellipsis ml-2 ${highlight ? 'text-blue-600 font-bold' : 'text-slate-700'}`}>{value}</span>
    </div>
);
