# Gym POS — Plan 6: รายงาน Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้า "รายงาน" ตามสเปกข้อ 7: ยอดขาย, การเข้าใช้, สมาชิก (ใช้งานอยู่ / ใกล้หมด / เพิ่งหมด), สินค้า, การปล่อยเข้า และคลาส/PT — เจ้าของดูได้ทุกช่วงวันที่ ส่วนพนักงานเห็นเฉพาะยอดขายของวันนี้ (ขั้นที่ 6 ของสเปกข้อ 10)

**Architecture:** ทุกตัวเลขคำนวณในฟังก์ชัน PostgreSQL (`security definer`, `stable`) ที่คืน `jsonb` หนึ่งก้อนต่อรายงาน ตรวจสิทธิ์ในฟังก์ชันเอง (เจ้าของทุกช่วง; พนักงานเฉพาะ `report_sales` ของวันนี้) วันทั้งหมดคิดตามเวลาไทย หน้าเว็บเป็น Server Component ที่เรียก RPC แล้ววาดตารางและแท่งกราฟด้วย CSS ล้วน ไม่มีไลบรารีกราฟ

**Tech Stack:** ต่อจากแผน 5 ไม่มีไลบรารีใหม่

**Spec:** `docs/superpowers/specs/2026-11-03-gym-pos-design.md` (ข้อ 3, 7)

## Global Constraints

- ช่วงวันที่เป็นวันตามเวลาไทยแบบรวมทั้งสองข้าง (`p_from`..`p_to`) ยาวไม่เกิน 366 วัน (`'ช่วงวันที่ต้องไม่เกิน 1 ปี'`), `p_to < p_from` → `'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม'`
- ไม่นับบิลที่ยกเลิก (`status = 'voided'`) ในตัวเลขยอดขายและสินค้าขายดีเลย
- "ยอดสุทธิ" = ผลรวม `sales.total` (หลังส่วนลด); ยอดแยกตามประเภท (แพ็กเกจ/สินค้า) เป็นยอด **ก่อนส่วนลด** และหน้าจอต้องเขียนกำกับไว้
- สิทธิ์: ไม่ใช่เจ้าของเรียกรายงานใดนอกจาก `report_sales` ของวันนี้ → `'เฉพาะเจ้าของเท่านั้นที่ดูรายงานนี้ได้'`
- ข้อความภาษาไทยทั้งหมด เงินแสดงด้วย `baht()` วันที่ด้วย `formatThaiDate()`

## Review Focus

1. บิลที่ถูกยกเลิก → ไม่อยู่ในยอดขาย ไม่อยู่ในยอดแยกวิธีชำระ และไม่อยู่ในสินค้าขายดี (Task 1: `voided_excluded_everywhere`)
2. บิลเวลา 23:30 เวลาไทย (16:30 UTC) และ 00:30 เวลาไทยของวันถัดไป → อยู่คนละวันตามเวลาไทย (Task 1: `sales_split_by_bangkok_day`)
3. บิลที่มีส่วนลด → ยอดสุทธิรวมตรงกับ `total` แต่ยอดแยกประเภทเป็นก่อนส่วนลด และส่วนลดรวมแสดงแยก (Task 1: `discount_reported_separately`)
4. พนักงานเรียก RPC รายงานเองผ่าน API เพื่อดูวันอื่นหรือรายงานอื่น → ถูกปฏิเสธ (Task 1: `staff_other_day_rejected`, `staff_members_report_rejected`)
5. สมาชิกที่ต่ออายุไว้แล้ว → ไม่อยู่ในรายชื่อ "ใกล้หมด" และสมาชิกที่หมดแล้วแต่ซื้อใหม่ → ไม่อยู่ใน "เพิ่งหมด" (Task 1: `renewed_not_expiring`, `rebought_not_expired`)

---

## File Structure

```
supabase/migrations/20261104000006_reports.sql   # report_* functions
supabase/tests/reports_test.sql                  # pgTAP
src/lib/reports/range.ts                         # parseRange, monthStartOf
src/lib/reports/types.ts                         # types of each report's jsonb
src/app/(app)/reports/page.tsx                   # range + tabs; staff → today only
src/app/(app)/reports/range-form.tsx             # client: วันที่เริ่ม/สิ้นสุด + ปุ่มลัด
src/app/(app)/reports/bars.tsx                   # แท่งกราฟ CSS (server component)
src/app/(app)/reports/sales-report.tsx
src/app/(app)/reports/checkins-report.tsx
src/app/(app)/reports/members-report.tsx
src/app/(app)/reports/products-report.tsx
src/app/(app)/reports/overrides-report.tsx
src/app/(app)/reports/classes-report.tsx
tests/unit/report-range.test.ts
tests/e2e/reports.spec.ts
```

