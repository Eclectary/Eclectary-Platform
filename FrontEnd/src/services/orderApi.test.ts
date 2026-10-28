import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';
import { createOrder } from './orderApi';

vi.mock('./api', () => ({
  default: { post: vi.fn() },
}));

const postMock = vi.mocked(api.post);

describe('createOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends only the supported order payload and normalizes server money values', async () => {
    const request = {
      customer_name: 'Jane Doe',
      customer_email: 'jane@example.com',
      customer_phone: '555-0100',
      shipping_address: '1 Main St',
      shipping_city: 'Portland',
      shipping_state: 'OR',
      shipping_postal_code: '97201',
      items: [{ product_id: 42, quantity: 2 }],
    };
    postMock.mockResolvedValue({
      data: {
        data: {
          id: 9,
          user_id: 7,
          status: 'pending',
          ...request,
          shipping_amount: '6.5',
          subtotal: '39.98',
          final_total: '46.48',
          items: [{ id: 3, product_id: 42, title: 'Real product', quantity: 2, price: '19.99' }],
          created_at: '2026-10-28T12:00:00Z',
          updated_at: '2026-10-28T12:00:00Z',
        },
      },
    });

    const order = await createOrder(request);

    expect(postMock).toHaveBeenCalledWith('/orders', { order: request });
    expect(order).toMatchObject({ shipping_amount: 6.5, subtotal: 39.98, final_total: 46.48 });
    expect(order.items[0].price).toBe(19.99);
    expect(postMock.mock.calls[0][1]).not.toHaveProperty('order.user_id');
    expect(postMock.mock.calls[0][1]).not.toHaveProperty('order.total');
    expect(postMock.mock.calls[0][1]).not.toHaveProperty('order.status');
  });
});
