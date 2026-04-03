import { Navigate, useLocation } from "react-router-dom";
import { getAdminToken } from "../admin/adminApi";

const AdminProtectedRoute = ({ children }) => {
  const location = useLocation();
  const token = getAdminToken();

  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default AdminProtectedRoute;
