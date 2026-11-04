import { expect, test } from "@playwright/test";
import { addPackage, login, STAFF } from "./helpers";

const BANNER = "ออฟไลน์ — ยังไม่ได้บันทึก";

test.describe("offline", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, STAFF);
  });

  test("banner_shows_when_offline", async ({ page, context }) => {
    await page.goto("/sell");
    await expect(page.getByText(BANNER)).toHaveCount(0);
    await context.setOffline(true);
    await expect(page.getByText(BANNER)).toBeVisible();
    await context.setOffline(false);
  });

  test("pay_disabled_offline", async ({ page, context }) => {
    await page.goto("/sell");
    await addPackage(page, "น้ำดื่ม");
    await page.getByRole("button", { name: "เงินสด", exact: true }).click();
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "ชำระเงิน" })).toBeDisabled();
    await context.setOffline(false);
  });

  test("banner_hides_when_back_online", async ({ page, context }) => {
    await page.goto("/sell");
    await addPackage(page, "น้ำดื่ม");
    await page.getByRole("button", { name: "เงินสด", exact: true }).click();
    await context.setOffline(true);
    await expect(page.getByText(BANNER)).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText(BANNER)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ชำระเงิน" })).toBeEnabled();
  });

  test("checkin_blocked_offline", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    await page.getByLabel("สแกนหรือค้นหาสมาชิก").fill("A1000002");
    await page.getByLabel("สแกนหรือค้นหาสมาชิก").press("Enter");
    await expect(page.getByText("ออฟไลน์อยู่ ยังเช็กอินไม่ได้")).toBeVisible();
    await expect(page.getByTestId("checkin-result")).toHaveCount(0);
    await context.setOffline(false);
  });
});

test.describe("connection lost after sending", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, STAFF);
  });

  // Wi-Fi still connected but the internet is down: navigator.onLine stays
  // true, so only the failed request tells us. Server actions are POSTs.
  async function failServerActions(page: import("@playwright/test").Page, path: string) {
    await page.route(`**${path}`, (route) =>
      route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue(),
    );
  }

  test("sale_request_fails_shows_error_and_unlocks", async ({ page }) => {
    await page.goto("/sell");
    await addPackage(page, "น้ำดื่ม");
    await page.getByRole("button", { name: "เงินสด", exact: true }).click();
    await failServerActions(page, "/sell");
    await page.getByRole("button", { name: "ชำระเงิน" }).click();
    await expect(page.getByText("บันทึกไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่")).toBeVisible();
    await expect(page.getByRole("button", { name: "ชำระเงิน" })).toBeEnabled();
    await expect(page).toHaveURL(/\/sell/);
  });

  test("checkin_request_fails_shows_error_and_unlocks", async ({ page }) => {
    await page.goto("/");
    await failServerActions(page, "/");
    await page.getByLabel("สแกนหรือค้นหาสมาชิก").fill("A1000002");
    await page.getByLabel("สแกนหรือค้นหาสมาชิก").press("Enter");
    await expect(page.getByText("เช็กอินไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่")).toBeVisible();
    await expect(page.getByText("กำลังตรวจสอบ…")).toHaveCount(0);
  });

  test("new_member_save_disabled_offline", async ({ page, context }) => {
    await page.goto("/members/new");
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "บันทึก" })).toBeDisabled();
    await context.setOffline(false);
  });
});
