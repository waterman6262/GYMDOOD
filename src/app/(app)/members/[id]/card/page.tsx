import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getMember } from "@/lib/members/queries";
import { createClient } from "@/lib/supabase/server";
import { CardActions } from "./card-actions";

export default async function MemberCardPage({ params }: PageProps<"/members/[id]/card">) {
  const { id } = await params;
  const member = await getMember(id);
  if (!member) notFound();

  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("gym_name").eq("id", 1).single();
  const gymName = settings?.gym_name ?? "";
  const qrSvg = await QRCode.toString(member.member_code, { type: "svg", margin: 1 });

  return (
    <div className="space-y-6">
      <Link href={`/members/${member.id}`} className="no-print text-sm text-indigo-700 hover:underline">
        ← กลับไปหน้าสมาชิก
      </Link>
      <article className="member-card mx-auto flex aspect-[85.6/54] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow ring-1 ring-slate-200">
        <header className="bg-indigo-600 px-5 py-3 text-lg font-bold text-white">{gymName || "บัตรสมาชิก"}</header>
        <div className="flex flex-1 items-center justify-between gap-4 p-5">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-xl font-bold">{member.name}</p>
            <p className="font-mono text-lg text-slate-600">{member.member_code}</p>
          </div>
          <div data-testid="member-qr" className="size-32 shrink-0" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </div>
      </article>
      <CardActions gymName={gymName} name={member.name} code={member.member_code} />
    </div>
  );
}
