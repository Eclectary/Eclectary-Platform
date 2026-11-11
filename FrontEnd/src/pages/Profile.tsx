import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { getOrders } from "../services/orderApi";
import type { Order } from "../types/order";
import "../styles/profile.css";

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const displayName = "Eclectary Member";

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchRecent = async () => {
      try {
        const data = await getOrders();
        if (!isMounted) return;
        const sorted = [...data].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });
        setRecentOrders(sorted.slice(0, 3));
      } catch {
        if (!isMounted) return;
        setRecentOrders([]);
      } finally {
        if (isMounted) setOrdersLoading(false);
      }
    };

    fetchRecent();
    return () => {
      isMounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  function handleLogout() {
    logout();
    navigate("/");
  }

  const profileDetails = [
    { label: "Email", value: user?.email || "Not provided" },
    { label: "Member since", value: "June 2026" },
    { label: "Saved lists", value: "12 items" },
    { label: "Delivery address", value: "No default address set" },
  ];

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <aside className="profile-sidebar">
          <div className="profile-avatar" aria-label="User avatar">{initials}</div>
          <div className="profile-summary">
            <p className="profile-kicker">Account</p>
            <h1>{displayName}</h1>
            <p>{user?.email || "No email on file"}</p>
          </div>

          <div className="profile-actions">
            <Button type="button" variant="primary" fullWidth>
              Edit profile
            </Button>
            <Button type="button" variant="secondary" fullWidth onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </aside>

        <div className="profile-content">
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Profile details</h2>
              <span className="profile-badge">Verified</span>
            </div>

            <div className="profile-detail-grid">
              {profileDetails.map((detail) => (
                <div key={detail.label} className="profile-detail-item">
                  <span>{detail.label}</span>
                  <strong>{detail.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Quick stats</h2>
            </div>

            <div className="profile-stats-grid">
              <div className="profile-stat">
                <strong>12</strong>
                <span>Saved items</span>
              </div>
              <div className="profile-stat">
                <strong>{recentOrders.length}</strong>
                <span>Orders</span>
              </div>
              <div className="profile-stat">
                <strong>3</strong>
                <span>Wishlist updates</span>
              </div>
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Recent orders</h2>
              <Link to="/account/orders">View all</Link>
            </div>

            <div className="profile-order-list">
              {ordersLoading ? (
                <p>Loading orders...</p>
              ) : recentOrders.length === 0 ? (
                <p>
                  No orders yet. <Link to="/shop">Start shopping</Link>
                </p>
              ) : (
                recentOrders.map((order) => {
                  const firstItem = order.items[0];
                  const itemSummary = firstItem
                    ? `${firstItem.title}${order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}`
                    : "Order items";
                  return (
                    <div key={order.id} className="profile-order-item">
                      <div>
                        <span className="profile-order-id">#{order.id}</span>
                        <p>{itemSummary}</p>
                        <p style={{ fontSize: "0.875rem", color: "#666" }}>{formatDate(order.created_at)}</p>
                      </div>
                      <span className="profile-order-status">{order.status}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default Profile;
