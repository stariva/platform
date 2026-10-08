import { describe, expect, test } from "bun:test";
import { suggestEmailFix } from "./email-typo";

describe("suggestEmailFix", () => {
  test("fixes common domain typos", () => {
    expect(suggestEmailFix("olga@gmial.com")).toBe("olga@gmail.com");
    expect(suggestEmailFix("olga@gmail.ru")).toBe("olga@gmail.com");
    expect(suggestEmailFix("olga@yandx.ru")).toBe("olga@yandex.ru");
    expect(suggestEmailFix("olga@mail.ry")).toBe("olga@mail.ru");
    expect(suggestEmailFix("olga@ramblr.ru")).toBe("olga@rambler.ru");
  });

  test("leaves correct and unknown domains alone", () => {
    expect(suggestEmailFix("olga@mail.ru")).toBeNull();
    expect(suggestEmailFix("olga@Gmail.com")).toBeNull();
    expect(suggestEmailFix("olga@stariva.ru")).toBeNull();
    expect(suggestEmailFix("olga@bk.ru")).toBeNull();
    expect(suggestEmailFix("olga@")).toBeNull();
    expect(suggestEmailFix("olga")).toBeNull();
  });
});
