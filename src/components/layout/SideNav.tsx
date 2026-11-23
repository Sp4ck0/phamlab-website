import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type TouchEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { useAccessibleTrips } from "../../hooks/useAccessibleTrips";
import { useAccessCode } from "../../hooks/useAccessCode";
import { useTheme } from "../../hooks/useTheme";
import { useKanbanBoardUnread } from "../../kanban/useKanbanBoards";
import { flagEmoji, navCountdown, navMonthLabel } from "../../lib/tripLogic";
import { loadNavCollapsed, saveNavCollapsed, subscribeNavCollapsed } from "../../lib/navCollapsed";
import { useVersionLogUnseen } from "../../hooks/useVersionLog";
import { VersionLog } from "./VersionLog";
import { ThemeIcon } from "./ThemeIcon";
import { AiButton } from "./AiButton";

export function SideNav() {
  const { trips } = useAccessibleTrips();
  const { slug: activeSlug, boardId: activeBoardId } = useParams();
  const location = useLocation();
  const { code } = useAccessCode();
  const isManagementCode = useQuery(api.management.checkManagementAccess, code ? { code } : "skip");
  const isDatingCode = useQuery(api.dating.checkDatingAccess, code ? { code } : "skip");
  const isAccentCode = useQuery(api.dating.checkAccentAccess, code ? { code } : "skip");
  const { boards } = useKanbanBoardUnread();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const unseen = useVersionLogUnseen();

  // Desktop only: the stylesheet ignores this on phones, which have their own drawer.
  const collapsed = useSyncExternalStore(subscribeNavCollapsed, loadNavCollapsed, () => false);
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-nav-collapsed", collapsed);
    return () => document.documentElement.removeAttribute("data-nav-collapsed");
  }, [collapsed]);

  // Close the mobile drawer whenever the route changes (link tap, back/forward).
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Escape closes the drawer, matching standard dialog/drawer behavior.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // A leftward swipe on the open drawer (or its backdrop) closes it.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: TouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || !isOpen) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dx < -50 && Math.abs(dx) > Math.abs(dy) * 1.5) setIsOpen(false);
  }

  const headerButtons = (
    <span className="nav-actions">
      <AiButton />
      <button
        className="btn btn-icon"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Light mode" : "Dark mode"}
      >
        <ThemeIcon isDark={isDark} />
      </button>
    </span>
  );

  return (
    <>
      <div className="mobile-topbar">
        <button
          className="navtoggle"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
        >
          {isOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
        <span className="navmark"><img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" /></span>
        <span className="navtitle">Pham Lab</span>
        {headerButtons}
      </div>
      <div
        className="navbackdrop"
        data-open={isOpen ? "true" : undefined}
        onClick={() => setIsOpen(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />

      <nav
        className="sidenav"
        data-open={isOpen ? "true" : undefined}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="navhead">
          <span className="navmark"><img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" /></span>
          <span className="navtitle">Pham Lab</span>
          {headerButtons}
        </div>
        {trips && trips.length > 0 && (
          <div className="navgroup">
            <div className="navsection">Trips</div>
            <div className="navlist">
              {trips.map((t) => (
                <Link
                  key={t.slug}
                  className="navitem"
                  data-active={t.slug === activeSlug ? "true" : undefined}
                  to={`/trip/${t.slug}`}
                >
                  <span className="navicon">{t.navIcon}</span>
                  <span className="navtext">
                    <span className="navname">{t.title}</span>
                    <span className="navmeta">
                      <span>{navMonthLabel(t.start, t.end)}</span>
                      <span>
                        {t.countries
                          .filter((c) => c !== "US")
                          .map((c) => flagEmoji(c)?.emoji)
                          .join("")}
                      </span>
                      <span className="navcount">{navCountdown(t.start, t.end)}</span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {code && boards.length > 0 && (
          <div className="navgroup">
            <div className="navsection">Boards</div>
            <div className="navlist">
              {boards.map((b) => (
                <Link
                  key={b._id}
                  className="navitem"
                  data-active={b._id === activeBoardId ? "true" : undefined}
                  to={`/kanban/${b._id}`}
                >
                  <span className="navicon">📝</span>
                  <span className="navtext">
                    <span className="navname">{b.name}</span>
                  </span>
                  {b.unread > 0 && (
                    <span className="navbadge" title="Cards with new replies">
                      {b.unread}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {(isDatingCode || isAccentCode) && (
          <div className="navgroup">
            <div className="navsection">Experimental</div>
            <div className="navlist">
              {isDatingCode && (
                <Link
                  className="navitem"
                  data-active={location.pathname === "/dating-simulator" ? "true" : undefined}
                  to="/dating-simulator"
                >
                  <span className="navicon">💬</span>
                  <span className="navtext">
                    <span className="navname">Dating Simulator</span>
                  </span>
                </Link>
              )}
              {isAccentCode && (
                <Link
                  className="navitem"
                  data-active={location.pathname === "/accent-check" ? "true" : undefined}
                  to="/accent-check"
                >
                  <span className="navicon">🗣️</span>
                  <span className="navtext">
                    <span className="navname">Accent Check</span>
                  </span>
                </Link>
              )}
            </div>
          </div>
        )}

        {isManagementCode && (
          <div className="navgroup">
            <div className="navsection">Admin</div>
            <div className="navlist">
              <Link
                className="navitem"
                data-active={location.pathname === "/manage" ? "true" : undefined}
                to="/manage"
              >
                <span className="navicon">🛠️</span>
                <span className="navtext">
                  <span className="navname">Manage access</span>
                </span>
              </Link>
            </div>
          </div>
        )}

        <div className="navfooter">
          <button className="btn" onClick={() => setShowLog(true)}>
            What's new
            {!!unseen?.count && (
              <span className="navbadge" title="Entries you haven't seen">
                {unseen.count}
              </span>
            )}
          </button>
          <Link className="btn" to="/settings">
            Settings
          </Link>
        </div>
      </nav>
      <button
        className="navcollapse"
        onClick={() => saveNavCollapsed(true)}
        aria-label="Collapse menu"
        title="Collapse menu"
      >
        ‹
      </button>
      <button
        className="navexpand"
        onClick={() => saveNavCollapsed(false)}
        aria-label="Open menu"
        title="Open menu"
      >
        ›
      </button>
      {isOpen && (
        <button className="navhandle" onClick={() => setIsOpen(false)} aria-label="Minimize menu">
          ‹
        </button>
      )}
      {showLog && <VersionLog onClose={() => setShowLog(false)} />}
    </>
  );
}
