import React, { useState } from 'react';

const PHASE_COLORS = {
    0: 'var(--phase-pre)',
    1: 'var(--phase-p1)',
    2: 'var(--phase-p2)',
    3: 'var(--phase-p3)',
    4: 'var(--phase-p4)',
};

const PHASE_LABELS = ['PRÉ', 'P1', 'P2', 'P3', 'P4'];

/**
 * PhaseBadge — Badge de fase com dropdown
 */
export default function PhaseBadge({ phase, phaseIndex, totalPhases, onChange }) {
    const [open, setOpen] = useState(false);

    const color = PHASE_COLORS[phaseIndex] || PHASE_COLORS[0];
    const label = PHASE_LABELS[phaseIndex] || phase?.name || `F${phaseIndex + 1}`;

    return (
        <div className="phase-badge-container">
            <button
                className="phase-badge"
                style={{
                    background: `color-mix(in srgb, ${color} 15%, transparent)`,
                    borderColor: color,
                    color: color,
                }}
                onClick={() => setOpen(!open)}
            >
                {label} <span className="phase-arrow">▼</span>
            </button>

            {open && (
                <div className="phase-dropdown">
                    {Array.from({ length: totalPhases }, (_, i) => (
                        <button
                            key={i}
                            className={`phase-dropdown-item ${i === phaseIndex ? 'active' : ''}`}
                            style={{ color: PHASE_COLORS[i] || PHASE_COLORS[0] }}
                            onClick={() => { onChange(i); setOpen(false); }}
                        >
                            {PHASE_LABELS[i] || `Fase ${i + 1}`}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
