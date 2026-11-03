# Gym POS — Plan 5: คลาสและ PT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เจ้าของตั้งชนิดคลาส เทรนเนอร์ และตารางรอบคลาส; พนักงานจองคลาสให้สมาชิกที่เคาน์เตอร์ (จำกัดที่นั่ง), เช็กชื่อ "มาแล้ว" ซึ่งเช็กอินให้อัตโนมัติ, นัด PT และกด "เทรนแล้ว" เพื่อตัดชั่วโมง (ขั้นที่ 5 ของสเปกข้อ 10)

**Architecture:** ตาราง `trainers`, `class_types`, `class_sessions` เขียนตรงผ่าน RLS (เจ้าของเท่านั้น) ส่วน `class_bookings` และ `pt_appointments` เขียนผ่านฟังก์ชัน `security definer` เท่านั้น ฟังก์ชันจองล็อกแถวรอบคลาสก่อนนับที่นั่ง การเช็กชื่อเรียก `check_in` จากแผน 3 เพื่อใช้กติกาตัดครั้งเดียวกัน

**Tech Stack:** ต่อจากแผน 4 ไม่มีไลบรารีใหม่

**Spec:** `docs/superpowers/specs/2026-11-03-gym-pos-design.md` (ข้อ 3, 4 หน้าจอ 4 และ 7, ข้อ 5.1 trainers, 5.5, 6.1, 6.4, 6.5, 6.6)

## Global Constraints

- วันของรอบคลาสและนัด PT คือ `(starts_at at time zone 'Asia/Bangkok')::date`
- จองคลาสได้เมื่อสมาชิกมีแพ็กเกจเข้ายิมที่ใช้ได้ในวันของคลาส (กติกาเดียวกับเช็กอิน: ชนิด day/duration/visits, active, อยู่ในช่วงวัน, ไม่ถูกพักวันนั้น, visits เหลือ > 0)
- เช็กชื่อ "มาแล้ว" ได้เฉพาะในวันของคลาส และใช้ `check_in` ของแผน 3 (ถ้าสมาชิกเช็กอินวันนั้นแล้ว ไม่เช็กอินซ้ำ)
- PT: นัดได้เมื่อแพ็กเกจ PT `active`, ไม่ถูกพักในวันนัด, วันนัดอยู่ในช่วงแพ็กเกจ และนัดที่ยังค้าง (`scheduled`) รวมนัดใหม่ไม่เกิน `pt_left`; ตัดชั่วโมงเมื่อ "เทรนแล้ว" ครั้งเดียวต่อนัด; ยกเลิกนัดไม่ตัด
- สิทธิ์: ชนิดคลาส, เทรนเนอร์, สร้าง/ยกเลิกรอบคลาส = เจ้าของ; จอง, ยกเลิกจอง, เช็กชื่อ, นัด/ยกเลิก/ปิด PT = พนักงานและเจ้าของ (สเปกข้อ 3)
- ข้อความภาษาไทยทั้งหมด

## Review Focus

1. แท็บเล็ต 2 เครื่องจองที่นั่งสุดท้ายพร้อมกัน → จองได้คนเดียว อีกคนได้ `คลาสเต็มแล้ว` (Task 2 ยิงพร้อมกันจริง)
2. สมาชิกแพ็กเกจนับครั้งเช็กอินตอนเช้าแล้ว เย็นมาเข้าคลาส → ไม่ตัดครั้งซ้ำ และไม่มีแถว check-in ซ้ำ (Task 1: `attend_after_morning_checkin_no_double`)
3. คลาสเวลา 00:30 เวลาไทย → นับเป็นวันนั้นตามเวลาไทยทั้งตอนตรวจสิทธิ์จองและตอนเช็กชื่อ (Task 1: `session_date_is_bangkok_date`)
4. นัด PT เกินจำนวนชั่วโมงที่เหลือ หรือกด "เทรนแล้ว" ซ้ำ → ถูกปฏิเสธ ชั่วโมงไม่ติดลบ (Task 1)
5. สมาชิกพักสมาชิกหลังจากจองคลาสหรือนัด PT ไว้แล้ว → เช็กชื่อ/ตัดชั่วโมงในช่วงพักไม่ได้ พร้อมข้อความบอกเหตุผล (Task 1: `attend_while_frozen_rejected`, `complete_pt_while_frozen_rejected`)

