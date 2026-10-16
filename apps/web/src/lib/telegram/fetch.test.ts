import assert from "node:assert/strict";
import { createServer } from "node:http";
import { type AddressInfo, connect } from "node:net";
import { test } from "node:test";
import { telegramFetch } from "./fetch";

const listen = (server: ReturnType<typeof createServer>) =>
  new Promise<number>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve((server.address() as AddressInfo).port),
    ),
  );

test("without a proxy the global fetch is used", () => {
  assert.equal(telegramFetch(undefined), fetch);
});

test("requests are tunnelled through the HTTP proxy with its credentials", async () => {
  const target = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, path: req.url, body }));
    });
  });
  const targetPort = await listen(target);

  const connects: { host?: string; auth?: string }[] = [];
  const proxy = createServer();
  proxy.on("connect", (req, clientSocket, head) => {
    connects.push({
      host: req.url,
      auth: req.headers["proxy-authorization"],
    });
    // 3proxy и ему подобные пробрасывают TCP до адреса из CONNECT; тут адрес
    // подменяем на локальный сервер
    const upstream = connect(targetPort, "127.0.0.1", () => {
      clientSocket.write("HTTP/1.1 200 Connection established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => upstream.destroy());
  });
  const proxyPort = await listen(proxy);

  try {
    const res = await telegramFetch(
      `http://user:secret@127.0.0.1:${proxyPort}`,
    )("http://telegram.test/bottoken/sendMessage", {
      method: "POST",
      body: JSON.stringify({ text: "hi" }),
      signal: AbortSignal.timeout(5_000),
    });
    assert.deepEqual(await res.json(), {
      ok: true,
      path: "/bottoken/sendMessage",
      body: JSON.stringify({ text: "hi" }),
    });
  } finally {
    proxy.closeAllConnections();
    target.closeAllConnections();
    proxy.close();
    target.close();
  }
  assert.equal(connects.length, 1);
  assert.equal(connects[0]?.host, "telegram.test:80");
  assert.equal(
    connects[0]?.auth,
    `Basic ${Buffer.from("user:secret").toString("base64")}`,
  );
});
