import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAccessibleTrips } from "../../hooks/useAccessibleTrips";
import { useAccessCode } from "../../hooks/useAccessCode";
import { navCountdown, navMonthLabel } from "../../lib/tripLogic";

const MANAGEMENT_CODE = "bubble";

export function SideNav() {
  const { trips } = useAccessibleTrips();
  const { slug: activeSlug } = useParams();
  const location = useLocation();
  const { code, clear } = useAccessCode();
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  async function handleLogout() {
    clear();
    if (isAuthenticated) await signOut();
    navigate("/unlock");
  }

  return (
    <nav className="sidenav">
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

      {code?.trim().toLowerCase() === MANAGEMENT_CODE && (
        <div className="navgroup">
          <div className="navsection">Admin</div>
          <div className="navlist">
            <Link className="navitem" data-active={location.pathname === "/manage" ? "true" : undefined} to="/manage">
              <span className="navicon">🛠️</span>
              <span className="navtext">
                <span className="navname">Manage access</span>
              </span>
            </Link>
          </div>
        </div>
      )}

      {(code || isAuthenticated) && (
        <div className="navfooter">
          <button className="btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}
