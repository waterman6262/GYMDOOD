# Gym POS — Plan 7: PWA + Deploy + ทดสอบบนแท็บเล็ต Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ติดตั้งแอปบนแท็บเล็ตได้เหมือนแอปจริง (PWA), เตือนชัดเจนเมื่อเน็ตหลุด (สเปกข้อ 8), แล้วขึ้นใช้งานจริงบน Supabase Cloud + Vercel พร้อมบัญชีเจ้าของบัญชีแรก และทดสอบบนแท็บเล็ตที่ยิม (ขั้นที่ 7 ของสเปกข้อ 10)

**Architecture:** Manifest ผ่าน `src/app/manifest.ts` (file convention ของ Next.js 16) และไอคอน PNG ที่สร้างจาก SVG ด้วย `sharp` (มีอยู่แล้วใน `node_modules` ผ่าน Next.js) — ไม่ทำ service worker/offline cache เพราะสเปกตัดโหมดออฟไลน์ออกจากเวอร์ชัน 1 และ PWA ติดตั้งได้โดยไม่ต้องมี; แถบออฟไลน์ใช้ `navigator.onLine` + event `online`/`offline` ใน Context เดียวทั้งแอป ปุ่มบันทึกสำคัญอ่าน Context นี้; ระบบ production เริ่มจากฐานข้อมูลว่างที่มีแค่ migrations (ไม่รัน `seed.sql`) แล้วสร้างบัญชีเจ้าของคนแรกด้วยสคริปต์

**Tech Stack:** ต่อจากแผน 6 + `sharp` (devDependency แบบระบุชัด เพื่อสคริปต์สร้างไอคอน)

**Spec:** `docs/superpowers/specs/2026-11-03-gym-pos-design.md` (ข้อ 1, 2, 8, 9 ส่วนทดสอบบนแท็บเล็ตจริง, 10 ขั้นที่ 7)

## Global Constraints

- ห้ามรัน `supabase/seed.sql` กับฐานข้อมูล production (มีรหัสผ่านทดสอบ) — production มีแค่ migrations
- กุญแจจริง (`SUPABASE_SERVICE_ROLE_KEY`, รหัสผ่านเจ้าของ) ห้ามอยู่ใน git; เจ้าของเป็นคนใส่เองใน Vercel และใน terminal ของตัวเอง ผู้ช่วยไม่พิมพ์หรือเห็นค่าจริง
- ขั้นที่ต้องสมัคร/ล็อกอินบัญชี (Supabase, Vercel) เจ้าของทำเองตามคู่มือภาษาไทย แผนนี้ **หยุดรอ** ที่จุดนั้น
- แถบออฟไลน์: ข้อความ `ออฟไลน์ — ยังไม่ได้บันทึก` และปุ่ม `ชำระเงิน`/`ได้รับเงินแล้ว`, `ยืนยันปล่อยเข้า`, การเช็กอิน, `บันทึก*` ในฟอร์มหลัก ถูกปิดระหว่างออฟไลน์
- ข้อความภาษาไทย

## Review Focus

1. เน็ตหลุดระหว่างกดชำระเงิน → ปุ่มถูกปิดก่อนส่ง และถ้าหลุดหลังส่งไปแล้ว ข้อความ error เดิมยังขึ้น ไม่แสดงว่าสำเร็จ (Task 2)
2. เปิดแอปครั้งแรกตอนออฟไลน์ / กลับมาออนไลน์ → แถบหายเองโดยไม่ต้องรีเฟรช (Task 2: `banner_hides_when_back_online`)
3. สคริปต์สร้างเจ้าของถูกรันซ้ำด้วยอีเมลเดิม → ไม่สร้างบัญชีซ้ำ และบอกชัดว่ามีแล้ว (Task 3)
4. Header ความปลอดภัยต้องไม่บล็อกกล้อง (สแกน QR, ถ่ายรูปสมาชิก) และไม่บล็อกการเรียก Supabase (Task 3: `camera_allowed_by_permissions_policy`)
5. Production build ต้องไม่มี service role key หรือรหัสผ่านทดสอบหลุดไปฝั่ง browser (Task 3)

---

## File Structure

