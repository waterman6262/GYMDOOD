# Gym POS — Plan 1: Foundation (โปรเจกต์ + ล็อกอิน + สิทธิ์ + สมาชิก + แบบแพ็กเกจ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างโครงโปรเจกต์ที่ล็อกอินได้ แยกสิทธิ์เจ้าของ/พนักงาน และจัดการสมาชิก แบบแพ็กเกจ บัญชีพนักงาน และข้อมูลร้านได้ (ขั้นที่ 1 ของสเปกข้อ 10)

**Architecture:** Next.js App Router (TypeScript) คุยกับ Supabase โดยตรงผ่าน `@supabase/ssr` สิทธิ์ทั้งหมดบังคับด้วย Row Level Security ในไฟล์ migration การสร้างบัญชีพนักงานใช้ service role key ใน server action เท่านั้น พัฒนาด้วย Supabase local (Docker) และทดสอบฐานข้อมูลด้วย pgTAP

**Tech Stack:** Next.js (latest, App Router) · TypeScript · Tailwind CSS · Supabase (`supabase` CLI ผ่าน npx, `@supabase/supabase-js`, `@supabase/ssr`) · zod · Vitest · Playwright · pgTAP

**Spec:** `docs/superpowers/specs/2026-11-03-gym-pos-design.md`

**แผนทั้งหมด** (แต่ละแผนได้ซอฟต์แวร์ที่ใช้งานได้จริง และเขียนแผนถัดไปหลังแผนก่อนหน้าเสร็จ):
1. **Foundation** ← แผนนี้
2. ขาย + ใบเสร็จ + ยกเลิกบิล
3. เช็กอิน QR + บัตร QR + พักสมาชิก
4. สินค้าและสต็อก
5. คลาสและ PT
6. รายงาน
7. PWA + deploy Vercel + ทดสอบบนแท็บเล็ต

## Global Constraints

- ข้อความทุกอย่างบนหน้าจอและข้อความผิดพลาดเป็นภาษาไทย
- เขตเวลา `Asia/Bangkok` สำหรับทุกการคำนวณวัน และสกุลเงินบาทเก็บเป็น `numeric(10,2)`
- บทบาทมีแค่ `owner` และ `staff` ไม่มีหน้าสมัครสมาชิกเอง บัญชีพนักงานสร้างโดยเจ้าของเท่านั้น
- สิทธิ์บังคับที่ฐานข้อมูล (RLS) เสมอ การซ่อนปุ่มในหน้าจอเป็นแค่ความสะดวก ไม่ใช่การป้องกัน
- `SUPABASE_SERVICE_ROLE_KEY` ใช้ได้เฉพาะโค้ดฝั่ง server (`src/lib/supabase/admin.ts`) ห้ามมี prefix `NEXT_PUBLIC_`
- สมาชิกที่มีประวัติห้ามลบ ใช้ `active = false` แทน
- ออกแบบสำหรับแท็บเล็ตแนวนอน ปุ่มสูงอย่างน้อย 44px และใช้บนมือถือได้
- `package_types.kind` ∈ `day | duration | visits | pt`, `seats` ∈ `1 | 2`, `day` มี `duration_days = 1`

## Review Focus

1. พนักงาน (ไม่ใช่เจ้าของ) เรียก API ของ Supabase ตรง ๆ เพื่อแก้ราคาแพ็กเกจหรือตั้งตัวเองเป็นเจ้าของ → ต้องถูกปฏิเสธ (Task 2)
2. บัญชีพนักงานที่ถูกปิดใช้งาน (`active = false`) แต่ยังมี session ค้างอยู่ → อ่าน/เขียนข้อมูลไม่ได้ และถูกส่งกลับหน้าล็อกอิน (Task 2, Task 4)
3. ค้นชื่อไทยบางส่วน เช่น "สม" หรือค้นเบอร์ที่พิมพ์มีขีด `081-234-5678` → ต้องเจอสมาชิก (Task 5)
4. สมาชิกสองคนใช้เบอร์เดียวกัน (พ่อแม่ลูก) → บันทึกได้และค้นเจอทั้งคู่ (Task 5)
5. แบบแพ็กเกจที่ค่าไม่เข้ากับชนิด เช่น `visits` ที่ไม่มีจำนวนครั้ง หรือราคาติดลบ → ถูกปฏิเสธทั้งที่หน้าจอและที่ฐานข้อมูล (Task 2, Task 6)

