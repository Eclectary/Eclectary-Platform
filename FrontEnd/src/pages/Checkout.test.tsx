import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Checkout from './Checkout';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCheckout } from '../context/CheckoutContext';
import type { Order } from '../types/order';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));
vi.mock('../context/CheckoutContext', () => ({ useCheckout: vi.fn() }));
vi.mock('../components/ProductImage', () => ({
  default: ({ image, alt }: { image?: string | null; alt: string }) => <img src={image ?? undefined} alt={alt} />,
}));

const useAuthMock = vi.mocked(useAuth);
const useCartMock = vi.mocked(useCart);
const useCheckoutMock = vi.mocked(useCheckout);
const submit = vi.fn<ReturnType<typeof useCheckout>['submit']>();
const dismiss = vi.fn<ReturnType<typeof useCheckout>['dismiss']>();
const product = { id: 42, active: true, title: 'API-only vase', price: 19.99, image: '/real.jpg', creator: 'Real Maker' };
const availableItem = { productId: 42, quantity: 2, product, status: 'available' as const };

const order: Order = {
  id: 91, user_id: 7, status: 'pending', customer_name: 'Jane Doe', customer_email: 'member@example.com',
  customer_phone: '555-0100', shipping_address: '1 Main St', shipping_city: 'Portland', shipping_state: 'OR',
  shipping_postal_code: '97201', shipping_amount: 6.5, subtotal: 39.98, final_total: 46.48,
  items: [{ id: 1, product_id: 42, title: 'API-only vase', quantity: 2, price: 19.99 }],
  created_at: '2026-10-28T12:00:00Z', updated_at: '2026-10-28T12:00:00Z',
};

