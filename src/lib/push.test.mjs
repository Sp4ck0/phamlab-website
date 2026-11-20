import test from "node:test";
import assert from "node:assert/strict";
import { deviceLabel, isIos, pushSupport, urlBase64ToUint8Array } from "./push.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36";

test("deviceLabel names the device", () => {
  assert.equal(deviceLabel(IPHONE), "iPhone");
  assert.equal(deviceLabel(MAC, 5), "iPad"); // iPadOS reports a Mac user agent
  assert.equal(deviceLabel(MAC, 0), "Mac");
  assert.equal(deviceLabel(ANDROID, 5), "Android");
  assert.equal(deviceLabel(WINDOWS), "Windows PC");
  assert.equal(deviceLabel("something else"), "This device");
});

test("isIos matches iPhone and touch Macs only", () => {
  assert.equal(isIos(IPHONE), true);
  assert.equal(isIos(MAC, 5), true);
  assert.equal(isIos(MAC, 0), false);
  assert.equal(isIos(ANDROID, 5), false);
});

test("pushSupport: iOS Safari must install first, other browsers just lack it", () => {
  assert.equal(pushSupport({ hasPush: true, ios: true, standalone: true }), "ok");
  assert.equal(pushSupport({ hasPush: false, ios: true, standalone: false }), "needs-install");
  assert.equal(pushSupport({ hasPush: false, ios: false, standalone: false }), "unsupported");
  assert.equal(pushSupport({ hasPush: false, ios: true, standalone: true }), "unsupported");
});

test("urlBase64ToUint8Array decodes base64url with and without padding", () => {
  // "hello?>" -> aGVsbG8_Pg in base64url (contains _ which is / in base64)
  assert.deepEqual([...urlBase64ToUint8Array("aGVsbG8_Pg")], [...Buffer.from("hello?>")]);
  assert.deepEqual([...urlBase64ToUint8Array("aGVsbG8_Pg==")], [...Buffer.from("hello?>")]);
});
