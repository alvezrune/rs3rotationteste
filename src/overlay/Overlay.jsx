import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import lodash from 'lodash';
import AbilitySlot from './AbilitySlot';
import GCDBar from './GCDBar';
import PhaseBadge from '../components/PhaseBadge';
import RotationEngine from '../engine/rotation-engine';
import GCDTimer from '../engine/gcd-timer';

const api = window.electronAPI;

// Mapa de estilos → cores
const STYLE_COLORS = {
    necro: 'var(--necro)', melee: 'var(--melee)',
    ranged: 'var(--ranged)', magic: 'var(--magic)', util: 'var(--util)',
};

export default function Overlay() {
    const [abilities, setAbilities] = useState({});
    const [rotations, setRotations] = useState([]);
    const [settings, setSettings] = useState(null);
    const [activeRotation, setActiveRotation] = useState(null);
    const [currentStep, setCurrentStep] = useState(null);
    const [nextSteps, setNextSteps] = useState([]);
    const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
    const [phase, setPhase] = useState(null);
    const [gcdProgress, setGcdProgress] = useState(0);
    const [gcdState, setGcdState] = useState('idle');
    const [gcdRemaining, setGcdRemaining] = useState('');
    const [isTracking, setIsTracking] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [dropdownSearch, setDropdownSearch] = useState('');
    const [errorMsg, setErrorMsg] = useState(null);
    const [completed, setCompleted] = useState(false);
    const [iconCache, setIconCache] = useState({});

    // Refs — initialized as null, created in useEffect
    const engineRef = useRef(null);
    const gcdRef = useRef(null);
    const preInputRef = useRef(null);
    const errorTimeoutRef = useRef(null);
    const passiveTimerRef = useRef(null);

    // Novas Refs de Ciclo de Vida do React
    const mouseDepthRef = useRef(0);
    const iconLoadingRef = useRef(new Set());
    const handleKeyPressRef = useRef(null);
    const updateViewRef = useRef(null);
    const checkAutoAdvanceRef = useRef(null);

    // Latest-value refs for use inside callbacks (avoids stale closures)
    const abilitiesRef = useRef(abilities);
    const settingsRef = useRef(settings);
    const completedRef = useRef(completed);

    // Keep refs in sync
    useEffect(() => { abilitiesRef.current = abilities; }, [abilities]);
    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { completedRef.current = completed; }, [completed]);

    // ========== INITIALIZE ENGINE & GCD ==========
    useEffect(() => {
        engineRef.current = new RotationEngine();
        gcdRef.current = new GCDTimer();

        // GCD timer callbacks
        const gcd = gcdRef.current;
        gcd.onTick(({ progress, remaining }) => {
            setGcdProgress(progress);
            setGcdRemaining(remaining + 's');
        });
        gcd.onComplete(() => {
            setGcdState('complete');
            setTimeout(() => {
                setGcdState(current => current === 'complete' ? 'idle' : current);
            }, 300);
            setGcdProgress(0);
            setGcdRemaining('');

            // Check for pre-input
            if (preInputRef.current) {
                const savedKey = preInputRef.current;
                preInputRef.current = null;
                handleKeyPressRef.current?.(savedKey);
            }
        });

        return () => {
            gcd.removeAllListeners();
            if (passiveTimerRef.current) clearTimeout(passiveTimerRef.current);
            if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
        };
    }, []);

    // ========== LOAD INITIAL DATA ==========
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [ab, rots, sets] = await Promise.all([
                    api.loadAbilities(), api.loadRotations(), api.loadSettings(),
                ]);
                if (cancelled) return;
                const safeAb = ab || {};
                const safeRots = rots || [];
                setAbilities(safeAb);
                setRotations(safeRots);
                setSettings(sets);

                // Restore last rotation
                if (sets?.lastRotation && safeRots.length) {
                    const last = safeRots.find(r => r.id === sets.lastRotation);
                    if (last) {
                        selectRotationInternal(last, safeAb, sets);
                    }
                }
            } catch (err) {
                console.error('[Overlay] Failed to load initial data:', err);
            }
        };
        load();

        // Inicializa com mouse invisível (clicks passam reto pelo overlay)
        if (api && api.setIgnoreMouseEvents) {
            api.setIgnoreMouseEvents(true);
        }

        return () => { cancelled = true; };
    }, []);

    // ========== IPC LISTENERS ==========
    useEffect(() => {
        const cleanups = [
            api.onSettingsChanged((data) => setSettings(data)),
            api.onAbilitiesChanged((data) => {
                setAbilities(data);
                setIconCache({}); // Invalidate icon cache
            }),
            api.onRotationsChanged((data) => setRotations(data)),
        ];
        return () => cleanups.forEach(fn => fn && fn());
    }, []);

    // ========== KEY PRESS LISTENER ==========
    useEffect(() => {
        const cleanup = api.onKeyPressed(({ key }) => {
            if (completedRef.current) return;
            handleKeyPressRef.current?.(key);
        });
        return cleanup;
    }, []);

    // ========== ICON RESOLVER ==========
    const resolveIcon = useCallback((abilityId) => {
        if (!abilityId) return;

        // 1. Check if we need to fetch, avoiding setState if it's already there
        let needsFetch = false;
        setIconCache(prev => {
            if (prev[abilityId] !== undefined) return prev; // já em cache
            if (iconLoadingRef.current.has(abilityId)) return prev; // sendo carregado agora

            needsFetch = true;
            iconLoadingRef.current.add(abilityId);
            return { ...prev, [abilityId]: null }; // Seta como nulo no react dom (mostrando bolinha de loading)
        });

        // 2. ONLY do the fetch if the sync evaluation says we should. (Side Effects fora do State Updater!)
        if (needsFetch) {
            api.getIconPath(abilityId).then(url => {
                iconLoadingRef.current.delete(abilityId);
                setIconCache(c => {
                    if (c[abilityId] === url) return c; // Evita loop caso não mude
                    return { ...c, [abilityId]: url };
                });
            }).catch(() => {
                iconLoadingRef.current.delete(abilityId);
            });
        }
    }, []);

    const preloadIcons = useCallback((steps) => {
        if (!steps) return;
        const allSkills = steps.flatMap(s => s?.skills || []);

        // 1. Identify which ones need fetching entirely synchronously 
        const fetchIds = [];

        setIconCache(prev => {
            const newIds = allSkills.map(s => s.id).filter(id => id && prev[id] === undefined && !iconLoadingRef.current.has(id));
            if (newIds.length === 0) return prev;

            const next = { ...prev };
            newIds.forEach(id => {
                next[id] = null; // Seta slot null pro componente vazio sumonar o Placeholder
                iconLoadingRef.current.add(id);
                fetchIds.push(id);
            });
            return next; // Roda setState apenas 1 vez (não em O(n) looping)
        });

        // 2. Perform IO fetches Outside setState purely based on the batch collected
        fetchIds.forEach(id => {
            api.getIconPath(id).then(url => {
                iconLoadingRef.current.delete(id);
                setIconCache(c => c[id] === url ? c : { ...c, [id]: url });
            }).catch(() => {
                iconLoadingRef.current.delete(id);
            });
        });
    }, []);

    // ========== LÓGICA DO MOUSE (Hover Depth Fix) ==========
    const handleMouseEnter = useCallback(() => {
        mouseDepthRef.current += 1;
        if (mouseDepthRef.current === 1) {
            api?.setIgnoreMouseEvents?.(false);
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        mouseDepthRef.current = Math.max(0, mouseDepthRef.current - 1);
        if (mouseDepthRef.current === 0) {
            api?.setIgnoreMouseEvents?.(true);
        }
    }, []);

    // ========== INTERNAL FUNCTIONS (use refs, no stale closures) ==========

    function updateViewFromEngine() {
        const engine = engineRef.current;
        if (!engine) return;

        const nextCount = settingsRef.current?.overlay?.nextSlotsCount || 4;
        const step = engine.getCurrentStep();
        const next = engine.getNextSteps(nextCount);
        const prog = engine.getProgress();
        const ph = engine.getCurrentPhase();

        setCurrentStep(step);
        setNextSteps(next);
        setProgress(prog);
        setPhase(ph);

        // Preload icons
        const allSteps = [step, ...next].filter(Boolean);
        preloadIcons(allSteps);

        // Check auto-advance for passive skills
        checkAutoAdvanceRef.current?.(engine);
    }
    updateViewRef.current = updateViewFromEngine;

    function checkAutoAdvance(engine) {
        if (passiveTimerRef.current) {
            clearTimeout(passiveTimerRef.current);
            passiveTimerRef.current = null;
        }

        const step = engine.getCurrentStep();
        if (!step) return;

        const skills = step.skills || [];
        const abs = abilitiesRef.current;
        const allPassive = skills.every(s => {
            const ab = abs[s.id];
            return ab?.isPassive;
        });

        if (allPassive || step.passive) {
            const gcd = gcdRef.current;
            if (gcd) {
                gcd.reset();
                gcd.start();
                setGcdState('running');
            }
            passiveTimerRef.current = setTimeout(() => {
                engine.advance();
                updateViewRef.current?.();
            }, 1800);
        }
    }
    checkAutoAdvanceRef.current = checkAutoAdvance;

    function selectRotationInternal(rotation, abilitiesMap, settingsObj) {
        const engine = engineRef.current;
        if (!engine) return;

        engine.removeAllListeners();
        engine.load(rotation);

        setActiveRotation(rotation);
        setCompleted(false);
        completedRef.current = false;
        setShowDropdown(false);
        setDropdownSearch('');

        // Engine callbacks com Ref (Mata Stale Closures totalmente)
        engine.onAdvance(() => updateViewRef.current?.());
        engine.onPhaseComplete(() => { });
        engine.onRotationComplete(() => {
            setCompleted(true);
            completedRef.current = true;
            setIsTracking(false);
            api.unregisterAllKeys();
        });

        updateViewFromEngine();
        registerKeysInternal(engine, abilitiesMap || abilitiesRef.current);
        setIsTracking(true);

        // Save as last rotation
        const s = { ...(settingsObj || settingsRef.current || {}), lastRotation: rotation.id };
        api.saveSettings(s);
    }

    function registerKeysInternal(engine, abilitiesMap) {
        const keyMap = {};
        const phases = engine.phases || [];
        for (const phase of phases) {
            for (const step of (phase.steps || [])) {
                for (const skill of (step.skills || [])) {
                    const ab = abilitiesMap[skill.id];
                    if (ab?.key?.base) {
                        keyMap[skill.id] = ab.key;
                    }
                }
            }
        }
        api.registerRotationKeys(keyMap);
    }

    const handleKeyPressInternal = useCallback(lodash.throttle((key) => {
        try {
            const engine = engineRef.current;
            const gcd = gcdRef.current;
            if (!engine || !gcd) return;

            const step = engine.getCurrentStep();
            if (!step) return;

            // Check if GCD is ready
            if (!gcd.isReady()) {
                preInputRef.current = key;
                return;
            }

            // Check if key matches expected
            const expectedSkills = step.skills || [];
            const abs = abilitiesRef.current;
            let matched = false;

            for (const skill of expectedSkills) {
                const ab = abs[skill.id];
                if (!ab?.key?.base) continue;
                const mods = (ab.key.modifiers || []).map(m => m.toLowerCase());
                const parts = [];
                if (mods.includes('ctrl') || mods.includes('control')) parts.push('ctrl');
                if (mods.includes('shift')) parts.push('shift');
                if (mods.includes('alt')) parts.push('alt');
                if (mods.includes('meta')) parts.push('meta');
                parts.push(ab.key.base.toLowerCase());
                if (parts.join('+') === key) {
                    matched = true;
                    break;
                }
            }

            if (matched) {
                // Clear passive timer
                if (passiveTimerRef.current) {
                    clearTimeout(passiveTimerRef.current);
                    passiveTimerRef.current = null;
                }
                // Correct key — advance
                gcd.reset();
                gcd.start();
                setGcdState('running');
                engine.advance();
                updateViewRef.current?.();
            } else {
                // Wrong key
                const s = settingsRef.current;
                const flashEnabled = s?.overlay?.flashOnError === true;
                if (flashEnabled) {
                    setGcdState('error-key');
                }

                const correctSkill = expectedSkills[0];
                const ab = abs[correctSkill?.id];
                const correctKey = ab?.key?.base ? formatKeyDisplay(ab.key) : '?';
                setErrorMsg(`✗ ${key.toUpperCase()} — Aperte ${correctKey}`);

                if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
                errorTimeoutRef.current = setTimeout(() => {
                    setErrorMsg(null);
                    if (flashEnabled) {
                        setGcdState(gcdRef.current?.isReady() ? 'idle' : 'running');
                    }
                }, 1000); // reduced timeout 
            }
        } catch (err) {
            console.error('[React] Error in key handler:', err);
        }
    }, 150, { trailing: false }), []); // throttle key presses heavily to avoid flicker/crash loops

    useEffect(() => {
        handleKeyPressRef.current = handleKeyPressInternal;
    }, [handleKeyPressInternal]);

    // ========== WRAPPER FUNCTIONS (for JSX event handlers) ==========

    const selectRotation = useCallback((rotation) => {
        selectRotationInternal(rotation, abilitiesRef.current, settingsRef.current);
    }, []);

    const resetAll = useCallback(() => {
        const engine = engineRef.current;
        const gcd = gcdRef.current;
        if (!engine || !gcd) return;

        engine.resetAll();
        gcd.reset();
        if (passiveTimerRef.current) {
            clearTimeout(passiveTimerRef.current);
            passiveTimerRef.current = null;
        }
        setCompleted(false);
        completedRef.current = false;
        setGcdState('idle');
        setGcdProgress(0);
        setErrorMsg(null);
        updateViewFromEngine();
        registerKeysInternal(engine, abilitiesRef.current);
        setIsTracking(true);
    }, []);

    const changePhase = useCallback((phaseIndex) => {
        const engine = engineRef.current;
        const gcd = gcdRef.current;
        if (!engine || !gcd) return;

        engine.setPhaseByIndex(phaseIndex);
        gcd.reset();
        if (passiveTimerRef.current) {
            clearTimeout(passiveTimerRef.current);
            passiveTimerRef.current = null;
        }
        setGcdState('idle');
        setGcdProgress(0);
        updateViewRef.current?.();
    }, []);

    // Format key for display
    const formatKeyDisplay = (keyObj) => {
        if (!keyObj?.base) return '';
        const parts = [];
        const mods = keyObj.modifiers || [];
        if (mods.includes('Ctrl') || mods.includes('Control')) parts.push('Ctrl');
        if (mods.includes('Shift')) parts.push('Shift');
        if (mods.includes('Alt')) parts.push('Alt');
        parts.push(keyObj.base.toUpperCase());
        return parts.join('+');
    };

    // Get full ability from ref
    const getAbility = useCallback((skillRef) => {
        if (!skillRef) return null;
        return abilities[skillRef.id] || { id: skillRef.id, name: skillRef.name || skillRef.id, style: 'util' };
    }, [abilities]);

    const getStyleColor = (style) => STYLE_COLORS[style] || 'var(--util)';

    // Group rotations for dropdown
    const groupedRotations = useMemo(() => {
        const groups = {};
        const filtered = rotations.filter(r =>
            !dropdownSearch || r.name?.toLowerCase().includes(dropdownSearch.toLowerCase())
        );
        filtered.forEach(rot => {
            const group = rot.bossGroup || 'Outras';
            if (!groups[group]) groups[group] = [];
            groups[group].push(rot);
        });
        return groups;
    }, [rotations, dropdownSearch]);

    return (
        <div className="overlay-container">
            {/* TITLEBAR */}
            <div
                className="overlay-titlebar"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="titlebar-left">
                    <span className="titlebar-icon">⚔</span>
                    <span className="titlebar-brand">RS3 ROTATION</span>
                </div>

                <div className="titlebar-center" onClick={() => setShowDropdown(!showDropdown)}>
                    {activeRotation ? (
                        <span className="titlebar-rotation-name">
                            {activeRotation.name}
                            {activeRotation.style && (
                                <span className="titlebar-style-badge" style={{ color: getStyleColor(activeRotation.style) }}>
                                    {' — '}{activeRotation.style.charAt(0).toUpperCase() + activeRotation.style.slice(1)}
                                </span>
                            )}
                        </span>
                    ) : (
                        <span className="titlebar-placeholder">▼ Selecione uma rotação</span>
                    )}
                </div>

                <div className="titlebar-controls">
                    <button className="tb-btn" onClick={() => api.openSettings()} title="Configurações">⚙</button>
                    <button className="tb-btn" onClick={resetAll} title="Reset rotação">↺</button>
                    <button className="tb-btn" onClick={() => api.minimizeOverlay()} title="Minimizar">─</button>
                    <button className="tb-btn tb-btn-close" onClick={() => api.closeOverlay()} title="Fechar">✕</button>
                </div>
            </div>

            {/* DROPDOWN DE ROTAÇÕES */}
            {showDropdown && (
                <div
                    className="rotation-dropdown-overlay"
                    onClick={() => setShowDropdown(false)}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="rotation-dropdown" onClick={e => e.stopPropagation()}>
                        <div className="dropdown-header">
                            <input
                                className="dropdown-search"
                                value={dropdownSearch}
                                onChange={e => setDropdownSearch(e.target.value)}
                                placeholder="🔍 Buscar rotação..."
                                autoFocus
                            />
                        </div>
                        <div className="dropdown-list">
                            {Object.keys(groupedRotations).length === 0 ? (
                                <div className="dropdown-empty">Nenhuma rotação encontrada</div>
                            ) : (
                                Object.entries(groupedRotations).map(([group, rots]) => (
                                    <div key={group} className="dropdown-group">
                                        <div className="dropdown-group-title">{group}</div>
                                        {rots.map(rot => (
                                            <div
                                                key={rot.id}
                                                className={`dropdown-item ${activeRotation?.id === rot.id ? 'active' : ''}`}
                                                onClick={() => selectRotation(rot)}
                                            >
                                                <div className="dropdown-item-left">
                                                    <div className="dropdown-item-dot" style={{ background: getStyleColor(rot.style) }} />
                                                    <span className="dropdown-item-name">{rot.name}</span>
                                                </div>
                                                <div className="dropdown-item-right">
                                                    <span className="dropdown-item-count">
                                                        {(rot.phases || []).reduce((s, p) => s + (p.steps?.length || 0), 0)} skills
                                                    </span>
                                                    <span className="dropdown-item-style" style={{ color: getStyleColor(rot.style) }}>
                                                        {rot.style}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CONTEÚDO PRINCIPAL */}
            <div className="overlay-content">
                {!activeRotation ? (
                    <div
                        className="overlay-empty"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <div className="empty-icon">⚔️</div>
                        <div className="empty-text">SELECIONE UM BOSS PARA INICIAR</div>
                        <button className="empty-btn" onClick={() => setShowDropdown(true)}>
                            Escolher Boss / Rotação
                        </button>
                    </div>
                ) : completed ? (
                    <div
                        className="overlay-completed"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <div className="completed-icon">✅</div>
                        <div className="completed-text">Completo!</div>
                        <div className="completed-sub">Rotação finalizada</div>
                        <button className="completed-btn" onClick={resetAll}>↺ Reiniciar</button>
                    </div>
                ) : (
                    <div
                        className="overlay-active"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        {/* Skill Track */}
                        <div className="skills-track">
                            {/* Phase Badge */}
                            {phase && engineRef.current && engineRef.current.phases.length > 1 && (
                                <PhaseBadge
                                    phase={phase}
                                    phaseIndex={engineRef.current.currentPhaseIndex}
                                    totalPhases={engineRef.current.phases.length}
                                    onChange={changePhase}
                                />
                            )}

                            {/* Current slot */}
                            {currentStep && (
                                <AbilitySlot
                                    step={currentStep}
                                    variant="current"
                                    getAbility={getAbility}
                                    getStyleColor={getStyleColor}
                                    iconCache={iconCache}
                                    showName={settings?.overlay?.showSkillNames !== false}
                                    showKeybind={true}
                                />
                            )}

                            {/* Next slots */}
                            {nextSteps.map((step, i) => (
                                <React.Fragment key={i}>
                                    <span className="slot-arrow">›</span>
                                    <AbilitySlot
                                        step={step}
                                        variant={`next${i + 1}`}
                                        getAbility={getAbility}
                                        getStyleColor={getStyleColor}
                                        iconCache={iconCache}
                                        showName={false}
                                        showKeybind={true}
                                    />
                                </React.Fragment>
                            ))}

                            {/* Step note */}
                            {currentStep?.note && (
                                <span className="step-note" title={currentStep.note}>📝</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* GCD BAR */}
            {activeRotation && !completed && (
                <GCDBar
                    progress={gcdProgress}
                    state={gcdState}
                    remaining={gcdRemaining}
                />
            )}

            {/* ERRO MSG */}
            {errorMsg && (
                <div className="error-message">{errorMsg}</div>
            )}

            {/* TRACKING DOT */}
            <div className={`tracking-indicator ${isTracking ? 'active' : ''}`} />
        </div>
    );
}
