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
