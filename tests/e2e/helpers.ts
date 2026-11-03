import { expect, type Page } from "@playwright/test";

// Test logins come from supabase/seed.sql (local database only).
export const OWNER = { email: "owner@gym.test", password: "owner-pass-1234" };
export const STAFF = { email: "staff@gym.test", password: "staff-pass-1234" };

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(user.email);
  await page.getByLabel("รหัสผ่าน").fill(user.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function pickBuyer(page: Page, name: string) {
  await page.getByLabel("ค้นหาผู้ซื้อ").fill(name);
  await page.getByRole("button", { name: `เลือก ${name}` }).click();
  await expect(page.getByTestId("buyer")).toContainText(name);
}

export async function addPackage(page: Page, name: string) {
  await page.getByRole("button", { name: `เพิ่ม ${name}`, exact: true }).click();
}

export async function pay(page: Page, method: "เงินสด" | "โอน" | "QR PromptPay" = "เงินสด") {
  await page.getByRole("button", { name: method, exact: true }).click();
  await page.getByRole("button", { name: "ชำระเงิน" }).click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/);
  return (await page.getByTestId("receipt-no").textContent())!.trim();
}

export async function newMember(page: Page, name: string) {
  await page.goto("/members/new");
  await page.getByLabel("ชื่อ-นามสกุล").fill(name);
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByTestId("member-code")).toBeVisible();
  return page.url().split("/").pop()!;
}
