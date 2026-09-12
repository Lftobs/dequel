export function stripAnsi(str: string): string {
	let s = str.replace(/[\u001b\u009b]\[[\d;]*[A-Za-z]/g, "");
	s = s.replace(/\[(\d+;)*\d*m/g, "");
	return s;
}

export function parseLogEntry(log: { id?: string; message: string; createdAt?: string; timestamp?: string }) {
	let message = stripAnsi(log.message);
	let level = "info";
	let status = "";
	let host = "localhost";
	let request = "";
	let duration: string | null = null;
	let size: string | null = null;
	let raw = log.message;

	if (message.startsWith("{") && message.endsWith("}")) {
		try {
			const obj = JSON.parse(message);
			if (obj.level) level = obj.level.toLowerCase();
			if (obj.status) {
				status = String(obj.status);
				const statusNum = Number(obj.status);
				if (statusNum >= 500) level = "error";
				else if (statusNum >= 400) level = "warning";
			}
			if (obj.request) {
				host = obj.request.host || host;
				request = `${obj.request.method || ""} ${obj.request.uri || ""}`;
				duration = obj.duration ? `${(obj.duration * 1000).toFixed(2)}ms` : null;
				size = obj.size ? `${obj.size} B` : null;
				message = obj.msg || obj.message || obj.error || message;
				if (!message || message === '""') {
					message = `${obj.request.method || ""} ${obj.request.uri || ""}`;
				}
			} else {
				message = obj.msg || obj.message || message;
			}
			raw = JSON.stringify(obj, null, 2);
		} catch {}
	} else {
		const upper = message.toUpperCase();
		if (upper.includes("ERROR") || upper.includes("CRITICAL") || upper.includes("FAIL")) {
			level = "error";
		} else if (upper.includes("WARN")) {
			level = "warning";
		}
	}

	return {
		...log,
		parsedMessage: message,
		level,
		status,
		host,
		request,
		duration,
		size,
		raw,
	};
}
