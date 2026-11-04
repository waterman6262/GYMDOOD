// Reads a line from the terminal without ever echoing what is typed.
// Keys are handled one by one in raw mode, so Backspace can't make the
// terminal redraw the line (which is how readline-based prompts leak).
/**
 * @param {string} question
 * @param {{ input?: NodeJS.ReadableStream & { isTTY?: boolean; isRaw?: boolean; setRawMode?: (raw: boolean) => void }, output?: NodeJS.WritableStream }} [streams]
 * @returns {Promise<string>}
 */
export function askHidden(question, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve, reject) => {
    output.write(question);
    let value = "";
    const wasRaw = input.isRaw ?? false;
    if (input.isTTY) input.setRawMode(true);
    input.resume();

    function finish() {
      input.off("data", onData);
      if (input.isTTY) input.setRawMode(wasRaw);
      input.pause();
      output.write("\n");
    }

    function onData(chunk) {
      for (const ch of chunk.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          finish();
          reject(new Error("ยกเลิกแล้ว"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    }

    input.on("data", onData);
  });
}
