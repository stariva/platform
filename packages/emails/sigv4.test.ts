import { expect, test } from "bun:test";

import { signRequest } from "./sigv4";

// Тест get-vanilla из набора проверок AWS Signature V4 (документация AWS).
test("signs the AWS get-vanilla test vector", () => {
  const headers = signRequest({
    method: "GET",
    url: new URL("https://example.amazonaws.com/"),
    headers: {},
    body: "",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    service: "service",
    now: new Date("2015-08-30T12:36:00Z"),
  });
  expect(headers.Authorization).toBe(
    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
  );
  expect(headers["x-amz-date"]).toBe("20150830T123600Z");
});