---

### Task 1: ฟังก์ชันรายงานในฐานข้อมูล

**Files:**
- Create: `supabase/migrations/20261104000006_reports.sql`, `supabase/tests/reports_test.sql`

**Interfaces:**
- Produces (ทุกฟังก์ชัน `language plpgsql stable security definer set search_path = ''`, revoke จาก public/anon, grant authenticated; ฟังก์ชันที่รับช่วงวันที่ตรวจช่วงตาม Global Constraints ก่อน):
  - `public.require_report_owner()` (void): ไม่ใช่ `is_owner()` → raise `'เฉพาะเจ้าของเท่านั้นที่ดูรายงานนี้ได้'`
  - `public.check_report_range(p_from date, p_to date)` (void): ตรวจช่วงตาม Global Constraints
  - `report_sales(p_from date, p_to date) returns jsonb`: ถ้าไม่ใช่เจ้าของ ต้องเป็น `is_staff()` และ `p_from = p_to = bangkok_today()` ไม่งั้น raise ข้อความเจ้าของ; คืน
    ```
    { totals: { bills, subtotal, discount, net, voided_bills },
      by_day: [{ day, bills, net }],                 -- ทุกวันในช่วง (วันที่ไม่มีขาย = 0) เรียงวัน
      by_payment: [{ method, bills, net }],          -- cash/transfer/promptpay ครบทั้ง 3
      by_type: { package, product } }                -- ผลรวม line_total ก่อนส่วนลด
    ```
    วันของบิล = `session_date(created_at)` (ฟังก์ชันจากแผน 5)
  - `report_checkins(p_from, p_to) returns jsonb` (เจ้าของ): `{ total, unique_members, by_day: [{day, total, unique_members}], by_hour: [{hour 0–23, total}] }` ชั่วโมงตามเวลาไทย, by_hour ครบ 24 ช่อง
  - `report_members() returns jsonb` (เจ้าของ, ณ วันนี้):
    - `active_count`: จำนวนสมาชิก active ที่ `has_gym_access(member, today)`
    - `expiring`: `[{ member_id, name, phone, package_name, end_date, visits_left }]` สมาชิก active ที่มีแพ็กเกจ `duration`/`visits` ใช้ได้วันนี้และ `end_date` ภายใน 7 วัน (`<= today + 6`) หรือ visits เหลือ ≤ 2 **และ** ไม่มีแพ็กเกจเข้ายิมอื่นที่ใช้ได้หลัง `end_date` นั้น (ต่ออายุแล้วไม่นับ) เรียงตาม `end_date`
    - `expired_recent`: `[{ member_id, name, phone, last_end_date }]` สมาชิก active ที่แพ็กเกจเข้ายิมล่าสุด (ไม่นับ cancelled) หมดระหว่าง `today - 30` ถึง `today - 1` และวันนี้ไม่มีสิทธิ์และไม่มีแพ็กเกจรอเริ่ม เรียงจากหมดล่าสุด
  - `report_products(p_from, p_to) returns jsonb` (เจ้าของ): `{ best_sellers: [{ product_id, name, qty, amount }] (สูงสุด 20, เรียง qty มากไปน้อย), low_stock: [{ product_id, name, stock_qty, low_stock_at }] (active, track_stock, stock_qty <= low_stock_at, เรียง stock_qty) }`
  - `report_overrides(p_from, p_to) returns jsonb` (เจ้าของ): `[{ checked_in_at, member_name, reason, staff_name }]` เรียงใหม่ไปเก่า
  - `report_classes(p_from, p_to) returns jsonb` (เจ้าของ): `{ sessions: [{ id, starts_at, class_name, trainer_name, capacity, booked, attended, no_show, cancelled }], pt_by_trainer: [{ trainer_name, done }] }` (`booked` = ไม่นับ cancelled; PT นับ `done` ที่ `completed_at` อยู่ในช่วง)

