import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import type { Id } from "@convex/dataModel";
import { useAccessCode } from "../hooks/useAccessCode";

type ChannelType = "email" | "slack" | "discord";
type Channel = {
  _id: Id<"notification_channels">;
  type: ChannelType;
  label: string;
  masked: string;
  status: "pending" | "verified";
};

const TYPE_COPY: Record<ChannelType, { label: string; placeholder: string; hint: string }> = {
  email: { label: "Email", placeholder: "you@example.com", hint: "We'll email a 6-digit code to confirm it." },
  slack: {
    label: "Slack",
    placeholder: "https://hooks.slack.com/services/…",
    hint: "Paste an Incoming Webhook URL for the channel. We'll post a 6-digit code there to confirm it.",
  },
  discord: {
    label: "Discord",
    placeholder: "https://discord.com/api/webhooks/…",
    hint: "Paste a channel webhook URL (Channel settings → Integrations). We'll post a 6-digit code there to confirm it.",
  },
};

function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  // Convex wraps server errors; keep just the message we threw.
  const m = msg.match(/Uncaught Error: (.*?)(?: at |\n|$)/);
  return m?.[1] ?? "Something went wrong";
}

function ChannelRow({ channel }: { channel: Channel }) {
  const { code } = useAccessCode();
  const args = code ? { code } : {};
  const confirm = useMutation(api.notifications.confirmChannel);
  const resend = useMutation(api.notifications.resendCode);
  const remove = useMutation(api.notifications.removeChannel);
  const [entered, setEntered] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setting-row" style={{ alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div className="setting-label">
          {channel.label} <span className="sdek">· {TYPE_COPY[channel.type].label}</span>
        </div>
        <div className="sdek">
          {channel.masked} · {channel.status === "verified" ? "Confirmed" : "Waiting for your code"}
        </div>
        {channel.status === "pending" && (
          <form
            className="notif-confirm"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const res = await confirm({ ...args, channelId: channel._id, entered });
                if (res && !res.ok) setMessage("That code doesn't match.");
              });
            }}
          >
            <input
              className="ai-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit code"
              value={entered}
              onChange={(e) => setEntered(e.target.value.replace(/\D/g, ""))}
              aria-label="Confirmation code"
            />
            <button className="btn" type="submit" disabled={busy || entered.length !== 6}>
              Confirm
            </button>
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await resend({ ...args, channelId: channel._id });
                  setMessage("New code sent.");
                })
              }
            >
              Resend
            </button>
          </form>
        )}
        {message && <div className="sdek" role="status">{message}</div>}
      </div>
      <button className="btn" disabled={busy} onClick={() => void run(() => remove({ ...args, channelId: channel._id }))}>
        Remove
      </button>
    </div>
  );
}

export function NotificationChannels() {
  const { code } = useAccessCode();
  const args = code ? { code } : {};
  // Typed by hand: the notifications<->notificationDelivery modules reference
  // each other, so Convex infers these results as `any`.
  const channels = useQuery(api.notifications.listChannels, args) as Channel[] | null | undefined;
  const add = useMutation(api.notifications.addChannel);
  const [type, setType] = useState<ChannelType>("email");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await add({ ...args, type, label, target });
      setLabel("");
      setTarget("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <div>
          <div className="setting-label">Notifications</div>
          <div className="sdek">
            Add a place to get notified, then pick what you want to hear about from a board's bell menu. A channel
            only works once you've entered the code we send to it.
          </div>
        </div>
      </div>
      {(channels ?? []).map((c) => (
        <ChannelRow key={c._id} channel={c} />
      ))}
      <form className="setting-row notif-add" onSubmit={(e) => void submit(e)}>
        <select
          className="ai-input"
          value={type}
          onChange={(e) => setType(e.target.value as ChannelType)}
          aria-label="Channel type"
        >
          {(Object.keys(TYPE_COPY) as ChannelType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_COPY[t].label}
            </option>
          ))}
        </select>
        <input
          className="ai-input"
          placeholder="Name (e.g. My email)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="Channel name"
        />
        <input
          className="ai-input notif-add__target"
          placeholder={TYPE_COPY[type].placeholder}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Channel address"
        />
        <button className="btn" type="submit" disabled={busy || !target.trim()}>
          Send code
        </button>
        <div className="sdek notif-add__hint">{error || TYPE_COPY[type].hint}</div>
      </form>
    </>
  );
}
