# Gym POS — Plan 4: สินค้าหน้าเคาน์เตอร์และสต็อก Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ขายสินค้า (น้ำ เวย์ ผ้าเช็ดตัว ค่าเช่าล็อกเกอร์) ในตะกร้าเดียวกับแพ็กเกจ, ตัดสต็อกอัตโนมัติและไม่ให้ขายเกินของที่มี, รับของเข้า, เจ้าของปรับยอดตามที่นับจริง, เตือนของใกล้หมด, ดูประวัติสต็อก และยกเลิกบิลแล้วคืนสต็อก (ขั้นที่ 4 ของสเปกข้อ 10)

**Architecture:** เพิ่มตาราง `products` และ `stock_movements` แล้วขยาย `create_sale` / `void_sale` จากแผน 2 ให้รองรับรายการสินค้า สต็อกเปลี่ยนได้ทางฟังก์ชันเท่านั้น (`create_sale`, `void_sale`, `receive_stock`, `adjust_stock`) และทุกครั้งที่เปลี่ยนต้องมีแถวใน `stock_movements` คอลัมน์ `stock_qty` ถูกถอนสิทธิ์ update จาก client แม้แต่เจ้าของ

**Tech Stack:** ต่อจากแผน 3 ไม่มีไลบรารีใหม่

**Spec:** `docs/superpowers/specs/2026-11-03-gym-pos-design.md` (ข้อ 3, 4 หน้าจอ 2 และ 5, ข้อ 5.3, 5.4, 6.2, 6.3, 6.7, 8)

## Global Constraints

- `stock_qty` ไม่ติดลบ (constraint ที่ฐานข้อมูล) และทุกการเปลี่ยนจำนวนมีแถวใน `stock_movements` พร้อมพนักงานที่ทำ
- สินค้า `track_stock = false` ขายได้ไม่จำกัดและไม่มี movement
- ราคาและจำนวนในบิลมาจากฐานข้อมูลเสมอ
- สมาชิกบังคับเฉพาะเมื่อตะกร้ามีแพ็กเกจ ตะกร้าที่มีแต่สินค้าไม่ต้องเลือกสมาชิก (สเปกข้อ 6.2 ข้อ 1)
- สิทธิ์: พนักงานรับของเข้าได้; เพิ่ม/แก้สินค้า/ราคา/เปิดปิด และปรับยอดสต็อกได้เฉพาะเจ้าของ (สเปกข้อ 3)
- ข้อความภาษาไทยทั้งหมด ข้อความสต็อกไม่พอต้องบอกจำนวนที่เหลือ

## Review Focus

1. แท็บเล็ต 2 เครื่องขายชิ้นสุดท้ายพร้อมกัน → สำเร็จ 1 บิล อีกบิลได้ข้อความสต็อกไม่พอ และสต็อกไม่ติดลบ (Task 2 ยิงพร้อมกันจริง)
2. ยกเลิกบิลหลังจากมีการรับของเข้าหรือปรับยอดไปแล้ว → คืนสต็อกแบบบวกเพิ่มจากยอดปัจจุบัน ไม่ใช่ตั้งค่ากลับเป็นค่าเก่า (Task 1: `void_after_receive_adds_back`)
3. ตะกร้ามีสินค้าเดียวกัน 2 บรรทัด (เช่น หยิบน้ำ 2 รอบ) → ตรวจสต็อกจากผลรวม ไม่ใช่ทีละบรรทัด (Task 1: `same_product_two_lines_counted_together`)
4. ปิด `track_stock` ของสินค้าที่มีประวัติแล้ว → ยอดเดิมยังอยู่ และการขายระหว่างนั้นไม่แตะสต็อก (Task 1: `untracked_product_unlimited`)
5. เจ้าของพยายามแก้ `stock_qty` ตรง ๆ ผ่าน API → ถูกปฏิเสธ ต้องผ่าน `adjust_stock` ที่บันทึกประวัติ (Task 1: `owner_cannot_update_stock_directly`)

