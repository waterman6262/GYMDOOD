import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { login } from "./helpers";

// Runs scripts/create-owner.mjs against the local Supabase.
function createOwner(email: string, password: string) {
  return spawnSync(
    process.execPath,
    ["scripts/create-owner.mjs", "--env", ".env.local", "--email", email, "--name", "เจ้าของทดสอบ"],
    { env: { ...process.env, OWNER_PASSWORD: password }, encoding: "utf8" },
  );
}

test.describe("create-owner script", () => {
  const email = `owner${Date.now()}@gym.test`;
  const password = "owner-script-pass";

  test("creates_owner_who_can_log_in", async ({ page }) => {
    const run = createOwner(email, password);
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain(`สร้างบัญชีเจ้าของเรียบร้อย: ${email}`);
    await login(page, { email, password });
    await expect(page.getByRole("link", { name: "ตั้งค่า" })).toBeVisible();
  });

  test("rerun_same_email_refused", () => {
    const run = createOwner(email, password);
    expect(run.status).toBe(1);
    expect(run.stdout + run.stderr).toContain("มีบัญชีนี้อยู่แล้ว ไม่ได้สร้างซ้ำ");
  });

  test("short_password_refused", () => {
    const run = createOwner(`short${Date.now()}@gym.test`, "short");
    expect(run.status).toBe(1);
    expect(run.stdout + run.stderr).toContain("รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร");
  });
});
