import { expect, test, type Page } from "@playwright/test";
import { login, OWNER, STAFF } from "./helpers";

const RECEIPT_NO = /R\d{4}-\d{6}/;

async function pickBuyer(page: Page, name: string) {
  await page.getByLabel("ค้นหาผู้ซื้อ").fill(name);
  await page.getByRole("button", { name: `เลือก ${name}` }).click();
  await expect(page.getByTestId("buyer")).toContainText(name);
}

async function addPackage(page: Page, name: string) {
  await page.getByRole("button", { name: `เพิ่ม ${name}`, exact: true }).click();
}

async function pay(page: Page, method: "เงินสด" | "โอน" | "QR PromptPay" = "เงินสด") {
  await page.getByRole("button", { name: method, exact: true }).click();
  await page.getByRole("button", { name: "ชำระเงิน" }).click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/);
  return (await page.getByTestId("receipt-no").textContent())!.trim();
}

async function setPromptPay(page: Page, value: string) {
  await login(page, OWNER);
  await page.goto("/settings/shop");
  await page.getByLabel("เลข PromptPay").fill(value);
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
}

test.describe("sell", () => {
  test("sell_monthly_cash", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/sell");
    await pickBuyer(page, "วิชัย แข็งแรง");
    await addPackage(page, "รายเดือน");
    const receiptNo = await pay(page);
    expect(receiptNo).toMatch(RECEIPT_NO);
    await expect(page.getByTestId("receipt-total")).toHaveText("1,200.00");
    await expect(page.getByText("เงินสด")).toBeVisible();
  });

  test("percent_discount_applies", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/sell");
    await pickBuyer(page, "วิชัย แข็งแรง");
    await addPackage(page, "รายเดือน");
    await page.getByRole("button", { name: "%", exact: true }).click();
    await page.getByLabel("ส่วนลด").fill("10");
    await expect(page.getByTestId("net-total")).toHaveText("1,080.00");
    await pay(page);
    await expect(page.getByTestId("receipt-discount")).toHaveText("120.00");
  });

  test("couple_requires_second_member", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/sell");
    await pickBuyer(page, "ประยุทธ์ ครอบครัว");
    await addPackage(page, "รายเดือน คู่");
    await page.getByRole("button", { name: "เงินสด", exact: true }).click();
    await page.getByRole("button", { name: "ชำระเงิน" }).click();
    await expect(page.getByText("ต้องเลือกสมาชิก 2 คนไม่ซ้ำกัน")).toBeVisible();
    await expect(page).toHaveURL(/\/sell/);

    await page.getByLabel("ค้นหาสมาชิกคนที่ 2").fill("นภา");
    await page.getByRole("button", { name: "เลือก นภา ฟิตเสมอ" }).click();
    await page.getByRole("button", { name: "ชำระเงิน" }).click();
    await expect(page).toHaveURL(/\/sales\//);
  });

  test("double_click_creates_one_sale", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/sell");
    await pickBuyer(page, "นภา ฟิตเสมอ");
    await addPackage(page, "รายวัน");
    await page.getByRole("button", { name: "เงินสด", exact: true }).click();
    await page.getByRole("button", { name: "ชำระเงิน" }).dblclick();
    await expect(page).toHaveURL(/\/sales\//);
    const first = Number((await page.getByTestId("receipt-no").textContent())!.slice(-6));

    // If the double click had made two sales, the next number would jump by 2.
    await page.goto("/sell");
    await pickBuyer(page, "นภา ฟิตเสมอ");
    await addPackage(page, "รายวัน");
    const next = Number((await pay(page)).slice(-6));
    expect(next - first).toBe(1);
  });

  test("prefill_member_from_query", async ({ page }) => {
    await login(page, STAFF);
    await page.goto("/members?q=นภา");
    await page.getByRole("link", { name: "นภา ฟิตเสมอ" }).click();
    await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop();
    await page.goto(`/sell?member=${id}`);
    await expect(page.getByTestId("buyer")).toContainText("นภา ฟิตเสมอ");
  });
});

test.describe.serial("promptpay", () => {
  test("promptpay_without_id_blocked", async ({ page }) => {
    await setPromptPay(page, "");
    await login(page, STAFF);
    await page.goto("/sell");
    await pickBuyer(page, "วิชัย แข็งแรง");
    await addPackage(page, "รายวัน");
    await page.getByRole("button", { name: "QR PromptPay", exact: true }).click();
    await expect(page.getByText("ยังไม่ได้ตั้งเลข PromptPay")).toBeVisible();
    await expect(page.getByRole("button", { name: /ชำระเงิน|ได้รับเงินแล้ว/ })).toBeDisabled();
  });

  test("promptpay_shows_qr", async ({ page }) => {
    await setPromptPay(page, "0812345678");
    await login(page, STAFF);
    await page.goto("/sell");
    await pickBuyer(page, "วิชัย แข็งแรง");
    await addPackage(page, "รายวัน");
    await page.getByRole("button", { name: "QR PromptPay", exact: true }).click();
    await expect(page.getByTestId("promptpay-qr").locator("svg")).toBeVisible();
    await page.getByRole("button", { name: "ได้รับเงินแล้ว" }).click();
    await expect(page).toHaveURL(/\/sales\//);
    await expect(page.getByText("QR PromptPay")).toBeVisible();
  });
});
