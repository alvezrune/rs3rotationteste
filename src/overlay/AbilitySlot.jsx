import React from 'react';

/**
 * AbilitySlot — Componente de slot de skill com variantes
 */
export default function AbilitySlot({ step, variant, getAbility, getStyleColor, iconCache, showName = true, showKeybind = false }) {
    if (!step) return null;

    const skills = step.skills || [];
    if (skills.length === 0) return null;

    const isGrouped = skills.length > 1;
    const primarySkill = skills[0];
    const ab = getAbility(primarySkill);
    if (!ab) return null;

    const color = getStyleColor(ab.style || 'util');
    const isPassive = ab.isPassive || step.passive;

    // Gerar iniciais para placeholder
    const getInitials = (name) => {
        if (!name) return '?';
        const words = name.split(' ').filter(Boolean);
        return words.length === 1
            ? words[0].substring(0, 3).toUpperCase()
            : words.map(w => w[0]).join('').substring(0, 3).toUpperCase();
    };

    // Formatar keybind para display
    const formatKey = (ability) => {
        if (!ability) return null;
        if (isPassive) return { base: 'AUTO', mod: null };
        if (ability.keybind) {
            const parts = ability.keybind.split('+');
            if (parts.length === 1) return { base: parts[0].toUpperCase(), mod: null };
            return { base: parts[parts.length - 1].toUpperCase(), mod: parts[0] };
        }
        if (!ability.key?.base) return null;
        const mods = ability.key.modifiers || [];
        const base = ability.key.base.toUpperCase();
        if (mods.length === 0) return { base, mod: null };
        return { base, mod: mods[0] };
    };

    const KeybindBadge = ({ ability, compact = false }) => {
        const parts = formatKey(ability);
        if (!parts) return null;
        const isAuto = parts.base === 'AUTO';

        return (
            <div className={`kb-badge ${parts.mod ? 'has-mod' : 'single'} ${isAuto ? 'is-auto' : ''} ${compact ? 'is-compact' : ''}`}>
                {parts.mod && <span className="kb-mod">{parts.mod}</span>}
                <span className="kb-base">{parts.base}</span>
            </div>
        );
    };

    // Renderizar ícone
    const IconContent = ({ ability, size }) => {
        if (!ability) return null;
        const iconUrl = iconCache?.[ability.id];
        if (iconUrl) {
            return (
                <img
                    src={iconUrl}
                    alt={ability.name || ''}
                    className="slot-icon-img"
                    style={{
                        width: size,
                        height: size,
                        filter: variant === 'current' ? `drop-shadow(0 0 8px ${color}b3)` : 'none'
                    }}
                    onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
                />
            );
        }
        return null;
    };

    const Placeholder = ({ ability, size }) => {
        if (!ability) return null;
        return (
            <div
                className="slot-icon-placeholder"
                style={{
                    width: size, height: size,
                    background: `color-mix(in srgb, ${color} 20%, transparent)`,
                    display: iconCache?.[ability.id] ? 'none' : 'flex',
                }}
            >
                <span style={{ color }}>{getInitials(ability.name)}</span>
            </div>
        );
    };

    // ======= VARIANT: done =======
    if (variant === 'done') return null;

    // ======= VARIANT: current =======
    if (variant === 'current') {
        return (
            <div className={`ability-slot slot-current style-${ab.style || 'util'} ${isPassive ? 'slot-passive' : ''} ${isGrouped ? 'is-grouped-slot' : ''}`}>
                <div className={`slot-icon-wrap slot-icon-current ${isGrouped ? 'is-grouped' : ''}`}>
                    {isGrouped ? (
                        <div className="grouped-content-current">
                            <div className="grouped-lightning-top">⚡</div>
                            {skills.map((skill, i) => {
                                const sAb = getAbility(skill);
                                if (!sAb) return null;
                                return (
                                    <React.Fragment key={(skill.id || i) + '-' + i}>
                                        <div className="grouped-row-current">
                                            <div className="mini-icon-wrap-current">
                                                <IconContent ability={sAb} size={34} />
                                                <Placeholder ability={sAb} size={34} />
                                            </div>
                                            {showKeybind && <KeybindBadge ability={sAb} />}
                                        </div>
                                        {i < skills.length - 1 && <div className="grouped-divider" />}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    ) : (
                        <>
                            <IconContent ability={ab} size={48} />
                            <Placeholder ability={ab} size={48} />
                        </>
                    )}
                </div>
                {showName && !isGrouped && (
                    <div className="slot-name">
                        {ab.name || '?'}
                        {isPassive && <span className="passive-label">passivo</span>}
                    </div>
                )}
                {showKeybind && !isGrouped && <KeybindBadge ability={ab} />}
            </div>
        );
    }

    // ======= VARIANTS: next1 - next6 =======
    const sizeMap = {
        next1: { icon: 26 },
        next2: { icon: 20 },
        next3: { icon: 16 },
        next4: { icon: 14 },
        next5: { icon: 12 },
        next6: { icon: 10 }
    };
    const sizes = sizeMap[variant] || sizeMap.next6;

    return (
        <div className={`ability-slot slot-next slot-${variant}`}>
            <div
                className={`slot-icon-wrap ${isGrouped ? 'is-grouped' : ''}`}
                style={{ width: isGrouped ? 'auto' : sizes.icon, minWidth: sizes.icon, height: isGrouped ? 'auto' : sizes.icon }}
            >
                {isGrouped ? (
                    <div className="grouped-icons next-grouped">
                        {skills.map((skill, i) => {
                            const sAb = getAbility(skill);
                            if (!sAb) return null;
                            return (
                                <div className="grouped-inner-row" key={(skill.id || i) + '-' + i}>
                                    <div className="mini-icon-wrap">
                                        <IconContent ability={sAb} size={sizes.icon} />
                                        <Placeholder ability={sAb} size={sizes.icon} />
                                    </div>
                                    {showKeybind && <KeybindBadge ability={sAb} compact={true} />}
                                </div>
                            );
                        })}
                        <div className="grouped-tick-badge">⚡</div>
                    </div>
                ) : (
                    <>
                        <IconContent ability={ab} size={sizes.icon} />
                        <Placeholder ability={ab} size={sizes.icon} />
                    </>
                )}
            </div>
            {!isGrouped && showKeybind && <KeybindBadge ability={ab} compact={true} />}
        </div>
    );
}
