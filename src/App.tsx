import { Navigate, Route, Routes } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@convex/api";
import { TripPage } from "./pages/TripPage";
import { TripPrintPage } from "./pages/TripPrintPage";
import { UnlockPage } from "./pages/UnlockPage";
import { LoginPage } from "./pages/LoginPage";
import { ManagePage } from "./pages/ManagePage";
import { SettingsPage } from "./pages/SettingsPage";
import { ConnectPage } from "./pages/ConnectPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { KanbanBoardsPage } from "./pages/KanbanBoardsPage";
import { KanbanPage } from "./pages/KanbanPage";
import { DatingSimulatorPage } from "./pages/DatingSimulatorPage";
import { useAccessibleTrips } from "./hooks/useAccessibleTrips";
import { useAccessCode } from "./hooks/useAccessCode";
import { useKanbanBoards } from "./kanban/useKanbanBoards";
import { loadLastTab } from "./lib/lastTab";
import { RouteScrollPolicy } from "./components/trip/TripEntryBoundary";

// Base-URL entry: resume the last visited tab if it is still accessible,
// otherwise the first accessible tab (same order as the side nav: trips,
// boards, dating, manage), otherwise /unlock. A code doesn't need any trips to
// be valid (e.g. dating-only or boards-only access), so every tab type counts.
function Home() {
  const { trips, isLoading: tripsLoading } = useAccessibleTrips();
  const { code } = useAccessCode();
  const { isLoading: authLoading } = useConvexAuth();
  const { boards, isLoading: boardsLoading } = useKanbanBoards();
  const isDatingCode = useQuery(api.dating.checkDatingAccess, code ? { code } : "skip");
  const isManagementCode = useQuery(api.management.checkManagementAccess, code ? { code } : "skip");

  // Queries skipped for lack of a code stay undefined forever, so only wait on
  // them when a code exists. Unknown is never treated as "no access".
  if (authLoading || tripsLoading || boardsLoading) return null;
  if (code && (isDatingCode === undefined || isManagementCode === undefined)) return null;

  const tabs = [
    ...(trips ?? []).map((t) => `/trip/${t.slug}`),
    ...boards.map((b) => `/kanban/${b._id}`),
    ...(isDatingCode ? ["/dating-simulator"] : []),
    ...(isManagementCode ? ["/manage"] : []),
  ];
  // Only a path that exactly matches a currently accessible tab is used, so a
  // stale, revoked or tampered stored value falls through to the top tab.
  const last = loadLastTab();
  const target = last && tabs.includes(last) ? last : tabs[0];
  return <Navigate to={target ?? "/unlock"} replace />;
}

export default function App() {
  return (
    <>
    <RouteScrollPolicy />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/unlock" element={<UnlockPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/trip/:slug" element={<TripPage />} />
      <Route path="/trip/:slug/export" element={<TripPrintPage />} />
      {/* Original URL of the export page — kept so existing links still work. */}
      <Route path="/trip/:slug/print" element={<TripPrintPage />} />
      <Route path="/kanban" element={<KanbanBoardsPage />} />
      <Route path="/kanban/:boardId" element={<KanbanPage />} />
      <Route path="/manage" element={<ManagePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/connect" element={<ConnectPage />} />
      <Route path="/connections" element={<ConnectionsPage />} />
      <Route path="/dating-simulator" element={<DatingSimulatorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
