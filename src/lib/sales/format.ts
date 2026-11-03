const bahtFormat = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const thaiDateTime = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

/** 1200 → "1,200.00" */
export function baht(n: number | string): string {
  return bahtFormat.format(Number(n));
}

/** "2026-11-03" → "3 พ.ย. 2569" */
export function formatThaiDate(d: string | Date): string {
  return thaiDate.format(typeof d === "string" ? new Date(d) : d);
}

/** Timestamp → "3 พ.ย. 2569 14:05" */
export function formatThaiDateTime(d: string | Date): string {
  return thaiDateTime.format(typeof d === "string" ? new Date(d) : d);
}

export type PaymentMethod = "cash" | "transfer" | "promptpay";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "เงินสด",
  transfer: "โอน",
  promptpay: "QR PromptPay",
};
