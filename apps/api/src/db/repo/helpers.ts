export const now = () => new Date();

export const getRowsAffected = (result: { rows?: unknown[]; rowCount?: number; changes?: number }): number => {
  return result.rowCount ?? result.changes ?? 0;
};
