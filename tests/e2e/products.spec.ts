import { expect, test, type Page } from "@playwright/test";
import { addPackage, login, OWNER, pay, pickBuyer, STAFF } from "./helpers";

async function stockOnButton(page: Page, name: string): Promise<number> {
  const text = await page.getByRole("button", { name: `เพิ่ม ${name}`, exact: true }).textContent();
  return Number(text!.match(/เหลือ (\d+)/)![1]);
}

test.describe("sell products", () => {
  test("sell_water_without_member", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/sell");
    await addPackage(page, "น้ำดื่ม");
    await addPackage(page, "น้ำดื่ม");
    await expect(page.getByTestId("cart")).toContainText("× 2");
    await expect(page.getByTestId("net-total")).toHaveText("20.00");
    await pay(page);
    await expect(page.getByText("น้ำดื่ม ×2")).toBeVisible();
    await expect(page.getByTestId("receipt-total")).toHaveText("20.00");
  });

  test("stock_shown_and_decreases", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/sell");
    const before = await stockOnButton(page, "เวย์โปรตีน 1 ซอง");
    await addPackage(page, "เวย์โปรตีน 1 ซอง");
    await pay(page);
    await page.goto("/sell");
    expect(await stockOnButton(page, "เวย์โปรตีน 1 ซอง")).toBe(before - 1);
  });

  test("mixed_cart_package_and_product", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/sell");
    await pickBuyer(page, "วิชัย แข็งแรง");
    await addPackage(page, "รายวัน");
    await addPackage(page, "เช่าผ้าเช็ดตัว");
    await pay(page);
    await expect(page.getByText("รายวัน", { exact: true })).toBeVisible();
    await expect(page.getByText("เช่าผ้าเช็ดตัว")).toBeVisible();
    await expect(page.getByTestId("receipt-total")).toHaveText("120.00");
  });

  test("over_stock_blocked_on_screen", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/sell");
    const stock = await stockOnButton(page, "เวย์โปรตีน 1 ซอง");
    await addPackage(page, "เวย์โปรตีน 1 ซอง");
    for (let i = 0; i < stock; i++) {
      await page.getByRole("button", { name: "เพิ่มจำนวน เวย์โปรตีน 1 ซอง" }).click();
    }
    await page.getByRole("button", { name: "เงินสด", exact: true }).click();
    await page.getByRole("button", { name: "ชำระเงิน" }).click();
    await expect(page.getByText("เหลือไม่พอ")).toBeVisible();
    await expect(page).toHaveURL(/\/sell/);
  });

  test("void_returns_stock", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/sell");
    const before = await stockOnButton(page, "เวย์โปรตีน 1 ซอง");
    await addPackage(page, "เวย์โปรตีน 1 ซอง");
    await pay(page);
    await page.getByRole("button", { name: "ยกเลิกบิล" }).click();
    await page.getByLabel("เหตุผลที่ยกเลิก").fill("ลูกค้าคืนของ");
    await page.getByRole("button", { name: "ยืนยันยกเลิกบิล" }).click();
    await expect(page.getByText("ยกเลิกแล้ว")).toBeVisible();
    await page.goto("/sell");
    expect(await stockOnButton(page, "เวย์โปรตีน 1 ซอง")).toBe(before);
  });
});

/** Owner adds a product with a unique name; returns its name. Stays logged in as owner. */
async function ownerCreatesProduct(page: Page, opts: { tracked: boolean; lowAt?: number; price?: number }) {
  const name = `สินค้าทดสอบ ${String(Date.now()).slice(-7)}`;
  await page.goto("/products");
  await page.getByLabel("ชื่อสินค้า").fill(name);
  await page.getByLabel("ราคา (บาท)").fill(String(opts.price ?? 15));
  const box = page.getByLabel("นับสต็อก");
  if (opts.tracked) await box.check();
  else await box.uncheck();
  await page.getByLabel("เตือนเมื่อเหลือ").fill(String(opts.lowAt ?? 5));
  await page.getByRole("button", { name: "บันทึกสินค้า" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  return name;
}

const row = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(name) });

async function receive(page: Page, name: string, qty: number, note: string) {
  await row(page, name).getByRole("button", { name: "รับเข้า" }).click();
  await page.getByLabel("จำนวนรับเข้า").fill(String(qty));
  await page.getByLabel("หมายเหตุ").fill(note);
  await page.getByRole("button", { name: "บันทึกรับเข้า" }).click();
}

test.describe("products page", () => {
  test("low_stock_filter", async ({ page }) => {
    await login(page, OWNER);
    const name = await ownerCreatesProduct(page, { tracked: true, lowAt: 5 });
    await page.getByLabel("แสดงเฉพาะใกล้หมด").check();
    await expect(row(page, name)).toContainText("หมด");
    await expect(page.getByRole("row", { name: /^น้ำดื่ม/ })).toHaveCount(0);
    await receive(page, name, 3, "ของมา");
    await expect(row(page, name)).toContainText("ใกล้หมด");
  });

  test("staff_receives_stock", async ({ page }) => {
    await login(page, OWNER);
    const name = await ownerCreatesProduct(page, { tracked: true });
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await login(page, STAFF);
    await page.goto("/products");
    await receive(page, name, 10, "ล็อตใหม่");
    await expect(row(page, name)).toContainText("10");
    await row(page, name).getByRole("link", { name }).click();
    const history = page.getByTestId("stock-history");
    await expect(history).toContainText("รับเข้า");
    await expect(history).toContainText("+10");
    await expect(history).toContainText("ล็อตใหม่");
  });

  test("staff_cannot_adjust_or_edit", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/products");
    await expect(page.getByRole("button", { name: "ปรับยอด" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "แก้ไข" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "บันทึกสินค้า" })).toHaveCount(0);
  });

  test("owner_adjusts_stock", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/products");
    await row(page, "^น้ำดื่ม").getByRole("button", { name: "ปรับยอด" }).click();
    await page.getByLabel("จำนวนที่นับได้").fill("40");
    await page.getByLabel("เหตุผล").fill("นับจริง");
    await page.getByRole("button", { name: "บันทึกยอด" }).click();
    await expect(row(page, "^น้ำดื่ม").getByTestId("stock-qty")).toHaveText("40");
    await row(page, "^น้ำดื่ม").getByRole("link", { name: "น้ำดื่ม" }).click();
    await expect(page.getByTestId("stock-history")).toContainText("ปรับยอด");
  });

  test("owner_adds_closes_untracked_product", async ({ page }) => {
    await login(page, OWNER);
    const name = await ownerCreatesProduct(page, { tracked: false, price: 150 });
    await expect(row(page, name)).toContainText("ไม่นับสต็อก");
    await page.goto("/sell");
    await expect(page.getByRole("button", { name: `เพิ่ม ${name}`, exact: true })).toBeVisible();

    // owner_closes_product
    await page.goto("/products");
    await row(page, name).getByRole("button", { name: "ปิดขาย" }).click();
    await expect(row(page, name).getByRole("button", { name: "เปิดขาย" })).toBeVisible();
    await page.goto("/sell");
    await expect(page.getByRole("button", { name: `เพิ่ม ${name}`, exact: true })).toHaveCount(0);
  });

  test("history_links_receipt", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/sell");
    await addPackage(page, "น้ำดื่ม");
    const receiptNo = await pay(page);
    await page.goto("/products");
    await row(page, "^น้ำดื่ม").getByRole("link", { name: "น้ำดื่ม" }).click();
    await expect(page.getByTestId("stock-history").getByRole("link", { name: receiptNo })).toBeVisible();
  });
});