---

## File Structure

```
supabase/migrations/20261104000005_classes_pt.sql   # ตาราง, ฟังก์ชัน, RLS
supabase/tests/classes_test.sql                     # pgTAP
supabase/seed.sql                                   # + เทรนเนอร์ 2 คน, ชนิดคลาส 2 แบบ
src/lib/classes/time.ts                             # weekStart, bangkokDateTimeToIso, formatTime
src/app/(app)/settings/classes/page.tsx + actions.ts + forms     # ชนิดคลาส
src/app/(app)/settings/trainers/page.tsx + actions.ts + forms    # เทรนเนอร์
src/app/(app)/classes/page.tsx                      # ตารางรอบคลาสรายสัปดาห์ + ฟอร์มเพิ่มรอบ (เจ้าของ)
src/app/(app)/classes/session-form.tsx
src/app/(app)/classes/[id]/page.tsx                 # รายชื่อจอง, จอง, เช็กชื่อ, ยกเลิกรอบ
src/app/(app)/classes/[id]/roster.tsx
src/app/(app)/classes/actions.ts
src/app/(app)/pt/page.tsx                           # นัด PT
src/app/(app)/pt/pt-forms.tsx
src/app/(app)/pt/actions.ts
tests/unit/class-time.test.ts
tests/e2e/classes.spec.ts, tests/e2e/db-api.spec.ts
```

---

### Task 1: ตารางคลาส/PT และฟังก์ชัน

**Files:**
- Create: `supabase/migrations/20261104000005_classes_pt.sql`, `supabase/tests/classes_test.sql`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Produces (ตาราง):
  - `trainers(id, name text not null check btrim<>'' , phone text, active bool default true, created_at)`
  - `class_types(id, name text not null check btrim<>'', default_capacity int not null default 15 check > 0, active bool default true, created_at)`
  - `class_sessions(id, class_type_id references class_types, trainer_id references trainers null, starts_at timestamptz, ends_at timestamptz check ends_at > starts_at, capacity int check > 0, cancelled bool default false, created_at, created_by references staff)` + index `(starts_at)`
  - `class_bookings(id, class_session_id references class_sessions, member_id references members, status text default 'booked' check in ('booked','attended','no_show','cancelled'), check_in_id uuid null references check_ins, created_at, updated_at, created_by references staff)` + unique `(class_session_id, member_id)`
  - `pt_appointments(id, membership_id references memberships, trainer_id references trainers, starts_at timestamptz, status text default 'scheduled' check in ('scheduled','done','cancelled'), completed_at timestamptz, created_at, created_by references staff)` + index `(starts_at)`
