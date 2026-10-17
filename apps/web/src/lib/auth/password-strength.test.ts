import { expect, test } from "bun:test";
import { passwordStrength } from "./password-strength";

test("a password shorter than the minimum is weak", () => {
  expect(passwordStrength("")).toBe("weak");
  expect(passwordStrength("Ab1!xyz")).toBe("weak");
});

test("common and trivially patterned passwords are weak whatever their length", () => {
  expect(passwordStrength("Password1")).toBe("weak");
  expect(passwordStrength("12345678")).toBe("weak");
  expect(passwordStrength("aaaaaaaaaaaaaaaa")).toBe("weak");
  expect(passwordStrength("abcdefghijklmnop")).toBe("weak");
});

test("a short single-class password is weak", () => {
  expect(passwordStrength("sunflower")).toBe("weak");
});

test("mixing character classes lifts an 8+ character password to medium", () => {
  expect(passwordStrength("Sunflower7")).toBe("medium");
});

test("length alone can make a password strong", () => {
  expect(passwordStrength("тихий вечер у моря")).toBe("strong");
  expect(passwordStrength("correct horse battery")).toBe("strong");
});

test("a long password with mixed classes is strong", () => {
  expect(passwordStrength("Sunflower-Field7")).toBe("strong");
});
