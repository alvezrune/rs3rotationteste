import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    rectIntersection
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const api = window.electronAPI;

const STYLE_COLORS = {
    necro: 'var(--necro)', melee: 'var(--melee)',
    ranged: 'var(--ranged)', magic: 'var(--magic)',
    util: 'var(--util)', defensives: 'var(--defensives, #64748b)'
};

// Normalize style/category string for comparison
function normalizeStyle(str) {
    if (!str) return '';
    const s = str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
        .trim();
    // Map aliases
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

export default function TabRotacao({ rotations, abilities, refreshRotations }) {
    const [selected, setSelected] = useState(null);
    const [editName, setEditName] = useState('');
    const [editStyle, setEditStyle] = useState('necro');
    const [phases, setPhases] = useState([]);
    const [activePhase, setActivePhase] = useState(0);
    const [saveStatus, setSaveStatus] = useState('');
    const [contextMenu, setContextMenu] = useState(null);
    const [paletteStyle, setPaletteStyle] = useState('Necromancy');
    const [iconCache, setIconCache] = useState({});

    // Drag & Drop States
    const [activeDrag, setActiveDrag] = useState(null); // Para reordenar (dnd-kit)
    const [manualDrag, setManualDrag] = useState(null); // Para paleta -> track { abId, x, y, icon, isMoving, startX, startY }
    const [hoveredStepIdx, setHoveredStepIdx] = useState(null);
    const [isOverTrack, setIsOverTrack] = useState(false);

    const trackRef = useRef(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Carregar cache de ícones
    useEffect(() => {
        const loadIcons = async () => {
            const cache = {};
            for (const id of Object.keys(abilities)) {
                cache[id] = await api.getIconPath(id);
            }
            setIconCache(cache);
        };
        loadIcons();
    }, [abilities]);

    // --- LOGICA DE DRAG MANUAL (Paleta para Track) ---
    const handlePointerDown = (abId, e) => {
        // Travar ponteiro para permitir arraste suave
        e.currentTarget.setPointerCapture(e.pointerId);
        setManualDrag({
            abId,
            x: e.clientX,
            y: e.clientY,
            startX: e.clientX,
            startY: e.clientY,
            isMoving: false,
            icon: iconCache[abId]
        });
    };

    const handlePointerMove = (e) => {
        if (!manualDrag) return;

        const dist = Math.sqrt(
            Math.pow(e.clientX - manualDrag.startX, 2) +
            Math.pow(e.clientY - manualDrag.startY, 2)
        );

        const isMoving = manualDrag.isMoving || dist > 4;

        setManualDrag(prev => ({ ...prev, x: e.clientX, y: e.clientY, isMoving }));

        if (isMoving) {
            // Detecção de colisão manual
            const element = document.elementFromPoint(e.clientX, e.clientY);

            // 1. Detectar se está sobre um step específico (para merge)
            const stepEl = element?.closest('[data-step-idx]');
            if (stepEl) {
                setHoveredStepIdx(parseInt(stepEl.getAttribute('data-step-idx')));
                setIsOverTrack(false);
            } else {
                setHoveredStepIdx(null);
                // 2. Detectar se está na área da track (para add)
                const trackEl = element?.closest('[data-droppable="true"]');
                setIsOverTrack(!!trackEl);
            }
        }
    };

    const handlePointerUp = (e) => {
        if (!manualDrag) return;

        const { abId, isMoving } = manualDrag;
        const finalX = e.clientX;
        const finalY = e.clientY;

        // Resetar estados de drag
        setManualDrag(null);
        setHoveredStepIdx(null);
        setIsOverTrack(false);

        // Se não moveu, é apenas um clique (adicionar direto)
        if (!isMoving) {
            addStep(abId);
            return;
        }

        // Se moveu, ver onde soltou
        const element = document.elementFromPoint(finalX, finalY);
        const stepEl = element?.closest('[data-step-idx]');

        if (stepEl) {
            mergeStep(parseInt(stepEl.getAttribute('data-step-idx')), abId);
        } else {
            const trackEl = element?.closest('[data-droppable="true"]');
            if (trackEl) addStep(abId);
        }
    };

    // --- OPERAÇÕES NA ROTAÇÃO ---
    const addStep = (abilityId) => {
        setPhases(current => {
            const updated = [...current];
            if (!updated[activePhase]) return current;
            const newSteps = [...updated[activePhase].steps, {
                skills: [{ id: abilityId }],
                note: '',
                passive: false,
            }];
            updated[activePhase] = { ...updated[activePhase], steps: newSteps };
            return updated;
        });
    };

    const mergeStep = (idx, abId) => {
        setPhases(current => {
            const updated = [...current];
            if (!updated[activePhase]) return current;

            const steps = [...updated[activePhase].steps];
            const targetStep = { ...steps[idx] };

            // Apenas se a skill ainda não estiver lá
            if (!targetStep.skills.find(s => s.id === abId)) {
                targetStep.skills = [...targetStep.skills, { id: abId }];
                steps[idx] = targetStep;
                updated[activePhase] = { ...updated[activePhase], steps };
                return updated;
            }
            return current;
        });
    };

    const removeStep = (stepIndex) => {
        setPhases(current => {
            const updated = [...current];
            const steps = [...updated[activePhase].steps];
            steps.splice(stepIndex, 1);
            updated[activePhase] = { ...updated[activePhase], steps };
            return updated;
        });
    };

    // --- PERSISTÊNCIA E GESTÃO ---
    const selectRotation = useCallback((rot) => {
        setSelected(rot);
        setEditName(rot.name || '');
        setEditStyle(rot.style || 'necro');
        setPhases(rot.phases || [{ id: 'p1', name: 'P1', steps: [] }]);
        setActivePhase(0);
    }, []);

    const saveRotation = useCallback(async () => {
        if (!selected) return;
        setSaveStatus('⏳ Salvando...');
        const data = {
            ...selected,
            name: editName,
            style: editStyle,
            phases,
        };
        const id = selected.id || editName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        await api.saveRotation(id, data);
        await refreshRotations();
        setSaveStatus('💾 Salvo');
        setTimeout(() => setSaveStatus(''), 2000);
    }, [selected, editName, editStyle, phases, refreshRotations]);

    const createRotation = async () => {
        const id = `rot-${Date.now()}`;
        const newRot = {
            id, name: 'Nova Rotação', style: 'necro',
            phases: [{ id: 'p1', name: 'P1', steps: [] }],
        };
        await api.saveRotation(id, newRot);
        await refreshRotations();
        selectRotation(newRot);
    };

    const deleteRotation = async (rot) => {
        if (!confirm(`Tem certeza que deseja deletar "${rot.name}"?`)) return;
        await api.deleteRotation(rot.id);
        await refreshRotations();
        if (selected?.id === rot.id) setSelected(null);
        setContextMenu(null);
    };

    const duplicateRotation = async (rot) => {
        const id = `${rot.id}-copy-${Date.now()}`;
        const copy = { ...rot, id, name: `${rot.name} (cópia)` };
        await api.saveRotation(id, copy);
        await refreshRotations();
    };

    // --- REORDENAÇÃO (DND-KIT) ---
    const handleDragStart = (event) => setActiveDrag(event.active);
    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveDrag(null);
        if (!over || active.id === over.id) return;

        setPhases(current => {
            const updated = [...current];
            const steps = [...updated[activePhase].steps];
            const oldIndex = steps.findIndex((_, i) => `step-${i}` === active.id);
            const newIndex = steps.findIndex((_, i) => `step-${i}` === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                updated[activePhase].steps = arrayMove(steps, oldIndex, newIndex);
                return updated;
            }
            return current;
        });
    };

    // --- FASES ---
    const addPhase = () => {
        const id = `p${Date.now()}`;
        setPhases([...phases, { id, name: `P${phases.length + 1}`, steps: [] }]);
    };

    const deletePhase = (index) => {
        if (phases.length <= 1) return;
        if (!confirm('Excluir esta fase?')) return;
        const updated = phases.filter((_, i) => i !== index);
        setPhases(updated);
        setActivePhase(Math.max(0, index - 1));
    };

    const updatePhaseName = (index, name) => {
        const updated = [...phases];
        updated[index].name = name;
        setPhases(updated);
    };

    const getAbility = (skillRef) => {
        const ab = abilities[skillRef?.id];
        if (!ab) return { name: '?', style: 'util' };

        // Ensure consistent structure for keybinds
        const key = ab.key?.base || ab.keybind || '';
        return { ...ab, keyDisplay: key };
    };

    const currentPhaseSteps = phases[activePhase]?.steps || [];

    return (
        <div className="tab-rotacao">
            {/* Camada de Ghost (Manual Drag) */}
            {manualDrag && manualDrag.isMoving && (
                <div className="manual-drag-ghost" style={{ left: manualDrag.x, top: manualDrag.y }}>
                    {manualDrag.icon ? <img src={manualDrag.icon} /> : <div className="palette-item-placeholder">?</div>}
                </div>
            )}

            {/* Sidebar de Rotações */}
            <div className="rot-sidebar">
                <div className="rot-sidebar-header">
                    <span className="section-label">Rotações</span>
                    <button className="btn-small btn-gold" onClick={createRotation}>＋ Nova</button>
                </div>
                <div className="rot-list">
                    {rotations.map(rot => (
                        <div
                            key={rot.id}
                            className={`rot-card ${selected?.id === rot.id ? 'active' : ''}`}
                            onClick={() => selectRotation(rot)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY, rotation: rot });
                            }}
                        >
                            <div className="rot-card-name">{rot.name}</div>
                            <div className="rot-card-meta">
                                <span className="rot-card-style" style={{ color: STYLE_COLORS[rot.style] }}>{rot.style}</span>
                                <span className="rot-card-count">{(rot.phases || []).reduce((s, p) => s + (p.steps?.length || 0), 0)} skills</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor de Rotação */}
            <div className="rot-editor">
                {!selected ? (
                    <div className="rot-empty">Selecione uma rotação para editar</div>
                ) : (
                    <>
                        <div className="rot-editor-header">
                            <input className="rot-name-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome" />
                            <select className="rot-style-select" value={editStyle} onChange={e => setEditStyle(e.target.value)} style={{ color: STYLE_COLORS[editStyle] }}>
                                <option value="necro">💀 Necromancy</option>
                                <option value="melee">⚔️ Melee</option>
                                <option value="ranged">🏹 Ranged</option>
                                <option value="magic">🔮 Magic</option>
                                <option value="util">🛡️ Utilitárias</option>
                            </select>
                            <span className="save-indicator">{saveStatus}</span>
                            <button className="btn-small btn-gold" onClick={saveRotation}>💾 Salvar</button>
                            <button className="btn-small btn-success" onClick={saveRotation}>▶ Usar no Overlay</button>
                        </div>

                        <div className="phase-tabs">
                            {phases.map((phase, i) => (
                                <div key={phase.id} className={`phase-tab-wrapper ${i === activePhase ? 'active' : ''}`}>
                                    <input className="phase-tab-input" value={phase.name} onChange={e => updatePhaseName(i, e.target.value)} onClick={() => setActivePhase(i)} />
                                    {phases.length > 1 && <button className="phase-del-btn" onClick={() => deletePhase(i)}>×</button>}
                                </div>
                            ))}
                            <button className="phase-tab phase-tab-add" onClick={addPhase}>＋</button>
                        </div>

                        <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                            <div className={`step-list-horizontal ${isOverTrack ? 'is-over' : ''}`} data-droppable="true" ref={trackRef}>
                                <SortableContext items={currentPhaseSteps.map((_, i) => `step-${i}`)} strategy={horizontalListSortingStrategy}>
                                    {currentPhaseSteps.map((step, idx) => (
                                        <SortableStep
                                            key={`step-${idx}-${step.skills.map(s => s.id).join('-')}`}
                                            id={`step-${idx}`}
                                            step={step}
                                            idx={idx}
                                            abilities={step.skills.map(s => getAbility(s))}
                                            icons={step.skills.map(s => iconCache[s.id])}
                                            onRemove={() => removeStep(idx)}
                                            isHovered={hoveredStepIdx === idx}
                                            primaryStyle={getAbility(step.skills[0])?.style || 'util'}
                                        />
                                    ))}
                                </SortableContext>
                                {currentPhaseSteps.length === 0 && <div className="step-list-empty">Arraste habilidades da paleta abaixo</div>}
                            </div>
                            <DragOverlay>
                                {activeDrag ? <div className="step-card dragging"><div className="step-card-num">?</div></div> : null}
                            </DragOverlay>
                        </DndContext>

                        <div className="ab-palette">
                            <div className="ab-palette-tabs">
                                {['Necromancy', 'Magic', 'Defensivas', 'Melee', 'Ranged', 'Utilitárias'].map(style => (
                                    <div key={style} className={`ab-palette-tab ${paletteStyle === style ? 'active' : ''}`} onClick={() => setPaletteStyle(style)}>{style}</div>
                                ))}
                            </div>
                            <div className="ab-palette-grid">
                                {Object.values(abilities).filter(ab => matchesTab(ab, paletteStyle)).map(ab => (
                                    <div
                                        key={ab.id}
                                        className="palette-item"
                                        title={ab.name}
                                        onPointerDown={(e) => handlePointerDown(ab.id, e)}
                                        onPointerMove={handlePointerMove}
                                        onPointerUp={handlePointerUp}
                                        style={{ touchAction: 'none' }}
                                    >
                                        {iconCache[ab.id] ? (
                                            <img src={iconCache[ab.id]} className="palette-item-img" draggable="false" style={{ pointerEvents: 'none' }} />
                                        ) : (
                                            <div className="palette-item-placeholder" style={{ color: STYLE_COLORS[ab.style] || 'var(--util)', pointerEvents: 'none' }}>{ab.name[0]}</div>
                                        )}
                                        {(ab.key?.base || ab.keybind) && (
                                            <div className="palette-item-bind">{(ab.key?.base || ab.keybind).toUpperCase()}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="context-overlay" onClick={() => setContextMenu(null)} />
                    <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
                        <button onClick={() => { setEditName(prompt('Novo nome:', contextMenu.rotation.name) || contextMenu.rotation.name); setContextMenu(null); }}>✏ Renomear</button>
                        <button onClick={() => { duplicateRotation(contextMenu.rotation); setContextMenu(null); }}>📋 Duplicar</button>
                        <button className="ctx-danger" onClick={() => deleteRotation(contextMenu.rotation)}>🗑 Deletar</button>
                    </div>
                </>
            )}
        </div>
    );
}

function SortableStep({ id, step, idx, abilities, icons, onRemove, isHovered, primaryStyle }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const isCombined = abilities.length > 1;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`step-card style-${primaryStyle} ${isCombined ? 'is-combined' : ''} ${isHovered ? 'drop-target' : ''}`}
            data-step-idx={idx}
            {...attributes}
            {...listeners}
        >
            {isHovered && <div className="drop-indicator-text">Solte para Combinar</div>}

            <div className="step-skill-container" style={{ pointerEvents: 'none' }}>
                {abilities.map((ability, i) => (
                    <div className="step-skill-mini" key={i}>
                        {icons[i] ? (
                            <img src={icons[i]} className="step-img" draggable="false" />
                        ) : (
                            <div className="step-placeholder" style={{ background: `var(--${ability.style}-dim)`, color: `var(--${ability.style})` }}>
                                {ability.name[0]}
                            </div>
                        )}
                        {ability.keyDisplay && <div className="step-card-bind">{ability.keyDisplay.toUpperCase()}</div>}
                    </div>
                ))}
                {isCombined && <div className="step-group-badge">⚡ MESMO TICK</div>}
            </div>

            <div className="step-card-num" style={{ pointerEvents: 'none' }}>{idx + 1}</div>
            <button
                className="step-card-del"
                onMouseDown={(e) => { e.stopPropagation(); onRemove(); }}
            >
                ×
            </button>
        </div>
    );
}