- RLS: ทุกตาราง select ถ้า `is_staff()`; `trainers`, `class_types`, `class_sessions` insert/update ถ้า `is_owner()`; `class_bookings`, `pt_appointments` ไม่มี policy เขียน
- Produces (ฟังก์ชัน `security definer`, `search_path = ''`, revoke จาก public/anon, grant authenticated; ตรวจ `is_staff()` ก่อนเสมอ ไม่ผ่าน `'ไม่มีสิทธิ์ทำรายการ'`):
  - `public.session_date(p_starts_at timestamptz) returns date` (immutable) = `(p_starts_at at time zone 'Asia/Bangkok')::date`
  - `public.has_gym_access(p_member_id uuid, p_day date) returns bool` (stable): มีแพ็กเกจตามกติกาใน Global Constraints ในวันนั้น
  - `public.book_class(p_session_id uuid, p_member_id uuid) returns uuid` (คืน booking id): ล็อกแถวรอบคลาส `for update`; ไม่พบหรือ `cancelled` → `'รอบคลาสนี้ถูกยกเลิกแล้ว'`; `ends_at <= now()` → `'คลาสนี้จบไปแล้ว'`; สมาชิกไม่ active → `'สมาชิกถูกปิดใช้งาน'`; ไม่ผ่าน `has_gym_access(member, session_date)` → `'สมาชิกไม่มีแพ็กเกจที่ใช้ได้ในวันคลาส'`; มีการจองที่ไม่ใช่ `cancelled` อยู่แล้ว → `'สมาชิกจองรอบนี้แล้ว'`; จำนวนจองที่ไม่ใช่ `cancelled` ≥ capacity → `'คลาสเต็มแล้ว'`; ถ้ามีแถวเดิมที่ `cancelled` ให้เปลี่ยนกลับเป็น `booked` แทน insert
  - `public.cancel_booking(p_booking_id uuid) returns void`: สถานะต้องเป็น `booked` (ไม่งั้น `'ยกเลิกได้เฉพาะการจองที่ยังไม่เช็กชื่อ'`)
  - `public.mark_attendance(p_booking_id uuid, p_attended bool) returns jsonb` (คืน `{status, check_in_id}`):
    - การจองต้องไม่ใช่ `cancelled` (`'การจองนี้ถูกยกเลิกแล้ว'`) และวันนี้ต้องเป็นวันของคลาส (`'เช็กชื่อได้เฉพาะวันที่มีคลาส'`)
    - `p_attended = false` → `no_show` (ถ้าเคยเป็น `attended` ไม่ยกเลิก check-in เดิม)
    - `p_attended = true`: ถ้าการจองเป็น `attended` อยู่แล้ว คืนค่าเดิม; ถ้าสมาชิกมี check-in วันนี้แล้ว ผูก `check_in_id` กับแถวแรกของวัน; ไม่งั้นเรียก `public.check_in(member)` ถ้าได้ `denied` raise `'เช็กชื่อไม่ได้: {DENY reason label}'` โดย label: frozen `พักสมาชิกอยู่`, used_up `ใช้ครบจำนวนครั้งแล้ว`, expired `แพ็กเกจหมดอายุ`, not_started `แพ็กเกจยังไม่เริ่ม`, none `ยังไม่มีแพ็กเกจ`; สำเร็จ → `attended` + `check_in_id`
  - `public.create_pt_appointment(p_membership_id uuid, p_trainer_id uuid, p_starts_at timestamptz) returns uuid`: แพ็กเกจต้องเป็น `pt` และ `active` (`'ไม่พบแพ็กเกจ PT'`); วันนัดอยู่นอก `start_date..end_date` → `'วันนัดอยู่นอกช่วงของแพ็กเกจ'`; `is_frozen(membership, วันนัด)` → `'แพ็กเกจถูกพักในวันนัด'`; เทรนเนอร์ไม่ active → `'ไม่พบเทรนเนอร์'`; ล็อกแพ็กเกจ `for update` แล้วนับนัด `scheduled` + 1 > `pt_left` → `'ชั่วโมง PT ที่เหลือไม่พอสำหรับนัดเพิ่ม'`
  - `public.complete_pt(p_appointment_id uuid) returns int` (คืน `pt_left` ใหม่): นัดต้อง `scheduled` (`'นัดนี้ปิดไปแล้ว'`); แพ็กเกจ `active` และ `pt_left > 0`; `is_frozen(membership, bangkok_today())` → `'แพ็กเกจถูกพักอยู่'`; ตั้ง `done`, `completed_at = now()`, `pt_left - 1`
  - `public.cancel_pt(p_appointment_id uuid) returns void`: ต้อง `scheduled` (`'นัดนี้ปิดไปแล้ว'`) → `cancelled`
- Seed: เทรนเนอร์ `โค้ชเอ`, `โค้ชบี`; ชนิดคลาส `โยคะ` (15 ที่), `มวยไทย` (10 ที่)

