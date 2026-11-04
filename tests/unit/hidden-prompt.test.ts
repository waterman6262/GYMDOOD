import { PassThrough } from "node:stream";
import { describe, expect, test } from "vitest";
import { askHidden } from "../../scripts/lib/hidden-prompt.mjs";

function terminal() {
  const input = new PassThrough();
  const output = new PassThrough();
  let shown = "";
  output.on("data", (chunk) => (shown += chunk.toString()));
  return { input, output, shown: () => shown };
}

describe("askHidden", () => {
  test("backspace_never_echoes_password", async () => {
    const t = terminal();
    const answer = askHidden("PW: ", { input: t.input, output: t.output });
    t.input.write("secret12x\u007f\r");
    await expect(answer).resolves.toBe("secret12");
    expect(t.shown()).toBe("PW: \n");
  });

  test("enter_alone_returns_empty", async () => {
    const t = terminal();
    const answer = askHidden("PW: ", { input: t.input, output: t.output });
    t.input.write("\n");
    await expect(answer).resolves.toBe("");
  });

  test("ctrl_c_cancels", async () => {
    const t = terminal();
    const answer = askHidden("PW: ", { input: t.input, output: t.output });
    t.input.write("abc\u0003");
    await expect(answer).rejects.toThrow("ยกเลิก");
  });
});
