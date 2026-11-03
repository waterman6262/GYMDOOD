import { expect, test } from "@playwright/test";
import { login, OWNER, STAFF } from "./helpers";

test.describe("login and roles", () => {
  test("redirects_to_login", async ({ page }) => {
    await page.goto("/members");
    await expect(page).toHaveURL(/\/login/);
  });

  test("wrong_password_shows_thai_error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill(OWNER.email);
    await page.getByLabel("รหัสผ่าน").fill("wrong-password");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
  });

  test("owner_sees_settings_menu", async ({ page }) => {
    await login(page, OWNER);
    await expect(page.getByRole("link", { name: "ตั้งค่า" })).toBeVisible();
  });

  test("staff_hides_settings_menu", async ({ page }) => {
    await login(page, STAFF);
    await expect(page.getByRole("link", { name: "สมาชิก", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "ตั้งค่า" })).toHaveCount(0);
    await page.goto("/settings/packages");
    await expect(page).toHaveURL(/\/$/);
  });
});