- [ ] **Step 1: เขียน pgTAP ที่ล้มเหลว** `supabase/tests/classes_test.sql` (fixtures เอง; รอบคลาสสร้างจาก `now()` ให้อยู่ "วันนี้" ตามเวลาไทย เช่น `date_trunc('day', now() at time zone 'Asia/Bangkok') + interval '23 hours'` แปลงกลับเป็น timestamptz ด้วย `at time zone 'Asia/Bangkok'`):
  - `session_date_is_bangkok_date`: `session_date('2026-11-04 17:30+00')` = `2026-11-05` (00:30 เวลาไทย)
  - `book_ok`: สมาชิกมี duration → ได้ booking id
  - `book_twice_rejected`: → `'สมาชิกจองรอบนี้แล้ว'`
  - `book_full_rejected`: รอบที่ capacity 1 จองแล้ว 1 → `'คลาสเต็มแล้ว'`
  - `cancelled_booking_frees_seat`: ยกเลิกการจองในรอบเต็ม แล้วอีกคนจองได้
  - `rebook_after_cancel_reuses_row`: คนที่ยกเลิกจองกลับได้ และยังมีแถวเดียวต่อคนต่อรอบ
  - `book_without_access_rejected`: สมาชิกไม่มีแพ็กเกจ → `'สมาชิกไม่มีแพ็กเกจที่ใช้ได้ในวันคลาส'`
  - `book_frozen_rejected`: สมาชิกที่พักครอบคลุมวันคลาส → ข้อความเดียวกัน
  - `book_cancelled_session_rejected`, `book_ended_session_rejected`
  - `attend_checks_in_and_deducts`: สมาชิก visits 10 จอง แล้ว `mark_attendance(true)` → `attended`, มี `check_in_id`, `visits_left = 9`
  - `attend_after_morning_checkin_no_double`: สมาชิก visits เช็กอินเช้า (`check_in`) แล้วเช็กชื่อคลาส → `visits_left` ลด 1 ครั้งเดียว, check_ins ของวันนี้มี 1 แถว, `check_in_id` ชี้แถวนั้น
  - `attend_twice_idempotent`: เช็กชื่อซ้ำ → ไม่มี check-in เพิ่ม
  - `attend_while_frozen_rejected`: จองแล้ว (fixture insert ตรง) ต่อมามี freeze ครอบคลุมวันนี้ → `throws_ok` `'เช็กชื่อไม่ได้: พักสมาชิกอยู่'`
  - `attend_other_day_rejected`: รอบคลาสพรุ่งนี้ → `'เช็กชื่อได้เฉพาะวันที่มีคลาส'`
  - `no_show_marks`: `mark_attendance(false)` → `no_show` และไม่มี check-in ใหม่
  - `pt_schedule_ok`, `pt_over_hours_rejected` (pt_left 2, นัด 2 แล้ว นัดที่ 3 → ข้อความตาม Interfaces), `pt_outside_range_rejected`, `pt_frozen_day_rejected`
  - `pt_complete_deducts`: → `pt_left` ลด 1 และ `done`
  - `pt_complete_twice_rejected`: → `'นัดนี้ปิดไปแล้ว'`
  - `complete_pt_while_frozen_rejected`: นัดวันนี้ แต่มี freeze ครอบคลุมวันนี้ (insert freeze ตรงหลังนัด) → `'แพ็กเกจถูกพักอยู่'`
  - `pt_cancel_no_deduct`: ยกเลิกนัด → `pt_left` เท่าเดิม
  - `staff_cannot_create_session`: staff insert `class_sessions` → `throws_ok` `42501`
  - `staff_cannot_insert_bookings_directly`: → `throws_ok` `42501`
- [ ] **Step 2: Run** `npm run test:db` → FAIL
- [ ] **Step 3:** เขียน migration และ seed ตาม Interfaces
- [ ] **Step 4: Run** `npm run db:reset && npm run test:db` → PASS ทุกไฟล์
- [ ] **Step 5: Commit** `feat(db): classes, bookings and PT appointments`

### Task 2: จองที่นั่งสุดท้ายพร้อมกัน

**Files:**
- Modify: `tests/e2e/db-api.spec.ts`