```
src/app/manifest.ts                      # web app manifest
src/app/layout.tsx                       # viewport/theme color, apple-touch-icon, apple web app meta
public/icons/icon.svg                    # ต้นแบบไอคอน
public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
scripts/make-icons.mjs                   # สร้าง PNG จาก SVG ด้วย sharp
src/components/online-status.tsx         # OnlineProvider, useOnline(), OfflineBanner
src/app/(app)/layout.tsx                 # ใส่ OnlineProvider + OfflineBanner
next.config.ts                           # security headers
scripts/create-owner.mjs                 # สร้างบัญชีเจ้าของคนแรกบน production
docs/deploy.md                           # คู่มือขึ้นระบบจริง (ภาษาไทย ทีละขั้น)
docs/tablet-test.md                      # เช็กลิสต์ทดสอบบนแท็บเล็ตจริง
tests/e2e/pwa.spec.ts, tests/e2e/offline.spec.ts, tests/e2e/create-owner.spec.ts
```

---

### Task 1: Manifest และไอคอน

**Files:**
- Create: `src/app/manifest.ts`, `public/icons/icon.svg`, `scripts/make-icons.mjs`, PNG ทั้ง 4 ไฟล์, `tests/e2e/pwa.spec.ts`
- Modify: `src/app/layout.tsx`, `package.json` (`"icons": "node scripts/make-icons.mjs"`, devDependency `sharp`)

**Interfaces:**
- Produces: manifest `{ name: "GYMDOOD POS", short_name: "GYMDOOD", start_url: "/", display: "standalone", orientation: "any", background_color: "#f8fafc", theme_color: "#4f46e5", lang: "th", icons: [192 any, 512 any, 512 maskable] }`; layout `export const viewport = { themeColor: "#4f46e5" }` และ metadata `appleWebApp: { capable: true, title: "GYMDOOD", statusBarStyle: "default" }`, `icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" }`
- ไอคอน: พื้นสี่เหลี่ยมมุมมน `#4f46e5` ตัวอักษร/รูปดัมเบลสีขาว (SVG วาดเอง ไม่ใช้โลโก้ของใคร); maskable มีขอบปลอดภัย 10%

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** `tests/e2e/pwa.spec.ts`: `manifest_served` (GET `/manifest.webmanifest` → 200, `display = "standalone"`, `start_url = "/"`, มีไอคอน 192 และ 512), `icons_served` (ทุก `src` ใน manifest และ `/icons/apple-touch-icon.png` → 200 และ content-type `image/png`), `login_page_links_manifest` (หน้า `/login` มี `<link rel="manifest">` และ `<meta name="theme-color" content="#4f46e5">`), `manifest_public_without_login` (เปิดได้โดยไม่ล็อกอิน — proxy ต้องไม่ redirect)
- [ ] **Step 2: Run** `npx playwright test tests/e2e/pwa.spec.ts` → FAIL
- [ ] **Step 3:** เขียน SVG, สคริปต์, รัน `npm run icons`, เขียน manifest และแก้ layout; แก้ matcher ใน `src/proxy.ts` ให้ข้าม `manifest.webmanifest` และ `/icons/`
- [ ] **Step 4: Run** `npx playwright test` → PASS ทั้งหมด
- [ ] **Step 5: Commit** `feat: installable PWA manifest and icons`

### Task 2: แถบออฟไลน์และปิดปุ่มบันทึกเมื่อเน็ตหลุด

**Files:**
- Create: `src/components/online-status.tsx`, `tests/e2e/offline.spec.ts`
- Modify: `src/app/(app)/layout.tsx`, `src/app/(app)/sell/sell-screen.tsx`, `src/app/(app)/checkin/check-in-screen.tsx`, `src/app/(app)/classes/[id]/roster.tsx`, `src/app/(app)/pt/pt-forms.tsx`, `src/app/(app)/sales/[id]/void-form.tsx`

