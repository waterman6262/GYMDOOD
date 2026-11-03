/** Keep only the digits of a phone number, e.g. "081-234-5678" → "0812345678". */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}
