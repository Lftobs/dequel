export type ApiResponse<T = unknown> =
	| { status: "success"; message: string; data: T }
	| { status: "error"; message: string; error?: string };

export const ok = <T>(data: T, message = "OK"): ApiResponse<T> => ({
	status: "success",
	message,
	data,
});

export const created = <T>(data: T, message = "Created"): ApiResponse<T> => ({
	status: "success",
	message,
	data,
});

export const fail = (message: string, error?: string): ApiResponse => ({
	status: "error",
	message,
	error,
});
