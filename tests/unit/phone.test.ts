import { describe, expect, test } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  test("strips dashes", () => {
    expect(normalizePhone("081-234-5678")).toBe("0812345678");
  });

  test("strips spaces", () => {
    expect(normalizePhone(" 081 234 5678 ")).toBe("0812345678");
  });
});
