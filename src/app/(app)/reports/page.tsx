import Link from "next/link";
import { getCurrentStaff } from "@/lib/auth";
import { bangkokToday } from "@/lib/classes/time";
import { parseRange } from "@/lib/reports/range";
import type {
  CheckinsReport,
  ClassesReport,
  MembersReport,
  OverrideRow,
  ProductsReport,
  SalesReport,
} from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";
import { CheckinsReportView } from "./checkins-report";
import { ClassesReportView } from "./classes-report";
import { MembersReportView } from "./members-report";
import { OverridesReportView } from "./overrides-report";
import { ProductsReportView } from "./products-report";
import { RangeForm } from "./range-form";
import { SalesReportView } from "./sales-report";

const TABS = [
  { id: "sales", label: "ยอดขาย" },
  { id: "checkins", label: "การเข้าใช้" },
  { id: "members", label: "สมาชิก" },
  { id: "products", label: "สินค้า" },
  { id: "overrides", label: "การปล่อยเข้า" },
  { id: "classes", label: "คลาส/PT" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
      {message}
    </p>
  );
}

/** Calls a report function; database errors (P0001) are Thai and shown as-is. */
async function load<T>(fn: string, args?: Record<string, string>): Promise<{ data?: T; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.code === "P0001" ? error.message : "โหลดรายงานไม่สำเร็จ กรุณาลองใหม่" };
  return { data: data as T };
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const [params, staff] = await Promise.all([searchParams, getCurrentStaff()]);
  const today = bangkokToday();

  // Staff see today's sales only (spec §7).
  if (staff?.role !== "owner") {
    const sales = await load<SalesReport>("report_sales", { p_from: today, p_to: today });
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">ยอดขายวันนี้</h1>
        {sales.error ? <ErrorBox message={sales.error} /> : <SalesReportView data={sales.data!} from={today} to={today} />}
      </div>
    );
  }

  const { from, to } = parseRange(params, today);
  const tab: TabId = TABS.some((t) => t.id === params.tab) ? (params.tab as TabId) : "sales";
  const range = { p_from: from, p_to: to };

  let body: React.ReactNode = null;
  if (tab === "sales") {
    const r = await load<SalesReport>("report_sales", range);
    body = r.error ? <ErrorBox message={r.error} /> : <SalesReportView data={r.data!} from={from} to={to} />;
  } else if (tab === "checkins") {
    const r = await load<CheckinsReport>("report_checkins", range);
    body = r.error ? <ErrorBox message={r.error} /> : <CheckinsReportView data={r.data!} singleDay={from === to} />;
  } else if (tab === "members") {
    const r = await load<MembersReport>("report_members");
    body = r.error ? <ErrorBox message={r.error} /> : <MembersReportView data={r.data!} />;
  } else if (tab === "products") {
    const r = await load<ProductsReport>("report_products", range);
    body = r.error ? <ErrorBox message={r.error} /> : <ProductsReportView data={r.data!} />;
  } else if (tab === "overrides") {
    const r = await load<OverrideRow[]>("report_overrides", range);
    body = r.error ? <ErrorBox message={r.error} /> : <OverridesReportView rows={r.data!} />;
  } else {
    const r = await load<ClassesReport>("report_classes", range);
    body = r.error ? <ErrorBox message={r.error} /> : <ClassesReportView data={r.data!} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">รายงาน</h1>
      <nav data-testid="report-tabs" className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/reports?tab=${t.id}&from=${from}&to=${to}`}
            className={`rounded-lg px-3 py-2 ${tab === t.id ? "bg-indigo-600 text-white" : "hover:bg-slate-100"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab !== "members" && <RangeForm tab={tab} from={from} to={to} today={today} />}
      {body}
    </div>
  );
}
