import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../services/orderApi';
import type { Order } from '../types/order';
import '../styles/orders.css';

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatMoney(amount: number): string {
  return '$' + amount.toFixed(2);
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrders();
      const sorted = [...data].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
      setOrders(sorted);
    } catch (err) {
      setError('We could not load your orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) {
    return (
      <main className="orders-page">
        <section className="orders-container">
          <header className="orders-header">
            <h1>Your orders</h1>
          </header>
          <p className="orders-state">Loading your orders...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="orders-page">
        <section className="orders-container">
          <header className="orders-header">
            <h1>Your orders</h1>
          </header>
          <div className="orders-state orders-state--error">
            <p>{error}</p>
            <button type="button" className="orders-button" onClick={fetchOrders}>
              Retry
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (orders.length === 0) {
    return (
      <main className="orders-page">
        <section className="orders-container">
          <header className="orders-header">
            <h1>Your orders</h1>
          </header>
          <div className="orders-state">
            <p>You have no orders yet.</p>
            <Link className="orders-button" to="/shop">
              Continue shopping
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="orders-page">
      <section className="orders-container">
        <header className="orders-header">
          <h1>Your orders</h1>
        </header>
        <div className="orders-list">
          {orders.map((order) => (
            <article key={order.id} className="order-card">
              <header className="order-card__header">
                <div>
                  <p className="order-card__id">Order #{order.id}</p>
                  <p className="order-card__meta">
                    Placed on {formatDate(order.created_at)} • Status: {order.status}
                  </p>
                </div>
              </header>

              <section className="order-card__items" aria-label="Order items">
                {order.items.map((item) => (
                  <div key={item.id} className="order-card__item">
                    <div className="order-card__item-info">
                      <p className="order-card__item-title">{item.title}</p>
                      <p className="order-card__item-meta">
                        Qty: {item.quantity} × {formatMoney(item.price)}
                      </p>
                    </div>
                    <div className="order-card__item-line">
                      {formatMoney(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </section>

              <section className="order-card__totals" aria-label="Order totals">
                <div className="order-card__total-row">
                  <span>Product subtotal</span>
                  <span>{formatMoney(order.subtotal)}</span>
                </div>
                <div className="order-card__total-row">
                  <span>Shipping</span>
                  <span>{formatMoney(order.shipping_amount)}</span>
                </div>
                <div className="order-card__total-row order-card__total-row--final">
                  <span>Final total</span>
                  <span>{formatMoney(order.final_total)}</span>
                </div>
              </section>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
