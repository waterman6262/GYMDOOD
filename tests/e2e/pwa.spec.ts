import { expect, test } from "@playwright/test";

type Manifest = { display: string; start_url: string; icons: { src: string; sizes: string; purpose?: string }[] };

test.describe("pwa", () => {
  test("manifest_served", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const manifest = (await res.json()) as Manifest;
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  test("icons_served", async ({ request }) => {
    const manifest = (await (await request.get("/manifest.webmanifest")).json()) as Manifest;
    for (const src of [...manifest.icons.map((i) => i.src), "/icons/apple-touch-icon.png"]) {
      const res = await request.get(src, { maxRedirects: 0 });
      expect(res.status(), src).toBe(200);
      expect(res.headers()["content-type"], src).toContain("image/png");
    }
  });

  test("login_page_links_manifest", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#4f46e5");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });

  test("manifest_public_without_login", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });
});

test.describe("security headers", () => {
  test("security_headers_present", async ({ request }) => {
    const headers = (await request.get("/login")).headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("camera_allowed_by_permissions_policy", async ({ request }) => {
    const policy = (await request.get("/login")).headers()["permissions-policy"];
    expect(policy).toContain("camera=(self)");
    expect(policy).toContain("microphone=()");
  });
});
