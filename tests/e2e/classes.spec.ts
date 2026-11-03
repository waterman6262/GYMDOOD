import { expect, test } from "@playwright/test";
import { login, OWNER, STAFF } from "./helpers";

test.describe("class settings", () => {
  test("owner_adds_class_type_and_trainer", async ({ page }) => {
    const suffix = String(Date.now()).slice(-6);
    await login(page, OWNER);
    await page.goto("/settings/classes");
    await page.getByLabel("ชื่อคลาส").fill(`พิลาทิส ${suffix}`);
    await page.getByLabel("จำนวนที่นั่ง").fill("12");
    await page.getByRole("button", { name: "บันทึกคลาส" }).click();
    await expect(page.getByRole("row", { name: new RegExp(`พิลาทิส ${suffix}`) })).toContainText("12");

    await page.goto("/settings/trainers");
    await page.getByLabel("ชื่อเทรนเนอร์").fill(`โค้ช ${suffix}`);
    await page.getByLabel("เบอร์โทร").fill("0877777777");
    await page.getByRole("button", { name: "บันทึกเทรนเนอร์" }).click();
    await expect(page.getByRole("row", { name: new RegExp(`โค้ช ${suffix}`) })).toBeVisible();
  });

  test("class_type_capacity_validated", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/settings/classes");
    await page.getByLabel("ชื่อคลาส").fill("ผิด");
    await page.getByLabel("จำนวนที่นั่ง").fill("0");
    await page.getByRole("button", { name: "บันทึกคลาส" }).click();
    await expect(page.getByText("จำนวนที่นั่งต้องเป็นจำนวนเต็มตั้งแต่ 1")).toBeVisible();
  });

  test("staff_cannot_open_class_settings", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/settings/classes");
    await expect(page).toHaveURL(/\/$/);
  });
});
