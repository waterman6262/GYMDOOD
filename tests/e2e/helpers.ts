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
