import { Link, useLocation } from 'react-router-dom';
import { useCheckout } from '../context/CheckoutContext';
import '../styles/checkout.css';

export default function OrderConfirmation() {
  const { state: navigationState } = useLocation();
  const { state: checkoutState } = useCheckout();
  const orderId: unknown = navigationState && typeof navigationState === 'object'
    ? Reflect.get(navigationState, 'orderId')
    : undefined;

  if (checkoutState.status !== 'success' || checkoutState.order.id !== orderId) {
    return (
      <main className="checkout-page">
        <section className="checkout-empty">
          <h1>Order confirmation unavailable</h1>
          <p>We could not find this order confirmation for your current account.</p>
          <Link className="checkout-button" to="/shop">Continue shopping</Link>
        </section>
      </main>
    );
  }

  const { order, cartClearWarning } = checkoutState;

  return (
    <main className="checkout-page order-confirmation">
      <section className="checkout-card">
        <p className="checkout-eyebrow">Order received</p>
        <h1>Thank you, {order.customer_name}</h1>
        <p>
          Order <strong>#{order.id}</strong> was created successfully. Payment has not been processed.
        </p>
        <p>Status: <strong>{order.status}</strong></p>
        {cartClearWarning && (
          <p className="checkout-notice checkout-notice--error" role="alert">{cartClearWarning}</p>
        )}
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
