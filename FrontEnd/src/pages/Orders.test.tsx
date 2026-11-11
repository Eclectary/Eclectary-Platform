import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { getOrders } from '../services/orderApi';
import type { Order } from '../types/order';
import Orders from './Orders';

vi.mock('../services/orderApi', () => ({ getOrders: vi.fn() }));

beforeEach(() => {
  vi.mocked(getOrders).mockReset();
});

afterEach(cleanup);

describe('Orders loading and retry', () => {
  it('shows loading, handles a failure, and loads orders on retry', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(getOrders).mockReturnValueOnce(new Promise((_, rejectPromise) => {
      reject = rejectPromise;
    })).mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<MemoryRouter><Orders /></MemoryRouter>);

    expect(screen.getByText('Loading your orders...')).toBeInTheDocument();
    await act(async () => reject(new Error('Network failed')));
    expect(screen.getByText(/could not load your orders/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('You have no orders yet.')).toBeInTheDocument();
    expect(getOrders).toHaveBeenCalledTimes(2);
  });

  it('sorts returned orders newest first', async () => {
    const makeOrder = (id: number, createdAt: string): Order => ({
      id, user_id: 7, status: 'pending', customer_name: 'Member',
      customer_email: 'member@example.com', customer_phone: '555-0100',
      shipping_address: '1 Main St', shipping_city: 'Portland',
      shipping_state: 'OR', shipping_postal_code: '97201',
      shipping_amount: 6.5, subtotal: 0, final_total: 6.5, items: [],
      created_at: createdAt, updated_at: createdAt,
    });
    vi.mocked(getOrders).mockResolvedValue([
      makeOrder(1, '2026-01-01T00:00:00Z'),
      makeOrder(2, '2026-02-01T00:00:00Z'),
    ]);
    render(<MemoryRouter><Orders /></MemoryRouter>);

    const orders = await screen.findAllByText(/Order #/);
    expect(orders.map((element) => element.textContent)).toEqual(['Order #2', 'Order #1']);
  });
});