- [ ] **Step 1: เขียน pgTAP ที่ล้มเหลว** `supabase/tests/reports_test.sql` — fixtures insert ตรง (เป็น postgres) ในวันที่ตายตัว `2030-01-10` / `2030-01-11` เพื่อไม่ชนข้อมูลอื่น: บิล `sales` (+ `sale_items`) ที่ `created_at` กำหนดเอง, check_ins, class_sessions/bookings, pt_appointments; ส่วนรายงานสมาชิกใช้ `bangkok_today()`:
  - `sales_totals`: 3 บิลวันที่ 10 (เงินสด 1,200 / โอน 900 ส่วนลด 100 / PromptPay 60) → `bills = 3`, `net = 2060`, `discount = 100`, `subtotal = 2160`
  - `voided_excluded_everywhere`: บิลที่ 4 voided 500 → `bills` ยังเป็น 3, `voided_bills = 1`, by_payment ไม่นับ, best_sellers ไม่นับสินค้าในบิลนั้น
  - `sales_split_by_bangkok_day`: บิล `2030-01-10 16:30 UTC` อยู่วันที่ 10, บิล `2030-01-10 17:30 UTC` อยู่วันที่ 11
  - `by_day_fills_empty_days`: ช่วง 9–12 → by_day มี 4 แถว วันที่ 9 และ 12 เป็น 0
  - `by_payment_has_three_methods`
  - `discount_reported_separately`: `by_type.package + by_type.product = subtotal` และ `net = subtotal - discount`
  - `checkins_by_day_and_hour`: 3 check-ins (2 คน) วันที่ 10 เวลาไทย 07:xx และ 18:xx → `total 3`, `unique_members 2`, `by_hour[7].total = 2`
  - `members_active_and_expiring`: สมาชิกที่หมด today+3 อยู่ใน `expiring`
  - `renewed_not_expiring`: สมาชิกหมด today+3 แต่มี duration ต่อท้าย → ไม่อยู่
  - `visits_two_left_expiring`: visits เหลือ 2 อยู่ใน `expiring`
  - `expired_recent_listed`: หมด today−5 ไม่มีอันใหม่ → อยู่ใน `expired_recent`
  - `rebought_not_expired`: หมด today−5 แต่ซื้อใหม่ใช้ได้วันนี้ → ไม่อยู่
  - `best_sellers_ranked`: น้ำ 5 ชิ้น / เวย์ 2 ชิ้น → อันดับแรกเป็นน้ำ `qty 5`
  - `low_stock_listed`: สินค้า stock 1 เตือนที่ 5 อยู่ใน `low_stock`
  - `overrides_listed`: override 1 แถวพร้อมเหตุผลและชื่อพนักงาน
  - `classes_counts`: รอบที่จอง 3 (มา 2, ไม่มา 1) + ยกเลิกจอง 1 → `booked 3`, `attended 2`, `no_show 1`; PT done 2 ของโค้ช A → `pt_by_trainer` มี `done 2`
  - `staff_today_sales_ok`: staff `report_sales(today, today)` ไม่ error
  - `staff_other_day_rejected`, `staff_members_report_rejected`: → `throws_ok` `'เฉพาะเจ้าของเท่านั้นที่ดูรายงานนี้ได้'`
  - `range_too_long_rejected`, `range_reversed_rejected`
- [ ] **Step 2: Run** `npm run test:db` → FAIL
- [ ] **Step 3:** เขียน migration ตาม Interfaces
- [ ] **Step 4: Run** `npm run db:reset && npm run test:db` → PASS ทุกไฟล์
- [ ] **Step 5: Commit** `feat(db): report functions`

### Task 2: หน้ารายงาน ยอดขาย และสิทธิ์พนักงาน

**Files:**
- Create: `src/lib/reports/range.ts`, `src/lib/reports/types.ts`, `tests/unit/report-range.test.ts`, `src/app/(app)/reports/page.tsx`, `range-form.tsx`, `bars.tsx`, `sales-report.tsx`, `tests/e2e/reports.spec.ts`
- Modify: `src/app/(app)/nav-links.tsx` (`รายงาน` → `ready: true`)

