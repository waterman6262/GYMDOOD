import Link from "next/link";
import { searchMembers } from "@/lib/members/queries";
import { MemberSearch } from "./member-search";

export default async function MembersPage({ searchParams }: PageProps<"/members">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const inactive = params.inactive === "1";
  const members = await searchMembers(q, inactive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">สมาชิก</h1>
        <Link href="/members/new" className="btn-primary">
          + เพิ่มสมาชิก
        </Link>
      </div>
      <MemberSearch key={`${q}|${inactive}`} q={q} inactive={inactive} />
      {members.length === 0 ? (
        <p className="text-slate-500">ไม่พบสมาชิก</p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <Link href={`/members/${m.id}`} className="font-medium text-indigo-700 hover:underline">
                  {m.name}
                </Link>
                <p className="text-sm text-slate-500">
                  {m.member_code}
                  {m.phone && ` · ${m.phone}`}
                </p>
              </div>
              {!m.active && <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">ปิดใช้งาน</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
