# Gym POS — Plan 3: เช็กอิน QR + บัตรสมาชิก + พักสมาชิก + รูปสมาชิก Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้าแรกของแอปเป็นหน้าเช็กอิน: สแกน QR (กล้องแท็บเล็ตหรือเครื่องสแกนแบบพิมพ์) หรือค้นชื่อ → เห็นสถานะ 🟢/🟡/🔴 ภายใน 3 วินาที, ตัดครั้งวันละครั้ง, ต่ออายุหรือปล่อยเข้าพร้อมเหตุผลได้ และสมาชิกมีบัตร QR, รูป และพักสมาชิกได้ (ขั้นที่ 3 ของสเปกข้อ 10)

**Architecture:** กติกาเช็กอินและพักสมาชิกอยู่ในฟังก์ชัน PostgreSQL (`check_in`, `freeze_membership`, `unfreeze_membership`) ที่ทำงานใน transaction เดียวและล็อกแถวแพ็กเกจก่อนตัดครั้ง หน้าจอแค่ส่ง `member_id` แล้วแสดงผลที่ฟังก์ชันคืนมา รูปสมาชิกเก็บใน Supabase Storage แบบ private และแสดงผ่าน signed URL

**Tech Stack:** ต่อจากแผน 2 + `qr-scanner` (สแกน QR ด้วยกล้อง ใช้ได้ทั้ง iPad Safari และ Android Chrome, MIT)

**Spec:** `docs/superpowers/specs/2026-11-03-gym-pos-design.md` (ข้อ 4 หน้าจอ 1 และ 3, ข้อ 5.2 freezes, ข้อ 5.5 check_ins, ข้อ 6.1, ข้อ 6.4)

## Global Constraints

- "วันนี้" คือ `bangkok_today()` เสมอ ทั้งการตัดครั้ง การหาแพ็กเกจที่ใช้ได้ และการพัก
- แพ็กเกจเข้ายิมได้คือชนิด `day`, `duration`, `visits` เท่านั้น แพ็กเกจ `pt` ไม่ใช้เข้ายิม
- ตัดครั้งแพ็กเกจ `visits` ได้ครั้งเดียวต่อสมาชิกต่อวัน
- ปล่อยเข้าทั้งที่ไม่มีสิทธิ์ต้องมีเหตุผลเสมอ และบันทึกพนักงานที่กด
- 🟡 ใกล้หมด = เหลือไม่เกิน 7 วันรวมวันนี้ (`end_date - today + 1 <= 7`) หรือเหลือไม่เกิน 2 ครั้งหลังตัด และสมาชิกยังไม่มีแพ็กเกจเข้ายิมที่รอเริ่มอยู่
- พักได้เฉพาะ `duration`, `visits`, `pt` ที่ `active` และยังไม่หมดอายุ (ไม่รวม `day`) พนักงานและเจ้าของพักได้ (สเปกข้อ 3)
- รูปสมาชิกเป็นข้อมูลส่วนตัว: bucket แบบ private อ่านได้เฉพาะพนักงานที่ active และไม่แสดงในหน้าใบเสร็จสาธารณะ
- ข้อความบนหน้าจอและข้อความผิดพลาดเป็นภาษาไทย

## Review Focus

1. สแกนคนเดิมซ้ำเร็ว ๆ หรือเข้า 2 รอบในวันเดียว → ตัดครั้งแค่ครั้งเดียว และไม่ติดลบ (Task 1: `visit_deducted_once_per_day`, `concurrent_scans_deduct_once` ผ่านการล็อกแถว)
2. เช็กอินตอน 23:59 กับ 00:01 เวลาไทย → นับเป็นคนละวันตามเวลาไทย ไม่ใช่ UTC (Task 1: ฟังก์ชันใช้ `bangkok_today()` และ `check_ins.check_in_date` เก็บวันไทย)
3. แพ็กเกจเดิมหมดแล้วแต่มีแพ็กเกจต่ออายุที่เริ่มพรุ่งนี้ → วันนี้เป็น 🔴 และบอกว่าแพ็กเกจถัดไปเริ่มวันไหน (Task 1: `upcoming_only_is_denied_with_next_start`)
4. พักซ้อนช่วงเดิม พักเริ่มหลังวันหมดอายุ หรือวันสิ้นสุดก่อนวันเริ่ม → ถูกปฏิเสธ (Task 1)
5. เครื่องสแกนพิมพ์รหัสเป็นตัวเล็กหรือมีช่องว่าง/ขึ้นบรรทัด → ยังเช็กอินคนนั้นได้ (Task 3: `scanner_lowercase_code`)

