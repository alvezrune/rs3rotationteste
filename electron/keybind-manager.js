/**
 * KeybindManager — Gerencia registros de teclas via uiohook-napi
 */
class KeybindManager {
    constructor() {
        this.registeredKeys = new Map(); // combo string -> abilityId
        this.isTracking = false;
        this._onKeyCallback = null;
    }

    /**
     * Carrega keybinds a partir do mapa de abilities
     * @param {Object} abilities - { id: { key: { base, modifiers }, ... } }
     */
    loadFromAbilities(abilities) {
        this.registeredKeys.clear();
        for (const [id, ab] of Object.entries(abilities)) {
            if (ab.key && ab.key.base) {
                const combo = this.serializeCombo(ab.key);
                if (combo) {
                    this.registeredKeys.set(combo, id);
                }
            }
        }
    }

    /**
     * Registra keybinds para a rotação ativa
     * @param {Object} keyMap - { [abilityId]: { base, modifiers } }
     */
    registerRotationKeys(keyMap) {
        this.registeredKeys.clear();
        for (const [abilityId, keyObj] of Object.entries(keyMap)) {
            const combo = this.serializeCombo(keyObj);
            if (combo) {
                this.registeredKeys.set(combo, abilityId);
            }
        }
        this.isTracking = true;
    }

    /**
     * Atualiza keybind de uma ability específica
     */
    updateAbility(abilityId, newCombo) {
        // Remover binding antigo
        for (const [combo, id] of this.registeredKeys.entries()) {
            if (id === abilityId) {
                this.registeredKeys.delete(combo);
                break;
            }
        }
        // Adicionar novo
        if (newCombo && newCombo.base) {
            const comboStr = this.serializeCombo(newCombo);
            if (comboStr) {
                this.registeredKeys.set(comboStr, abilityId);
            }
        }
    }

    /** Remove todos os registros */
    unregisterAll() {
        this.registeredKeys.clear();
        this.isTracking = false;
    }

    /**
     * Detecta conflitos com uma combo
     * @returns {string|null} ID da ability em conflito, ou null
     */
    getConflicts(combo, excludeId = null) {
        const comboStr = typeof combo === 'string' ? combo : this.serializeCombo(combo);
        const existing = this.registeredKeys.get(comboStr);
        if (existing && existing !== excludeId) {
            return existing;
        }
        return null;
    }

    /**
     * Verifica se uma combo está registrada
     */
    isRegistered(comboStr) {
        return this.registeredKeys.has(comboStr);
    }

    /**
     * Retorna o combo set para verificação em keydown
     */
    getRegisteredCombos() {
        return new Set(this.registeredKeys.keys());
    }

    /**
     * Serializa objeto de key para string consistente
     * Formato: ctrl+shift+alt+meta+base
     */
    serializeCombo(keyObj) {
        if (!keyObj || !keyObj.base) return '';
        const mods = (keyObj.modifiers || []).map(m => m.toLowerCase());
        const res = [];
        if (mods.includes('ctrl') || mods.includes('control')) res.push('ctrl');
        if (mods.includes('shift')) res.push('shift');
        if (mods.includes('alt')) res.push('alt');
        if (mods.includes('meta') || mods.includes('win') || mods.includes('cmd')) res.push('meta');
        res.push(keyObj.base.toLowerCase());
        return res.join('+');
    }

    /**
     * Parseia combo string para objeto
     */
    parseCombo(comboStr) {
        if (!comboStr) return { base: '', modifiers: [] };
        const parts = comboStr.split('+');
        const modifiers = [];
        let base = '';
        for (const part of parts) {
            if (['ctrl', 'shift', 'alt', 'meta'].includes(part)) {
                modifiers.push(part.charAt(0).toUpperCase() + part.slice(1));
            } else {
                base = part;
            }
        }
        return { base, modifiers };
    }
}

module.exports = KeybindManager;
