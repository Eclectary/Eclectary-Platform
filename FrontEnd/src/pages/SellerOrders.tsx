import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getSellerOrders, updateSellerItemFulfillment } from '../services/orderApi';
import type { FulfillmentStatus, SellerOrder } from '../types/order';
import '../styles/seller-orders.css';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function nextStatus(status: FulfillmentStatus): FulfillmentStatus | null {
  if (status === 'unfulfilled') return 'processing';
  if (status === 'processing') return 'fulfilled';
  return null;
}

function actionLabel(status: FulfillmentStatus): string {
  return status === 'unfulfilled' ? 'Move to Processing' : 'Mark Fulfilled';
}

export default function SellerOrders() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<Record<number, boolean>>({});
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await getSellerOrders());
    } catch {
      setError('We could not load your seller orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void getSellerOrders()
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch(() => {
        if (active) setError('We could not load your seller orders. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const advanceItem = async (orderId: number, itemId: number, status: FulfillmentStatus) => {
    const desiredStatus = nextStatus(status);
    if (!desiredStatus) return;

    setPendingItems((current) => ({ ...current, [itemId]: true }));
    setItemErrors((current) => ({ ...current, [itemId]: '' }));
    try {
      const updatedItem = await updateSellerItemFulfillment(orderId, itemId, desiredStatus);
      setOrders((current) => current.map((order) => (
        order.id === orderId
          ? { ...order, items: order.items.map((item) => item.id === itemId ? updatedItem : item) }
          : order
      )));
    } catch {
      setItemErrors((current) => ({
        ...current,
        [itemId]: 'We could not update this item. Please try again.',
      }));
    } finally {
      setPendingItems((current) => ({ ...current, [itemId]: false }));
    }
  };

  return (
    <section className="seller-orders">
      <header className="seller-orders__header">
        <h2>Seller Orders</h2>
        <p>Fulfill the items purchased from your store.</p>
      </header>

      {loading && <p role="status">Loading seller orders...</p>}

      {!loading && error && (
        <div className="seller-orders__state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadOrders()}>Retry</button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="seller-orders__state">
          <p>You do not have any seller orders yet.</p>
          <Link to="/dashboard/products">Manage Products</Link>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="seller-orders__list">
          {orders.map((order) => (
            <article className="seller-order-card" key={order.id}>
              <header className="seller-order-card__header">
                <div>
                  <h3>Order #{order.id}</h3>
                  <p>Placed {formatDate(order.created_at)}</p>
                </div>
                <address>
                  <strong>{order.recipient_name}</strong><br />
                  {order.shipping_address}<br />
                  {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}
                </address>
              </header>

              <div className="seller-order-card__items">
                {order.items.map((item) => {
                  const desiredStatus = nextStatus(item.fulfillment_status);
                  const pending = Boolean(pendingItems[item.id]);
                  return (
                    <section className="seller-order-item" key={item.id}>
                      <div>
                        <h4>{item.title}</h4>
                        <p>Quantity: {item.quantity} · {formatMoney(item.unit_price)} each</p>
                        <p>Line total: {formatMoney(item.line_total)}</p>
                        <p>Status: <strong>{item.fulfillment_status}</strong></p>
                      </div>
                      {desiredStatus && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void advanceItem(order.id, item.id, item.fulfillment_status)}
                        >
                          {pending ? 'Updating...' : actionLabel(item.fulfillment_status)}
                        </button>
                      )}
                      {itemErrors[item.id] && <p className="seller-order-item__error" role="alert">{itemErrors[item.id]}</p>}
                    </section>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