---

## File Structure

```
supabase/migrations/20261103000003_checkin_freeze.sql  # ตาราง, ฟังก์ชัน, RLS, storage bucket
supabase/tests/checkin_test.sql                       # pgTAP
src/lib/checkin/types.ts                              # CheckInResult, labels
src/lib/members/photos.ts                             # getPhotoUrls (signed URLs, server only)
src/app/(app)/page.tsx                                # หน้าเช็กอิน (แทนหน้าแรกชั่วคราว)
src/app/(app)/checkin/check-in-screen.tsx             # client: ช่องค้น/สแกน, ผลลัพธ์, ปล่อยเข้า
src/app/(app)/checkin/camera-scanner.tsx              # client: กล้อง + qr-scanner
src/app/(app)/checkin/actions.ts                      # checkInMember, findForCheckIn
src/app/(app)/members/[id]/card/page.tsx              # บัตร QR สมาชิก
src/app/(app)/members/[id]/card/card-actions.tsx      # พิมพ์ / บันทึกรูป PNG
src/app/(app)/members/[id]/freeze-form.tsx            # ฟอร์มพัก / ยกเลิกการพัก
src/app/(app)/members/[id]/photo-upload.tsx           # ถ่าย/เลือกรูป ย่อแล้วอัปโหลด
src/app/(app)/members/freeze-actions.ts               # freezeMembership, unfreezeMembership
tests/fixtures/member.jpg                             # รูปทดสอบ
tests/e2e/checkin.spec.ts
```

---

### Task 1: ตาราง check_ins / freezes, ฟังก์ชัน และ storage

**Files:**
- Create: `supabase/migrations/20261103000003_checkin_freeze.sql`, `supabase/tests/checkin_test.sql`

**Interfaces:**
- Produces (ตาราง):
  - `check_ins(id, member_id references members, membership_id uuid null references memberships, checked_in_at timestamptz default now(), check_in_date date not null default bangkok_today(), override bool default false, override_reason text, visit_deducted bool default false, created_by references staff)` + check `(not override) or btrim(coalesce(override_reason,'')) <> ''` + index `(member_id, check_in_date)`
  - `freezes(id, membership_id references memberships, start_date date, end_date date check end_date >= start_date, reason text, status text default 'active' check in ('active','cancelled'), created_at, created_by references staff)`
