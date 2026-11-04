# คู่มือขึ้นระบบจริง (Supabase Cloud + Vercel)

ทำครั้งเดียวตอนเริ่มใช้งานจริง ใช้เวลาประมาณ 30–45 นาที ทุกอย่างใช้แบบฟรีได้

> **กฎสำคัญ**
> - ห้ามรัน `npx supabase db reset` หรือ `supabase/seed.sql` กับระบบจริง (มีบัญชีทดสอบและจะลบข้อมูลทั้งหมด)
> - กุญแจ (key) และรหัสผ่านจริง ห้ามใส่ลงไฟล์ที่ git เก็บ และห้ามส่งในแชต — ใส่เองใน Vercel และในไฟล์ `.env.production.local` บนเครื่องคุณเท่านั้น

## ค่าใช้จ่ายและข้อควรรู้

| บริการ | แผน | ข้อจำกัดที่ควรรู้ |
|---|---|---|
| Supabase | Free | ฐานข้อมูล 500 MB, ไฟล์รูป 1 GB (สมาชิก 200 คนใช้ไม่ถึง); **หยุดโปรเจกต์ถ้าไม่มีใครใช้ 7 วัน** (ยิมที่เปิดทุกวันไม่โดน กดเปิดใหม่ได้ใน Dashboard); **ไม่มีไฟล์ backup ให้ดาวน์โหลด** — ทำเองตาม "สำรองข้อมูล" ด้านล่าง |
| Vercel | Hobby | ฟรีสำหรับใช้ส่วนตัว/ร้านเดียว ทุกครั้งที่ push ขึ้น `main` จะอัปเดตเว็บให้อัตโนมัติ |

## ขั้นที่ 1: สร้างโปรเจกต์ Supabase

1. เข้า https://supabase.com → **Start your project** → ล็อกอินด้วย GitHub
2. **New project**
   - Name: `gymdood`
   - Database Password: กด **Generate** แล้ว **จดเก็บไว้ในที่ปลอดภัย** (ต้องใช้ในขั้นที่ 3)
   - Region: **Southeast Asia (Singapore)**
3. รอสร้างเสร็จ (1–2 นาที) แล้วไปที่ **Project Settings → API** จดค่าเหล่านี้:
   - **Project URL** (เช่น `https://abcd1234.supabase.co`)
   - **anon public** key
   - **service_role** key (ห้ามให้ใครเห็น)
   - **Project ref** = ตัวอักษรหน้า `.supabase.co` (เช่น `abcd1234`)

## ขั้นที่ 2: ปิดการสมัครสมาชิกเอง

Supabase → **Authentication → Sign In / Providers** (หรือ **Settings**) → ปิด **Allow new users to sign up** → Save

ระบบนี้ให้เจ้าของเป็นคนสร้างบัญชีพนักงานเท่านั้น

## ขั้นที่ 3: สร้างตารางในฐานข้อมูลจริง

เปิด terminal ที่โฟลเดอร์โปรเจกต์ แล้วรันทีละคำสั่ง:

```bash
npx supabase login
```

(เบราว์เซอร์จะเปิดให้ยืนยันตัวตน)

```bash
npx supabase link --project-ref <Project ref>
```

(ถามรหัสผ่านฐานข้อมูล ใส่ค่าที่จดไว้ในขั้นที่ 1)

```bash
npx supabase db push --remote
```

ตรวจว่าบรรทัด `Target:` เป็นชื่อโปรเจกต์ของคุณ (ไม่ใช่ `local stack`) แล้วตอบ `Y` เมื่อถามยืนยัน ระบบจะสร้างตาราง ฟังก์ชัน สิทธิ์ และที่เก็บรูปสมาชิกให้ทั้งหมด

## ขั้นที่ 4: สร้างบัญชีเจ้าของคนแรก

1. สร้างไฟล์ `.env.production.local` ที่โฟลเดอร์โปรเจกต์ (git ไม่เก็บไฟล์นี้) ใส่:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<Project URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   ```

2. รัน (เปลี่ยนอีเมลและชื่อเป็นของคุณ):

   ```bash
   node scripts/create-owner.mjs --env .env.production.local --email you@example.com --name "ชื่อเจ้าของ"
   ```

   ระบบจะถามรหัสผ่าน (พิมพ์แล้วจะไม่แสดงบนจอ อย่างน้อย 10 ตัวอักษร) ถ้าสำเร็จจะขึ้น `สร้างบัญชีเจ้าของเรียบร้อย`

## ขั้นที่ 5: Deploy ขึ้น Vercel

1. เข้า https://vercel.com → ล็อกอินด้วย GitHub
2. **Add New… → Project** → เลือก repo **GYMDOOD** → **Import**
3. เปิด **Environment Variables** ใส่ 3 ตัว (ค่าเดียวกับไฟล์ในขั้นที่ 4):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. กด **Deploy** รอ 2–3 นาที จะได้ลิงก์ เช่น `https://gymdood.vercel.app`

