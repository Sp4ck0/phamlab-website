import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/api";
import { TripPage } from "./pages/TripPage";
import { UnlockPage } from "./pages/UnlockPage";
import { LoginPage } from "./pages/LoginPage";
import { ManagePage } from "./pages/ManagePage";
import { KanbanBoardsPage } from "./pages/KanbanBoardsPage";
import { KanbanPage } from "./pages/KanbanPage";
import { DatingSimulatorPage } from "./pages/DatingSimulatorPage";
import { useAccessibleTrips } from "./hooks/useAccessibleTrips";
import { useAccessCode } from "./hooks/useAccessCode";

// A code doesn't need any trips to be valid (e.g. dating-simulator-only or
// boards-only access) — fall back to those before giving up and bouncing to
// /unlock, so a trip-less code doesn't loop back to the unlock screen.
function Home() {
  const { trips, isLoading } = useAccessibleTrips();
  const { code } = useAccessCode();
  const isDatingCode = useQuery(api.dating.checkDatingAccess, code ? { code } : "skip");

  if (isLoading) return null;
  if (trips && trips.length > 0) return <Navigate to={`/trip/${trips[0].slug}`} replace />;
  if (code && isDatingCode === undefined) return null;
  if (isDatingCode) return <Navigate to="/dating-simulator" replace />;
  return <Navigate to="/unlock" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/unlock" element={<UnlockPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/trip/:slug" element={<TripPage />} />
      <Route path="/kanban" element={<KanbanBoardsPage />} />
      <Route path="/kanban/:boardId" element={<KanbanPage />} />
      <Route path="/manage" element={<ManagePage />} />
      <Route path="/dating-simulator" element={<DatingSimulatorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