---

## File Structure

```
supabase/migrations/20261104000004_products.sql  # products, stock_movements, receive/adjust, create_sale/void_sale v2
supabase/tests/products_test.sql                 # pgTAP
supabase/seed.sql                                # + สินค้าตัวอย่าง
src/lib/sales/cart.ts                            # CartLine รองรับสินค้า + qty
src/lib/products/schema.ts                       # productSchema (zod)
src/app/(app)/sell/*                             # ส่วนสินค้าในหน้าขาย
src/app/(app)/products/page.tsx                  # รายการสินค้า + สต็อก + ตัวกรองใกล้หมด
src/app/(app)/products/product-row.tsx           # client: รับเข้า / ปรับยอด
src/app/(app)/products/product-form.tsx          # client: เพิ่ม/แก้สินค้า (เจ้าของ)
src/app/(app)/products/actions.ts
src/app/(app)/products/[id]/page.tsx             # ประวัติสต็อก
tests/unit/cart.test.ts, tests/unit/product-schema.test.ts
tests/e2e/products.spec.ts, tests/e2e/db-api.spec.ts
```

---

### Task 1: ตารางสินค้า สต็อก และฟังก์ชันขาย/ยกเลิกเวอร์ชันใหม่

**Files:**
- Create: `supabase/migrations/20261104000004_products.sql`, `supabase/tests/products_test.sql`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Produces (ตาราง):
  - `products(id, name text not null check btrim<>'' , price numeric(10,2) check >= 0, track_stock bool default true, stock_qty int default 0 check >= 0, low_stock_at int default 5 check >= 0, active bool default true, created_at)`
  - `stock_movements(id, product_id references products, change int check <> 0, reason text check in ('sale','receive','adjust','void'), sale_id uuid null references sales, note text, created_at, created_by references staff)` + index `(product_id, created_at)`
  - `sale_items`: แก้ check ของ `item_type` เป็น `in ('package','product')`, เพิ่ม `product_id uuid references products` และ check `(item_type = 'package' and package_type_id is not null and product_id is null) or (item_type = 'product' and product_id is not null and package_type_id is null)`
- RLS / สิทธิ์:
  - `products`: select ถ้า `is_staff()`; insert/update ถ้า `is_owner()`; ไม่มี delete; `revoke update on products from authenticated` แล้ว `grant update (name, price, track_stock, low_stock_at, active) on products to authenticated`
  - `stock_movements`: select ถ้า `is_staff()` ไม่มี policy เขียน