- [ ] **Step 1: เขียนเทสต์** `concurrent_last_seat_books_once`: owner client สร้าง class_type และรอบคลาสพรุ่งนี้ capacity 1; staff client สร้างสมาชิกใหม่ 2 คนและขายแพ็กเกจ `รายเดือน` ให้ทั้งคู่ด้วย `create_sale`; ยิง `book_class` ของทั้งสองคนพร้อมกัน → สำเร็จ 1, อีกครั้ง error `คลาสเต็มแล้ว`, และจำนวนการจองที่ไม่ใช่ `cancelled` = 1
- [ ] **Step 2: Run** → ถ้าผ่านตั้งแต่แรก ยืนยันโดยเอา `for update` ของรอบคลาสออกจากฟังก์ชันใน DB ชั่วคราว เห็น FAIL แล้ว `npm run db:reset` และบันทึกใน ledger
- [ ] **Step 3: Commit** `test: concurrent bookings for the last seat`

### Task 3: ตั้งค่าชนิดคลาสและเทรนเนอร์ + ตัวช่วยเวลา

**Files:**
- Create: `src/lib/classes/time.ts`, `tests/unit/class-time.test.ts`, `src/app/(app)/settings/classes/{page,actions,class-type-form}.tsx|ts`, `src/app/(app)/settings/trainers/{page,actions,trainer-form}.tsx|ts`, `tests/e2e/classes.spec.ts`
- Modify: `src/app/(app)/settings/settings-tabs.tsx` (เพิ่มแท็บ `คลาส`, `เทรนเนอร์`)

**Interfaces:**
- Produces:
  - `weekStart(date: string): string`: วันจันทร์ของสัปดาห์ (`YYYY-MM-DD`) ของวันที่ให้มา
  - `addDays(date: string, n: number): string`
  - `bangkokToIso(date: string, time: string): string`: `"2026-11-05", "00:30"` → `"2026-11-04T17:30:00.000Z"`
  - `formatTime(iso: string): string`: เวลาไทย `HH:mm`
  - actions (ทุกตัว `requireOwner()` และ `requireOwnerPage()` ในหน้า): `saveClassType(_prev, formData)` (`name`, `default_capacity` ≥ 1 → `'จำนวนที่นั่งต้องเป็นจำนวนเต็มตั้งแต่ 1'`), `setClassTypeActive(id, active)`, `saveTrainer(_prev, formData)` (`name`, `phone` ตรวจด้วยกติกาเดียวกับเบอร์สมาชิก), `setTrainerActive(id, active)`
  - ฟอร์ม: `ชื่อคลาส`, `จำนวนที่นั่ง`, ปุ่ม `บันทึกคลาส`; `ชื่อเทรนเนอร์`, `เบอร์โทร`, ปุ่ม `บันทึกเทรนเนอร์`; แต่ละแถวมีปุ่ม `ปิดใช้งาน`/`เปิดใช้งาน`

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**
  - unit: `week_start_monday` (`2026-11-04` พุธ → `2026-11-02`), `week_start_sunday` (`2026-11-08` → `2026-11-02`), `bangkok_to_iso` (ตามตัวอย่าง), `format_time` (`2026-11-04T11:00:00Z` → `18:00`), `add_days_month_end` (`2026-11-30` + 1 → `2026-12-01`)
  - e2e `owner_adds_class_type_and_trainer`: owner เพิ่มชนิดคลาส `พิลาทิส {suffix}` 12 ที่ และเทรนเนอร์ `โค้ช {suffix}` → เห็นในรายการ; staff เปิด `/settings/classes` → ถูกพาไป `/`
- [ ] **Step 2: Run** `npm test` และ `npx playwright test tests/e2e/classes.spec.ts` → FAIL
- [ ] **Step 3:** เขียนโค้ดตาม Interfaces
- [ ] **Step 4: Run** `npm test && npx playwright test` → PASS
- [ ] **Step 5: Commit** `feat: class type and trainer settings`

### Task 4: ตารางคลาส การจอง และการเช็กชื่อ

**Files:**
- Create: `src/app/(app)/classes/page.tsx`, `session-form.tsx`, `actions.ts`, `src/app/(app)/classes/[id]/page.tsx`, `roster.tsx`
- Modify: `src/app/(app)/nav-links.tsx` (`คลาส/PT` → `ready: true`), `tests/e2e/classes.spec.ts`

