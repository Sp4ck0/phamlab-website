import test from "node:test";
import assert from "node:assert/strict";
import { detectPlatform } from "./platform.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36";
const INSTAGRAM_IOS = IPHONE + " Instagram 330.0.0.0";
const MAC = IPAD_DESKTOP;

test("already installed wins over everything", () => {
  assert.equal(detectPlatform(IPHONE, true), "installed");
  assert.equal(detectPlatform(INSTAGRAM_IOS, true), "installed");
});
test("iPhone Safari is ios", () => assert.equal(detectPlatform(IPHONE, false), "ios"));
test("iPadOS with a desktop user agent is ios, a real Mac is not", () => {
  assert.equal(detectPlatform(IPAD_DESKTOP, false, 5), "ios");
  assert.equal(detectPlatform(MAC, false, 0), "other");
});
test("in-app browsers are detected before ios", () => {
  assert.equal(detectPlatform(INSTAGRAM_IOS, false), "in-app");
  assert.equal(detectPlatform(ANDROID_WEBVIEW, false), "in-app");
});
test("Android Chrome is other (it installs via beforeinstallprompt)", () => {
  assert.equal(detectPlatform(ANDROID, false, 5), "other");
});
