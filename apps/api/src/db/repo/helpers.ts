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