**Interfaces:**
- Consumes: `book_class`, `cancel_booking`, `mark_attendance` (Task 1); `weekStart`, `addDays`, `bangkokToIso`, `formatTime` (Task 3); `MemberPicker` (แผน 2)
- Produces:
  - `createSessions(_prev, formData)` (`requireOwner()`): ช่อง `class_type_id`, `trainer_id` (ไม่บังคับ), `date`, `time`, `duration_minutes` (ค่าเริ่มต้น 60), `capacity` (ว่าง = `default_capacity` ของชนิดคลาส), `repeat_weeks` (1–12); สร้างรอบทุกสัปดาห์ตามจำนวน; วันเวลาในอดีต → `'วันเวลาเริ่มต้องไม่ย้อนหลัง'`
  - `cancelSession(sessionId)` (`requireOwner()`), `bookMember(sessionId, memberId)`, `cancelBooking(bookingId)`, `markAttendance(bookingId, attended)` คืน `{ error?: string }`
  - `/classes`: ตัวเลือกสัปดาห์ (`?week=YYYY-MM-DD`, ปุ่ม `สัปดาห์ก่อน` / `สัปดาห์นี้` / `สัปดาห์หน้า`), รอบคลาสจัดกลุ่มตามวัน แสดงเวลา, ชื่อคลาส, เทรนเนอร์, `จองแล้ว N/capacity`, ป้าย `เต็ม` / `ยกเลิก`, แต่ละรอบเป็นลิงก์ไป `/classes/{id}`; เจ้าของเห็นฟอร์ม `เพิ่มรอบคลาส` (`ชนิดคลาส`, `เทรนเนอร์`, `วันที่`, `เวลาเริ่ม`, `ระยะเวลา (นาที)`, `จำนวนที่นั่ง`, `ทำซ้ำทุกสัปดาห์ (ครั้ง)`, ปุ่ม `บันทึกรอบคลาส`); ลิงก์ `นัด PT` ไป `/pt`
  - `/classes/[id]`: หัวข้อ ชื่อคลาส + วันเวลาไทย + เทรนเนอร์ + `จองแล้ว N/capacity`; `MemberPicker` label `ค้นหาสมาชิกเพื่อจอง` (กดชื่อ = จองทันที); รายชื่อ (`data-testid="roster"`) แต่ละคนแสดงสถานะ `จองแล้ว`/`มาแล้ว`/`ไม่มา` และปุ่ม `มาแล้ว`, `ไม่มา`, `ยกเลิกจอง` ตามสถานะ; error แสดงในกล่องแดง; เจ้าของมีปุ่ม `ยกเลิกรอบคลาส`

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** เพิ่มใน `tests/e2e/classes.spec.ts` (helper `ownerCreatesSession(page, { capacity, dayOffset })` ใช้ชนิดคลาส `โยคะ` จาก seed เวลา 23:00 ระยะ 50 นาทีของวันนี้/พรุ่งนี้; เทสต์ที่ต้องใช้รอบ "วันนี้" ให้ `test.skip` พร้อมเหตุผลถ้าเวลาไทยเลย 22:50 แล้ว เพราะรอบจะจบก่อนเทสต์เสร็จ):
  - `owner_creates_weekly_sessions`: repeat 3 → สัปดาห์นี้และ 2 สัปดาห์ถัดไปมีรอบนั้น (กด `สัปดาห์หน้า` แล้วเห็น)
  - `staff_books_and_attends`: สมาชิกใหม่ซื้อ `10 ครั้ง` → staff เปิดรอบวันนี้ จองสมาชิก → รายชื่อ `จองแล้ว`, หัวข้อ `จองแล้ว 1/` → กด `มาแล้ว` → สถานะ `มาแล้ว`; หน้าเช็กอินมีชื่อในรายการวันนี้ และหน้าสมาชิกแสดง `เหลือ 9 ครั้ง`
  - `full_class_blocked`: รอบ capacity 1 จองแล้ว 1 คน จองอีกคน → `คลาสเต็มแล้ว`
  - `no_package_cannot_book`: สมาชิกไม่มีแพ็กเกจ → `สมาชิกไม่มีแพ็กเกจที่ใช้ได้ในวันคลาส`
  - `cancel_booking_frees_seat`: ยกเลิกจองแล้วจำนวนกลับเป็น 0
  - `attend_tomorrow_blocked`: รอบพรุ่งนี้ กด `มาแล้ว` → `เช็กชื่อได้เฉพาะวันที่มีคลาส`
  - `owner_cancels_session`: owner `ยกเลิกรอบคลาส` → ตารางแสดงป้าย `ยกเลิก` และจองเพิ่มไม่ได้ (`รอบคลาสนี้ถูกยกเลิกแล้ว`)
  - `staff_cannot_create_session`: staff เปิด `/classes` ไม่เห็นฟอร์ม `เพิ่มรอบคลาส`
