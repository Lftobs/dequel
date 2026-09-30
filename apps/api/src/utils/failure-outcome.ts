export const CANCELLED_FAILURE_REASON = "Cancelled";

export type FailureOutcome = "failure" | "cancelled";

export const classifyFailureOutcome = (reason: string | null | undefined): FailureOutcome =>
	reason === CANCELLED_FAILURE_REASON ? "cancelled" : "failure";