- Produces (ฟังก์ชัน, `security definer`, `search_path = ''`, revoke จาก public/anon, grant authenticated):
  - `receive_stock(p_product_id uuid, p_qty int, p_note text) returns int` (คืนยอดใหม่): `is_staff()`; `p_qty <= 0` → `'จำนวนรับเข้าต้องมากกว่า 0'`; สินค้าไม่มีหรือ `track_stock = false` → `'สินค้านี้ไม่ได้นับสต็อก'`; ล็อกแถว, บวก, บันทึก movement `receive`
  - `adjust_stock(p_product_id uuid, p_counted int, p_note text) returns int`: ไม่ใช่ `is_owner()` → `'เฉพาะเจ้าของเท่านั้นที่ปรับยอดสต็อกได้'`; `p_counted < 0` → `'จำนวนต้องไม่ติดลบ'`; ไม่นับสต็อก → `'สินค้านี้ไม่ได้นับสต็อก'`; เหตุผลว่าง → `'กรุณาระบุเหตุผล'`; ตั้งยอดเป็น `p_counted` และบันทึก movement `adjust` ด้วยส่วนต่าง (ถ้าไม่ต่างกันไม่บันทึก movement)
  - `create_sale` (`create or replace`, signature เดิม): แต่ละรายการใน `p_items` เป็นแบบใดแบบหนึ่ง
    - แพ็กเกจ `{"package_type_id", "member_ids"}` — กติกาเดิมทั้งหมด
    - สินค้า `{"product_id", "qty"}` — สินค้าต้องมีและ `active` (ไม่งั้น `'สินค้า "{name}" ปิดขายแล้ว'` / `'ไม่พบสินค้า'`); `qty` เป็นจำนวนเต็ม ≥ 1 (ไม่งั้น `'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1'`)
    - `p_member_id` บังคับเฉพาะเมื่อมีรายการแพ็กเกจ (`'กรุณาเลือกสมาชิก'`) ถ้าส่งมาต้องเป็นสมาชิก active
    - ล็อกแถว `products` ที่เกี่ยวข้องด้วย `for update` เรียงตาม id (กัน deadlock) และล็อก `package_types` ด้วย `for share` ในรอบตรวจ เพื่อให้ราคาในรอบตรวจกับรอบบันทึกเป็นค่าเดียวกัน
    - สต็อกตรวจจากผลรวม qty ต่อสินค้าทั้งตะกร้า ไม่พอ → `'สินค้า "{name}" เหลือไม่พอ (เหลือ {stock_qty})'`
    - บันทึก `sale_items` แบบ `product` (`unit_price = price`, `line_total = price * qty`), ลด `stock_qty` และ movement `sale` (`change = -qty`, `sale_id`) เฉพาะ `track_stock`
  - `void_sale` (`create or replace`): นอกจากเดิม ให้บวก `stock_qty` คืนตาม `sale_items` แบบ product ที่สินค้ายัง `track_stock` และบันทึก movement `void` (`change = +qty`, `sale_id`)
- Seed: `น้ำดื่ม` 10 บาท สต็อก 48 เตือนที่ 12; `เวย์โปรตีน 1 ซอง` 60 บาท สต็อก 20 เตือนที่ 5; `เกลือแร่` 25 บาท สต็อก 3 เตือนที่ 6 (ไว้ทดสอบของใกล้หมด); `เช่าผ้าเช็ดตัว` 20 บาท ไม่นับสต็อก; `เช่าล็อกเกอร์ (วัน)` 30 บาท ไม่นับสต็อก

- [ ] **Step 1: เขียน pgTAP ที่ล้มเหลว** `supabase/tests/products_test.sql` (fixtures เอง: owner, staff, สมาชิก, แพ็กเกจรายวัน, สินค้า A นับสต็อก 5 ชิ้น 10 บาท, สินค้า B ไม่นับสต็อก 20 บาท, สินค้า C ปิดขาย):
  - `sell_product_without_member`: `create_sale(..., null, [{A, qty 2}], 0, 'cash')` สำเร็จ, `total = 20`, A เหลือ 3, มี movement `sale` `change = -2` ที่ `sale_id` ตรง
  - `mixed_cart`: แพ็กเกจรายวัน + A 1 ชิ้น พร้อมสมาชิก → `sale_items` 2 แถว (`package` + `product`), memberships 1 แถว, A เหลือ 2
  - `package_still_needs_member`: แพ็กเกจโดยไม่มีสมาชิก → `throws_ok` `'กรุณาเลือกสมาชิก'`
  - `insufficient_stock_rejected`: A 5 ชิ้น (เหลือ 2) → `throws_ok` `'สินค้า "A" เหลือไม่พอ (เหลือ 2)'` และไม่มีบิลใหม่ (นับ sales ก่อน/หลังเท่ากัน)
  - `same_product_two_lines_counted_together`: A 1 + A 2 (เหลือ 2) → `throws_ok` ข้อความเดียวกัน
  - `untracked_product_unlimited`: B 100 ชิ้น → สำเร็จ, `stock_qty` ของ B ไม่เปลี่ยน, ไม่มี movement ของ B
  - `inactive_product_rejected`: C → `throws_ok` `'สินค้า "C" ปิดขายแล้ว'`
  - `qty_must_be_positive_integer`: qty 0 และ qty 1.5 → `throws_ok` `'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1'`
  - `staff_receives_stock`: staff `receive_stock(A, 10, 'ล็อตใหม่')` → คืน 12, movement `receive +10`
  - `receive_nonpositive_rejected`: qty 0 → `throws_ok`
  - `receive_untracked_rejected`: B → `throws_ok` `'สินค้านี้ไม่ได้นับสต็อก'`
  - `void_after_receive_adds_back`: void บิลของ `sell_product_without_member` (owner) → A = 12 + 2 = 14, movement `void +2`
  - `staff_cannot_adjust`: → `throws_ok` `'เฉพาะเจ้าของเท่านั้นที่ปรับยอดสต็อกได้'`
  - `owner_adjust_records_difference`: owner `adjust_stock(A, 9, 'นับจริง')` → A = 9, movement `adjust -5`
  - `adjust_same_count_no_movement`: ปรับเป็น 9 อีกครั้ง → จำนวน movement ไม่เพิ่ม
  - `owner_cannot_update_stock_directly`: owner `update products set stock_qty = 100` → `throws_ok` `42501`
  - `owner_can_edit_price`: owner `update products set price = 12` → สำเร็จ
  - `staff_cannot_edit_price`: staff update price → 0 แถว (ใช้ `is_empty(... returning id)`)
  - `staff_cannot_insert_products`: → `throws_ok` `42501`
