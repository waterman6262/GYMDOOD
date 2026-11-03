import { expect, test } from "@playwright/test";
import { login, logout, OWNER, STAFF } from "./helpers";

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

test.describe("owner settings", () => {
  const suffix = String(Date.now()).slice(-6);
  const packageName = `10 ครั้ง นักเรียน ${suffix}`;
  const newStaff = { name: `พนักงานใหม่ ${suffix}`, email: `staff${suffix}@gym.test`, password: "test-pass-1234" };

  test("create_visits_package", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/settings/packages");
    await page.getByLabel("ชื่อแพ็กเกจ").fill(packageName);
    await page.getByLabel("ชนิด").selectOption({ label: "นับครั้ง" });
    await page.getByLabel("ราคา (บาท)").fill("700");
    await page.getByLabel("จำนวนครั้ง").fill("10");
    await page.getByLabel("ใช้ได้ภายใน (วัน)").fill("60");
    await page.getByLabel("ป้าย").fill("นักเรียน");
    await page.getByRole("button", { name: "บันทึกแพ็กเกจ" }).click();
    const row = page.getByRole("row", { name: new RegExp(packageName) });
    await expect(row).toContainText("700");
    await expect(row).toContainText("10 ครั้ง / 60 วัน");
  });

  test("form_fields_follow_kind", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/settings/packages");
    await page.getByLabel("ชนิด").selectOption({ label: "รายวัน" });
    await expect(page.getByLabel("ใช้ได้ภายใน (วัน)")).toHaveCount(0);
    await page.getByLabel("ชนิด").selectOption({ label: "PT" });
    await expect(page.getByLabel("จำนวนชั่วโมง PT")).toBeVisible();
  });

  test("visits_without_count_rejected", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/settings/packages");
    await page.getByLabel("ชื่อแพ็กเกจ").fill(`ไม่มีจำนวน ${suffix}`);
    await page.getByLabel("ชนิด").selectOption({ label: "นับครั้ง" });
    await page.getByLabel("ราคา (บาท)").fill("500");
    await page.getByLabel("ใช้ได้ภายใน (วัน)").fill("30");
    await page.getByRole("button", { name: "บันทึกแพ็กเกจ" }).click();
    await expect(page.getByText("กรุณาระบุจำนวนครั้ง")).toBeVisible();
  });

  test("create_staff_then_login", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/settings/staff");
    await page.getByLabel("ชื่อ").fill(newStaff.name);
    await page.getByLabel("อีเมล").fill(newStaff.email);
    await page.getByLabel("รหัสผ่าน").fill(newStaff.password);
    await page.getByRole("button", { name: "สร้างบัญชี" }).click();
    await expect(page.getByRole("row", { name: new RegExp(newStaff.email) })).toBeVisible();
    await logout(page);
    await login(page, newStaff);
    await expect(page.getByRole("complementary").getByText(newStaff.name)).toBeVisible();
  });

  test("deactivated_staff_kicked_out", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/settings/staff");
    const row = page.getByRole("row", { name: new RegExp(newStaff.email) });
    await row.getByRole("button", { name: "ปิดบัญชี" }).click();
    await expect(row.getByRole("button", { name: "เปิดบัญชี" })).toBeVisible();
    await logout(page);
    await page.getByLabel("อีเมล").fill(newStaff.email);
    await page.getByLabel("รหัสผ่าน").fill(newStaff.password);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page.getByText("บัญชีนี้ถูกปิดใช้งาน")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("owner_cannot_deactivate_self", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/settings/staff");
    const row = page.getByRole("row", { name: new RegExp(OWNER.email) });
    await row.getByRole("button", { name: "ปิดบัญชี" }).click();
    await expect(page.getByText("ไม่สามารถปิดบัญชีของตัวเองได้")).toBeVisible();
  });

  test("save_shop_settings", async ({ page }) => {
    await login(page, OWNER);
    await page.goto("/settings/shop");
    await page.getByLabel("ชื่อยิม").fill(`GYMDOOD ${suffix}`);
    await page.getByLabel("เลข PromptPay").fill("0812345678");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("ชื่อยิม")).toHaveValue(`GYMDOOD ${suffix}`);

    await page.getByLabel("เลข PromptPay").fill("12345");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("เลข PromptPay ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก")).toBeVisible();
  });
});