**Interfaces:**
- Produces:
  - `OnlineProvider` (client) ให้ค่าเริ่มต้น `true` ตอน render ฝั่ง server แล้วอ่าน `navigator.onLine` หลัง mount และฟัง `online`/`offline` (ใช้ `useSyncExternalStore` ไม่ใช้ setState ใน effect)
  - `useOnline(): boolean`
  - `<OfflineBanner />`: แถบสีแดงติดบนสุด `role="status"` ข้อความ `ออฟไลน์ — ยังไม่ได้บันทึก` และบรรทัดรอง `ตรวจ Wi-Fi หรือเน็ตมือถือ ระบบจะใช้งานได้เองเมื่อกลับมาออนไลน์`
  - ปุ่มที่บันทึกข้อมูลในหน้าขาย, เช็กอิน (ช่องค้นยังพิมพ์ได้แต่ Enter/ปุ่มไม่ส่ง และแสดง `ออฟไลน์อยู่ ยังเช็กอินไม่ได้`), ปล่อยเข้า, จอง/เช็กชื่อคลาส, นัด/ปิด PT, ยกเลิกบิล → `disabled` เมื่อ `!online`

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** `tests/e2e/offline.spec.ts` (ใช้ `context.setOffline(true/false)` หลังหน้าโหลดแล้ว):
  - `banner_shows_when_offline`: staff เปิด `/sell` → offline → เห็น `ออฟไลน์ — ยังไม่ได้บันทึก`
  - `pay_disabled_offline`: เพิ่ม `น้ำดื่ม` + `เงินสด` → offline → ปุ่ม `ชำระเงิน` disabled
  - `banner_hides_when_back_online`: offline → online → แถบหาย และปุ่ม `ชำระเงิน` กดได้
  - `checkin_blocked_offline`: หน้า `/` → offline → พิมพ์ `A1000002` + Enter → เห็น `ออฟไลน์อยู่ ยังเช็กอินไม่ได้` และไม่มี `checkin-result`
- [ ] **Step 2: Run** `npx playwright test tests/e2e/offline.spec.ts` → FAIL
- [ ] **Step 3:** เขียนโค้ดตาม Interfaces
- [ ] **Step 4: Run** `npx playwright test` → PASS ทั้งหมด
- [ ] **Step 5: Commit** `feat: offline banner and disabled saves while offline`

### Task 3: Header ความปลอดภัย และสคริปต์สร้างเจ้าของคนแรก

**Files:**
- Create: `scripts/create-owner.mjs`, `tests/e2e/create-owner.spec.ts`
- Modify: `next.config.ts`, `tests/e2e/pwa.spec.ts`

**Interfaces:**
- Produces:
  - `headers()` ใน `next.config.ts` สำหรับทุก path: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`
  - `node scripts/create-owner.mjs --email <อีเมล> --name <ชื่อ>`: อ่าน `NEXT_PUBLIC_SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` จาก environment (หรือไฟล์ที่ระบุด้วย `--env <path>`), ถามรหัสผ่านทาง stdin แบบไม่แสดงตัวอักษร (หรือรับจาก `OWNER_PASSWORD` เพื่อใช้ในเทสต์), รหัสผ่านต้องยาว ≥ 10 ตัว; ถ้าอีเมลนี้มีบัญชีแล้ว พิมพ์ `มีบัญชีนี้อยู่แล้ว ไม่ได้สร้างซ้ำ` และ exit code 1; สำเร็จพิมพ์ `สร้างบัญชีเจ้าของเรียบร้อย: <อีเมล>`; ถ้าสร้าง staff row ไม่สำเร็จให้ลบ auth user ที่เพิ่งสร้าง (ไม่มีบัญชีครึ่ง ๆ กลาง ๆ)

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**
  - `pwa.spec.ts` + `security_headers_present` และ `camera_allowed_by_permissions_policy` (response ของ `/login` มี header ตาม Interfaces และ `Permissions-Policy` มี `camera=(self)`)
  - `create-owner.spec.ts` (เรียกสคริปต์ด้วย `child_process` กับ Supabase ในเครื่อง, ส่ง `--env .env.local` และ `OWNER_PASSWORD`): `creates_owner_who_can_log_in` (อีเมลสุ่ม → exit 0 → ล็อกอินที่ `/login` ได้และเห็นเมนู `ตั้งค่า`), `rerun_same_email_refused` (exit 1 + ข้อความ), `short_password_refused`
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3:** เขียนโค้ดตาม Interfaces
- [ ] **Step 4: Run** `npm run build` แล้วตรวจ `.next/static` ว่าไม่มีค่า service role key และไม่มี `owner-pass-1234`/`staff-pass-1234`; `npx playwright test` → PASS
- [ ] **Step 5: Commit** `feat: security headers and first-owner setup script`

### Task 4: คู่มือขึ้นระบบจริง และ deploy (เจ้าของทำบางขั้นเอง)

**Files:**
- Create: `docs/deploy.md`, `docs/tablet-test.md`
- Modify: `README.md` (ลิงก์ไปคู่มือ)

**Interfaces:**
- `docs/deploy.md` (ภาษาไทย ทีละขั้น มีภาพรวมค่าใช้จ่าย Free tier และข้อควรรู้):
  1. สร้างโปรเจกต์ Supabase (region Singapore, ตั้งรหัสผ่านฐานข้อมูลเก็บไว้เอง) แล้วจด Project URL, anon key, service role key, project ref
  2. Supabase → Authentication → ปิด "Allow new users to sign up" (ระบบนี้สร้างบัญชีโดยเจ้าของเท่านั้น)
  3. ในเครื่อง: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push` (ห้ามใช้ `db reset` กับ production)
  4. สร้างไฟล์ `.env.production.local` (git ไม่เก็บ) แล้ว `node scripts/create-owner.mjs --env .env.production.local --email ... --name ...`
  5. Vercel → Add New Project → Import `GYMDOOD` → ใส่ Environment Variables 3 ตัว → Deploy
  6. เปิดลิงก์ Vercel ล็อกอินด้วยบัญชีเจ้าของ → ตั้งค่า: ข้อมูลร้าน/เลข PromptPay, แพ็กเกจจริง, พนักงาน, สินค้า, ชนิดคลาส, เทรนเนอร์
  7. ข้อควรรู้: Supabase Free หยุดโปรเจกต์ถ้าไม่มีการใช้งาน 7 วัน (ยิมที่เปิดทุกวันไม่โดน), แผน Free ไม่มี backup ให้ดาวน์โหลด — แนะนำวิธี export ข้อมูลรายสัปดาห์ด้วย `npx supabase db dump --data-only`, ทุก push ขึ้น `main` จะ deploy ใหม่อัตโนมัติ