- [ ] **Step 2: Run** `npm run test:db` → FAIL
- [ ] **Step 3:** เขียน migration และ seed ตาม Interfaces
- [ ] **Step 4: Run** `npm run db:reset && npm run test:db` → PASS ทุกไฟล์ (รวม `sales_test.sql` เดิมต้องยังผ่าน)
- [ ] **Step 5: Commit** `feat(db): products, stock movements and product sales`

### Task 2: ขายชิ้นสุดท้ายพร้อมกัน

**Files:**
- Modify: `tests/e2e/db-api.spec.ts`

**Interfaces:**
- Consumes: `staffClient()` (แผน 3), `create_sale` + `receive_stock` (Task 1)

- [ ] **Step 1: เขียนเทสต์** `concurrent_last_item_sells_once`: owner client สร้างสินค้าใหม่ (insert products ชื่อไม่ซ้ำ) แล้ว staff `receive_stock` 1 ชิ้น; ยิง `create_sale` 2 ครั้งพร้อมกันด้วย `client_request_id` ต่างกัน สินค้านั้น 1 ชิ้น ไม่มีสมาชิก → สำเร็จ 1 ครั้ง อีกครั้ง error ข้อความขึ้นต้น `สินค้า "` และมี `เหลือไม่พอ`; `stock_qty = 0`. ต้องเพิ่ม `ownerClient()` ใน `tests/e2e/supabase-client.ts` (ล็อกอินด้วย `OWNER`)
- [ ] **Step 2: Run** `npx playwright test tests/e2e/db-api.spec.ts` → ถ้าผ่านตั้งแต่แรก ยืนยันว่าเทสต์จับปัญหาได้โดยเอา `for update` ของ products ออกจากฟังก์ชันใน DB ชั่วคราว (แบบเดียวกับแผน 3) เห็น FAIL แล้ว `npm run db:reset` และบันทึกใน ledger
- [ ] **Step 3: Commit** `test: concurrent sales of the last item`

### Task 3: ตะกร้ารองรับสินค้า

**Files:**
- Modify: `src/lib/sales/cart.ts`, `tests/unit/cart.test.ts`
- Create: `src/lib/products/schema.ts`, `tests/unit/product-schema.test.ts`

