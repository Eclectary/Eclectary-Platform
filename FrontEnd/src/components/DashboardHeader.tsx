import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "../styles/DashboardHeader.css";

function DashboardHeader() {
  const { user } = useAuth();
  const accountLabel = user?.email ?? "Seller account";

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-title">
        <h1>Seller Dashboard</h1>
        <p>Manage your Eclectary shop</p>
      </div>

      <div className="dashboard-header-actions">
        {user && (
          <Link to={`/seller/${user.id}`} className="dashboard-view-store">
            View Store
          </Link>
        )}

        <div className="dashboard-account">
          <div className="dashboard-avatar" aria-hidden="true">
            {accountLabel.charAt(0).toUpperCase()}
          </div>

          <div className="dashboard-account-info">
            <span className="dashboard-account-name">{accountLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;
