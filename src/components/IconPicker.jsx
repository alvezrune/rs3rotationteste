import React, { useState, useEffect } from 'react';

const api = window.electronAPI;

/**
 * IconPicker — Componente para selecionar ícone de uma ability
 * @param {string} props.abilityId - ID da ability
 * @param {string} props.abilityName - Nome para placeholder
 * @param {string} props.style - Estilo (necro, melee, etc.)
 */
export default function IconPicker({ abilityId, abilityName, style, onChanged }) {
    const [iconUrl, setIconUrl] = useState(null);

    useEffect(() => {
        if (!abilityId) return;
        api.getIconPath(abilityId).then(url => setIconUrl(url));
    }, [abilityId]);

    const chooseIcon = async () => {
        const result = await api.chooseIcon(abilityId);
        if (result) {
            const url = await api.getIconPath(abilityId);
            setIconUrl(url);
            if (onChanged) onChanged();
        }
    };

    const removeIcon = async () => {
        await api.removeIcon(abilityId);
        setIconUrl(null);
        if (onChanged) onChanged();
    };

    const initials = abilityName
        ? abilityName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
        : '??';

    return (
        <div className="icon-picker">
            <div className="ip-preview">
                {iconUrl ? (
                    <img src={iconUrl} alt={abilityName} className="ip-img" />
                ) : (
                    <div
                        className="ip-placeholder"
                        style={{ background: `var(--${style || 'util'}-dim)` }}
                    >
                        <span style={{ color: `var(--${style || 'util'})` }}>{initials}</span>
                    </div>
                )}
            </div>
            <div className="ip-actions">
                <button className="btn-small btn-ghost" onClick={chooseIcon}>
                    📁 Escolher ícone
                </button>
                {iconUrl && (
                    <button className="btn-small btn-ghost" onClick={removeIcon} title="Remover">
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}
