import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login   from "./pages/Login";
import Scanner from "./pages/Scanner";
import Admin   from "./pages/Admin";
import { safeStorage } from "./utils/storage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RouteLogger } from "./components/RouteLogger";

function isLoggedIn() {
  return !!safeStorage.getItem("keli_token");
}

function ProtectedRoute({ element }: { element: JSX.Element }) {
  return isLoggedIn() ? element : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <RouteLogger />
        <Routes>
          <Route path="/login"   element={<Login />} />
          <Route path="/scan"    element={<ProtectedRoute element={<Scanner />} />} />
          <Route path="/admin"   element={<ProtectedRoute element={<Admin />} />} />
          <Route path="*"        element={<Navigate to={isLoggedIn() ? "/scan" : "/login"} />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
