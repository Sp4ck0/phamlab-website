import { Fragment, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useParams } from "react-router-dom";

// One owner for native restoration, mounted above Routes. Every entry, trip
// pages included, starts at the top; jumping to today or to an AI edit is done
// by DetailedView.
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
