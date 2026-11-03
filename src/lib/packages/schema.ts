import { z } from "zod";

// Form values arrive as strings, so numbers are coerced. An empty field
// coerces to 0, which the positive() checks reject with the same message.
const positiveInt = (error: string) => z.coerce.number({ error }).int({ error }).positive({ error });

const common = {
  name: z.string({ error: "กรุณากรอกชื่อแพ็กเกจ" }).trim().min(1, { error: "กรุณากรอกชื่อแพ็กเกจ" }),
  price: z.coerce.number({ error: "กรุณาระบุราคา" }).min(0, { error: "ราคาต้องไม่ติดลบ" }),
  seats: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2)], { error: "จำนวนสิทธิ์ต้องเป็น 1 หรือ 2" })),
  tag: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
};

const durationDays = positiveInt("กรุณาระบุจำนวนวันที่ใช้ได้");

export const packageTypeSchema = z.discriminatedUnion("kind", [
  z.object({
    ...common,
    kind: z.literal("day"),
    duration_days: z.unknown().transform(() => 1 as const),
  }),
  z.object({ ...common, kind: z.literal("duration"), duration_days: durationDays }),
  z.object({
    ...common,
    kind: z.literal("visits"),
    duration_days: durationDays,
    visits: positiveInt("กรุณาระบุจำนวนครั้ง"),
  }),
  z.object({
    ...common,
    kind: z.literal("pt"),
    duration_days: durationDays,
    pt_sessions: positiveInt("กรุณาระบุจำนวนชั่วโมง PT"),
  }),
]);

export type PackageKind = "day" | "duration" | "visits" | "pt";
export type PackageTypeInput = z.input<typeof packageTypeSchema>;
export type PackageTypeData = z.output<typeof packageTypeSchema>;

export const PACKAGE_KIND_LABELS: Record<PackageKind, string> = {
  day: "รายวัน",
  duration: "ตามระยะเวลา",
  visits: "นับครั้ง",
  pt: "PT",
};
