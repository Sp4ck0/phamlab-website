import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/api";
import { useAccessibleTrips } from "../../hooks/useAccessibleTrips";
import { useAccessCode } from "../../hooks/useAccessCode";
import { useTheme } from "../../hooks/useTheme";
import { flagEmoji, navCountdown, navMonthLabel } from "../../lib/tripLogic";

export function SideNav() {
  const { trips } = useAccessibleTrips();
  const { slug: activeSlug } = useParams();
  const location = useLocation();
  const { code, clear } = useAccessCode();
  const isManagementCode = useQuery(api.management.checkManagementAccess, code ? { code } : "skip");
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

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

  async function handleLogout() {
    clear();
    if (isAuthenticated) await signOut();
    navigate("/unlock");
  }

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
        <span className="navmark">🧳</span>
        <span className="navtitle">Itinerary</span>
      </div>
      <div className="navbackdrop" data-open={isOpen ? "true" : undefined} onClick={() => setIsOpen(false)} />

      <nav className="sidenav" data-open={isOpen ? "true" : undefined}>
        <div className="navhead">
          <span className="navmark">🧳</span>
          <span className="navtitle">Itinerary</span>
        </div>
        <div className="navgroup">
          <div className="navsection">Trips</div>
          <div className="navlist">
            {(trips || []).map((t) => (
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
            {trips && trips.length === 0 && (
              <div className="navsection" style={{ padding: "8px 10px", textTransform: "none", letterSpacing: 0 }}>
                No trips unlocked yet
              </div>
            )}
          </div>
        </div>

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
          <button className="btn" onClick={toggleTheme}>
            {isDark ? "Light mode" : "Dark mode"}
          </button>
          {(code || isAuthenticated) && (
            <button className="btn" onClick={handleLogout}>
              Log out
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