function OrderDestination() {
  const location = useLocation();
  const state = location.state as { orderId?: number; order?: Order } | null;
  return (
    <>
      <h1>Order {state?.orderId}</h1>
      <p>{state?.order ? 'Order details in navigation' : 'ID-only navigation'}</p>
    </>
  );
}

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <Routes>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order" element={<OrderDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '555-0100' } });
  fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: '1 Main St' } });
  fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: 'Portland' } });
  fireEvent.change(screen.getByLabelText(/^state$/i), { target: { value: 'or' } });
  fireEvent.change(screen.getByLabelText(/zip code/i), { target: { value: '97201' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  submit.mockReturnValue(true);
  useCheckoutMock.mockReturnValue({ state: { status: 'idle' }, submit, dismiss });
  useAuthMock.mockReturnValue({
    user: { id: 7, email: 'member@example.com', role: 'customer' }, token: 'token', loading: false,
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  });
  useCartMock.mockReturnValue({
    loading: false, error: null, mutationLoading: false, mutationError: null,
    mergeLoading: false, mergeError: null, mergeRetryable: false, mergeSkippedItems: [],
    retryGuestCartMerge: vi.fn(), canModifyCart: false,
    items: [availableItem], subtotal: 39.98, totalItems: 2, clearCart: vi.fn(), beginCheckout: vi.fn(),
    addItem: vi.fn(), addToCart: vi.fn(), removeItem: vi.fn(), removeFromCart: vi.fn(),
    updateQuantity: vi.fn(), calculateSubtotal: () => 39.98, isInCart: () => true,
  });
});

afterEach(cleanup);

describe('Checkout', () => {
  it('renders real CartContext products and prefills the signed-in email', () => {
    renderCheckout();

    expect(screen.getByText('API-only vase')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'API-only vase' })).toHaveAttribute('src', '/real.jpg');
    expect(screen.getByDisplayValue('member@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('$39.98')).toHaveLength(2);
  });

  it('submits the manually edited email instead of the prefilled email', () => {
    renderCheckout();
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'buyer@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /create pending order/i }));

    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ customer_email: 'buyer@example.com' }));
  });

  it('validates required fields, email, state, and ZIP before submission', async () => {
    renderCheckout();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'invalid' } });
    fireEvent.change(screen.getByLabelText(/^state$/i), { target: { value: 'O' } });
    fireEvent.change(screen.getByLabelText(/zip code/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /create pending order/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/two-letter state code/i)).toBeInTheDocument();
    expect(screen.getByText(/valid zip code/i)).toBeInTheDocument();
    expect(screen.getAllByText(/field is required/i)).not.toHaveLength(0);
    expect(submit).not.toHaveBeenCalled();
  });

  it('blocks pending and unavailable cart entries from submission', () => {
    useCartMock.mockReturnValueOnce({
      ...useCartMock(),
      items: [
        { ...availableItem, status: 'pending' },
        { productId: 77, quantity: 1, product: null, status: 'unavailable' },
      ],
    });
    renderCheckout();

    expect(screen.getByText(/checking current product details/i)).toBeInTheDocument();
    expect(screen.getByText(/remove unavailable products/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create pending order/i })).toBeDisabled();
  });

  it('shows the empty state without attempting an order', () => {
    useCartMock.mockReturnValueOnce({ ...useCartMock(), items: [], subtotal: 0, totalItems: 0 });
    renderCheckout();

    expect(screen.getByRole('heading', { name: /checkout is empty/i })).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('does not allow checkout without an authenticated session', () => {
    useAuthMock.mockReturnValue({
      user: null, token: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn(),
    });
    renderCheckout();

    expect(screen.getByRole('button', { name: /create pending order/i })).toBeDisabled();
    fireEvent.submit(screen.getByRole('button', { name: /create pending order/i }).closest('form')!);
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits only customer/shipping and item identity through checkout context', () => {
    renderCheckout();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /create pending order/i }));

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      customer_name: 'Jane Doe', customer_email: 'member@example.com', customer_phone: '555-0100',
      shipping_address: '1 Main St', shipping_city: 'Portland', shipping_state: 'OR',
      shipping_postal_code: '97201', items: [{ product_id: 42, quantity: 2 }],
    });
  });

  it('displays pending status and prevents duplicate submissions', () => {
    useCheckoutMock.mockReturnValue({ state: { status: 'pending' }, submit, dismiss });
    renderCheckout();
    const button = screen.getByRole('button', { name: /creating order/i });
    fireEvent.click(button);
    fireEvent.submit(button.closest('form')!);
    expect(screen.getByRole('status')).toHaveTextContent(/creating your order/i);
    expect(button).toBeDisabled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('shows the confirmed order is being processed while cart clearing is pending', () => {
    useCheckoutMock.mockReturnValue({ state: { status: 'pending', order }, submit, dismiss });
    renderCheckout();
    expect(screen.getByRole('status')).toHaveTextContent(/order created\. clearing your cart/i);
    expect(screen.queryByRole('heading', { name: 'Order 91' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /creating order/i })).toBeDisabled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('shows a retained error and does not automatically retry submission', () => {
    const error = 'We could not confirm your order. Your cart has been kept. Check your orders before trying again.';
    useCheckoutMock.mockReturnValue({ state: { status: 'error', error }, submit, dismiss });
    renderCheckout();
    expect(screen.getByRole('alert')).toHaveTextContent(error);
    expect(screen.getByText('API-only vase')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /create pending order/i }));
    fireEvent.submit(screen.getByRole('button', { name: /create pending order/i }).closest('form')!);
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /dismiss and return to checkout/i }));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });

  it('redirects a retained successful order without allowing another submission', async () => {
    useCheckoutMock.mockReturnValue({
      state: { status: 'success', order, cartClearWarning: null }, submit, dismiss,
    });
    renderCheckout();

    expect(await screen.findByRole('heading', { name: 'Order 91' })).toBeInTheDocument();
    expect(screen.getByText('ID-only navigation')).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /create pending order/i })).not.toBeInTheDocument();
  });

  it('redirects when checkout remounts after the retained order completes', async () => {
    useCheckoutMock.mockReturnValue({ state: { status: 'pending' }, submit, dismiss });
    const first = renderCheckout();
    expect(screen.getByRole('status')).toHaveTextContent(/creating your order/i);
    first.unmount();

    useCheckoutMock.mockReturnValue({
      state: { status: 'success', order, cartClearWarning: 'Cart could not be cleared.' }, submit, dismiss,
    });
    renderCheckout();

    expect(await screen.findByRole('heading', { name: 'Order 91' })).toBeInTheDocument();
    expect(screen.getByText('ID-only navigation')).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });
});