---

## File Structure

```
supabase/
  config.toml                         # สร้างโดย supabase init
  migrations/20261103000001_foundation.sql   # ตาราง, helper functions, RLS
  seed.sql                            # บัญชีเจ้าของสำหรับ dev + ข้อมูลตัวอย่าง
  tests/foundation_test.sql           # pgTAP
src/
  lib/supabase/client.ts              # browser client
  lib/supabase/server.ts              # server client (cookies)
  lib/supabase/admin.ts               # service role client (server only)
  lib/auth.ts                         # getCurrentStaff, requireOwner
  lib/phone.ts                        # normalizePhone
  lib/members/schema.ts               # memberSchema (zod)
  lib/packages/schema.ts              # packageTypeSchema (zod)
  middleware.ts                       # refresh session + redirect /login
  app/login/page.tsx, app/login/actions.ts
  app/(app)/layout.tsx                # แถบเมนูตามสิทธิ์ + ปุ่มออกจากระบบ
  app/(app)/page.tsx                  # หน้าแรกชั่วคราว (จะเป็นหน้าเช็กอินใน Plan 3)
  app/(app)/members/page.tsx          # รายชื่อ + ค้นหา
  app/(app)/members/new/page.tsx
  app/(app)/members/[id]/page.tsx     # แก้ไข / ปิดการใช้งาน
  app/(app)/members/actions.ts
  app/(app)/settings/packages/page.tsx, actions.ts
  app/(app)/settings/staff/page.tsx, actions.ts
  app/(app)/settings/shop/page.tsx, actions.ts
tests/
  unit/phone.test.ts
  unit/member-schema.test.ts
  unit/package-schema.test.ts
  e2e/foundation.spec.ts
.env.example
```

---

### Task 1: ตั้งโปรเจกต์และ Supabase local

