import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../hooks/useAccessCode";
import { serverMessage } from "../lib/serverError";

type PushChannel = { _id: Id<"notification_channels">; type: string; masked: string };

// Must match the backend's mask for a push channel (notifications.ts maskTarget).
const maskFor = (endpoint: string) => `device …${endpoint.slice(-6)}`;

function keyBytes(base64Url: string) {
  const raw = atob(base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "="));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** "Notify this device": subscribes this browser to Web Push and stores it as a channel. */
export function PushSetup({ channels }: { channels: PushChannel[] }) {
  const { code } = useAccessCode();
  const args = code ? { code } : {};
  const publicKey = useQuery(api.notifications.pushPublicKey, {});
  const add = useMutation(api.notifications.addPushChannel);
  const remove = useMutation(api.notifications.removeChannel);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEndpoint(sub?.endpoint ?? null))
      .catch(() => {});
  }, []);

  // Not set up on this deployment (no VAPID key): offer nothing rather than a dead button.
  if (publicKey === undefined || publicKey === null) return null;

  const mine = endpoint ? channels.find((c) => c.type === "push" && c.masked === maskFor(endpoint)) : undefined;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(serverMessage(e, "Couldn't change notifications on this device"));
    } finally {
      setBusy(false);
    }
  }

  async function enable(key: string) {
    if ((await Notification.requestPermission()) !== "granted") {
      setMessage("Notifications are blocked for this site. Allow them in your browser's site settings, then try again.");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    const { keys } = sub.toJSON();
    if (!keys?.p256dh || !keys.auth) throw new Error("This browser gave an incomplete subscription");
    await add({ ...args, endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth });
    setEndpoint(sub.endpoint);
    await reg.showNotification("Notifications are on", { body: "You'll get alerts for the boards you choose below.", icon: "icon-192.png" });
  }

  async function disable(channelId: Id<"notification_channels">) {
    await remove({ ...args, channelId });
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    await sub?.unsubscribe();
    setEndpoint(null);
  }

  return (
    <div className="setting-row" style={{ alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div className="setting-label notif-name">
          <span aria-hidden="true">🔔</span> This device
        </div>
        <div className="sdek">
          {!supported
            ? isIos
              ? "On iPhone and iPad, first tap Share → Add to Home Screen, then open phamlab from your Home Screen to turn this on."
              : "This browser can't receive push notifications."
            : mine
              ? "On — alerts show up on this device, even when the site is closed."
              : "Get alerts on this device, even when the site is closed. Install the site to your Home Screen for the most reliable delivery."}
        </div>
        {message && <div className="sdek" role="status">{message}</div>}
      </div>
      {supported && (
        <button
          className="btn"
          disabled={busy}
          onClick={() => void run(() => (mine ? disable(mine._id) : enable(publicKey)))}
        >
          {busy ? "Working…" : mine ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  );
}
