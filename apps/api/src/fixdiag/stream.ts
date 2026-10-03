import type { StageEvent } from "./types";

type Listener = (event: StageEvent) => void;

class DiagBus {
	private listeners = new Map<string, Set<Listener>>();

	subscribe(runId: string, listener: Listener): () => void {
		let set = this.listeners.get(runId);
		if (!set) {
			set = new Set();
			this.listeners.set(runId, set);
		}
		set.add(listener);
		return () => {
			set.delete(listener);
			if (set.size === 0) this.listeners.delete(runId);
		};
	}

	emit(runId: string, event: StageEvent) {
		for (const listener of this.listeners.get(runId) ?? []) {
			try {
				listener(event);
			} catch {}
		}
	}
}

export const diagBus = new DiagBus();