- Produces (ฟังก์ชัน ทั้งหมด `security definer`, `search_path = ''`, ตรวจ `is_staff()` ก่อน ไม่ผ่าน raise `'ไม่มีสิทธิ์ทำรายการ'`):
  - `public.is_frozen(p_membership_id uuid, p_day date) returns bool` (stable): มี freeze `active` ที่ `start_date <= p_day <= end_date` (แผน 5 ใช้ฟังก์ชันนี้กันการนัด/ตัดชั่วโมง PT ระหว่างพัก ตามสเปกข้อ 6.4)
  - `public.check_in(p_member_id uuid, p_override_reason text default null) returns jsonb`
    - สมาชิกไม่มีหรือปิดใช้งาน → raise `'สมาชิกถูกปิดใช้งาน'`
    - หาแพ็กเกจเข้ายิมที่ใช้ได้วันนี้ (ตาม Global Constraints + `not is_frozen`) เรียง `end_date` จากน้อยไปมาก เลือกแถวแรกด้วย `for update`
    - **มีแพ็กเกจ:** insert `check_ins`; ถ้าเป็น `visits` และวันนี้สมาชิกยังไม่มี check-in ที่ `visit_deducted` → `visits_left - 1` และ `visit_deducted = true`
    - **ไม่มีแพ็กเกจ, ไม่ส่งเหตุผล:** ไม่ insert อะไร
    - **ไม่มีแพ็กเกจ, ส่งเหตุผล:** insert `check_ins` แบบ `override = true`, `membership_id = null`
    - คืนค่า:
      ```
      { status: 'ok' | 'warning' | 'denied',
        check_in_id: uuid | null,
        reason: null | 'frozen' | 'used_up' | 'expired' | 'none',
        membership: null | { id, package_name, kind, end_date, visits_left },
        days_left: int | null, visit_deducted: bool,
        already_today: bool,          -- มี check-in ของวันนี้อยู่ก่อนแล้ว
        next_start_date: date | null, -- แพ็กเกจเข้ายิมที่รอเริ่มอันแรก
        member: { id, name, member_code } }
      ```
      - `status` ของแถวที่ override เป็น `'denied'` แต่ `check_in_id` ไม่ใช่ null
      - `reason` เมื่อ denied ไล่ลำดับ: มีแพ็กเกจที่ครอบคลุมวันนี้แต่ถูกพัก → `frozen`; มีแพ็กเกจ `visits` ในช่วงวันแต่ครั้งเหลือ 0 → `used_up`; เคยมีแพ็กเกจเข้ายิม (ไม่นับที่ยกเลิก) → `expired`; ไม่เคยมี → `none`
  - `public.freeze_membership(p_membership_id uuid, p_start date, p_end date, p_reason text) returns void`
    - ข้อผิดพลาด: ไม่พบหรือ `cancelled` → `'ไม่พบแพ็กเกจ'`; ชนิด `day` → `'แพ็กเกจรายวันพักไม่ได้'`; `p_end < p_start` → `'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม'`; `p_start < bangkok_today()` → `'วันเริ่มพักต้องไม่ย้อนหลัง'`; `p_start > end_date` ของแพ็กเกจ → `'แพ็กเกจหมดอายุก่อนวันเริ่มพัก'`; ซ้อนกับ freeze `active` เดิม → `'ช่วงที่พักซ้อนกับการพักเดิม'`; เหตุผลว่าง → `'กรุณาระบุเหตุผล'`
    - ผล: insert `freezes`; แพ็กเกจนี้ `end_date += n` (n = จำนวนวันที่พัก); ถ้าเป็น `duration` เลื่อนแพ็กเกจ `duration` ที่ `active` ของสมาชิกคนเดียวกันซึ่ง `start_date > end_date เดิม` ออกไปอีก n วันด้วย (ไม่ให้ช่วงซ้อนกัน)
  - `public.unfreeze_membership(p_freeze_id uuid) returns void`: freeze ต้อง `active` (ไม่งั้น `'การพักนี้ถูกยกเลิกไปแล้ว'`); ถ้ายังไม่เริ่ม (`start_date > today`) คืนทุกวัน; ถ้าเริ่มแล้ว ตั้ง `end_date = today - 1` และคืนเฉพาะวันที่ยังไม่ได้พัก (ถ้า `today - 1 < start_date` ถือว่าคืนทุกวัน); หักวันที่คืนออกจาก `end_date` ของแพ็กเกจและแพ็กเกจที่ถูกเลื่อนตามในข้อก่อน; ตั้ง `status = 'cancelled'` เมื่อคืนทุกวัน
- RLS: `check_ins`, `freezes` select ได้ถ้า `is_staff()` ไม่มี policy เขียน; `revoke execute ... from public, anon` แล้ว `grant ... to authenticated` สำหรับ 3 ฟังก์ชันหลัก
- Storage: `insert into storage.buckets (id, name, public) values ('member-photos','member-photos', false)` และ policy บน `storage.objects` ให้ select/insert/update เมื่อ `bucket_id = 'member-photos' and public.is_staff()`

