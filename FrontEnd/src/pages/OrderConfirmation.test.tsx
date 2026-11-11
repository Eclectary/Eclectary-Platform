import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OrderConfirmation from './OrderConfirmation';
import { useCheckout } from '../context/CheckoutContext';
import type { Order } from '../types/order';

vi.mock('../context/CheckoutContext', () => ({ useCheckout: vi.fn() }));

const useCheckoutMock = vi.mocked(useCheckout);

const order: Order = {
  id: 91,
  user_id: 7,
  status: 'pending',
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com',
  customer_phone: '555-0100',
  shipping_address: '1 Main St',
  shipping_city: 'Portland',
  shipping_state: 'OR',
  shipping_postal_code: '97201',
  shipping_amount: 6.5,
  subtotal: 39.98,
  final_total: 46.48,
  items: [{ id: 2, product_id: 42, title: 'Real product', quantity: 2, price: 19.99 }],
  created_at: '2026-10-28T12:00:00Z',
  updated_at: '2026-10-28T12:00:00Z',
};

function renderPage(state?: { orderId: number }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/order', state }]}>
      <Routes><Route path="/order" element={<OrderConfirmation />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useCheckoutMock.mockReset();
  useCheckoutMock.mockReturnValue({
    state: { status: 'success', order, cartClearWarning: null },
    submit: vi.fn(),
    dismiss: vi.fn(),
  });
});

describe('OrderConfirmation', () => {
  it('shows the server-created order and makes the no-payment state explicit', () => {
    renderPage({ orderId: order.id });

    expect(screen.getByText('#91')).toBeInTheDocument();
    expect(screen.getByText(/payment has not been processed/i)).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText(/real product/i)).toBeInTheDocument();
    expect(screen.getByText('$46.48')).toBeInTheDocument();
    expect(screen.getByText(/portland, or 97201/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the cart-clearing warning with the confirmed order', () => {
    const cartClearWarning = 'Your order was created, but your saved cart could not be cleared. Please review your cart before placing another order.';
    useCheckoutMock.mockReturnValue({
      state: { status: 'success', order, cartClearWarning },
      submit: vi.fn(),
      dismiss: vi.fn(),
    });
    renderPage({ orderId: order.id });

    expect(screen.getByText('#91')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(cartClearWarning);
    expect(screen.getByText(/real product/i)).toBeInTheDocument();
  });

  it('handles direct navigation without fabricating an order', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /confirmation unavailable/i })).toBeInTheDocument();
    expect(screen.getByText(/could not find this order confirmation/i)).toBeInTheDocument();
    expect(screen.queryByText('#91')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not expose a retained order when the navigation ID differs', () => {
    renderPage({ orderId: order.id + 1 });

    expect(screen.getByRole('heading', { name: /confirmation unavailable/i })).toBeInTheDocument();
    expect(screen.queryByText('#91')).not.toBeInTheDocument();
    expect(screen.queryByText(/real product/i)).not.toBeInTheDocument();
  });

  it.each([
    { status: 'idle' as const },
    { status: 'pending' as const, order },
    { status: 'error' as const, error: 'Order failed' },
  ])('does not expose order details when checkout is $status', (state) => {
    useCheckoutMock.mockReturnValue({ state, submit: vi.fn(), dismiss: vi.fn() });
    renderPage({ orderId: order.id });

    expect(screen.getByRole('heading', { name: /confirmation unavailable/i })).toBeInTheDocument();
    expect(screen.queryByText('#91')).not.toBeInTheDocument();
    expect(screen.queryByText(/real product/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
