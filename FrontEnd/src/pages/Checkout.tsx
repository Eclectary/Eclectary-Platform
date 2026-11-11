import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';

import ProductImage from '../components/ProductImage';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCheckout } from '../context/CheckoutContext';
import '../styles/checkout.css';

type CustomerInfo = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
};

type CustomerErrors = Partial<Record<keyof CustomerInfo, string>>;

const SHIPPING_ESTIMATE = 6.5;

function Checkout() {
  const { user, token, loading: authLoading } = useAuth();
  const { items, subtotal } = useCart();
  const { state: checkoutState, submit, dismiss } = useCheckout();
  const [customerFields, setCustomer] = useState<Omit<CustomerInfo, 'email'> & { email: string | null }>({
    fullName: '',
    email: null,
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [submissionError, setSubmissionError] = useState('');

  const customer: CustomerInfo = {
    ...customerFields,
    email: customerFields.email ?? user?.email ?? '',
  };

  const availableItems = items.filter(
    (item): item is typeof item & { product: NonNullable<typeof item.product> } =>
      item.status === 'available' && Boolean(item.product),
  );
  const hasPendingItems = items.some((item) => item.status === 'pending');
  const hasUnavailableItems = items.some((item) => item.status === 'unavailable');
  const shipping = availableItems.length > 0 ? SHIPPING_ESTIMATE : 0;
  const total = subtotal + shipping;

  if (checkoutState.status === 'success') {
    return <Navigate to="/order" replace state={{ orderId: checkoutState.order.id }} />;
  }

  if (items.length === 0 && checkoutState.status === 'idle') {
    return (
      <section className="checkout-page checkout-page--empty">
        <h1>Your checkout is empty.</h1>
        <p>Add something from the shop before checking out.</p>
        <Link to="/shop">Return to the shop</Link>
      </section>
    );
  }

  const handleFieldChange = (field: keyof CustomerInfo, value: string) => {
    setCustomer((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (checkoutState.status !== 'idle') return;

    const nextErrors: CustomerErrors = {};
    const requiredFields: Array<keyof CustomerInfo> = [
      'fullName', 'email', 'phone', 'address', 'city', 'state', 'postalCode',
    ];

    requiredFields.forEach((field) => {
      if (!customer[field].trim()) nextErrors[field] = 'This field is required.';
    });

    if (customer.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (customer.state.trim() && !/^[A-Za-z]{2}$/.test(customer.state.trim())) {
      nextErrors.state = 'Enter a two-letter state code.';
    }
    if (customer.postalCode.trim() && !/^\d{5}(?:-\d{4})?$/.test(customer.postalCode.trim())) {
      nextErrors.postalCode = 'Enter a valid ZIP code.';
    }

    setErrors(nextErrors);
    setSubmissionError('');

    if (Object.keys(nextErrors).length > 0) return;
    if (authLoading || !user || !token) {
      setSubmissionError('Your session is not ready. Please sign in again before submitting.');
      return;
    }
    if (hasPendingItems) {
      setSubmissionError('Please wait while cart products are being checked.');
      return;
    }
    if (hasUnavailableItems || availableItems.length !== items.length) {
      setSubmissionError('Remove unavailable products from your cart before checking out.');
      return;
    }

    const started = submit({
      customer_name: customer.fullName.trim(),
      customer_email: customer.email.trim(),
      customer_phone: customer.phone.trim(),
      shipping_address: customer.address.trim(),
      shipping_city: customer.city.trim(),
      shipping_state: customer.state.trim().toUpperCase(),
      shipping_postal_code: customer.postalCode.trim(),
      items: availableItems.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
    });
    if (!started) setSubmissionError('Checkout could not start. Please check its status before trying again.');
  };

  return (
    <section className="checkout-page">
      <div className="checkout-page__header">
        <p className="eyebrow">Almost yours</p>
        <h1>Checkout</h1>
      </div>

      <div className="checkout-page__layout">
        <form className="checkout-form" onSubmit={handleSubmit} noValidate>
          <section className="checkout-section" aria-labelledby="customer-info-heading">
            <h2 id="customer-info-heading">Customer information</h2>
            <div className="checkout-field">
              <label htmlFor="fullName">Full name</label>
              <input id="fullName" name="fullName" autoComplete="name" value={customer.fullName}
                onChange={(event) => handleFieldChange('fullName', event.target.value)} aria-invalid={Boolean(errors.fullName)} />
              {errors.fullName && <p className="checkout-error">{errors.fullName}</p>}
            </div>
            <div className="checkout-field-row">
              <div className="checkout-field">
                <label htmlFor="email">Email address</label>
                <input id="email" name="email" type="email" autoComplete="email" value={customer.email}
                  onChange={(event) => handleFieldChange('email', event.target.value)} aria-invalid={Boolean(errors.email)} />
                {errors.email && <p className="checkout-error">{errors.email}</p>}
              </div>
              <div className="checkout-field">
                <label htmlFor="phone">Phone number</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" value={customer.phone}
                  onChange={(event) => handleFieldChange('phone', event.target.value)} aria-invalid={Boolean(errors.phone)} />
                {errors.phone && <p className="checkout-error">{errors.phone}</p>}
              </div>
            </div>
            <div className="checkout-field">
              <label htmlFor="address">Street address</label>
              <input id="address" name="address" autoComplete="street-address" value={customer.address}
                onChange={(event) => handleFieldChange('address', event.target.value)} aria-invalid={Boolean(errors.address)} />
              {errors.address && <p className="checkout-error">{errors.address}</p>}
            </div>
            <div className="checkout-field-row checkout-field-row--shipping">
              <div className="checkout-field">
                <label htmlFor="city">City</label>
                <input id="city" name="city" autoComplete="address-level2" value={customer.city}
                  onChange={(event) => handleFieldChange('city', event.target.value)} aria-invalid={Boolean(errors.city)} />
                {errors.city && <p className="checkout-error">{errors.city}</p>}
              </div>
              <div className="checkout-field">
                <label htmlFor="state">State</label>
                <input id="state" name="state" autoComplete="address-level1" maxLength={2} value={customer.state}
                  onChange={(event) => handleFieldChange('state', event.target.value)} aria-invalid={Boolean(errors.state)} />
                {errors.state && <p className="checkout-error">{errors.state}</p>}
              </div>
              <div className="checkout-field">
                <label htmlFor="postalCode">ZIP code</label>
                <input id="postalCode" name="postalCode" autoComplete="postal-code" value={customer.postalCode}
                  onChange={(event) => handleFieldChange('postalCode', event.target.value)} aria-invalid={Boolean(errors.postalCode)} />
                {errors.postalCode && <p className="checkout-error">{errors.postalCode}</p>}
              </div>
            </div>
          </section>

          <section className="checkout-section checkout-section--placeholder" aria-labelledby="shipping-heading">
            <h2 id="shipping-heading">Shipping</h2>
            <p className="checkout-placeholder-note">A fixed standard shipping rate is applied by the server.</p>
            <div className="checkout-placeholder-card"><span>Standard shipping</span><strong>${SHIPPING_ESTIMATE.toFixed(2)}</strong></div>
          </section>

          <section className="checkout-section checkout-section--placeholder" aria-labelledby="payment-heading">
            <h2 id="payment-heading">Payment</h2>
            <p className="checkout-placeholder-note">Payment processing is not connected. This creates a pending order and does not charge you.</p>
          </section>

          {hasPendingItems && <p className="checkout-notice" role="status">Checking current product details before checkout…</p>}
          {hasUnavailableItems && <p className="checkout-notice checkout-notice--error">Remove unavailable products in your cart before checking out.</p>}
          {checkoutState.status === 'pending' && (
            <p className="checkout-notice" role="status">
              {checkoutState.order ? 'Order created. Clearing your cart…' : 'Creating your order…'}
            </p>
          )}
          {checkoutState.status === 'error' ? (
            <div className="checkout-notice checkout-notice--error" role="alert">
              <p>{checkoutState.error}</p>
              <button type="button" onClick={() => { dismiss(); setSubmissionError(''); }}>
                Dismiss and return to checkout
              </button>
            </div>
          ) : submissionError && <p className="checkout-notice checkout-notice--error" role="alert">{submissionError}</p>}

          <button className="checkout-submit" type="submit"
            disabled={checkoutState.status !== 'idle' || authLoading || !user || !token || hasPendingItems || hasUnavailableItems || availableItems.length === 0}>
            {checkoutState.status === 'pending' ? 'Creating order…' : 'Create pending order'}
          </button>
          <p className="checkout-back-link"><Link to="/cart">Back to cart</Link></p>
        </form>

        <aside className="checkout-summary" aria-label="Order summary">
          <h2>Order summary</h2>
          <div className="checkout-summary__list">
            {items.map((item) => (
              <div className={`checkout-summary__item checkout-summary__item--${item.status}`} key={item.productId}>
                {item.product ? (
                  <>
                    <ProductImage image={item.product.image} alt={item.product.title} className="checkout-summary__image"
                      fallbackClassName="checkout-summary__image-placeholder" />
                    <div className="checkout-summary__item-details">
                      <span>{item.product.title}</span>
                      <span className="checkout-summary__item-quantity">Qty {item.quantity}</span>
                      {item.status !== 'available' && <span>{item.status === 'pending' ? 'Checking product…' : 'Unavailable'}</span>}
                    </div>
                    <strong>{item.status === 'available' ? `$${(item.product.price * item.quantity).toFixed(2)}` : '—'}</strong>
                  </>
                ) : (
                  <div className="checkout-summary__item-details checkout-summary__item-details--wide">
                    <span>Product #{item.productId}</span>
                    <span>{item.status === 'pending' ? 'Checking product…' : 'Unavailable'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="checkout-summary__row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="checkout-summary__row"><span>Shipping</span><span>${shipping.toFixed(2)}</span></div>
          <div className="checkout-summary__row checkout-summary__row--total"><span>Total</span><strong>${total.toFixed(2)}</strong></div>
        </aside>
      </div>
    </section>
  );
}

export default Checkout;