- [ ] **Step 1: เขียน pgTAP ที่ล้มเหลว** `supabase/tests/checkin_test.sql` (สร้าง fixtures เอง, ใช้ `bangkok_today()` เป็นฐานของวันที่ทุกตัว):
  - `duration_member_ok`: แพ็กเกจ duration เหลือ 20 วัน → `status='ok'`, มี `check_in_id`, `visit_deducted=false`
  - `visits_deducts_one`: visits เหลือ 10 → `visits_left` เป็น 9, `visit_deducted=true`
  - `visit_deducted_once_per_day`: เช็กอินคนเดิมอีกครั้ง → `visits_left` ยังเป็น 9, `already_today=true`, มี check_ins 2 แถว
  - `warning_when_few_days_left`: duration ที่ `end_date = today + 3` → `status='warning'`, `days_left=4`
  - `warning_when_two_visits_left`: visits เหลือ 3 → หลังตัดเหลือ 2 → `status='warning'`
  - `no_warning_when_renewal_waiting`: duration เหลือ 3 วัน + มี duration รอเริ่ม → `status='ok'`
  - `picks_soonest_expiring`: มี visits (หมด 30 วัน) และ duration (หมด 10 วัน) → ใช้ duration และ visits ไม่ถูกตัด
  - `expired_is_denied`: มีแต่แพ็กเกจที่หมดแล้ว → `status='denied'`, `reason='expired'`, `check_in_id is null`, ไม่มีแถวใหม่ใน check_ins
  - `used_up_is_denied`: visits เหลือ 0 → `reason='used_up'`
  - `never_bought_is_denied`: → `reason='none'`
  - `pt_only_is_denied`: มีแต่ PT → `reason='none'`
  - `upcoming_only_is_denied_with_next_start`: แพ็กเกจเริ่มพรุ่งนี้ → `denied`, `next_start_date = today + 1`
  - `frozen_is_denied`: duration ที่พักครอบคลุมวันนี้ → `reason='frozen'`
  - `override_records_reason`: denied + เหตุผล `'โอนแล้ว รอตรวจ'` → มี `check_in_id`, แถวนั้น `override=true`, `membership_id is null`
  - `override_without_reason_rejected_by_table`: insert check_ins `override=true` เหตุผลว่างตรง ๆ (as postgres) → `throws_ok` `23514`
  - `inactive_member_rejected`: → `throws_ok` `'สมาชิกถูกปิดใช้งาน'`
  - `freeze_extends_end_date`: duration หมด `today+20` พัก `today..today+6` → `end_date = today+27`
  - `freeze_shifts_stacked_duration`: มี duration ต่อท้ายเริ่ม `today+21` → เลื่อนเป็นเริ่ม `today+28` และ end เลื่อน 7 วัน
  - `freeze_overlap_rejected`, `freeze_after_expiry_rejected`, `freeze_end_before_start_rejected`, `freeze_in_past_rejected`, `freeze_day_pass_rejected`: → `throws_ok` ข้อความตาม Interfaces
  - `unfreeze_future_restores_all`: พักล่วงหน้า `today+5..today+9` แล้วยกเลิก → `end_date` กลับเป็นค่าเดิม, freeze `cancelled`
  - `unfreeze_started_restores_rest`: พัก `today..today+6` แล้วยกเลิกวันนี้ → คืนครบ 7 วัน (เพราะ `today-1 < start`) และ `cancelled`
  - `staff_cannot_insert_check_ins_directly`: staff insert check_ins → `throws_ok` `42501`
  - `anon_cannot_check_in`: `set role anon` เรียก `check_in` → `throws_ok` `42501`
- [ ] **Step 2: Run** `npm run test:db` → FAIL
- [ ] **Step 3:** เขียน migration ตาม Interfaces
- [ ] **Step 4: Run** `npm run db:reset && npm run test:db` → PASS ทุกไฟล์
- [ ] **Step 5: Commit** `feat(db): check-in and freeze functions`

### Task 2: ทดสอบการตัดครั้งเมื่อสแกนพร้อมกัน

**Files:**
- Modify: `tests/e2e/sales-api.spec.ts` → เปลี่ยนชื่อเป็น `tests/e2e/db-api.spec.ts` และย้าย helper อ่าน `.env.local` / ล็อกอิน staff ไปไว้ใน `tests/e2e/supabase-client.ts`

**Interfaces:**
- Consumes: `check_in` (Task 1), `create_sale` (แผน 2) สำหรับสร้างแพ็กเกจ visits ให้สมาชิกใหม่
- Produces: `staffClient(): Promise<SupabaseClient>` ใน `tests/e2e/supabase-client.ts`

- [ ] **Step 1: เขียนเทสต์** `concurrent_scans_deduct_once`: สร้างสมาชิกใหม่ผ่าน client (insert members), ขายแพ็กเกจ `10 ครั้ง` ด้วย `create_sale`, แล้วเรียก `check_in` 4 ครั้งพร้อมกัน (`Promise.all`) → ไม่มี error, `visits_left` เป็น 9, และมี `visit_deducted = true` แค่ 1 แถว
- [ ] **Step 2: Run** `npx playwright test tests/e2e/db-api.spec.ts` → ถ้า PASS ตั้งแต่แรก แปลว่าการล็อกของ Task 1 ครอบไว้แล้ว ให้ยืนยันว่าเทสต์จับปัญหาได้จริงโดยลบ `for update` ชั่วคราว รันให้เห็น FAIL แล้วใส่กลับ (บันทึกผลใน ledger)
- [ ] **Step 3: Run** `npx playwright test` → PASS ทั้งหมด
- [ ] **Step 4: Commit** `test: concurrent check-ins deduct one visit`

