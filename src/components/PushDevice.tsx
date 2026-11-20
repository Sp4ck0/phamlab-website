import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessCode } from "../hooks/useAccessCode";
import { serverMessage } from "../lib/serverError";
import { deviceLabel, isIos, pushSupport, urlBase64ToUint8Array } from "../lib/push";
import { readThisDeviceId, writeThisDeviceId } from "../lib/pushDevice";

/**
 * The prompt to turn notifications on for this device. Once it's on, this device
 * is just another row in the channel list (tagged "This device", with Remove),
 * so this renders nothing then.
 */
export function PushDevice({ channelIds }: { channelIds: string[] }) {
  const { code } = useAccessCode();
  const args = code ? { code } : {};
  // null until the backend has VAPID keys: the prompt stays hidden until push works.
  const vapid = useQuery(api.notifications.vapidPublicKey, {}) as string | null | undefined;
  const addPush = useMutation(api.notifications.addPushChannel);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [channelId, setChannelId] = useState(readThisDeviceId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const ua = navigator.userAgent;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const support = pushSupport({
    hasPush: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    ios: isIos(ua, navigator.maxTouchPoints),
    standalone,
  });

  useEffect(() => {
    if (support !== "ok") return;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setHasSubscription(!!sub));
  }, [support]);

  if (!vapid || support === "unsupported") return null;
  if (support === "needs-install") {
    return (
      <div className="setting-row">
        <div className="setting-label">Get notifications on this {isIos(ua, navigator.maxTouchPoints) ? "iPhone" : "device"}</div>
        <div className="sdek">
          Add phamlab to your Home Screen first, then open it from there and turn notifications on.{" "}
          <a href={`${import.meta.env.BASE_URL}pwa/`}>Show me how</a>
        </div>
      </div>
    );
  }

  // Already connected: its row in the list below is the one place to manage it.
  if (hasSubscription && channelId && channelIds.includes(channelId)) return null;

  async function turnOn() {
    setBusy(true);
    setMessage("");
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setMessage("Notifications are blocked for phamlab. Allow them in your device's settings, then try again.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid!) }));
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("Incomplete subscription");
      const id = await addPush({
        ...args,
        label: deviceLabel(ua, navigator.maxTouchPoints),
        subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
      });
      writeThisDeviceId(id);
      setChannelId(id);
      setHasSubscription(true);
    } catch (e) {
      setMessage(serverMessage(e, "Couldn't turn on notifications on this device"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setting-row" style={{ alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div className="setting-label">Get notifications on this device</div>
        <div className="sdek">You'll get a push for the boards you choose below.</div>
        {message && <div className="sdek" role="status">{message}</div>}
      </div>
      <button className="btn" disabled={busy} onClick={() => void turnOn()}>
        Turn on notifications
      </button>
    </div>
  );
}
