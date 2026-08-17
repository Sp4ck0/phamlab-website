import { Navigate, Route, Routes } from "react-router-dom";
import { TripPage } from "./pages/TripPage";
import { UnlockPage } from "./pages/UnlockPage";
import { LoginPage } from "./pages/LoginPage";
import { ManagePage } from "./pages/ManagePage";
import { KanbanBoardsPage } from "./pages/KanbanBoardsPage";
import { KanbanPage } from "./pages/KanbanPage";
import { useAccessibleTrips } from "./hooks/useAccessibleTrips";

function Home() {
  const { trips, isLoading } = useAccessibleTrips();
  if (isLoading) return null;
  if (trips && trips.length > 0) return <Navigate to={`/trip/${trips[0].slug}`} replace />;
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
