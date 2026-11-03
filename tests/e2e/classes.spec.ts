import { expect, test, type Page } from "@playwright/test";
import { addPackage, login, newMember, OWNER, pay, pickBuyer, STAFF } from "./helpers";

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

const bkkDate = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(Date.now() + offset * 86_400_000));
const bkkHourMinute = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const tooLateForToday = () => bkkHourMinute() >= "22:50";

/** Owner creates a โยคะ session at 23:00 (50 min) and ends on that session's page. Returns its URL. */
async function ownerCreatesSession(page: Page, opts: { capacity: number; dayOffset: number; repeat?: number }) {
  await page.goto("/classes");
  await page.getByLabel("ชนิดคลาส").selectOption({ label: "โยคะ" });
  await page.getByLabel("วันที่").fill(bkkDate(opts.dayOffset));
  await page.getByLabel("เวลาเริ่ม").fill("23:00");
  await page.getByLabel("ระยะเวลา (นาที)").fill("50");
  await page.getByLabel("จำนวนที่นั่ง").fill(String(opts.capacity));
  await page.getByLabel("ทำซ้ำทุกสัปดาห์ (ครั้ง)").fill(String(opts.repeat ?? 1));
  await page.getByRole("button", { name: "บันทึกรอบคลาส" }).click();
  await expect(page).toHaveURL(/\/classes\/[0-9a-f-]{36}$/);
  return page.url();
}

/** New member with a package bought for them; returns their name. */
async function memberWith(page: Page, packageName?: string) {
  const name = `คลาส ทดสอบ${String(Date.now()).slice(-7)}`;
  await newMember(page, name);
  if (packageName) {
    await page.goto("/sell");
    await pickBuyer(page, name);
    await addPackage(page, packageName);
    await pay(page);
  }
  return name;
}

async function book(page: Page, sessionUrl: string, name: string) {
  await page.goto(sessionUrl);
  await page.getByLabel("ค้นหาสมาชิกเพื่อจอง").fill(name);
  await page.getByRole("button", { name: `เลือก ${name}` }).click();
}

const rosterRow = (page: Page, name: string) => page.getByTestId("roster").getByRole("listitem").filter({ hasText: name });

