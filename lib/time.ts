export const BILLING_TIMEZONE = "Asia/Kuala_Lumpur";

// YYYY-MM-DD in the billing timezone.
export function localDate(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString("en-CA", { timeZone: BILLING_TIMEZONE });
}