**Interfaces:**
- Consumes: `report_sales` (Task 1), `bangkokToday`, `addDays` (แผน 5), `baht`, `formatThaiDate`, `PAYMENT_LABELS` (แผน 2)
- Produces:
  - `monthStartOf(date: string): string` (`2026-11-04` → `2026-11-01`)
  - `parseRange(params: { from?: string; to?: string }, today: string): { from: string; to: string }` — ค่าเริ่มต้นต้นเดือนถึงวันนี้; ค่าที่ไม่ใช่ `YYYY-MM-DD` ใช้ค่าเริ่มต้น; ถ้า `to < from` สลับให้
  - `type SalesReport`, `CheckinsReport`, `MembersReport`, `ProductsReport`, `OverrideRow`, `ClassesReport` ตรงกับ jsonb ของ Task 1
  - `<Bars rows={{ label: string; value: number; display?: string }[]} />`: แถวละแท่ง ความยาวเทียบค่าสูงสุด (`data-testid="bar"`)
  - `/reports` (เจ้าของ): `RangeForm` (`วันที่เริ่ม`, `วันที่สิ้นสุด`, ปุ่ม `ดูรายงาน`, ปุ่มลัด `วันนี้` / `7 วันล่าสุด` / `เดือนนี้` / `เดือนก่อน`) + แท็บ `?tab=` (`ยอดขาย`, `การเข้าใช้`, `สมาชิก`, `สินค้า`, `การปล่อยเข้า`, `คลาส/PT`) ค่าเริ่มต้น `ยอดขาย`; error จาก RPC แสดงกล่องแดง
  - `/reports` (พนักงาน): หัวข้อ `ยอดขายวันนี้` + `SalesReport` ของวันนี้เท่านั้น ไม่มีช่องวันที่และไม่มีแท็บ
  - `SalesReport`: การ์ดตัวเลข `จำนวนบิล`, `ยอดก่อนส่วนลด`, `ส่วนลด`, `ยอดสุทธิ` (`data-testid="sales-net"`), `บิลที่ยกเลิก`; ตาราง/แท่ง `แยกตามวิธีชำระ`, `แยกตามประเภท (ก่อนส่วนลด)`, `รายวัน` (ซ่อนเมื่อช่วงเป็นวันเดียว) และลิงก์ `ดูรายการบิล` → `/sales?date=` (เมื่อช่วงเป็นวันเดียว)
  - สเปกข้อ 7 "รายการบิล: ดูบิลที่ยกเลิกพร้อมเหตุผล": Modify `src/app/(app)/sales/page.tsx` ให้แถวที่ยกเลิกแสดง `ยกเลิก: {void_reason}` (เพิ่ม `void_reason` ใน select) — e2e `voided_sale_not_counted` ตรวจด้วยว่าหน้า `/sales` แสดงเหตุผลนั้น

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**
  - unit `report-range.test.ts`: `month_start`, `default_range_is_month_to_date`, `invalid_dates_fall_back`, `reversed_range_swapped`
  - e2e `reports.spec.ts`:
    - `staff_sees_today_sales_only`: staff เปิด `/reports` → เห็น `ยอดขายวันนี้`, ไม่มี `วันที่เริ่ม` และไม่มีแท็บ `สมาชิก`
    - `today_net_increases_after_sale`: owner อ่าน `sales-net` ของ `วันนี้` → ขายน้ำดื่ม 1 ขวด (10 บาท) → `sales-net` เพิ่มขึ้น 10.00 พอดี
    - `voided_sale_not_counted`: owner ขาย 10 บาทแล้วยกเลิกบิล → `sales-net` เท่าก่อนขาย
    - `owner_range_shortcuts`: กด `เดือนนี้` → URL มี `from=` เป็นวันที่ 1 ของเดือน และเห็นส่วน `รายวัน`
    - `bad_range_shows_error`: เปิด `/reports?from=2020-01-01&to=2026-01-01` → เห็น `ช่วงวันที่ต้องไม่เกิน 1 ปี`
- [ ] **Step 2: Run** `npm test` และ `npx playwright test tests/e2e/reports.spec.ts` → FAIL
- [ ] **Step 3:** เขียนโค้ดตาม Interfaces
- [ ] **Step 4: Run** `npm test && npx playwright test` → PASS
- [ ] **Step 5: Commit** `feat: reports page with sales report`

### Task 3: รายงานที่เหลือ