**Interfaces:**
- Produces:
  - `type CartLine = PackageLine | ProductLine` โดย `PackageLine = { kind: "package"; key; packageTypeId; name; price; seats: 1 | 2; memberIds: string[] }` และ `ProductLine = { kind: "product"; key; productId; name; price; qty: number; trackStock: boolean; stock: number }`
  - `computeTotals` ใช้ `price * qty` สำหรับสินค้า (กติกาส่วนลดเดิม)
  - `cartError(lines, buyerId: string | null)`: ตะกร้าว่าง → `'ตะกร้าว่าง'`; มีแพ็กเกจแต่ไม่มีผู้ซื้อ → `'กรุณาเลือกสมาชิก'`; แพ็กเกจที่สมาชิกไม่ครบ (ข้อความเดิม); สินค้าที่ qty ไม่ใช่จำนวนเต็ม ≥ 1 → `'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1'`; สินค้านับสต็อกที่ผลรวม qty ในตะกร้าเกิน `stock` → `'สินค้า "{name}" เหลือไม่พอ (เหลือ {stock})'`
  - `toSaleItems(lines)` คืน `{ package_type_id, member_ids }` หรือ `{ product_id, qty }` (ไม่มีราคา)
  - `addProduct(lines, product)`: ถ้ามีบรรทัดของสินค้านี้แล้ว เพิ่ม qty ของบรรทัดเดิม 1 ไม่สร้างบรรทัดใหม่
  - `productSchema` (zod, รับค่าจากฟอร์ม): `name` (`'กรุณากรอกชื่อสินค้า'`), `price` ≥ 0 (`'ราคาต้องไม่ติดลบ'`), `track_stock` (checkbox `"on"` → true), `low_stock_at` จำนวนเต็ม ≥ 0 (`'จุดเตือนต้องเป็นจำนวนเต็มไม่ติดลบ'`)

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**: แก้เทสต์เดิมใน `cart.test.ts` ให้บรรทัดแพ็กเกจมี `kind: "package"` และเพิ่ม:
  - `product_line_multiplies_qty`: น้ำ 10 × 3 + รายเดือน 1,200 → subtotal 1230
  - `products_only_needs_no_buyer`: `cartError([น้ำ], null)` → null
  - `package_needs_buyer`: `cartError([รายเดือน], null)` → `'กรุณาเลือกสมาชิก'`
  - `stock_checked_on_total_qty`: น้ำ stock 3 สองบรรทัด qty 2 + 2 → `'สินค้า "น้ำดื่ม" เหลือไม่พอ (เหลือ 3)'`
  - `untracked_ignores_stock`: ผ้าเช็ดตัว `trackStock false, stock 0` qty 5 → null
  - `add_product_merges_line`: เพิ่มน้ำ 2 ครั้ง → 1 บรรทัด qty 2
  - `to_sale_items_product_shape`: → `{ product_id, qty }`
  - `product-schema.test.ts`: ชื่อว่าง, ราคาติดลบ, จุดเตือน 1.5 → ข้อความตาม Interfaces; checkbox ไม่ส่งมา → `track_stock = false`
