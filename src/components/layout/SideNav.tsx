import { Link, useParams } from "react-router-dom";
import { useAccessibleTrips } from "../../hooks/useAccessibleTrips";
import { navCountdown, navMonthLabel } from "../../lib/tripLogic";

export function SideNav() {
  const { trips } = useAccessibleTrips();
  const { slug: activeSlug } = useParams();

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
    </nav>
  );
}
