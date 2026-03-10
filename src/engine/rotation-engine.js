/**
 * RotationEngine — Gerencia a lógica de rotação com suporte a fases
 */
export default class RotationEngine {
    constructor() {
        this.rotationData = null;
        this.phases = [];
        this.currentPhaseIndex = 0;
        this.currentStepIndex = 0;
        this._callbacks = {
            advance: [],
            phaseComplete: [],
            rotationComplete: [],
            error: [],
        };
    }

    /**
     * Carrega dados de rotação
     * @param {Object} rotationData - { name, style, phases: [{ id, name, steps: [{skills, note, passive}] }] }
     */
    load(rotationData) {
        this.rotationData = rotationData;
        this.phases = rotationData?.phases || [];
        // Compatibilidade: se não tiver fases, usar steps direto como fase única
        if (this.phases.length === 0 && rotationData?.steps) {
            this.phases = [{ id: 'default', name: 'Rotação', steps: rotationData.steps }];
        }
        // Compatibilidade: se for array legacy (rotation = [{id, name}...])
        if (Array.isArray(rotationData?.rotation)) {
            this.phases = [{
                id: 'default',
                name: 'Rotação',
                steps: rotationData.rotation.map(skill => ({
                    skills: [skill],
                    note: '',
                    passive: false,
                })),
            }];
        }
        this.currentPhaseIndex = 0;
        this.currentStepIndex = 0;
    }

    /** Muda a fase ativa */
    setPhase(phaseId) {
        const idx = this.phases.findIndex(p => p.id === phaseId);
        if (idx !== -1) {
            this.currentPhaseIndex = idx;
            this.currentStepIndex = 0;
        }
    }

    /** Muda a fase pelo índice */
    setPhaseByIndex(index) {
        if (index >= 0 && index < this.phases.length) {
            this.currentPhaseIndex = index;
            this.currentStepIndex = 0;
        }
    }

    /** Retorna a fase atual */
    getCurrentPhase() {
        return this.phases[this.currentPhaseIndex] || null;
    }

    /** Retorna todos os steps da fase atual */
    getPhaseSteps() {
        const phase = this.getCurrentPhase();
        return phase?.steps || [];
    }

    /** Retorna o step atual */
    getCurrentStep() {
        const steps = this.getPhaseSteps();
        return steps[this.currentStepIndex] || null;
    }

    /** Retorna os próximos N steps */
    getNextSteps(n = 3) {
        const steps = this.getPhaseSteps();
        const result = [];
        for (let i = 1; i <= n; i++) {
            const idx = this.currentStepIndex + i;
            if (idx < steps.length) {
                result.push(steps[idx]);
            }
        }
        return result;
    }

    /** Retorna o step anterior (para slot 'done') */
    getPreviousStep() {
        const steps = this.getPhaseSteps();
        if (this.currentStepIndex > 0) {
            return steps[this.currentStepIndex - 1];
        }
        return null;
    }

    /** Avança para o próximo step */
    advance() {
        const steps = this.getPhaseSteps();
        if (this.currentStepIndex < steps.length - 1) {
            this.currentStepIndex++;
            this._emit('advance', this.getCurrentStep());
            return true;
        }
        // Fase completa
        this._emit('phaseComplete', this.getCurrentPhase());

        // Tentar avançar para próxima fase
        if (this.currentPhaseIndex < this.phases.length - 1) {
            this.currentPhaseIndex++;
            this.currentStepIndex = 0;
            this._emit('advance', this.getCurrentStep());
            return true;
        }

        // Rotação completa
        this._emit('rotationComplete');
        return false;
    }

    /** Volta ao início da fase atual */
    reset() {
        this.currentStepIndex = 0;
    }

    /** Volta à primeira fase, step 0 */
    resetAll() {
        this.currentPhaseIndex = 0;
        this.currentStepIndex = 0;
    }

    /** Verifica se a fase atual está completa */
    isPhaseComplete() {
        const steps = this.getPhaseSteps();
        return this.currentStepIndex >= steps.length - 1;
    }

    /** Verifica se a rotação inteira está completa */
    isRotationComplete() {
        return this.isPhaseComplete() && this.currentPhaseIndex >= this.phases.length - 1;
    }

    /** Retorna informações de progresso */
    getProgress() {
        const steps = this.getPhaseSteps();
        return {
            current: this.currentStepIndex,
            total: steps.length,
            phaseIndex: this.currentPhaseIndex,
            totalPhases: this.phases.length,
            percent: steps.length > 0 ? (this.currentStepIndex / steps.length) * 100 : 0,
        };
    }

    // --- Eventos ---
    onAdvance(fn) { this._callbacks.advance.push(fn); }
    onPhaseComplete(fn) { this._callbacks.phaseComplete.push(fn); }
    onRotationComplete(fn) { this._callbacks.rotationComplete.push(fn); }
    onError(fn) { this._callbacks.error.push(fn); }

    emitError(data) { this._emit('error', data); }

    removeAllListeners() {
        this._callbacks = { advance: [], phaseComplete: [], rotationComplete: [], error: [] };
    }

    _emit(event, data) {
        (this._callbacks[event] || []).forEach(fn => fn(data));
    }
}