### Task 3: หน้าเช็กอิน

**Files:**
- Create: `src/lib/checkin/types.ts`, `src/app/(app)/checkin/check-in-screen.tsx`, `camera-scanner.tsx`, `actions.ts`, `tests/e2e/checkin.spec.ts`
- Modify: `src/app/(app)/page.tsx` (เป็นหน้าเช็กอิน), `src/app/(app)/nav-links.tsx` (`เช็กอิน` → `ready: true`)
- Install: `npm i qr-scanner`

**Interfaces:**
- Consumes: `check_in` (Task 1), `searchMembers` (แผน 1), `getPhotoUrls` (Task 5 — ก่อน Task 5 เสร็จให้แสดงตัวอักษรแรกของชื่อแทนรูป)
- Produces:
  - `type CheckInResult` ตรงกับ jsonb ของ `check_in` และ `DENY_REASON_LABELS = { frozen: "พักสมาชิกอยู่", used_up: "ใช้ครบจำนวนครั้งแล้ว", expired: "แพ็กเกจหมดอายุ", none: "ยังไม่มีแพ็กเกจ" }`
  - `findForCheckIn(input: string): Promise<{ exact: MemberHit | null; hits: MemberHit[] }>`: ตัดช่องว่าง/ขึ้นบรรทัด แปลงเป็นตัวใหญ่ ถ้าตรง `member_code` ของสมาชิก active คืน `exact` ไม่งั้นคืนผลค้นหาสูงสุด 10 คน
  - `checkInMember(memberId: string, overrideReason?: string): Promise<CheckInResult | { error: string }>`
- หน้าจอ `/`:
  - ช่องใหญ่ `สแกนหรือค้นหาสมาชิก` (autofocus และกลับมา focus หลังทุกผลลัพธ์ เพื่อให้เครื่องสแกนแบบพิมพ์ใช้ต่อได้ทันที) กด Enter → `findForCheckIn`; ถ้าได้ `exact` เช็กอินทันที ไม่งั้นแสดงรายชื่อเป็นปุ่ม `เช็กอิน {ชื่อ}`
  - ปุ่ม `สแกนด้วยกล้อง` เปิด `<CameraScanner onCode>` (กล้องหลัง, หยุดกล้องเมื่ออ่านได้หรือกดปิด) ถ้าเปิดกล้องไม่ได้แสดง `เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือค้นหาด้วยชื่อแทน`
  - การ์ดผลลัพธ์ (`data-testid="checkin-result"`, `data-status` = ok/warning/denied):
    - 🟢 `เข้าได้` / 🟡 `ใกล้หมด` / 🔴 `เข้าไม่ได้` + เหตุผลจาก `DENY_REASON_LABELS`
    - รูปหรือตัวอักษรแรก, ชื่อ, รหัส, ชื่อแพ็กเกจ, `หมดอายุ {วันที่ไทย}`, `เหลือ {n} ครั้ง` (visits), `เข้าแล้ววันนี้` เมื่อ `already_today`, `แพ็กเกจถัดไปเริ่ม {วันที่ไทย}` เมื่อมี `next_start_date`
    - 🟡 และ 🔴 มีปุ่ม `ต่ออายุ` → `/sell?member={id}`
    - 🔴 ที่ยังไม่ override มีปุ่ม `ปล่อยเข้าครั้งนี้` → ช่อง `เหตุผลที่ปล่อยเข้า` + `ยืนยันปล่อยเข้า` (เหตุผลว่างแสดง `กรุณาระบุเหตุผล` โดยไม่เรียก server); สำเร็จแล้วแสดง `ปล่อยเข้าแล้ว`
  - ด้านล่าง: `เช็กอินวันนี้` 20 รายการล่าสุด (เวลา, ชื่อ, ป้าย `ปล่อยเข้า` ถ้า override) และจำนวนรวมของวัน

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** `tests/e2e/checkin.spec.ts` (สร้างสมาชิกใหม่ต่อเทสต์ด้วย helper `newMember` + ขายแพ็กเกจผ่านหน้า `/sell` ตามต้องการ; ย้าย helper `newMember`, `pickBuyer`, `addPackage`, `pay` จาก `sales.spec.ts` ไป `tests/e2e/helpers.ts`):
  - `checkin_by_code_green`: สมาชิกที่ซื้อ `รายเดือน` → พิมพ์ `member_code` + Enter → `data-status="ok"`, เห็น `เข้าได้` และชื่อ
  - `scanner_lowercase_code`: พิมพ์รหัสเป็นตัวเล็กมีช่องว่างหน้าหลัง + Enter → `ok`
  - `checkin_by_name_search`: พิมพ์ส่วนหนึ่งของชื่อ + Enter → กด `เช็กอิน {ชื่อ}` → `ok`
  - `visits_count_shown_and_once_per_day`: ซื้อ `10 ครั้ง` → เช็กอิน เห็น `เหลือ 9 ครั้ง`; เช็กอินซ้ำ เห็น `เหลือ 9 ครั้ง` และ `เข้าแล้ววันนี้`
  - `no_package_red_with_renew`: สมาชิกใหม่ไม่มีแพ็กเกจ → `denied`, `ยังไม่มีแพ็กเกจ`; กด `ต่ออายุ` → `/sell?member=` และผู้ซื้อถูกเลือกไว้
  - `override_needs_reason`: สมาชิกไม่มีแพ็กเกจ → `ปล่อยเข้าครั้งนี้` → `ยืนยันปล่อยเข้า` ว่าง → `กรุณาระบุเหตุผล`; ใส่ `ลืมบัตร จ่ายแล้ว` → `ปล่อยเข้าแล้ว` และรายการ `เช็กอินวันนี้` มีชื่อพร้อมป้าย `ปล่อยเข้า`
  - `focus_returns_to_input`: หลังเช็กอินสำเร็จ ช่อง `สแกนหรือค้นหาสมาชิก` ถูก focus และว่าง
  - `camera_button_present`: มีปุ่ม `สแกนด้วยกล้อง` (การสแกนด้วยกล้องจริงทดสอบบนแท็บเล็ตในแผน 7)
