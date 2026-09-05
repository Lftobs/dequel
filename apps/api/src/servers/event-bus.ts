export interface ServerEvent {
	serverId: string;
	stage: string;
	message: string;
	done: boolean;
	ok: boolean;
	error?: string;
}

type Subscriber = (event: ServerEvent) => void;

class ServerEventBus {
	private readonly subscribers = new Map<string, Set<Subscriber>>();
	private readonly lastEvents = new Map<string, ServerEvent>();

	subscribe(serverId: string, subscriber: Subscriber) {
		if (!this.subscribers.has(serverId)) {
			this.subscribers.set(serverId, new Set());
		}
		this.subscribers.get(serverId)!.add(subscriber);

		return () => {
			const set = this.subscribers.get(serverId);
			if (!set) return;
			set.delete(subscriber);
			if (set.size === 0) {
				this.subscribers.delete(serverId);
			}
		};
	}

	publish(event: ServerEvent) {
		this.lastEvents.set(event.serverId, event);
		const set = this.subscribers.get(event.serverId);
		if (!set) return;
		for (const subscriber of set) {
			subscriber(event);
		}
	}

	getLastEvent(serverId: string): ServerEvent | undefined {
		return this.lastEvents.get(serverId);
	}

	clear(serverId: string) {
		this.lastEvents.delete(serverId);
	}
}

export const serverEventBus = new ServerEventBus();
