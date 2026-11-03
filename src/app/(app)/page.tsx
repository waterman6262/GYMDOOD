import Link from "next/link";
import { getCurrentStaff } from "@/lib/auth";

// Temporary home screen; becomes the check-in screen in Plan 3.
export default async function HomePage() {
  const staff = await getCurrentStaff();

  return (
    <div className="card max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">สวัสดี {staff?.name}</h1>
      <p className="text-slate-600">หน้าเช็กอินจะมาในเวอร์ชันถัดไป ตอนนี้จัดการสมาชิกได้แล้ว</p>
      <Link href="/members" className="btn-primary">
        ไปหน้าสมาชิก
      </Link>
    </div>
  );
}
