export interface DeploymentFailedSignal {
	eventId: string;
	deploymentId: string;
}

type Handler = (signal: DeploymentFailedSignal) => void;

const handlers = new Set<Handler>();

export const onDeploymentFailed = (handler: Handler): (() => void) => {
	handlers.add(handler);
	return () => handlers.delete(handler);
};

export const emitDeploymentFailed = (signal: DeploymentFailedSignal): void => {
	for (const handler of handlers) {
		try {
			handler(signal);
		} catch (err) {
			console.error("[Events] deployment-failed handler error:", err);
		}
	}
};
