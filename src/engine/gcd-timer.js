/**
 * GCDTimer — Gerencia o Global Cooldown timer de 1.8s (3 ticks RS3)
 */
export default class GCDTimer {
    constructor(duration = 1800) {
        this.duration = duration; // ms
        this._startTime = 0;
        this._running = false;
        this._completed = false;
        this._rafId = null;
        this._callbacks = {
            complete: [],
            tick: [],
        };
    }

    /** Inicia o timer */
    start() {
        if (this._running) return;
        this._running = true;
        this._completed = false;
        this._startTime = performance.now();
        this._tick();
    }

    /** Para sem completar */
    stop() {
        this._running = false;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    /** Reinicia do zero */
    reset() {
        this.stop();
        this._completed = false;
        this._startTime = 0;
        this._emit('tick', { progress: 0, remaining: this.duration / 1000 });
    }

    /** True se GCD completou */
    isReady() {
        return !this._running && (this._completed || this._startTime === 0);
    }

    /** Progresso de 0.0 a 1.0 */
    getProgress() {
        if (!this._running) return this._completed ? 1 : 0;
        const elapsed = performance.now() - this._startTime;
        return Math.min(1, elapsed / this.duration);
    }

    /** Tempo restante como string "1.2s" */
    getRemaining() {
        if (!this._running) return this._completed ? '0.0s' : `${(this.duration / 1000).toFixed(1)}s`;
        const elapsed = performance.now() - this._startTime;
        const remaining = Math.max(0, this.duration - elapsed);
        return `${(remaining / 1000).toFixed(1)}s`;
    }

    /** Internal — animation frame loop */
    _tick() {
        if (!this._running) return;

        const elapsed = performance.now() - this._startTime;
        const progress = Math.min(1, elapsed / this.duration);
        const remaining = Math.max(0, (this.duration - elapsed) / 1000);

        this._emit('tick', { progress, remaining: remaining.toFixed(1) });

        if (progress >= 1) {
            this._running = false;
            this._completed = true;
            this._emit('complete');
            return;
        }

        this._rafId = requestAnimationFrame(() => this._tick());
    }

    // --- Eventos ---
    onComplete(fn) { this._callbacks.complete.push(fn); }
    onTick(fn) { this._callbacks.tick.push(fn); }

    removeAllListeners() {
        this.stop();
        this._callbacks = { complete: [], tick: [] };
    }

    _emit(event, data) {
        (this._callbacks[event] || []).forEach(fn => fn(data));
    }
}
