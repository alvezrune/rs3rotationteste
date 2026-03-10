import React, { useState, useEffect, useRef } from 'react';

/**
 * KeyRecorder — Componente para capturar combinações de tecla
 * @param {Object} props.value - { base: string, modifiers: string[] }
 * @param {Function} props.onChange - (keyObj) => void
 * @param {boolean} props.compact - modo compacto
 */
export default function KeyRecorder({ value, onChange, compact = false }) {
    const [listening, setListening] = useState(false);
    const listenerRef = useRef(null);

    const startListening = () => {
        setListening(true);
    };

    useEffect(() => {
        if (!listening) return;

        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // ESC cancela
            if (e.key === 'Escape') {
                setListening(false);
                return;
            }

            // Ignorar teclas modificadoras sozinhas
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

            const modifiers = [];
            if (e.ctrlKey) modifiers.push('Ctrl');
            if (e.shiftKey) modifiers.push('Shift');
            if (e.altKey) modifiers.push('Alt');

            const base = e.key.length === 1 ? e.key.toLowerCase() : e.key;

            onChange({ base, modifiers });
            setListening(false);
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [listening, onChange]);

    const clearKey = () => {
        onChange({ base: '', modifiers: [] });
    };

    const formatDisplay = () => {
        if (!value?.base) return null;
        const parts = [...(value.modifiers || []), value.base.toUpperCase()];
        return parts;
    };

    const display = formatDisplay();

    if (compact) {
        return (
            <div className="kr-compact">
                {display ? (
                    <span className="kr-badges">
                        {display.map((part, i) => (
                            <span key={i} className="kr-badge">{part}</span>
                        ))}
                    </span>
                ) : (
                    <span className="kr-empty">—</span>
                )}
                <button className="kr-btn" onClick={startListening} title="Capturar">🎹</button>
                {display && <button className="kr-btn kr-clear" onClick={clearKey} title="Limpar">✕</button>}
                {listening && <span className="kr-listening">Aguardando... (ESC cancela)</span>}
            </div>
        );
    }

    return (
        <div className={`key-recorder ${listening ? 'recording' : ''}`}>
            <div className="kr-display">
                {display ? (
                    <div className="kr-badges">
                        {display.map((part, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="kr-plus">+</span>}
                                <span className="kr-badge">{part}</span>
                            </React.Fragment>
                        ))}
                    </div>
                ) : (
                    <span className="kr-empty">— sem bind —</span>
                )}
            </div>
            <div className="kr-actions">
                <button className="btn-small btn-ghost" onClick={startListening}>
                    🎹 Capturar
                </button>
                {display && (
                    <button className="btn-small btn-ghost" onClick={clearKey}>✕</button>
                )}
            </div>
            {listening && (
                <div className="kr-overlay">
                    <span className="kr-listening-text">Aguardando tecla... (ESC cancela)</span>
                </div>
            )}
        </div>
    );
}
