import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function ProtectedRoute() {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!user || !token) {
    return <Navigate to="/account/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
