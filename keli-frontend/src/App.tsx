import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login   from "./pages/Login";
import Scanner from "./pages/Scanner";
import Admin   from "./pages/Admin";

function isLoggedIn() {
  return !!localStorage.getItem("keli_token");
}

function ProtectedRoute({ element }: { element: JSX.Element }) {
  return isLoggedIn() ? element : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"   element={<Login />} />
        <Route path="/scan"    element={<ProtectedRoute element={<Scanner />} />} />
        <Route path="/admin"   element={<ProtectedRoute element={<Admin />} />} />
        <Route path="*"        element={<Navigate to={isLoggedIn() ? "/scan" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}
