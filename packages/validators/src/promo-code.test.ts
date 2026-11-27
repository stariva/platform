import { expect, test } from "bun:test";
import { EMPTY_PROMO_CODE, promoCodeFormSchema } from "./promo-code";

test("fixed promo amounts accept one kopeck and reject smaller values", () => {
  const input = {
    ...EMPTY_PROMO_CODE,
    code: "FIXED",
    discountType: "fixed",
    discountValue: 0.01,
    minOrderAmount: 0.01,
  };
  expect(promoCodeFormSchema.safeParse(input).success).toBe(true);
  for (const field of ["discountValue", "minOrderAmount"] as const) {
    const result = promoCodeFormSchema.safeParse({ ...input, [field]: 1e-10 });
    expect(result.error?.issues[0]?.path).toEqual([field]);
  }
});
