import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../hooks/useAccessCode";
import { serverMessage } from "../lib/serverError";
import { deviceLabel, isIos, pushSupport, urlBase64ToUint8Array } from "../lib/push";

// Which channel row is this device's, so "Turn off" can remove it. Per browser
// (the installed app and Safari keep separate storage, and separate pushes).
const KEY = "phamlab.pushChannelId";
const readId = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const writeId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the toggle still works, it just can't find its row later */
  }
};

/** "Turn on notifications" for this device: the push channel the owner adds from Settings. */
export function PushDevice({ channelIds }: { channelIds: string[] }) {
  const { code } = useAccessCode();
  const args = code ? { code } : {};
  // null until the backend has VAPID keys: the block stays hidden until push works.
  const vapid = useQuery(api.notifications.vapidPublicKey, {}) as string | null | undefined;
  const addPush = useMutation(api.notifications.addPushChannel);
  const removeChannel = useMutation(api.notifications.removeChannel);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [channelId, setChannelId] = useState(readId);
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
        <div className="setting-label">This device</div>
        <div className="sdek">
          To get notifications on this {isIos(ua, navigator.maxTouchPoints) ? "iPhone" : "device"}, add phamlab to your Home Screen first, then
          open it from there. <a href={`${import.meta.env.BASE_URL}pwa/`}>Show me how</a>
        </div>
      </div>
    );
  }

  const on = hasSubscription && !!channelId && channelIds.includes(channelId);

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
      writeId(id);
      setChannelId(id);
      setHasSubscription(true);
    } catch (e) {
      setMessage(serverMessage(e, "Couldn't turn on notifications on this device"));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage("");
    try {
      if (channelId) await removeChannel({ ...args, channelId: channelId as Id<"notification_channels"> });
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      await sub?.unsubscribe();
      writeId(null);
      setChannelId(null);
      setHasSubscription(false);
    } catch (e) {
      setMessage(serverMessage(e, "Couldn't turn off notifications"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setting-row" style={{ alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div className="setting-label">This device</div>
        <div className="sdek">
          {on
            ? "Notifications are on. You'll get a push for the boards you chose below."
            : "Get a push on this device for the boards you choose below."}
        </div>
        {message && <div className="sdek" role="status">{message}</div>}
      </div>
      <button className="btn" disabled={busy} onClick={() => void (on ? turnOff() : turnOn())}>
        {on ? "Turn off" : "Turn on notifications"}
      </button>
    </div>
  );
}
