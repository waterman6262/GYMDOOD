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
