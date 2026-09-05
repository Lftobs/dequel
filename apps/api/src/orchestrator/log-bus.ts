import type { LogEvent } from "../types";

type Subscriber = (event: LogEvent) => void;

class LogBus {
	private readonly subscribers = new Map<string, Set<Subscriber>>();

	subscribe(deploymentId: string, subscriber: Subscriber) {
		if (!this.subscribers.has(deploymentId)) {
			this.subscribers.set(deploymentId, new Set());
		}
		this.subscribers.get(deploymentId)!.add(subscriber);

		return () => {
			const set = this.subscribers.get(deploymentId);
			if (!set) {
				return;
			}
			set.delete(subscriber);
			if (set.size === 0) {
				this.subscribers.delete(deploymentId);
			}
		};
	}

	publish(event: LogEvent) {
		const set = this.subscribers.get(event.deploymentId);
		if (!set) {
			return;
		}

		for (const subscriber of set) {
			subscriber(event);
		}
	}
}

export const logBus = new LogBus();
