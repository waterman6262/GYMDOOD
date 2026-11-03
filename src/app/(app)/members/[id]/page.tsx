import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { getPhotoUrls } from "@/lib/members/photos";
import { getMember } from "@/lib/members/queries";
import { bangkokToday, getMemberships, MEMBERSHIP_STATE_LABELS, type MembershipState } from "@/lib/memberships/queries";
import { formatThaiDate } from "@/lib/sales/format";
import { setMemberActive, updateMember } from "../actions";
import { MemberForm } from "../member-form";
import { FreezeControls } from "./freeze-form";
import { PhotoUpload } from "./photo-upload";

const STATE_STYLES: Record<MembershipState, string> = {
  active: "bg-green-100 text-green-800",
  frozen: "bg-sky-100 text-sky-800",
  upcoming: "bg-violet-100 text-violet-800",
  expired: "bg-slate-200 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
};

export default async function MemberDetailPage({ params }: PageProps<"/members/[id]">) {
  const { id } = await params;
  const [member, staff, memberships] = await Promise.all([getMember(id), getCurrentStaff(), getMemberships(id)]);
  if (!member) notFound();
  const today = bangkokToday();
  const photos = await getPhotoUrls([member.photo_url]);

  return (
    <div className="space-y-6">
      <Link href="/members" className="text-sm text-indigo-700 hover:underline">
        ← กลับไปรายชื่อ
      </Link>
      <PhotoUpload memberId={member.id} name={member.name} photoUrl={member.photo_url ? (photos[member.photo_url] ?? null) : null} />
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">{member.name}</h1>
        {!member.active && <span className="rounded bg-slate-200 px-2 py-0.5 text-sm text-slate-600">ปิดใช้งาน</span>}
        {member.active && (
          <Link href={`/sell?member=${member.id}`} className="btn-primary">
            ขายแพ็กเกจ
          </Link>
        )}
        <Link href={`/members/${member.id}/card`} className="btn">
          บัตรสมาชิก
        </Link>
        {member.active && memberships.some((m) => m.kind === "pt" && ["active", "upcoming", "frozen"].includes(m.state)) && (
          <Link href={`/pt?member=${member.id}`} className="btn">
            นัด PT
          </Link>
        )}
      </div>
      <p className="text-slate-600">
        รหัสสมาชิก{" "}
        <span data-testid="member-code" className="font-mono text-lg font-semibold text-slate-900">
          {member.member_code}
        </span>
      </p>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">แพ็กเกจ</h2>
        {memberships.length === 0 ? (
          <p className="text-slate-500">ยังไม่มีแพ็กเกจ</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {memberships.map((m) => (
              <li key={m.id} data-testid="membership-row" className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">{m.package_name}</p>
                  <p className="text-sm text-slate-500">
                    {formatThaiDate(m.start_date)} – {formatThaiDate(m.end_date)}
                    {m.kind === "visits" && ` · เหลือ ${m.visits_left} ครั้ง`}
                    {m.kind === "pt" && ` · เหลือ ${m.pt_left} ชั่วโมง`}
                  </p>
                </div>
                <span className={`rounded px-2 py-0.5 text-sm ${STATE_STYLES[m.state]}`}>{MEMBERSHIP_STATE_LABELS[m.state]}</span>
                {m.kind !== "day" && m.state !== "cancelled" && (m.freezes.length > 0 || ["active", "frozen", "upcoming"].includes(m.state)) && (
                  <FreezeControls
                    membershipId={m.id}
                    freezes={m.freezes}
                    canFreeze={["active", "frozen", "upcoming"].includes(m.state)}
                    today={today}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

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