test.describe("classes", () => {
  test("owner_creates_weekly_sessions", async ({ page }) => {
    await login(page, OWNER);
    await ownerCreatesSession(page, { capacity: 10, dayOffset: 1, repeat: 3 });
    await page.goto(`/classes?week=${bkkDate(1)}`);
    await page.getByRole("link", { name: "สัปดาห์หน้า" }).click();
    await expect(page.getByTestId("session").filter({ hasText: "โยคะ" }).filter({ hasText: "23:00" }).first()).toBeVisible();
    await page.getByRole("link", { name: "สัปดาห์หน้า" }).click();
    await expect(page.getByTestId("session").filter({ hasText: "โยคะ" }).filter({ hasText: "23:00" }).first()).toBeVisible();
  });

  test("staff_books_and_attends", async ({ page }) => {
    test.skip(tooLateForToday(), "today's 23:00 class would end before the test finishes");
    await login(page, OWNER);
    const url = await ownerCreatesSession(page, { capacity: 10, dayOffset: 0 });
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await login(page, STAFF);
    const name = await memberWith(page, "10 ครั้ง");
    await book(page, url, name);
    await expect(rosterRow(page, name)).toContainText("จองแล้ว");
    await expect(page.getByTestId("booked-count")).toHaveText(/^จองแล้ว 1\//);
    await rosterRow(page, name).getByRole("button", { name: "มาแล้ว" }).click();
    await expect(rosterRow(page, name)).toContainText("มาแล้ว");
    await expect(rosterRow(page, name).getByRole("button", { name: "มาแล้ว" })).toHaveCount(0);

    await page.goto("/");
    await expect(page.getByTestId("today-checkins")).toContainText(name);
    await page.goto(`/members?q=${encodeURIComponent(name)}`);
    await page.getByRole("link", { name }).click();
    await expect(page.getByTestId("membership-row")).toContainText("เหลือ 9 ครั้ง");
  });

  test("full_class_blocked", async ({ page }) => {
    await login(page, OWNER);
    const url = await ownerCreatesSession(page, { capacity: 1, dayOffset: 1 });
    const a = await memberWith(page, "รายเดือน");
    const b = await memberWith(page, "รายเดือน");
    await book(page, url, a);
    await expect(rosterRow(page, a)).toContainText("จองแล้ว");
    await book(page, url, b);
    await expect(page.getByText("คลาสเต็มแล้ว")).toBeVisible();
  });

  test("no_package_cannot_book", async ({ page }) => {
    await login(page, OWNER);
    const url = await ownerCreatesSession(page, { capacity: 5, dayOffset: 1 });
    const name = await memberWith(page);
    await book(page, url, name);
    await expect(page.getByText("สมาชิกไม่มีแพ็กเกจที่ใช้ได้ในวันคลาส")).toBeVisible();
  });

  test("cancel_booking_frees_seat", async ({ page }) => {
    await login(page, OWNER);
    const url = await ownerCreatesSession(page, { capacity: 5, dayOffset: 1 });
    const name = await memberWith(page, "รายเดือน");
    await book(page, url, name);
    await rosterRow(page, name).getByRole("button", { name: "ยกเลิกจอง" }).click();
    await expect(page.getByTestId("booked-count")).toHaveText(/^จองแล้ว 0\//);
  });

  test("attend_tomorrow_blocked", async ({ page }) => {
    await login(page, OWNER);
    const url = await ownerCreatesSession(page, { capacity: 5, dayOffset: 1 });
    const name = await memberWith(page, "รายเดือน");
    await book(page, url, name);
    await rosterRow(page, name).getByRole("button", { name: "มาแล้ว" }).click();
    await expect(page.getByText("เช็กชื่อได้เฉพาะวันที่มีคลาส")).toBeVisible();
  });

  test("owner_cancels_session", async ({ page }) => {
    await login(page, OWNER);
    const url = await ownerCreatesSession(page, { capacity: 5, dayOffset: 1 });
    const name = await memberWith(page, "รายเดือน");
    await book(page, url, name);
    await page.getByRole("button", { name: "ยกเลิกรอบคลาส" }).click();
    await expect(page.getByText("รอบนี้ถูกยกเลิก")).toBeVisible();
    // Existing bookings show as cancelled, with no way to mark attendance or book more.
    await expect(rosterRow(page, name)).toContainText("ยกเลิก");
    await expect(rosterRow(page, name).getByRole("button")).toHaveCount(0);
    await expect(page.getByLabel("ค้นหาสมาชิกเพื่อจอง")).toHaveCount(0);
  });

  test("staff_cannot_create_session", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/classes");
    await expect(page.getByRole("button", { name: "บันทึกรอบคลาส" })).toHaveCount(0);
  });
});

async function schedulePt(page: Page, name: string) {
  await page.goto(`/members?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name }).click();
  await page.getByRole("link", { name: "นัด PT" }).click();
  await expect(page.getByTestId("pt-member")).toContainText(name);
  await page.getByLabel("แพ็กเกจ PT").selectOption({ index: 0 });
  await page.getByLabel("เทรนเนอร์").selectOption({ label: "โค้ชเอ" });
  await page.getByLabel("วันที่").fill(bkkDate(0));
  await page.getByLabel("เวลา").fill("23:00");
  await page.getByRole("button", { name: "บันทึกนัด" }).click();
  await expect(page.getByTestId("pt-upcoming").getByRole("listitem").filter({ hasText: name })).toBeVisible();
}

async function memberPtHours(page: Page, name: string) {
  await page.goto(`/members?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name }).click();
  return page.getByTestId("membership-row");
}

test.describe("pt", () => {
  test("pt_flow", async ({ page }) => {
    await login(page, STAFF);
    const name = await memberWith(page, "PT 10 ชั่วโมง");
    await schedulePt(page, name);
    const appt = page.getByTestId("pt-upcoming").getByRole("listitem").filter({ hasText: name });
    await appt.getByRole("button", { name: "เทรนแล้ว" }).click();
    await expect(page.getByTestId("pt-done").getByRole("listitem").filter({ hasText: name })).toBeVisible();
    await expect(await memberPtHours(page, name)).toContainText("เหลือ 9 ชั่วโมง");
  });

  test("pt_cancel_keeps_hours", async ({ page }) => {
    await login(page, STAFF);
    const name = await memberWith(page, "PT 10 ชั่วโมง");
    await schedulePt(page, name);
    const appt = page.getByTestId("pt-upcoming").getByRole("listitem").filter({ hasText: name });
    await appt.getByRole("button", { name: "ยกเลิกนัด" }).click();
    await expect(page.getByTestId("pt-upcoming").getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
    await expect(await memberPtHours(page, name)).toContainText("เหลือ 10 ชั่วโมง");
  });

  test("pt_no_package_message", async ({ page }) => {
    await login(page, STAFF);
    const name = await memberWith(page);
    await page.goto("/pt");
    await page.getByLabel("ค้นหาสมาชิก").fill(name);
    await page.getByRole("button", { name: `เลือก ${name}` }).click();
    await expect(page.getByText("สมาชิกนี้ไม่มีแพ็กเกจ PT ที่ใช้ได้")).toBeVisible();
  });
});
