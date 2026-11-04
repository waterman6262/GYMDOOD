// Creates the first owner account on a fresh (production) database, where
// seed.sql must never run. The password is typed in, never passed as an argument.
//
//   node scripts/create-owner.mjs --env .env.production.local --email you@example.com --name "ชื่อเจ้าของ"
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from --env or the environment).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { askHidden } from "./lib/hidden-prompt.mjs";

const { values: args } = parseArgs({
  options: {
    env: { type: "string" },
    email: { type: "string" },
    name: { type: "string" },
    help: { type: "boolean" },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (args.help || !args.email || !args.name) {
  console.log('ใช้: node scripts/create-owner.mjs --env <ไฟล์ env> --email <อีเมล> --name "<ชื่อ>"');
  process.exit(args.help ? 0 : 1);
}

const env = { ...process.env };
if (args.env) {
  for (const line of readFileSync(args.env, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("ไม่พบ NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY");

const password = env.OWNER_PASSWORD ?? (await askHidden("รหัสผ่านเจ้าของ (อย่างน้อย 10 ตัวอักษร): "));
if (password.length < 10) fail("รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร");

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: created, error: authError } = await admin.auth.admin.createUser({
  email: args.email.trim().toLowerCase(),
  password,
  email_confirm: true,
});
if (authError?.code === "email_exists") fail("มีบัญชีนี้อยู่แล้ว ไม่ได้สร้างซ้ำ");
if (authError || !created.user) fail(`สร้างบัญชีไม่สำเร็จ: ${authError?.message ?? "ไม่ทราบสาเหตุ"}`);

const { error: staffError } = await admin
  .from("staff")
  .insert({ user_id: created.user.id, name: args.name.trim(), role: "owner" });
if (staffError) {
  // Never leave a login that has no staff row behind.
  await admin.auth.admin.deleteUser(created.user.id);
  fail(`สร้างบัญชีไม่สำเร็จ: ${staffError.message}`);
}

console.log(`สร้างบัญชีเจ้าของเรียบร้อย: ${created.user.email}`);
