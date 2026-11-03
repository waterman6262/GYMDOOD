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

test.describe("member card and freeze", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, STAFF);
  });

  test("member_card_has_qr", async ({ page }) => {
    const m = await member(page);
    await page.goto(`/members/${m.id}`);
    await page.getByRole("link", { name: "บัตรสมาชิก" }).click();
    await expect(page.getByText(m.code)).toBeVisible();
    await expect(page.getByTestId("member-qr").locator("svg")).toBeVisible();
  });

  test("card_download_png", async ({ page }) => {
    const m = await member(page);
    await page.goto(`/members/${m.id}/card`);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "บันทึกรูป" }).click();
    expect((await download).suggestedFilename()).toBe(`${m.code}.png`);
  });

  test("freeze_then_checkin_denied", async ({ page }) => {
    const m = await member(page, "รายเดือน");
    await page.goto(`/members/${m.id}`);
    const row = page.getByTestId("membership-row");
    const before = (await row.textContent())!;
    await row.getByRole("button", { name: "พักสมาชิก" }).click();
    const end = new Date(Date.now() + 6 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
    await page.getByLabel("วันสิ้นสุด").fill(end);
    await page.getByLabel("เหตุผล").fill("บาดเจ็บ");
    await page.getByRole("button", { name: "ยืนยันพัก" }).click();
    await expect(row).toContainText("พักอยู่");
    expect(await row.textContent()).not.toBe(before);

    await page.goto("/");
    await scan(page, m.code);
    await expect(result(page)).toHaveAttribute("data-status", "denied");
    await expect(result(page)).toContainText("พักสมาชิกอยู่");

    // unfreeze_restores
    await page.goto(`/members/${m.id}`);
    await page.getByRole("button", { name: "ยกเลิกการพัก" }).click();
    await expect(row).toContainText("ใช้งานได้");
    await page.goto("/");
    await scan(page, m.code);
    await expect(result(page)).toHaveAttribute("data-status", "ok");
  });

  test("freeze_end_before_start_error", async ({ page }) => {
    const m = await member(page, "รายเดือน");
    await page.goto(`/members/${m.id}`);
    await page.getByTestId("membership-row").getByRole("button", { name: "พักสมาชิก" }).click();
    const tomorrow = new Date(Date.now() + 86400000 + 7 * 3600000).toISOString().slice(0, 10);
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    await page.getByLabel("วันเริ่มพัก").fill(tomorrow);
    await page.getByLabel("วันสิ้นสุด").fill(today);
    await page.getByLabel("เหตุผล").fill("ทดสอบ");
    await page.getByRole("button", { name: "ยืนยันพัก" }).click();
    await expect(page.getByText("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม")).toBeVisible();
  });
});

test.describe("member photos", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, STAFF);
  });

  async function uploadPhoto(page: Page, memberId: string, file: string) {
    await page.goto(`/members/${memberId}`);
    await page.getByLabel("ถ่ายหรือเลือกรูป").setInputFiles(file);
  }

  test("upload_photo_shows_on_member_page_and_checkin", async ({ page }) => {
    const m = await member(page, "รายเดือน");
    await uploadPhoto(page, m.id, "tests/fixtures/member.png");
    const img = page.getByRole("img", { name: m.name });
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/member-photos\//);

    // photo_shows_on_checkin
    await page.goto("/");
    await scan(page, m.code);
    await expect(result(page).getByRole("img", { name: m.name })).toBeVisible();
  });

  test("non_image_rejected", async ({ page }) => {
    const m = await member(page);
    await uploadPhoto(page, m.id, "package.json");
    await expect(page.getByText("ไฟล์ต้องเป็นรูปภาพขนาดไม่เกิน 15MB")).toBeVisible();
  });

  test("public_receipt_has_no_photo", async ({ page, browser }) => {
    const m = await member(page);
    await uploadPhoto(page, m.id, "tests/fixtures/member.png");
    await expect(page.getByRole("img", { name: m.name })).toBeVisible();
    await page.goto("/sell");
    await pickBuyer(page, m.name);
    await addPackage(page, "รายวัน");
    await pay(page);
    const url = (await page.getByRole("button", { name: "คัดลอกลิงก์ใบเสร็จ" }).getAttribute("data-share-url"))!;
    const anon = await (await browser.newContext()).newPage();
    await anon.goto(url);
    await expect(anon.getByTestId("receipt-no")).toBeVisible();
    await expect(anon.locator('img[src*="member-photos"]')).toHaveCount(0);
  });
});
