import React, { useState, useEffect } from 'react';

const api = window.electronAPI;

export default function TabIcones({ abilities }) {
    const [iconStatus, setIconStatus] = useState({ withIcon: [], withoutIcon: [], total: 0, iconDir: '' });

    const loadStatus = async () => {
        const status = await api.getAllIconStatus();
        setIconStatus(status);
    };

    useEffect(() => { loadStatus(); }, []);

    const chooseIcon = async (abilityId) => {
        const result = await api.chooseIcon(abilityId);
        if (result) {
            await loadStatus(); // Refresh
        }
    };

    const removeIcon = async (abilityId) => {
        await api.removeIcon(abilityId);
        await loadStatus();
    };

    const getAbility = (id) => abilities[id] || { name: id, style: 'util' };

    return (
        <div className="tab-icones">
            {/* Seção 1 — Resumo */}
            <div className="icon-summary card">
                <div className="icon-summary-line">
                    📁 Pasta: <code>{iconStatus.iconDir}</code>
                </div>
                <div className="icon-summary-line">
                    ✓ <strong>{iconStatus.withIcon.length}</strong> skills com ícone
                    {' | '}
                    ○ <strong>{iconStatus.withoutIcon.length}</strong> skills sem ícone
                </div>
                <button className="btn-small btn-ghost" onClick={() => api.openIconsFolder()}>
                    📂 Abrir pasta
                </button>
            </div>

            {/* Seção 2 — Skills sem ícone */}
            <div className="icon-section">
                <h3 className="section-label">Skills sem ícone ({iconStatus.withoutIcon.length})</h3>
                <div className="icon-missing-list">
                    {iconStatus.withoutIcon.map(id => {
                        const ab = getAbility(id);
                        return (
                            <div key={id} className="icon-missing-row">
                                <div
                                    className="icon-placeholder-small"
                                    style={{ background: `var(--${ab.style}-dim)` }}
                                >
                                    <span style={{ color: `var(--${ab.style})` }}>
                                        {ab.name?.substring(0, 2).toUpperCase()}
                                    </span>
                                </div>
                                <span className="icon-missing-name">{ab.name}</span>
                                <button className="btn-small btn-ghost" onClick={() => chooseIcon(id)}>
                                    📁 Escolher
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Seção 3 — Skills com ícone */}
            <div className="icon-section">
                <h3 className="section-label">Skills com ícone ({iconStatus.withIcon.length})</h3>
                <div className="icon-grid">
                    {iconStatus.withIcon.map(id => {
                        const ab = getAbility(id);
                        return (
                            <IconCard
                                key={id}
                                abilityId={id}
                                abilityName={ab.name}
                                onReplace={() => chooseIcon(id)}
                                onRemove={() => removeIcon(id)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function IconCard({ abilityId, abilityName, onReplace, onRemove }) {
    const [iconUrl, setIconUrl] = useState(null);
    const [hover, setHover] = useState(false);

    useEffect(() => {
        api.getIconPath(abilityId).then(url => setIconUrl(url));
    }, [abilityId]);

    return (
        <div
            className="icon-card"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <div className="icon-card-img">
                {iconUrl ? (
                    <img src={iconUrl} alt={abilityName} />
                ) : (
                    <div className="icon-card-placeholder">?</div>
                )}
                {hover && (
                    <div className="icon-card-overlay">
                        <button onClick={onReplace} title="Trocar">🔄</button>
                        <button onClick={onRemove} title="Remover">🗑</button>
                    </div>
                )}
            </div>
            <span className="icon-card-name">{abilityName}</span>
        </div>
    );
}
