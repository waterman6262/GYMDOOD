import { expect, test, type Page } from "@playwright/test";
import { addPackage, login, newMember, OWNER, pay, pickBuyer, STAFF } from "./helpers";

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

const tab = (page: Page, name: string, range = "วันนี้") =>
  (async () => {
    await page.goto("/reports");
    const link = page.getByTestId("report-tabs").getByRole("link", { name, exact: true });
    const id = new URL((await link.getAttribute("href"))!, "http://x").searchParams.get("tab");
    await link.click();
    await expect(page).toHaveURL(new RegExp(`tab=${id}`));
    if (range) {
      await page.getByRole("link", { name: range, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`tab=${id}.*from=`));
    }
  })();

test.describe("other reports", () => {
  test("checkins_tab", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/");
    await page.getByLabel("สแกนหรือค้นหาสมาชิก").fill("A1000002");
    await page.getByLabel("สแกนหรือค้นหาสมาชิก").press("Enter");
    await expect(page.getByTestId("checkin-result")).toBeVisible();
    await tab(page, "การเข้าใช้");
    expect(Number(await page.getByTestId("checkins-total").textContent())).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId("bar").first()).toBeVisible();
  });

  test("members_tab_expiring", async ({ page }) => {
    await login(page, OWNER);
    const name = `รายงานรายวัน ${String(Date.now()).slice(-6)}`;
    await newMember(page, name);
    await page.goto("/sell");
    await pickBuyer(page, name);
    await addPackage(page, "รายวัน");
    await pay(page);
    await tab(page, "สมาชิก", "");
    await expect(page.getByText("ข้อมูล ณ วันนี้")).toBeVisible();
    await expect(page.getByTestId("expiring")).not.toContainText(name);
  });

  test("override_tab_lists_reason", async ({ page }) => {
    await login(page, STAFF);
    const name = `รายงานปล่อยเข้า ${String(Date.now()).slice(-6)}`;
    const reason = `ทดสอบรายงาน ${String(Date.now()).slice(-6)}`;
    await newMember(page, name);
    const code = (await page.getByTestId("member-code").textContent())!.trim();
    await page.goto("/");
    await page.getByLabel("สแกนหรือค้นหาสมาชิก").fill(code);
    await page.getByLabel("สแกนหรือค้นหาสมาชิก").press("Enter");
    await page.getByRole("button", { name: "ปล่อยเข้าครั้งนี้" }).click();
    await page.getByLabel("เหตุผลที่ปล่อยเข้า").fill(reason);
    await page.getByRole("button", { name: "ยืนยันปล่อยเข้า" }).click();
    await expect(page.getByText("ปล่อยเข้าแล้ว")).toBeVisible();
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();

    await login(page, OWNER);
    await tab(page, "การปล่อยเข้า");
    const row = page.getByRole("row", { name: new RegExp(reason) });
    await expect(row).toContainText(name);
    await expect(row).toContainText("พนักงานหน้าเคาน์เตอร์");
  });

  test("products_tab_best_seller", async ({ page }) => {
    await login(page, OWNER);
    const product = `ขายดีรายงาน ${String(Date.now()).slice(-6)}`;
    await page.goto("/products");
    await page.getByLabel("ชื่อสินค้า").fill(product);
    await page.getByLabel("ราคา (บาท)").fill("5");
    await page.getByLabel("นับสต็อก").uncheck();
    await page.getByRole("button", { name: "บันทึกสินค้า" }).click();
    await expect(page.getByRole("row", { name: new RegExp(product) })).toBeVisible();
    await page.goto("/sell");
    for (let i = 0; i < 3; i++) await addPackage(page, product);
    await pay(page);
    await tab(page, "สินค้า");
    await expect(page.getByRole("row", { name: new RegExp(product) })).toContainText("3");
  });

  test("classes_tab_renders", async ({ page }) => {
    await login(page, OWNER);
    await tab(page, "คลาส/PT", "เดือนนี้");
    await expect(page.getByRole("heading", { name: "รอบคลาส" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ชั่วโมง PT แยกตามเทรนเนอร์" })).toBeVisible();
  });
});
