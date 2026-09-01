export const BASE = "/api";

export class ApiError extends Error {
	status: number;
	constructor(msg: string, status: number) {
		super(msg);
		this.status = status;
	}
}

export const apiFetch = async <T>(
	path: string,
	opts?: RequestInit,
): Promise<T> => {
	const isFormData = opts?.body instanceof FormData;
	const headers: Record<string, string> = {};
	if (!isFormData) headers["Content-Type"] = "application/json";
	const res = await fetch(`${BASE}${path}`, {
		...opts,
		headers: {
			...headers,
			...(opts?.headers as Record<string, string>),
		},
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({
			message: res.statusText,
		}));
		throw new ApiError(
			body.message ?? body.error ?? "Request failed",
			res.status,
		);
	}
	if (res.headers.get("content-type")?.includes("text/event-stream"))
		return res as unknown as T;
	if (res.headers.get("content-type")?.includes("text/plain"))
		return res.text() as unknown as T;
	const json = await res.json();
	if (json && typeof json === "object" && "status" in json && "data" in json)
		return json.data as T;
	return json as T;
};