**Files:**
- Create: โปรเจกต์ Next.js ที่ root, `supabase/config.toml`, `.env.example`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore` (รวม `.env.local`)

**Interfaces:**
- Produces: สคริปต์ `npm run dev`, `npm run test` (vitest), `npm run test:e2e` (playwright), `npm run test:db` (`supabase test db`), `npm run db:reset` (`supabase db reset`)

- [ ] **Step 1:** `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (โฟลเดอร์มี `docs/` อยู่แล้ว ถ้าตัวติดตั้งไม่ยอม ให้สร้างในโฟลเดอร์ชั่วคราวแล้วย้ายไฟล์เข้ามา)
- [ ] **Step 2:** `npm i @supabase/supabase-js @supabase/ssr zod` และ `npm i -D supabase vitest @vitejs/plugin-react @playwright/test`
- [ ] **Step 3:** `npx supabase init` แล้ว `npx supabase start` (ต้องเปิด Docker Desktop) จดค่า API URL, anon key, service role key ลง `.env.local` ด้วยชื่อ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` และใส่ชื่อตัวแปร (ไม่ใส่ค่า) ลง `.env.example`
- [ ] **Step 4:** เพิ่มสคริปต์ใน `package.json` ตาม Interfaces และตั้ง `vitest.config.ts` ให้รันเฉพาะ `tests/unit/**` และ `playwright.config.ts` ให้รัน `tests/e2e/**` กับ `http://localhost:3000` (`webServer: npm run dev`)
- [ ] **Step 5:** ตั้ง `<html lang="th">` และฟอนต์ที่รองรับภาษาไทย (`next/font/google` → `Noto_Sans_Thai`) ใน `src/app/layout.tsx`
- [ ] **Step 6: Verify** `npm run dev` แล้วเปิด http://localhost:3000 ขึ้นหน้าเริ่มต้นของ Next.js, `npm run test` ผ่าน (ยังไม่มีเทสต์ให้ใช้ `--passWithNoTests`)
- [ ] **Step 7: Commit** `chore: scaffold Next.js + Supabase local`

### Task 2: Schema, helper functions และ RLS

**Files:**
- Create: `supabase/migrations/20261103000001_foundation.sql`, `supabase/tests/foundation_test.sql`, `supabase/seed.sql`

**Interfaces:**
- Produces (ตาราง ตามสเปกข้อ 5):
  - `staff(id uuid pk, user_id uuid unique references auth.users, name text, role text check in ('owner','staff'), active bool default true, created_at)`
  - `members(id, member_code text unique default upper(substr(md5(gen_random_uuid()::text),1,8)), name text not null, phone text, phone_digits text generated always as (regexp_replace(coalesce(phone,''),'\D','','g')) stored, line_id, photo_url, note, active bool default true, created_at, created_by uuid references staff)`
  - `package_types(id, name, kind, price numeric(10,2) check >= 0, duration_days int, visits int, pt_sessions int, seats int default 1 check in (1,2), tag text, active bool default true, created_at)` พร้อม check constraint ตามชนิด: `day` → `duration_days = 1`; `duration` → `duration_days > 0`; `visits` → `visits > 0 and duration_days > 0`; `pt` → `pt_sessions > 0 and duration_days > 0`
  - `settings(id int primary key default 1 check (id = 1), gym_name, address, phone, promptpay_id, receipt_footer)` พร้อมแถวเริ่มต้น 1 แถว
  - SQL functions (`security definer`, `stable`): `public.current_staff_id() returns uuid`, `public.is_staff() returns bool` (มีแถว staff ที่ `active`), `public.is_owner() returns bool` (`active` และ `role = 'owner'`)
- RLS:
  - `staff`: select ถ้า `is_staff()`, insert/update/delete ถ้า `is_owner()`
  - `members`: select/insert/update ถ้า `is_staff()`, ไม่มี policy delete
  - `package_types`, `settings`: select ถ้า `is_staff()`, เขียนได้ถ้า `is_owner()`

- [ ] **Step 1: เขียน pgTAP ที่ล้มเหลวก่อน** ใน `supabase/tests/foundation_test.sql` สร้างผู้ใช้ทดสอบ 3 คนใน `auth.users` (owner, staff, staff ที่ `active = false`) แล้วสลับตัวตนด้วย `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>"}'` เทสต์:
  - `staff_can_read_members`: staff `select` members ได้
  - `staff_cannot_update_package_price`: staff update `package_types.price` แล้วได้ 0 แถว
  - `staff_cannot_promote_self`: staff update `staff.role = 'owner'` ของตัวเองแล้วได้ 0 แถว
  - `inactive_staff_sees_nothing`: staff ที่ปิดใช้งาน select members ได้ 0 แถว
  - `nobody_can_delete_member`: owner delete members แล้วได้ 0 แถว
  - `visits_package_requires_visits`: insert `kind='visits'` โดย `visits` เป็น null → `throws_ok` ด้วย check_violation (`23514`)
  - `negative_price_rejected`: insert `price = -1` → `throws_ok` `23514`
  - `member_code_generated`: insert member โดยไม่ระบุ code → `member_code` ยาว 8 ตัว
  - `phone_digits_strips_dashes`: phone `081-234-5678` → `phone_digits = '0812345678'`
- [ ] **Step 2: Run** `npm run test:db` → FAIL (ยังไม่มีตาราง)
- [ ] **Step 3:** เขียน migration ตาม Interfaces และเปิด `alter table ... enable row level security` ทุกตาราง
- [ ] **Step 4:** เขียน `seed.sql`: ผู้ใช้เจ้าของ `owner@gym.test` และพนักงาน `staff@gym.test` (สร้างใน `auth.users` + `auth.identities` ด้วยรหัสผ่านทดสอบที่เขียนไว้ในไฟล์นี้ไฟล์เดียว), แบบแพ็กเกจตัวอย่าง 6 แบบ (รายวัน 100, รายเดือน 1,200, รายปี 9,900, 10 ครั้ง/60 วัน 900, PT 10 ชั่วโมง/90 วัน 6,000, คู่รายเดือน 2,000 seats=2) และสมาชิกตัวอย่าง 5 คน (2 คนเบอร์เดียวกัน)
- [ ] **Step 5: Run** `npm run db:reset && npm run test:db` → PASS ทุกเทสต์
- [ ] **Step 6: Commit** `feat(db): foundation schema with RLS`

### Task 3: Phone normalize และ zod schemas

**Files:**
- Create: `src/lib/phone.ts`, `src/lib/members/schema.ts`, `src/lib/packages/schema.ts`
- Test: `tests/unit/phone.test.ts`, `tests/unit/member-schema.test.ts`, `tests/unit/package-schema.test.ts`

**Interfaces:**
- Produces:
  - `normalizePhone(input: string): string` คืนเฉพาะตัวเลข
  - `memberSchema: z.ZodType<MemberInput>` โดย `MemberInput = { name: string; phone?: string; line_id?: string; note?: string }`
  - `packageTypeSchema: z.ZodType<PackageTypeInput>` (discriminated union ตาม `kind`) โดย `PackageTypeInput = { name: string; kind: 'day'|'duration'|'visits'|'pt'; price: number; duration_days: number; visits?: number; pt_sessions?: number; seats: 1|2; tag?: string }`

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**
  - `normalizePhone('081-234-5678') === '0812345678'`, `normalizePhone(' 081 234 5678 ') === '0812345678'`
  - `memberSchema`: ชื่อว่าง (`'  '`) → error ข้อความ `'กรุณากรอกชื่อ'`; phone `'0812345678'` ผ่าน; phone `'12345'` → error `'เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0'`; ไม่ใส่ phone ผ่าน
  - `packageTypeSchema`: `{kind:'visits', visits: undefined}` → error `'กรุณาระบุจำนวนครั้ง'`; `{kind:'pt', pt_sessions: 0}` → error `'กรุณาระบุจำนวนชั่วโมง PT'`; `price: -1` → error `'ราคาต้องไม่ติดลบ'`; `{kind:'day'}` → parse ได้ `duration_days === 1` เสมอแม้ส่งค่าอื่นมา
- [ ] **Step 2: Run** `npm run test` → FAIL
- [ ] **Step 3:** เขียนโค้ดตาม Interfaces (phone ตรวจหลัง normalize ด้วย `/^0\d{8,9}$/`)
- [ ] **Step 4: Run** `npm run test` → PASS
- [ ] **Step 5: Commit** `feat: input validation for members and package types`

### Task 4: ล็อกอิน, session และเมนูตามสิทธิ์

**Files:**
- Create: `src/lib/supabase/{client,server,admin}.ts`, `src/lib/auth.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`
- Test: `tests/e2e/foundation.spec.ts`

**Interfaces:**
- Consumes: ตาราง `staff`, ฟังก์ชัน `is_owner()` จาก Task 2
- Produces:
  - `createClient()` ใน `server.ts` (สำหรับ Server Components / actions) และ `client.ts` (browser) ตามรูปแบบของ `@supabase/ssr`
  - `createAdminClient()` ใน `admin.ts` ขึ้นต้นไฟล์ด้วย `import 'server-only'`
  - `getCurrentStaff(): Promise<{ id: string; name: string; role: 'owner'|'staff' } | null>` คืน null ถ้าไม่ได้ล็อกอินหรือ `active = false`
  - `requireOwner(): Promise<void>` throw ถ้าไม่ใช่เจ้าของ
  - server actions: `signIn(formData)`, `signOut()`

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว**
  - `redirects_to_login`: เปิด `/members` โดยไม่ล็อกอิน → URL เป็น `/login`
  - `wrong_password_shows_thai_error`: ล็อกอินผิด → เห็นข้อความ `อีเมลหรือรหัสผ่านไม่ถูกต้อง`
  - `owner_sees_settings_menu`: ล็อกอิน `owner@gym.test` → เห็นเมนู `ตั้งค่า`
  - `staff_hides_settings_menu`: ล็อกอิน `staff@gym.test` → ไม่เห็นเมนู `ตั้งค่า` และเปิด `/settings/packages` ตรง ๆ แล้วถูกพาไป `/`
- [ ] **Step 2: Run** `npm run test:e2e` → FAIL
- [ ] **Step 3:** เขียนโค้ดตาม Interfaces
  - middleware: refresh session และพาไป `/login` ถ้าไม่มี user (ยกเว้น `/login`)
  - `(app)/layout.tsx`: เรียก `getCurrentStaff()` ถ้าได้ null ให้ `signOut` แล้วพาไป `/login` (ครอบคลุมบัญชีที่ถูกปิดใช้งาน)
  - เมนู: `เช็กอิน`, `ขาย`, `สมาชิก`, `คลาส/PT`, `สินค้า`, `รายงาน` ส่วน `ตั้งค่า` เห็นเฉพาะเจ้าของ เมนูที่ยังไม่มีหน้าให้แสดงเป็นปุ่มปิด (disabled) พร้อมป้าย `เร็ว ๆ นี้`
  - `/settings/*` layout เรียก `getCurrentStaff()` ถ้าไม่ใช่ owner ให้ redirect `/`
- [ ] **Step 4: Run** `npm run test:e2e` → PASS
- [ ] **Step 5: Commit** `feat: login, session guard and role-based menu`

### Task 5: หน้าจัดการสมาชิก

**Files:**
- Create: `src/app/(app)/members/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `actions.ts`
- Modify: `tests/e2e/foundation.spec.ts`

**Interfaces:**
- Consumes: `memberSchema`, `normalizePhone` (Task 3), `createClient`, `getCurrentStaff` (Task 4)
- Produces:
  - `searchMembers(q: string): Promise<Member[]>` ค้นด้วย `name ilike %q%` หรือ `phone_digits like %normalizePhone(q)%` (เฉพาะเมื่อ q มีตัวเลข) หรือ `member_code = upper(q)` เรียงตามชื่อ จำกัด 50 แถว
  - `createMember(input: MemberInput): Promise<{ id: string } | { error: string }>`
  - `updateMember(id: string, input: MemberInput): Promise<{ ok: true } | { error: string }>`
  - `setMemberActive(id: string, active: boolean)` (owner เท่านั้น ตามสเปกข้อ 3)
  - `type Member = { id; member_code; name; phone; line_id; note; active }`

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** (ล็อกอินเป็น staff)
  - `create_member`: เพิ่มสมาชิก `สมชาย ทดสอบ` เบอร์ `081-999-0000` → กลับมาหน้ารายชื่อแล้วเห็นชื่อนี้ และหน้ารายละเอียดแสดง `member_code` 8 ตัว
  - `search_thai_partial`: ค้น `สม` → เห็น `สมชาย ทดสอบ`
  - `search_phone_with_dashes`: ค้น `081-999` → เห็น `สมชาย ทดสอบ`
  - `shared_phone_both_found`: ค้นเบอร์ที่ seed ให้ 2 คนใช้ร่วมกัน → เห็นทั้ง 2 คน
  - `invalid_phone_shows_error`: เบอร์ `12345` → เห็น `เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0` และไม่ได้บันทึก
  - `staff_cannot_deactivate`: หน้ารายละเอียดของ staff ไม่มีปุ่ม `ปิดการใช้งาน` แต่ของ owner มี และกดแล้วสมาชิกหายจากรายชื่อเริ่มต้น (รายชื่อมีตัวกรอง `แสดงที่ปิดใช้งาน`)
- [ ] **Step 2: Run** `npm run test:e2e` → FAIL
- [ ] **Step 3:** เขียนหน้าและ actions ตาม Interfaces ช่องค้นหาค้นอัตโนมัติหลังหยุดพิมพ์ 300ms
- [ ] **Step 4: Run** `npm run test:e2e` → PASS
- [ ] **Step 5: Commit** `feat: member management`

### Task 6: หน้าตั้งค่า (แบบแพ็กเกจ, บัญชีพนักงาน, ข้อมูลร้าน)

**Files:**
- Create: `src/app/(app)/settings/layout.tsx`, `packages/page.tsx`, `packages/actions.ts`, `staff/page.tsx`, `staff/actions.ts`, `shop/page.tsx`, `shop/actions.ts`
- Modify: `tests/e2e/foundation.spec.ts`

**Interfaces:**
- Consumes: `packageTypeSchema` (Task 3), `requireOwner`, `createAdminClient` (Task 4)
- Produces:
  - `savePackageType(input: PackageTypeInput & { id?: string })` และ `setPackageTypeActive(id, active)` (แบบแพ็กเกจที่ปิดแล้วไม่แสดงในหน้าขายของ Plan 2 แต่ประวัติเดิมยังอยู่)
  - `createStaffAccount({ name, email, password, role })`: เรียก `requireOwner()` แล้วใช้ `admin.auth.admin.createUser({ email, password, email_confirm: true })` และ insert `staff` ถ้า insert staff ล้มเหลวให้ลบ auth user ที่เพิ่งสร้าง
  - `setStaffActive(staffId, active)`: ห้ามเจ้าของปิดบัญชีตัวเอง (error `ไม่สามารถปิดบัญชีของตัวเองได้`)
  - `saveShopSettings({ gym_name, address, phone, promptpay_id, receipt_footer })` โดย `promptpay_id` ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก หลัง normalize

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** (ล็อกอินเป็น owner)
  - `create_visits_package`: สร้าง `10 ครั้ง นักเรียน` ชนิดนับครั้ง ราคา 700 ครั้ง 10 ใช้ภายใน 60 วัน ป้าย `นักเรียน` → แสดงในรายการ
  - `form_fields_follow_kind`: เลือกชนิด `รายวัน` → ไม่มีช่องจำนวนวัน, เลือก `PT` → มีช่องจำนวนชั่วโมง
  - `visits_without_count_rejected`: ชนิดนับครั้งโดยไม่ใส่จำนวน → เห็น `กรุณาระบุจำนวนครั้ง`
  - `create_staff_then_login`: สร้างพนักงานใหม่ แล้วออกจากระบบและล็อกอินด้วยบัญชีนั้นได้
  - `deactivated_staff_kicked_out`: owner ปิดบัญชีพนักงานนั้น → พนักงานนั้นล็อกอินแล้วกลับไปหน้า `/login`
  - `owner_cannot_deactivate_self`: เห็น `ไม่สามารถปิดบัญชีของตัวเองได้`
  - `save_shop_settings`: บันทึกชื่อยิมและเลข PromptPay `0812345678` แล้วรีโหลดหน้ายังอยู่, เลข `12345` → error `เลข PromptPay ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก`
- [ ] **Step 2: Run** `npm run test:e2e` → FAIL
- [ ] **Step 3:** เขียนหน้าและ actions ตาม Interfaces
- [ ] **Step 4: Run** `npm run test:e2e && npm run test && npm run test:db` → PASS ทั้งหมด
- [ ] **Step 5: Commit** `feat: owner settings for packages, staff and shop`

### Task 7: ตรวจรวมและส่งมอบ

- [ ] **Step 1:** `npm run build` ผ่านโดยไม่มี error ของ TypeScript หรือ ESLint
- [ ] **Step 2:** ตรวจว่าไม่มี `SUPABASE_SERVICE_ROLE_KEY` ใน bundle ฝั่ง browser: `grep -r "service_role" .next/static` → ไม่พบ
- [ ] **Step 3:** เขียน `README.md` สั้น ๆ: วิธีเปิด Docker, `npx supabase start`, ตั้ง `.env.local`, `npm run dev` และบัญชีทดสอบอยู่ใน `supabase/seed.sql`
- [ ] **Step 4: Commit** `docs: local development guide`