- [ ] **Step 2: Run** `npx playwright test tests/e2e/classes.spec.ts` → FAIL
- [ ] **Step 3:** เขียนหน้าตาม Interfaces
- [ ] **Step 4: Run** `npx playwright test` → PASS
- [ ] **Step 5: Commit** `feat: class schedule, bookings and attendance`

### Task 5: นัด PT

**Files:**
- Create: `src/app/(app)/pt/page.tsx`, `pt-forms.tsx`, `actions.ts`
- Modify: `src/app/(app)/members/[id]/page.tsx` (ปุ่ม `นัด PT` → `/pt?member={id}` สำหรับแพ็กเกจ PT ที่ใช้ได้), `tests/e2e/classes.spec.ts`

**Interfaces:**
- Consumes: `create_pt_appointment`, `complete_pt`, `cancel_pt` (Task 1), `MemberPicker`, `getMemberships` (แผน 2–3)
- Produces:
  - actions: `createPtAppointment(_prev, formData)` (`membership_id`, `trainer_id`, `date`, `time`), `completePt(appointmentId)`, `cancelPt(appointmentId)` คืน `{ error?: string; ptLeft?: number }`
  - `/pt`: ฟอร์ม `นัด PT ใหม่`: `MemberPicker` label `ค้นหาสมาชิก` (หรือ `?member=` เลือกไว้), ตัวเลือก `แพ็กเกจ PT` แสดงเฉพาะแพ็กเกจ PT ที่ใช้ได้ของสมาชิกนั้น พร้อม `เหลือ {n} ชั่วโมง` (ถ้าไม่มีแสดง `สมาชิกนี้ไม่มีแพ็กเกจ PT ที่ใช้ได้` + ลิงก์ `ขายแพ็กเกจ`), `เทรนเนอร์`, `วันที่`, `เวลา`, ปุ่ม `บันทึกนัด`; รายการ `นัดที่กำลังจะถึง` (วันนี้เป็นต้นไป + นัดค้างในอดีตที่ยัง `scheduled`) จัดกลุ่มตามวัน แสดงเวลา, สมาชิก, เทรนเนอร์ และปุ่ม `เทรนแล้ว` / `ยกเลิกนัด`; ส่วน `เสร็จแล้ววันนี้`

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** เพิ่มใน `tests/e2e/classes.spec.ts`:
  - `pt_flow`: สมาชิกใหม่ซื้อ `PT 10 ชั่วโมง` → จากหน้าสมาชิกกด `นัด PT` → เลือกแพ็กเกจ, `โค้ชเอ`, วันนี้ 23:00 → `บันทึกนัด` → รายการมีชื่อ → `เทรนแล้ว` → ย้ายไป `เสร็จแล้ววันนี้` และหน้าสมาชิกแสดง `เหลือ 9 ชั่วโมง`
  - `pt_cancel_keeps_hours`: นัดแล้ว `ยกเลิกนัด` → หน้าสมาชิกยัง `เหลือ 10 ชั่วโมง`
  - `pt_no_package_message`: สมาชิกไม่มี PT → เห็น `สมาชิกนี้ไม่มีแพ็กเกจ PT ที่ใช้ได้`
- [ ] **Step 2: Run** `npx playwright test tests/e2e/classes.spec.ts` → FAIL
- [ ] **Step 3:** เขียนหน้าตาม Interfaces
- [ ] **Step 4: Run** `npm test && npm run test:db && npx playwright test && npm run build` → PASS ทั้งหมด
- [ ] **Step 5: Commit** `feat: PT appointments`
