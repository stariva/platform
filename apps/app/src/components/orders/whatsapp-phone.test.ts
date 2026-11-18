import assert from "node:assert/strict";
import { test } from "node:test";
import { whatsappPhone } from "./whatsapp-phone";

test("WhatsApp: complete international and Russian trunk formats", () => {
  for (const input of [
    "+7 (916) 123-45-67",
    "8 (916) 123-45-67",
    "79161234567",
  ]) {
    assert.equal(whatsappPhone(input), "79161234567");
  }
  assert.equal(whatsappPhone("+44 20 7946 0018"), "442079460018");
});

test("WhatsApp: ambiguous, incomplete and malformed inputs stay plain text", () => {
  for (const input of [
    "",
    "12345",
    "9161234567",
    "02079460018",
    "+7 123",
    "+999123456789",
    "+7 000 123 45 67",
    "call +79161234567",
    "+79161234567 ext 12",
  ]) {
    assert.equal(whatsappPhone(input), null, input);
  }
});