- `docs/tablet-test.md`: เช็กลิสต์ ☐ ที่เจ้าของติ๊กได้: ติดตั้ง PWA (iPad: Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม / Android: Chrome → ⋮ → ติดตั้งแอป), เปิดจากไอคอนแล้วเต็มจอ, สแกนบัตร QR ด้วยกล้องหลัง (จากหน้าจอมือถืออีกเครื่องและจากบัตรที่พิมพ์), เครื่องสแกน USB/Bluetooth (ถ้ามี — ตั้งแป้นพิมพ์เป็นภาษาอังกฤษ), ขายพร้อม QR PromptPay แล้วสแกนจ่ายจริงด้วยยอดเล็ก ๆ, พิมพ์ใบเสร็จ 80 มม., พิมพ์บัตรสมาชิก, ถ่ายรูปสมาชิกด้วยกล้องหน้า, ปิด Wi-Fi แล้วเห็นแถบออฟไลน์, หมุนจอแนวตั้ง/แนวนอน และช่องจดปัญหาที่พบ

- [ ] **Step 1:** เขียน `docs/deploy.md`, `docs/tablet-test.md` และลิงก์ใน README
- [ ] **Step 2: Verify** ทุกคำสั่งในคู่มือที่รันในเครื่องได้ถูกลองกับ Supabase ในเครื่องแล้ว (`node scripts/create-owner.mjs --help`, `npm run build`)
- [ ] **Step 3: Commit** `docs: deploy guide and tablet test checklist`
- [ ] **Step 4: หยุดรอเจ้าของ** — ส่งคู่มือให้เจ้าของทำขั้น 1–5 เอง (สมัคร/ล็อกอิน/ใส่กุญแจ) แล้วรอลิงก์ Vercel กลับมา ผู้ช่วยช่วยแก้ปัญหาได้ถ้าติด แต่ไม่ใส่กุญแจหรือรหัสผ่านแทน
- [ ] **Step 5: ตรวจระบบจริง** (หลังเจ้าของส่งลิงก์): เปิดลิงก์ในเบราว์เซอร์ของผู้ช่วยเฉพาะหน้า `/login` และ `/manifest.webmanifest` ตรวจว่า 200 และ header ครบ (ไม่ล็อกอินเข้าระบบจริงของเจ้าของ)

### Task 5: ทดสอบบนแท็บเล็ตจริงและแก้ปัญหาที่พบ

- [ ] **Step 1:** เจ้าของทำตาม `docs/tablet-test.md` ที่ยิมแล้วส่งรายการปัญหากลับมา
- [ ] **Step 2:** ปัญหาแต่ละข้อแก้ด้วย TDD (เขียนเทสต์ที่จำลองปัญหาได้ก่อนถ้าเป็นไปได้) บน branch ใหม่ แล้ว merge/push → Vercel deploy อัตโนมัติ
- [ ] **Step 3:** เจ้าของติ๊กเช็กลิสต์ซ้ำจนผ่านครบ → เวอร์ชัน 1 ใช้งานจริง
