import assert from "node:assert/strict";
import test from "node:test";
import { clientIp, clientPlace, deviceLabel, formatLoginWhen, loginBannerText } from "./login-device.ts";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("an iPhone Safari agent is not read as a Mac", () => {
  assert.equal(deviceLabel(IPHONE_SAFARI), "iPhone · Safari");
});

test("chrome on android stays chrome", () => {
  assert.equal(
    deviceLabel("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"),
    "Android · Chrome",
  );
});

test("client ip prefers the first forwarded address", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.8, 10.0.0.1",
    "x-real-ip": "198.51.100.2",
  });
  assert.equal(clientIp(headers), "203.0.113.8");
  assert.equal(clientIp(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
});

test("vercel city headers are decoded", () => {
  const headers = new Headers({
    "x-vercel-ip-city": "%D0%A7%D0%B8%D0%BA%D0%B0%D0%B3%D0%BE",
    "x-vercel-ip-country": "US",
  });
  assert.deepEqual(clientPlace(headers), { city: "Чикаго", country: "US" });
});

test("banner uses the viewer's timezone and skips a missing place", () => {
  const when = formatLoginWhen("2026-11-10T20:20:00.000Z", "Europe/Moscow");
  assert.equal(when, "10 ноября в 23:20");
  assert.equal(
    loginBannerText({
      device: "iPhone · Safari",
      city: "Чикаго",
      country: "US",
      ip: "1.2.3.4",
      when: "10 ноября в 15:20",
    }),
    "Вход в аккаунт: iPhone · Safari, Чикаго, IP 1.2.3.4, 10 ноября в 15:20",
  );
});
