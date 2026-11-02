import { NavLink } from "react-router-dom";
import "../styles/DashboardSidebar.css";

function dashboardLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "dashboard-link active" : "dashboard-link";
}

function DashboardSidebar() {
  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand">
        <NavLink to="/dashboard">Eclectary</NavLink>
        <span>Seller Dashboard</span>
      </div>

      <nav className="dashboard-nav" aria-label="Seller dashboard">
        <NavLink to="/dashboard" end className={dashboardLinkClass}>
          <span aria-hidden="true">⌂</span>
          Overview
        </NavLink>

        <NavLink to="/dashboard/products" className={dashboardLinkClass}>
          <span aria-hidden="true">▣</span>
          Products
        </NavLink>

        <NavLink to="/dashboard/products/new" className={dashboardLinkClass}>
          <span aria-hidden="true">＋</span>
          Add Product
        </NavLink>

        <NavLink to="/dashboard/orders" className={dashboardLinkClass}>
          <span aria-hidden="true">◎</span>
          Orders
        </NavLink>
      </nav>

      <div className="dashboard-sidebar-bottom">
        <NavLink to="/" className="dashboard-marketplace-link">
          ← Return to Marketplace
        </NavLink>
      </div>
    </aside>
  );
}

export default DashboardSidebar;
