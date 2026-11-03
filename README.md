# GYMDOOD POS

ระบบขายหน้าร้านและจัดการสมาชิกสำหรับยิม (Next.js + Supabase)

- สเปก: [docs/superpowers/specs/2026-11-03-gym-pos-design.md](docs/superpowers/specs/2026-11-03-gym-pos-design.md)
- แผนงาน: [docs/superpowers/plans/](docs/superpowers/plans/)

## รันในเครื่อง

ต้องมี Node.js 22 ขึ้นไป และ Docker Desktop

1. เปิด Docker Desktop ให้ทำงาน
2. ติดตั้งแพ็กเกจ

   ```bash
   npm install
   ```

3. เปิด Supabase ในเครื่อง ครั้งแรกจะโหลด image นานหน่อย

   ```bash
   npx supabase start
   ```

4. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าที่ `npx supabase status` แสดง
   - `NEXT_PUBLIC_SUPABASE_URL` ← API URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← anon key
   - `SUPABASE_SERVICE_ROLE_KEY` ← service_role key (ห้ามเปิดเผย ใช้เฉพาะฝั่ง server)
5. สร้างฐานข้อมูลพร้อมข้อมูลตัวอย่าง

   ```bash
   npm run db:reset
   ```

6. เปิดเว็บ แล้วเข้า http://localhost:3000

   ```bash
   npm run dev
   ```

บัญชีทดสอบ (เจ้าของและพนักงาน) อยู่ในหัวไฟล์ [supabase/seed.sql](supabase/seed.sql) ใช้ได้เฉพาะฐานข้อมูลในเครื่องเท่านั้น

## ทดสอบ

| คำสั่ง | ทดสอบอะไร |
|---|---|
| `npm test` | ตรวจข้อมูลที่กรอก (Vitest) |
| `npm run test:db` | สิทธิ์และกติกาในฐานข้อมูล (pgTAP) |
| `npm run test:e2e` | ใช้งานผ่านเบราว์เซอร์จริง (Playwright) ต้องเปิด Supabase ไว้ |
