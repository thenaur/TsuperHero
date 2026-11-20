// Tiny event bus: play.js emits ('change' | 'submit' | 'answer' | 'drawer' | 'stop'), tutorial listens.
export class Emitter {
  constructor() { this.handlers = new Set(); }
  on(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  emit(event, data) {
    for (const fn of [...this.handlers]) {
      try { fn(event, data); } catch (e) { console.error(e); }
    }
  }
}
