import React, { useState, useEffect, useMemo } from 'react';
import KeyRecorder from '../../components/KeyRecorder';

const api = window.electronAPI;

export default function TabKeybinds({ abilities, rotations, saveAbilities }) {
    const [iconCache, setIconCache] = useState({});

    // Carregar ícones
    useEffect(() => {
        const loadIcons = async () => {
            const cache = {};
            for (const id of Object.keys(abilities)) {
                const url = await api.getIconPath(id);
                if (url) cache[id] = url;
            }
            setIconCache(cache);
        };
        loadIcons();
    }, [abilities]);

    // Filtrar apenas abilities com keybind mapeada
    const mappedAbilities = useMemo(() => {
        return Object.values(abilities)
            .filter(ab => ab.key?.base)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [abilities]);

    const updateKey = (id, key) => {
        const updated = { ...abilities, [id]: { ...abilities[id], key } };
        saveAbilities(updated);
    };

    const groupedByCategory = useMemo(() => {
        const groups = {};
        mappedAbilities.forEach(ab => {
            const cat = ab.category || 'Outras';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(ab);
        });
        return groups;
    }, [mappedAbilities]);

    const unmappedCount = Object.values(abilities).filter(ab => !ab.key?.base).length;

    return (
        <div className="tab-keybinds">
            <div className="kb-header">
                <h3>Visão Rápida de Keybinds</h3>
                <p className="kb-desc">
                    Mostrando {mappedAbilities.length} skills mapeadas.
                    {unmappedCount > 0 && <span className="kb-unmapped"> ({unmappedCount} sem bind)</span>}
                </p>
            </div>

            <div className="kb-list">
                {Object.entries(groupedByCategory).map(([cat, abs]) => (
                    <div key={cat} className="kb-group">
                        <div className="kb-group-title">{cat}</div>
                        {abs.map(ab => (
                            <div key={ab.id} className="kb-row">
                                {/* Ícone */}
                                <div className="kb-icon">
                                    {iconCache[ab.id] ? (
                                        <img src={iconCache[ab.id]} alt={ab.name} className="kb-icon-img" />
                                    ) : (
                                        <div className="kb-icon-placeholder" style={{ background: `var(--${ab.style}-dim)` }}>
                                            <span style={{ color: `var(--${ab.style})` }}>
                                                {ab.name?.substring(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {/* Nome */}
                                <span className="kb-name">{ab.name}</span>
                                {/* Keybind */}
                                <div className="kb-bind">
                                    <KeyRecorder
                                        value={ab.key}
                                        onChange={(key) => updateKey(ab.id, key)}
                                        compact
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
                {mappedAbilities.length === 0 && (
                    <div className="kb-empty">Nenhuma skill com keybind mapeada. Configure nas Abilities.</div>
                )}
            </div>
        </div>
    );
}