**Files:**
- Create: `src/app/(app)/reports/checkins-report.tsx`, `members-report.tsx`, `products-report.tsx`, `overrides-report.tsx`, `classes-report.tsx`
- Modify: `src/app/(app)/reports/page.tsx`, `tests/e2e/reports.spec.ts`

**Interfaces:**
- Consumes: `report_checkins`, `report_members`, `report_products`, `report_overrides`, `report_classes` (Task 1), `<Bars>` (Task 2), `formatTime` (แผน 5)
- Produces:
  - `การเข้าใช้`: ตัวเลข `เช็กอินทั้งหมด`, `สมาชิกไม่ซ้ำ`; `<Bars>` `ช่วงเวลาที่คนเข้าเยอะ` (24 แท่ง ป้าย `06:00` ฯลฯ ซ่อนชั่วโมงที่เป็น 0 ทั้งช่วงหัวท้าย) และ `รายวัน`
  - `สมาชิก` (ไม่ใช้ช่วงวันที่ เขียนกำกับว่า `ข้อมูล ณ วันนี้`): ตัวเลข `สมาชิกที่ใช้งานอยู่`; ตาราง `ใกล้หมดใน 7 วัน` (`data-testid="expiring"`: ชื่อเป็นลิงก์ไปหน้าสมาชิก, เบอร์โทรเป็นลิงก์ `tel:`, แพ็กเกจ, วันหมด, ครั้งที่เหลือ); ตาราง `หมดอายุใน 30 วันที่ผ่านมา` (`data-testid="expired-recent"`)
  - `สินค้า`: ตาราง `สินค้าขายดี` (อันดับ, ชื่อ, จำนวน, ยอดก่อนส่วนลด) และ `ของใกล้หมด` (ลิงก์ไป `/products/{id}`)
  - `การปล่อยเข้า`: ตาราง เวลา (วันที่ไทย + เวลา), สมาชิก, เหตุผล, พนักงาน; ว่าง → `ไม่มีการปล่อยเข้าในช่วงนี้`
  - `คลาส/PT`: ตาราง `รอบคลาส` (วันเวลา, คลาส, เทรนเนอร์, จอง/ที่นั่ง, มา, ไม่มา, ป้ายยกเลิก) + ตัวเลข `อัตราการมา` = มา ÷ (มา + ไม่มา); ตาราง `ชั่วโมง PT แยกตามเทรนเนอร์`

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** เพิ่มใน `tests/e2e/reports.spec.ts` (owner):
  - `checkins_tab`: เช็กอินสมาชิก `A1000002` ที่หน้าแรก → แท็บ `การเข้าใช้` ช่วง `วันนี้` มี `เช็กอินทั้งหมด` ≥ 1 และ `<Bars>` อย่างน้อย 1 แท่ง
  - `members_tab_expiring`: สร้างสมาชิกใหม่ ซื้อ `รายวัน` ไม่ปรากฏใน `expiring` (รายวันไม่นับ) และหน้าโหลดได้พร้อม `ข้อมูล ณ วันนี้`
  - `override_tab_lists_reason`: ปล่อยเข้าสมาชิกใหม่ที่ไม่มีแพ็กเกจด้วยเหตุผล `ทดสอบรายงาน {suffix}` → แท็บ `การปล่อยเข้า` ช่วง `วันนี้` มีเหตุผลนั้นและชื่อพนักงาน
  - `products_tab_best_seller`: ขายสินค้าใหม่ที่ owner สร้าง (ไม่นับสต็อก) 3 ชิ้น → แท็บ `สินค้า` ช่วง `วันนี้` มีชื่อนั้นพร้อมจำนวน `3`
  - `classes_tab_renders`: แท็บ `คลาส/PT` ช่วง `เดือนนี้` แสดงหัวข้อ `รอบคลาส` และ `ชั่วโมง PT แยกตามเทรนเนอร์`
- [ ] **Step 2: Run** `npx playwright test tests/e2e/reports.spec.ts` → FAIL
- [ ] **Step 3:** เขียนคอมโพเนนต์ตาม Interfaces
- [ ] **Step 4: Run** `npm test && npm run test:db && npx playwright test && npm run build` → PASS ทั้งหมด
- [ ] **Step 5: Commit** `feat: check-in, member, product, override and class reports`
