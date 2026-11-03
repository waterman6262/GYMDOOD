import { createMember } from "../actions";
import { MemberForm } from "../member-form";

export default function NewMemberPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">เพิ่มสมาชิก</h1>
      <MemberForm action={createMember} />
    </div>
  );
}
