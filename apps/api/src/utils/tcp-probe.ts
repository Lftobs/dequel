import { connect } from "node:net";

export const probeTcp = (host: string, port: number, timeoutMs = 2000): Promise<boolean> =>
	new Promise((resolve) => {
		const socket = connect({ host, port });
		let settled = false;
		const finish = (ok: boolean) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolve(ok);
		};
		socket.setTimeout(timeoutMs, () => finish(false));
		socket.once("connect", () => finish(true));
		socket.once("error", () => finish(false));
	});
