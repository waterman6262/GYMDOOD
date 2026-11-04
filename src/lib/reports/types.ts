import type { PaymentMethod } from "@/lib/sales/format";

// Shapes returned by the report_* database functions.

export type SalesReport = {
  totals: { bills: number; subtotal: number; discount: number; net: number; voided_bills: number };
  by_day: { day: string; bills: number; net: number }[];
  by_payment: { method: PaymentMethod; bills: number; net: number }[];
  by_type: { package: number; product: number };
};

export type CheckinsReport = {
  total: number;
  unique_members: number;
  by_day: { day: string; total: number; unique_members: number }[];
  by_hour: { hour: number; total: number }[];
};

export type MembersReport = {
  active_count: number;
  expiring: {
    member_id: string;
    name: string;
    phone: string | null;
    package_name: string;
    end_date: string;
    visits_left: number | null;
  }[];
  expired_recent: { member_id: string; name: string; phone: string | null; last_end_date: string }[];
};

export type ProductsReport = {
  best_sellers: { product_id: string; name: string; qty: number; amount: number }[];
  low_stock: { product_id: string; name: string; stock_qty: number; low_stock_at: number }[];
};

export type OverrideRow = { checked_in_at: string; member_name: string; reason: string; staff_name: string | null };

export type ClassesReport = {
  sessions: {
    id: string;
    starts_at: string;
    class_name: string;
    trainer_name: string | null;
    capacity: number;
    cancelled: boolean;
    booked: number;
    attended: number;
    no_show: number;
  }[];
  pt_by_trainer: { trainer_name: string; done: number }[];
};