## ขั้นที่ 6: ตั้งค่าร้านในระบบจริง

เปิดลิงก์ Vercel → ล็อกอินด้วยบัญชีเจ้าของ → เมนู **ตั้งค่า**:

1. **ข้อมูลร้าน**: ชื่อยิม ที่อยู่ เบอร์ **เลข PromptPay** และข้อความท้ายใบเสร็จ
2. **แพ็กเกจ**: ราคาจริงของยิม
3. **พนักงาน**: สร้างบัญชีพนักงานหน้าเคาน์เตอร์
4. **คลาส** และ **เทรนเนอร์** (ถ้ามี)
5. เมนู **สินค้า**: เพิ่มสินค้า แล้วกด **รับเข้า** ตามจำนวนที่มีจริง

จากนั้นทำตาม [เช็กลิสต์ทดสอบบนแท็บเล็ต](tablet-test.md)

## สำรองข้อมูล (แนะนำทุกสัปดาห์)

ต้องเปิด **Docker Desktop** ไว้ก่อน แล้วรันที่โฟลเดอร์โปรเจกต์ (เปลี่ยนวันที่ในชื่อไฟล์):

```bash
npx supabase db dump --remote --data-only -f backups/backup-2026-11-04.sql
```

- ไฟล์อยู่ในโฟลเดอร์ `backups/` ซึ่ง git ไม่เก็บ (ไฟล์นี้มีข้อมูลสมาชิกและบัญชีผู้ใช้ **ห้ามส่งขึ้น GitHub หรือส่งในแชต**) แล้วคัดลอกไปเก็บไว้อีกที่ เช่น Google Drive ส่วนตัว
- ไฟล์มีข้อมูลทุกตาราง รวมบัญชีล็อกอิน แต่ **ไม่มีไฟล์รูปสมาชิก** — ดาวน์โหลดรูปเองได้จาก Supabase → Storage → `member-photos`

## กู้คืนข้อมูลจากไฟล์สำรอง

ใช้เมื่อฐานข้อมูลเสียหรือต้องย้ายไปโปรเจกต์ใหม่ (ทดสอบขั้นตอนนี้แล้วกับฐานข้อมูลในเครื่อง)

1. สร้างโปรเจกต์ Supabase **ใหม่ที่ว่างเปล่า** แล้วทำขั้นที่ 1–3 (ห้ามทำขั้นที่ 4 เพราะบัญชีเจ้าของมาจากไฟล์สำรองอยู่แล้ว)
2. Supabase → **Connect** → **Session pooler** → คัดลอก Connection string (ใส่รหัสผ่านฐานข้อมูลแทน `[YOUR-PASSWORD]`)
3. เปิด Docker Desktop แล้วรันใน **PowerShell** ที่โฟลเดอร์โปรเจกต์ (เปลี่ยน `<connection string>` และชื่อไฟล์):

   ```powershell
   docker run --rm -v "${PWD}:/work" postgres:17 psql "<connection string>" -v ON_ERROR_STOP=1 --single-transaction -f /work/supabase/restore/prepare.sql -f /work/backups/backup-2026-11-04.sql
   ```

   ถ้ามี error ระบบจะยกเลิกทั้งหมด ไม่มีข้อมูลครึ่ง ๆ กลาง ๆ
4. เปลี่ยนค่า Environment Variables ใน Vercel เป็นของโปรเจกต์ใหม่ แล้ว **Redeploy**
5. อัปโหลดรูปสมาชิกกลับเข้า Storage → `member-photos` (ชื่อไฟล์เดิม)

## อัปเดตระบบในอนาคต

- โค้ด: push ขึ้น `main` แล้ว Vercel อัปเดตเว็บให้เอง
- ถ้ามี migration ใหม่ในโฟลเดอร์ `supabase/migrations`: รัน `npx supabase db push --remote` **ก่อน** push โค้ด