- [ ] **Step 2: Run** `npm test` → FAIL
- [ ] **Step 3:** เขียนโค้ดตาม Interfaces และแก้จุดที่เรียก `cartError` / `CartLine` ใน `sell-screen.tsx` ให้ compile ผ่าน (ส่ง buyerId และใส่ `kind: "package"`)
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit` → PASS
- [ ] **Step 5: Commit** `feat: cart supports products with quantities`

### Task 4: ขายสินค้าในหน้าขาย

**Files:**
- Modify: `src/app/(app)/sell/page.tsx`, `sell-screen.tsx`, `actions.ts`, `tests/e2e/sales.spec.ts`
- Create: `tests/e2e/products.spec.ts`

**Interfaces:**
- Consumes: `create_sale` v2 (Task 1), `CartLine`/`cartError`/`addProduct` (Task 3)
- Produces:
  - `submitSale` รับ `memberId: string | null`
  - หน้าขาย: ส่วน `สินค้า` (ปุ่ม `aria-label="เพิ่ม {name}"` แสดงราคาและ `เหลือ {n}` สำหรับสินค้านับสต็อก ปุ่ม disabled เมื่อ stock 0 พร้อมคำว่า `หมด`) กดได้โดยไม่ต้องเลือกสมาชิก; บรรทัดสินค้าในตะกร้ามีปุ่ม `−` / `+` (`aria-label="ลด {name}"`, `"เพิ่มจำนวน {name}"`) และแสดง `× qty`; เปลี่ยนผู้ซื้อแล้วล้างเฉพาะบรรทัดแพ็กเกจ
  - หลังขายสำเร็จ หรือได้ error สต็อกไม่พอจากฐานข้อมูล ให้ `router.refresh()` เพื่อดึงสต็อกล่าสุด

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** `tests/e2e/products.spec.ts`:
  - `sell_water_without_member`: staff กด `เพิ่ม น้ำดื่ม` 2 ครั้ง → ตะกร้าแสดง `× 2`, สุทธิ `20.00`; เลือก `เงินสด` → `ชำระเงิน` → ใบเสร็จมี `น้ำดื่ม ×2` และ `20.00`
  - `stock_shown_and_decreases`: จำสต็อกของ `เวย์โปรตีน 1 ซอง` จากปุ่ม (`เหลือ N`) ขาย 1 ชิ้น → กลับหน้าขายเห็น `เหลือ N-1`
  - `mixed_cart_package_and_product`: เลือกสมาชิก `วิชัย แข็งแรง` + `รายวัน` + `เช่าผ้าเช็ดตัว` → ใบเสร็จมีทั้ง 2 รายการ สุทธิ `120.00`
  - `over_stock_blocked_on_screen`: กด `เพิ่ม เวย์โปรตีน 1 ซอง` แล้วกด `เพิ่มจำนวน` จน qty เกินตัวเลข `เหลือ N` บนปุ่ม → กด `ชำระเงิน` เห็น `เหลือไม่พอ` และยังอยู่ `/sell`
  - `void_returns_stock`: owner ขาย `เวย์โปรตีน 1 ซอง` 1 ชิ้น จำสต็อกก่อนขาย → ยกเลิกบิล → หน้าขายแสดงสต็อกเท่าเดิม
  - ใน `sales.spec.ts` เทสต์เดิมยังต้องผ่าน (ปุ่มแพ็กเกจยัง disabled จนเลือกผู้ซื้อ)
- [ ] **Step 2: Run** `npx playwright test tests/e2e/products.spec.ts` → FAIL
- [ ] **Step 3:** เขียนโค้ดตาม Interfaces
- [ ] **Step 4: Run** `npx playwright test` → PASS ทั้งหมด
- [ ] **Step 5: Commit** `feat: sell counter products with stock`

### Task 5: หน้าสินค้าและสต็อก

**Files:**
- Create: `src/app/(app)/products/page.tsx`, `product-row.tsx`, `product-form.tsx`, `actions.ts`, `src/app/(app)/products/[id]/page.tsx`
- Modify: `src/app/(app)/nav-links.tsx` (`สินค้า` → `ready: true`), `tests/e2e/products.spec.ts`

**Interfaces:**
- Consumes: `receive_stock`, `adjust_stock`, `stock_movements` (Task 1), `productSchema` (Task 3), `requireOwner` (แผน 1)
- Produces:
  - actions: `receiveStock(productId, _prev, formData)` (`qty`, `note`), `adjustStock(productId, _prev, formData)` (`counted`, `note`; เรียก `requireOwner()`), `saveProduct(_prev, formData)` (สร้าง/แก้ตาม `id`; `requireOwner()`), `setProductActive(productId, active)` (`requireOwner()`) — คืน `{ error?: string; savedAt?: number }` จากข้อความฐานข้อมูล
  - `/products`: ตาราง (ชื่อ, ราคา, คงเหลือ หรือ `ไม่นับสต็อก`, ป้าย `ใกล้หมด` สีเหลืองเมื่อ `stock_qty <= low_stock_at` และ `หมด` สีแดงเมื่อ 0), ช่องติ๊ก `แสดงเฉพาะใกล้หมด` (`?low=1`); แต่ละแถวนับสต็อกมีปุ่ม `รับเข้า` → ช่อง `จำนวนรับเข้า` + `หมายเหตุ` + `บันทึกรับเข้า`; เจ้าของมีปุ่ม `ปรับยอด` → `จำนวนที่นับได้` + `เหตุผล` + `บันทึกยอด`, ปุ่ม `แก้ไข` (`?edit=id`) และ `ปิดขาย`/`เปิดขาย`; เจ้าของเห็นฟอร์ม `เพิ่มสินค้า` (ชื่อสินค้า, ราคา (บาท), นับสต็อก (checkbox), เตือนเมื่อเหลือ, `บันทึกสินค้า`); ชื่อสินค้าเป็นลิงก์ไป `/products/{id}`
  - `/products/[id]`: ประวัติ 100 รายการล่าสุด (วันเวลาไทย, ประเภท `ขาย`/`รับเข้า`/`ปรับยอด`/`คืนจากยกเลิกบิล`, จำนวน +/−, หมายเหตุ, ผู้ทำ, ลิงก์ใบเสร็จเมื่อมี `sale_id`)

- [ ] **Step 1: เขียน e2e ที่ล้มเหลว** เพิ่มใน `tests/e2e/products.spec.ts` (ฐานข้อมูลทดสอบไม่ถูกล้างระหว่างรอบ เทสต์ที่ขึ้นกับจำนวนสต็อกจึงสร้างสินค้าของตัวเองด้วย helper `ownerCreatesProduct(page, { tracked, lowAt })` ชื่อมีเลขสุ่มท้าย):
  - `low_stock_filter`: owner สร้างสินค้านับสต็อก เตือนที่ 5 (สต็อก 0) → ติ๊ก `แสดงเฉพาะใกล้หมด` เห็นสินค้านั้นพร้อมป้าย `หมด` และไม่เห็น `น้ำดื่ม`; รับเข้า 3 ชิ้น → ป้ายเป็น `ใกล้หมด`
  - `staff_receives_stock`: สินค้าใหม่ของเทสต์นี้ → staff `รับเข้า` 10 หมายเหตุ `ล็อตใหม่` → คงเหลือ 10; หน้าประวัติมี `รับเข้า` `+10` `ล็อตใหม่`
  - `staff_cannot_adjust_or_edit`: staff ไม่เห็นปุ่ม `ปรับยอด`, `แก้ไข` และฟอร์ม `เพิ่มสินค้า`
  - `owner_adjusts_stock`: owner `ปรับยอด` น้ำดื่มเป็น 40 เหตุผล `นับจริง` → คงเหลือ 40; ประวัติมี `ปรับยอด`
  - `owner_adds_untracked_product`: owner เพิ่ม `ค่าคลาสทดลอง {suffix}` 150 บาท ไม่ติ๊ก `นับสต็อก` → แถวแสดง `ไม่นับสต็อก`; หน้าขายมีปุ่ม `เพิ่ม ค่าคลาสทดลอง {suffix}`
  - `owner_closes_product`: owner `ปิดขาย` สินค้าที่เพิ่งเพิ่ม → หน้าขายไม่มีปุ่มนั้น
  - `history_links_receipt`: หลังขายน้ำดื่ม ประวัติน้ำดื่มมีแถว `ขาย` ที่ลิงก์เป็นเลขใบเสร็จ
- [ ] **Step 2: Run** `npx playwright test tests/e2e/products.spec.ts` → FAIL
- [ ] **Step 3:** เขียนหน้าตาม Interfaces
- [ ] **Step 4: Run** `npm test && npm run test:db && npx playwright test && npm run build` → PASS ทั้งหมด
- [ ] **Step 5: Commit** `feat: products and stock management screens`
