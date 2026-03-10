import React, { useState, useEffect, useMemo } from 'react';
import KeyRecorder from '../../components/KeyRecorder';
import IconPicker from '../../components/IconPicker';

const api = window.electronAPI;

const STYLE_TABS = [
    { id: 'Necromancy', label: '💀 Necro', color: 'var(--necro)' },
    { id: 'Melee', label: '⚔️ Melee', color: 'var(--melee)' },
    { id: 'Ranged', label: '🏹 Ranged', color: 'var(--ranged)' },
    { id: 'Magic', label: '🔮 Magic', color: 'var(--magic)' },
    { id: 'Defensivas', label: '🛡️ Defensives', color: 'var(--defensives, #64748b)' },
    { id: 'Utilitárias', label: '⭐ Util', color: 'var(--util)' },
];

// Normalize style/category string for comparison
function normalizeStyle(str) {
    if (!str) return '';
    const s = str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
        .trim();
    if (s === 'necromancy' || s === 'necro') return 'necro';
    if (s === 'utilitarias' || s === 'util' || s === 'utility') return 'util';
    if (s === 'defensivas' || s === 'defensives' || s === 'defence' || s === 'defense') return 'defensives';
    return s;
}

function matchesTab(ab, tabName) {
    const target = normalizeStyle(tabName);
    const cat = normalizeStyle(ab.category);
    const sty = normalizeStyle(ab.style);
    return cat === target || sty === target;
}

