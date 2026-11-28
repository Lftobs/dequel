export const now = () => new Date();

export const formatTimestamp = (val: unknown): string => {
	if (!val) return new Date().toISOString();
	if (val instanceof Date) return val.toISOString();
	if (typeof val === "string") return val;
	try {
		return new Date(val as any).toISOString();
	} catch {
		return String(val);
	}
};

export const getRowsAffected = (result: { rows?: unknown[]; rowCount?: number; changes?: number }): number => {
	return result.rowCount ?? result.changes ?? 0;
};

export const pickDefined = <T extends object, const K extends readonly (keyof T)[]>(
	source: T,
	keys: K,
): { [P in K[number]]?: T[P] } => {
	const result: { [P in K[number]]?: T[P] } = {};
	for (const key of keys) {
		const value = source[key];
		if (value !== undefined) {
			result[key] = value;
		}
	}
	return result;
};
