import { Link, useLocation } from 'react-router-dom';
import type { Order } from '../types/order';
import '../styles/checkout.css';

interface OrderConfirmationState {
  order?: Order;
}

export default function OrderConfirmation() {
  const { state } = useLocation() as { state: OrderConfirmationState | null };
  const order = state?.order;

  if (!order) {
    return (
      <main className="checkout-page">
        <section className="checkout-empty">
          <h1>Order confirmation unavailable</h1>
          <p>This page does not contain an order confirmation. No new order was created.</p>
          <Link className="checkout-button" to="/shop">Continue shopping</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-page order-confirmation">
      <section className="checkout-card">
        <p className="checkout-eyebrow">Order received</p>
        <h1>Thank you, {order.customer_name}</h1>
        <p>
          Order <strong>#{order.id}</strong> was created successfully. Payment has not been processed.
        </p>
        <p>Status: <strong>{order.status}</strong></p>
      </section>

      <section className="checkout-card">
        <h2>Shipping to</h2>
        <address>
          {order.shipping_address}<br />
          {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}
        </address>
      </section>

      <section className="checkout-summary" aria-label="Order summary">
        <h2>Order summary</h2>
        {order.items.map((item) => (
          <div className="checkout-summary__item" key={item.id}>
            <span>{item.title} × {item.quantity}</span>
            <span>${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="checkout-summary__row">
          <span>Subtotal</span>
          <span>${order.subtotal.toFixed(2)}</span>
        </div>
        <div className="checkout-summary__row">
          <span>Shipping</span>
          <span>${order.shipping_amount.toFixed(2)}</span>
        </div>
        <div className="checkout-summary__total">
          <span>Total</span>
          <span>${order.final_total.toFixed(2)}</span>
        </div>
      </section>

      <Link className="checkout-button" to="/shop">Continue shopping</Link>
    </main>
  );
}