export default function TabAbilities({ abilities, saveAbilities }) {
    const [activeStyle, setActiveStyle] = useState('Necromancy');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [iconCache, setIconCache] = useState({});

    // Carregar todos os ícones
    useEffect(() => {
        const loadIcons = async () => {
            const cache = {};
            for (const id of Object.keys(abilities)) {
                const url = await api.getIconPath(id);
                cache[id] = url;
            }
            setIconCache(cache);
        };
        loadIcons();
    }, [abilities]);

    // Filtrar abilities por estilo e busca
    const filtered = useMemo(() => {
        return Object.values(abilities)
            .filter(ab => matchesTab(ab, activeStyle))
            .filter(ab => !search || (ab.name || '').toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
                if (a.category === 'auto' && b.category !== 'auto') return -1;
                if (a.category !== 'auto' && b.category === 'auto') return 1;
                return (a.name || '').localeCompare(b.name || '');
            });
    }, [abilities, activeStyle, search]);

    // Contadores
    const totalCount = Object.values(abilities).filter(ab => matchesTab(ab, activeStyle)).length;
    const configuredCount = Object.values(abilities).filter(ab => {
        return matchesTab(ab, activeStyle) && (ab.key?.base || ab.keybind);
    }).length;

    // Atualizar ability
    const updateAbility = (id, updates) => {
        const updated = { ...abilities, [id]: { ...abilities[id], ...updates } };
        saveAbilities(updated);
    };

    // Deletar ability
    const deleteAbility = (id) => {
        if (!confirm(`Deletar "${abilities[id]?.name}"?`)) return;
        const updated = { ...abilities };
        delete updated[id];
        saveAbilities(updated);
    };

    // Nova ability
    const createAbility = () => {
        const id = `custom_${Date.now()}`;
        const updated = {
            ...abilities,
            [id]: {
                id, name: 'Nova Habilidade', style: activeStyle === 'Utilitárias' ? 'util'
                    : activeStyle === 'Defensivas' ? 'defensives'
                        : activeStyle === 'Necromancy' ? 'necro' : activeStyle.toLowerCase(),
                category: activeStyle, defaultKey: '', isPassive: false, cooldown: 0,
                key: { base: '', modifiers: [] },
            },
        };
        saveAbilities(updated);
        setExpandedId(id);
    };

    // Recarregar ícone específico após mudança
    const refreshIcon = async (id) => {
        const url = await api.getIconPath(id);
        setIconCache(prev => ({ ...prev, [id]: url }));
    };

    return (
        <div className="tab-abilities">
            {/* Busca */}
            <div className="ab-search-bar">
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Buscar habilidade..."
                    className="search-input"
                />
            </div>

            {/* Sub-tabs de estilo */}
            <div className="style-tabs">
                {STYLE_TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`style-tab ${activeStyle === tab.id ? 'active' : ''}`}
                        style={activeStyle === tab.id ? { color: tab.color, borderBottomColor: tab.color } : {}}
                        onClick={() => setActiveStyle(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Contador */}
            <div className="ab-counter">
                {configuredCount} / {totalCount} configuradas
            </div>

            {/* Lista de abilities */}
            <div className="ab-list">
                {filtered.map(ab => (
                    <div key={ab.id}>
                        <div
                            className={`ab-row ${expandedId === ab.id ? 'expanded' : ''} ${!ab.key?.base ? 'no-bind' : ''}`}
                            onClick={() => setExpandedId(expandedId === ab.id ? null : ab.id)}
                        >
                            {/* ÍCONE REAL ou placeholder */}
                            <div className="ab-row-icon">
                                {iconCache[ab.id] ? (
                                    <img
                                        src={iconCache[ab.id]}
                                        alt={ab.name}
                                        className="ab-icon-img"
                                    />
                                ) : (
                                    <div
                                        className="ab-mini-icon"
                                        style={{ background: `var(--${ab.style}-dim)` }}
                                    >
                                        <span style={{ color: `var(--${ab.style})` }}>
                                            {ab.name?.substring(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <span className="ab-row-name">{ab.name}</span>
                            {(ab.isPassive || ab.category === 'auto' || ab.passive) && <span className="ab-passive-tag">AUTO</span>}
                            <span className="ab-row-bind">
                                {ab.category === 'auto' ? (
                                    <span className="auto-badge">AUTO</span>
                                ) : (ab.key?.base || ab.keybind) ? (
                                    <span className="key-badge">
                                        {ab.key?.modifiers?.length ? ab.key.modifiers.join('+') + '+' : ''}
                                        {(ab.key?.base || ab.keybind).toUpperCase()}
                                    </span>
                                ) : (
                                    <span className="no-bind-text">— sem bind —</span>
                                )}
                            </span>
                            <span className="ab-row-edit">✏</span>
                        </div>

                        {/* Painel expandido */}
                        {expandedId === ab.id && (
                            <div className="ab-edit-panel">
                                <div className="edit-field">
                                    <label>Nome de exibição</label>
                                    <input
                                        value={ab.name}
                                        onChange={e => updateAbility(ab.id, { name: e.target.value })}
                                    />
                                </div>

                                <div className="edit-field">
                                    <label>Keybind</label>
                                    <KeyRecorder
                                        value={ab.key}
                                        onChange={(key) => updateAbility(ab.id, { key })}
                                    />
                                </div>

                                <div className="edit-field">
                                    <label>Ícone</label>
                                    <IconPicker
                                        abilityId={ab.id}
                                        abilityName={ab.name}
                                        style={ab.style}
                                        onChanged={() => refreshIcon(ab.id)}
                                    />
                                </div>

                                <div className="edit-field">
                                    <label>Categoria</label>
                                    <select
                                        value={ab.category}
                                        onChange={e => updateAbility(ab.id, { category: e.target.value })}
                                    >
                                        <option value="Necromancy">Necromancy</option>
                                        <option value="Melee">Melee</option>
                                        <option value="Ranged">Ranged</option>
                                        <option value="Magic">Magic</option>
                                        <option value="Defensivas">Defensivas</option>
                                        <option value="Utilitárias">Utilitárias</option>
                                    </select>
                                </div>

                                <div className="edit-field edit-field-row">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={ab.isPassive || false}
                                            onChange={e => updateAbility(ab.id, { isPassive: e.target.checked })}
                                        />
                                        É passivo — Avança automaticamente após o GCD (1.8s)
                                    </label>
                                </div>

                                <div className="edit-field">
                                    <label>Cooldown em ticks</label>
                                    <input
                                        type="number"
                                        value={ab.cooldown || 0}
                                        onChange={e => updateAbility(ab.id, { cooldown: parseInt(e.target.value) || 0 })}
                                        min="0"
                                    />
                                    <span className="field-hint">1 tick = 0.6s</span>
                                </div>

                                <div className="edit-buttons">
                                    <button className="btn-small btn-gold" onClick={() => setExpandedId(null)}>
                                        ✓ Fechar
                                    </button>
                                    <button className="btn-small btn-danger" onClick={() => deleteAbility(ab.id)}>
                                        🗑 Deletar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="ab-footer">
                <button className="btn-small btn-gold" onClick={createAbility}>
                    + Nova Habilidade
                </button>
            </div>
        </div>
    );
}
