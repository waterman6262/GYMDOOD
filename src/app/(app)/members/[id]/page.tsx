import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { getMember } from "@/lib/members/queries";
import { setMemberActive, updateMember } from "../actions";
import { MemberForm } from "../member-form";

export default async function MemberDetailPage({ params }: PageProps<"/members/[id]">) {
  const { id } = await params;
  const [member, staff] = await Promise.all([getMember(id), getCurrentStaff()]);
  if (!member) notFound();

  return (
    <div className="space-y-6">
      <Link href="/members" className="text-sm text-indigo-700 hover:underline">
        ← กลับไปรายชื่อ
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">{member.name}</h1>
        {!member.active && <span className="rounded bg-slate-200 px-2 py-0.5 text-sm text-slate-600">ปิดใช้งาน</span>}
      </div>
      <p className="text-slate-600">
        รหัสสมาชิก{" "}
        <span data-testid="member-code" className="font-mono text-lg font-semibold text-slate-900">
          {member.member_code}
        </span>
      </p>

      <MemberForm key={member.id} action={updateMember.bind(null, member.id)} member={member} />

      {staff?.role === "owner" && (
        <form action={setMemberActive.bind(null, member.id, !member.active)}>
          <button type="submit" className={member.active ? "btn-danger" : "btn"}>
            {member.active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
          </button>
        </form>
      )}
    </div>
  );
}
