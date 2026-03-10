import React from 'react';

/**
 * GCDBar — Barra de Global Cooldown
 * @param {number} progress - 0.0 a 1.0
 * @param {string} state - 'idle' | 'running' | 'complete' | 'error-gcd' | 'error-key'
 * @param {string} remaining - texto restante "1.2s"
 */
export default function GCDBar({ progress, state, remaining }) {
    let barClass = 'gcd-bar';
    let fillClass = 'gcd-fill';
    let fillStyle = {};

    switch (state) {
        case 'running':
            fillStyle = { width: `${progress * 100}%` };
            fillClass += ' gcd-fill-active';
            break;
        case 'complete':
            fillStyle = { width: '100%' };
            fillClass += ' gcd-fill-complete';
            break;
        case 'error-gcd':
            fillStyle = { width: `${progress * 100}%` };
            fillClass += ' gcd-fill-active';
            break;
        case 'error-key':
            fillStyle = { width: `${progress * 100}%` };
            fillClass += ' gcd-fill-active'; // Mantém visível sem piscar
            break;
        default: // idle
            fillStyle = { width: '0%' };
            break;
    }

    return (
        <div className={barClass}>
            <div className={fillClass} style={fillStyle} />
            {state === 'running' && remaining && (
                <span className="gcd-remaining">{remaining}</span>
            )}
        </div>
    );
}