- [ ] **Step 2: Run** `npx playwright test tests/e2e/checkin.spec.ts` → FAIL
- [ ] **Step 3:** ติดตั้ง `qr-scanner` และเขียนหน้าตาม Interfaces
- [ ] **Step 4: Run** `npx playwright test` → PASS ทั้งหมด
- [ ] **Step 5: Commit** `feat: check-in screen with QR and name search`

### Task 4: บัตร QR และพักสมาชิกในหน้าสมาชิก

**Files:**
- Create: `src/app/(app)/members/[id]/card/page.tsx`, `card-actions.tsx`, `src/app/(app)/members/[id]/freeze-form.tsx`, `src/app/(app)/members/freeze-actions.ts`
- Modify: `src/lib/memberships/queries.ts`, `src/app/(app)/members/[id]/page.tsx`, `tests/e2e/checkin.spec.ts`

**Interfaces:**
- Consumes: `freeze_membership`, `unfreeze_membership`, `freezes` (Task 1), `qrcode` (แผน 2)
- Produces:
  - `MembershipState` เพิ่ม `"frozen"` (label `พักอยู่`) ซึ่งมาก่อน `active`/`upcoming` เมื่อมี freeze `active` ครอบคลุมวันนี้; `MembershipView` เพิ่ม `freezes: { id; start_date; end_date; reason }[]` (เฉพาะ `active`)
  - `freezeMembership(membershipId: string, _prev, formData)` (ช่อง `start_date`, `end_date`, `reason`) และ `unfreezeMembership(freezeId: string)` คืน `{ error?: string }` จากข้อความของฐานข้อมูล
  - หน้าสมาชิก: แต่ละแพ็กเกจ `duration`/`visits`/`pt` ที่ยังไม่หมดอายุและไม่ถูกยกเลิก มีปุ่ม `พักสมาชิก` → ฟอร์ม `วันเริ่มพัก` (ค่าเริ่มต้นวันนี้), `วันสิ้นสุด`, `เหตุผล`, `ยืนยันพัก`; ช่วงที่พักแสดงใต้แพ็กเกจพร้อมปุ่ม `ยกเลิกการพัก`; ปุ่ม `บัตรสมาชิก` → `/members/{id}/card`
  - `/members/[id]/card`: การ์ดขนาดบัตร (85.6×54 มม. เมื่อพิมพ์) มีชื่อยิม, ชื่อสมาชิก, `member_code` และ QR (SVG ของ `member_code`, `data-testid="member-qr"`); ปุ่ม `พิมพ์บัตร` และ `บันทึกรูป` (ดาวน์โหลด PNG ชื่อ `{member_code}.png` จาก `QRCode.toDataURL` วาดลง canvas พร้อมชื่อและรหัส)

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** เพิ่มใน `tests/e2e/checkin.spec.ts`:
  - `member_card_has_qr`: เปิดบัตรสมาชิก → เห็น `member_code` และ `[data-testid="member-qr"] svg`
  - `card_download_png`: กด `บันทึกรูป` → ได้ไฟล์ดาวน์โหลดชื่อ `{member_code}.png`
  - `freeze_then_checkin_denied`: สมาชิกซื้อ `รายเดือน` → พักวันนี้ถึง +6 วัน เหตุผล `บาดเจ็บ` → แพ็กเกจแสดง `พักอยู่` และวันหมดอายุเลื่อนออกไป 7 วัน; เช็กอินด้วยรหัส → `denied` + `พักสมาชิกอยู่`
  - `unfreeze_restores`: กด `ยกเลิกการพัก` → สถานะกลับเป็น `ใช้งานได้` และเช็กอินได้ `ok`
  - `freeze_end_before_start_error`: วันสิ้นสุดก่อนวันเริ่ม → เห็น `วันสิ้นสุดต้องไม่ก่อนวันเริ่ม`
