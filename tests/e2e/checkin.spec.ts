import { expect, test, type Page } from "@playwright/test";
import { addPackage, login, newMember, pay, pickBuyer, STAFF } from "./helpers";

/** New member, optionally with a package bought for them. Leaves the page on /. */
async function member(page: Page, packageName?: string) {
  const name = `เช็กอิน ทดสอบ${String(Date.now()).slice(-7)}`;
  const id = await newMember(page, name);
  const code = (await page.getByTestId("member-code").textContent())!.trim();
  if (packageName) {
    await page.goto("/sell");
    await pickBuyer(page, name);
    await addPackage(page, packageName);
    await pay(page);
  }
  await page.goto("/");
  return { id, name, code };
}

const input = (page: Page) => page.getByLabel("สแกนหรือค้นหาสมาชิก");
const result = (page: Page) => page.getByTestId("checkin-result");

async function scan(page: Page, text: string) {
  await input(page).fill(text);
  await input(page).press("Enter");
}

test.describe("check-in", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, STAFF);
  });

  test("checkin_by_code_green", async ({ page }) => {
    const m = await member(page, "รายเดือน");
    await scan(page, m.code);
    await expect(result(page)).toHaveAttribute("data-status", "ok");
    await expect(result(page)).toContainText("เข้าได้");
    await expect(result(page)).toContainText(m.name);
  });

  test("scanner_lowercase_code", async ({ page }) => {
    const m = await member(page, "รายเดือน");
    await scan(page, `  ${m.code.toLowerCase()} `);
    await expect(result(page)).toHaveAttribute("data-status", "ok");
  });

  test("checkin_by_name_search", async ({ page }) => {
    const m = await member(page, "รายเดือน");
    await scan(page, m.name.slice(-9));
    await page.getByRole("button", { name: `เช็กอิน ${m.name}` }).click();
    await expect(result(page)).toHaveAttribute("data-status", "ok");
  });

  test("visits_count_shown_and_once_per_day", async ({ page }) => {
    const m = await member(page, "10 ครั้ง");
    await scan(page, m.code);
    await expect(result(page)).toContainText("เหลือ 9 ครั้ง");
    await scan(page, m.code);
    await expect(result(page)).toContainText("เหลือ 9 ครั้ง");
    await expect(result(page)).toContainText("เข้าแล้ววันนี้");
  });

  test("no_package_red_with_renew", async ({ page }) => {
    const m = await member(page);
    await scan(page, m.code);
    await expect(result(page)).toHaveAttribute("data-status", "denied");
    await expect(result(page)).toContainText("ยังไม่มีแพ็กเกจ");
    await result(page).getByRole("link", { name: "ต่ออายุ" }).click();
    await expect(page).toHaveURL(new RegExp(`/sell\\?member=${m.id}`));
    await expect(page.getByTestId("buyer")).toContainText(m.name);
  });

  test("override_needs_reason", async ({ page }) => {
    const m = await member(page);
    await scan(page, m.code);
    await page.getByRole("button", { name: "ปล่อยเข้าครั้งนี้" }).click();
    await page.getByRole("button", { name: "ยืนยันปล่อยเข้า" }).click();
    await expect(page.getByText("กรุณาระบุเหตุผล")).toBeVisible();
    await page.getByLabel("เหตุผลที่ปล่อยเข้า").fill("ลืมบัตร จ่ายแล้ว");
    await page.getByRole("button", { name: "ยืนยันปล่อยเข้า" }).click();
    await expect(result(page)).toContainText("ปล่อยเข้าแล้ว");
    const today = page.getByTestId("today-checkins");
    await expect(today.getByRole("listitem").filter({ hasText: m.name })).toContainText("ปล่อยเข้า");
  });

  test("focus_returns_to_input", async ({ page }) => {
    const m = await member(page, "รายเดือน");
    await scan(page, m.code);
    await expect(result(page)).toBeVisible();
    await expect(input(page)).toBeFocused();
    await expect(input(page)).toHaveValue("");
  });

  test("camera_button_present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "สแกนด้วยกล้อง" })).toBeVisible();
  });
});
