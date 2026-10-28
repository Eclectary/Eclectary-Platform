import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import OrderConfirmation from './OrderConfirmation';
import type { Order } from '../types/order';

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

function renderPage(state?: { order: Order }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/order', state }]}>
      <Routes><Route path="/order" element={<OrderConfirmation />} /></Routes>
    </MemoryRouter>,
  );
}

describe('OrderConfirmation', () => {
  it('shows the server-created order and makes the no-payment state explicit', () => {
    renderPage({ order });

    expect(screen.getByText('#91')).toBeInTheDocument();
    expect(screen.getByText(/payment has not been processed/i)).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText(/real product/i)).toBeInTheDocument();
    expect(screen.getByText('$46.48')).toBeInTheDocument();
    expect(screen.getByText(/portland, or 97201/i)).toBeInTheDocument();
  });

  it('handles direct navigation without fabricating an order', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /confirmation unavailable/i })).toBeInTheDocument();
    expect(screen.getByText(/no new order was created/i)).toBeInTheDocument();
  });
});
