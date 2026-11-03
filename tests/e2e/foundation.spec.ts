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

test.describe("members", () => {
  // Unique per run so repeated runs against the same database don't collide.
  const suffix = String(Date.now()).slice(-6);
  const name = `สมชาย ทดสอบ${suffix}`;
  const phone = `081-9${suffix.slice(0, 2)}-${suffix.slice(2)}`;

  async function search(page: import("@playwright/test").Page, q: string) {
    await page.goto("/members");
    await page.getByLabel("ค้นหาสมาชิก").fill(q);
    await expect(page).toHaveURL(new RegExp(`q=`));
  }

  test("create_member", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/members/new");
    await page.getByLabel("ชื่อ-นามสกุล").fill(name);
    await page.getByLabel("เบอร์โทร").fill(phone);
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByTestId("member-code")).toHaveText(/^[0-9A-F]{8}$/);
    await page.goto("/members");
    await expect(page.getByRole("link", { name })).toBeVisible();
  });

  test("search_thai_partial", async ({ page }) => {
    await login(page, STAFF);
    await search(page, "สมช");
    await expect(page.getByRole("link", { name })).toBeVisible();
    await expect(page.getByRole("link", { name: "วิชัย แข็งแรง" })).toHaveCount(0);
  });

  test("search_phone_with_dashes", async ({ page }) => {
    await login(page, STAFF);
    await search(page, phone.slice(0, 7));
    await expect(page.getByRole("link", { name })).toBeVisible();
  });

  test("shared_phone_both_found", async ({ page }) => {
    await login(page, STAFF);
    await search(page, "084-444-4444");
    await expect(page.getByRole("link", { name: "ประยุทธ์ ครอบครัว" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ปิยะ ครอบครัว" })).toBeVisible();
  });

  test("search_with_filter_syntax_is_safe", async ({ page }) => {
    await login(page, STAFF);
    await search(page, "a,b)(%");
    await expect(page.getByText("ไม่พบสมาชิก")).toBeVisible();
  });

  test("invalid_phone_shows_error", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/members/new");
    await page.getByLabel("ชื่อ-นามสกุล").fill(`เบอร์ผิด${suffix}`);
    await page.getByLabel("เบอร์โทร").fill("12345");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0")).toBeVisible();
    await expect(page).toHaveURL(/\/members\/new/);
  });

  test("staff_cannot_deactivate", async ({ page }) => {
    await login(page, STAFF);
    await search(page, "นภา");
    await page.getByRole("link", { name: "นภา ฟิตเสมอ" }).click();
    await expect(page.getByTestId("member-code")).toBeVisible();
    await expect(page.getByRole("button", { name: "ปิดการใช้งาน" })).toHaveCount(0);
  });

  test("owner_deactivates_member", async ({ page }) => {
    await login(page, OWNER);
    await search(page, name);
    await page.getByRole("link", { name }).click();
    await page.getByRole("button", { name: "ปิดการใช้งาน" }).click();
    await expect(page.getByRole("button", { name: "เปิดการใช้งาน" })).toBeVisible();
    await search(page, name);
    await expect(page.getByRole("link", { name })).toHaveCount(0);
    await page.getByLabel("แสดงที่ปิดใช้งาน").check();
    await expect(page.getByRole("link", { name })).toBeVisible();
  });
});
