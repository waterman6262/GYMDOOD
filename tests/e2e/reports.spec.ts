import { expect, test, type Page } from "@playwright/test";
import { addPackage, login, OWNER, pay, STAFF } from "./helpers";

async function todayNet(page: Page): Promise<number> {
  await page.goto("/reports");
  await page.getByRole("link", { name: "วันนี้", exact: true }).click();
  await expect(page).toHaveURL(/from=/);
  return Number((await page.getByTestId("sales-net").textContent())!.replace(/,/g, ""));
}

test.describe("reports", () => {
  test("staff_sees_today_sales_only", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "ยอดขายวันนี้" })).toBeVisible();
    await expect(page.getByTestId("sales-net")).toBeVisible();
    await expect(page.getByLabel("วันที่เริ่ม")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "การเข้าใช้" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "การปล่อยเข้า" })).toHaveCount(0);
  });

  test("today_net_increases_after_sale", async ({ page }) => {
    await login(page, OWNER);
    const before = await todayNet(page);
    await page.goto("/sell");
    await addPackage(page, "น้ำดื่ม");
    await pay(page);
    expect(await todayNet(page)).toBeCloseTo(before + 10, 2);
  });

  test("voided_sale_not_counted", async ({ page }) => {
    await login(page, OWNER);
    const before = await todayNet(page);
    await page.goto("/sell");
    await addPackage(page, "น้ำดื่ม");
    const receiptNo = await pay(page);
    const reason = `ยกเลิกรายงาน ${String(Date.now()).slice(-6)}`;
    await page.getByRole("button", { name: "ยกเลิกบิล" }).click();
    await page.getByLabel("เหตุผลที่ยกเลิก").fill(reason);
    await page.getByRole("button", { name: "ยืนยันยกเลิกบิล" }).click();
    await expect(page.getByText("ยกเลิกแล้ว")).toBeVisible();
    expect(await todayNet(page)).toBeCloseTo(before, 2);

    await page.goto("/sales");
    await expect(page.getByRole("row", { name: new RegExp(receiptNo) })).toContainText(reason);
  });

  test("owner_range_shortcuts", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/reports");
    await page.getByRole("link", { name: "เดือนนี้" }).click();
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-01/);
    await expect(page.getByRole("heading", { name: "รายวัน" })).toBeVisible();
  });

  test("bad_range_shows_error", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/reports?from=2020-01-01&to=2026-01-01");
    await expect(page.getByText("ช่วงวันที่ต้องไม่เกิน 1 ปี")).toBeVisible();
  });
});