- [ ] **Step 2: Run** `npx playwright test tests/e2e/checkin.spec.ts` → FAIL
- [ ] **Step 3:** เขียนโค้ดตาม Interfaces
- [ ] **Step 4: Run** `npx playwright test` → PASS
- [ ] **Step 5: Commit** `feat: member QR card and membership freeze`

### Task 5: รูปสมาชิก

**Files:**
- Create: `src/lib/members/photos.ts`, `src/app/(app)/members/[id]/photo-upload.tsx`, `tests/fixtures/member.jpg` (รูป 600×600 สร้างด้วยสคริปต์ node สีพื้น ไม่ใช่รูปคนจริง)
- Modify: `src/app/(app)/members/[id]/page.tsx`, `src/app/(app)/checkin/check-in-screen.tsx` + `actions.ts` (แนบ `photo_url` ที่ sign แล้วในผลเช็กอิน), `tests/e2e/checkin.spec.ts`

**Interfaces:**
- Consumes: bucket `member-photos` (Task 1)
- Produces:
  - `getPhotoUrls(paths: string[]): Promise<Record<string, string>>` (server only) ใช้ `storage.from('member-photos').createSignedUrls(paths, 3600)` ข้าม path ว่าง
  - `<PhotoUpload memberId currentUrl />`: `<input type="file" accept="image/*" capture="user">` label `ถ่ายหรือเลือกรูป`; ย่อด้านยาวเหลือ 512px เป็น JPEG คุณภาพ 0.85 ด้วย canvas; อัปโหลดไป `{member_id}.jpg` (`upsert: true`) ด้วย browser client; แล้ว update `members.photo_url = '{member_id}.jpg'` ผ่าน server action `setMemberPhoto(memberId)` และ `router.refresh()`; ไฟล์ไม่ใช่รูปหรือใหญ่กว่า 15MB → `ไฟล์ต้องเป็นรูปภาพขนาดไม่เกิน 15MB`
  - ผลเช็กอินแสดงรูป (`img` alt = ชื่อสมาชิก) เมื่อมี

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว**:
  - `upload_photo_shows_on_member_page`: `setInputFiles('tests/fixtures/member.jpg')` → หน้าสมาชิกมี `img` alt ชื่อสมาชิก และ `src` เป็น signed URL (`/storage/v1/object/sign/member-photos/`)
  - `photo_shows_on_checkin`: เช็กอินสมาชิกคนนั้น → การ์ดผลลัพธ์มี `img` alt ชื่อสมาชิก
  - `non_image_rejected`: อัปโหลด `package.json` → เห็น `ไฟล์ต้องเป็นรูปภาพขนาดไม่เกิน 15MB`
  - `public_receipt_has_no_photo`: ใบเสร็จสาธารณะของสมาชิกที่มีรูปไม่มีแท็ก `img` ที่ชี้ไป `member-photos`
- [ ] **Step 2: Run** `npx playwright test tests/e2e/checkin.spec.ts` → FAIL
- [ ] **Step 3:** เขียนโค้ดตาม Interfaces
- [ ] **Step 4: Run** `npm test && npm run test:db && npx playwright test && npm run build` → PASS ทั้งหมด
- [ ] **Step 5: Commit** `feat: member photos on member page and check-in`
