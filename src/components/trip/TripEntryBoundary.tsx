import { Fragment, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useParams } from "react-router-dom";

// One owner for native restoration, mounted above Routes. Non-trip entries use
// a top policy; authorized trip content places its own compact itinerary start.
export function RouteScrollPolicy() {
  const location = useLocation();
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.key]);
  return null;
}

// Route key covers PUSH/REPLACE/POP; slug also covers initial/default entries.
// A retained external document return is a fresh presentation, not restoration.
export function TripEntryBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { slug } = useParams();
  const [epoch, setEpoch] = useState(0);
  useLayoutEffect(() => {
    function returned(event: PageTransitionEvent) {
      if (event.persisted) setEpoch(value => value + 1);
    }
    window.addEventListener("pageshow", returned);
    return () => window.removeEventListener("pageshow", returned);
  }, []);
  return <Fragment key={`${location.key}:${slug}:${epoch}`}>{children}</Fragment>;
}

// Mount only after the current trip is authorized and ready. No cached payload,
// location state, preference storage or shared mutation participates in reset.
export function ItineraryStart({ children }: { children: ReactNode }) {
  const start = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let frame = 0;
    let cancelled = false;
    function place() {
      if (!cancelled) start.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
    function cancel() { cancelled = true; window.cancelAnimationFrame(frame); }
    const events = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    events.forEach(event => window.addEventListener(event, cancel, { passive: true }));
    place();
    frame = window.requestAnimationFrame(() => {
      place();
      frame = window.requestAnimationFrame(place);
    });
    return () => {
      cancel();
      events.forEach(event => window.removeEventListener(event, cancel));
    };
  }, []);
  return <div ref={start} className="itinerary-start">{children}</div>;
}
