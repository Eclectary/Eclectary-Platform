import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';
import {
  createOrder,
  getSellerOrder,
  getSellerOrders,
  updateSellerItemFulfillment,
} from './orderApi';

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const patchMock = vi.mocked(api.patch);

const sellerOrderResponse = {
  id: 12,
  created_at: '2026-10-29T12:00:00Z',
  recipient_name: 'Buyer',
  shipping_address: '1 Main St',
  shipping_city: 'Durham',
  shipping_state: 'NC',
  shipping_postal_code: '27701',
  items: [{
    id: 30,
    product_id: 42,
    title: 'Seller product',
    quantity: 2,
    unit_price: '19.99',
    line_total: '39.98',
    fulfillment_status: 'unfulfilled' as const,
  }],
};

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

    const order = await createOrder(request, 'test-token', 'checkout-attempt-id');

    expect(postMock).toHaveBeenCalledWith('/orders', { order: request }, {
      headers: {
        Authorization: 'Bearer test-token',
        'Idempotency-Key': 'checkout-attempt-id',
      },
    });
    expect(order).toMatchObject({ shipping_amount: 6.5, subtotal: 39.98, final_total: 46.48 });
    expect(order.items[0].price).toBe(19.99);
    expect(postMock.mock.calls[0][1]).not.toHaveProperty('order.user_id');
    expect(postMock.mock.calls[0][1]).not.toHaveProperty('order.total');
    expect(postMock.mock.calls[0][1]).not.toHaveProperty('order.status');
  });
});

describe('seller orders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads and normalizes the seller order collection', async () => {
    getMock.mockResolvedValue({ data: { data: [sellerOrderResponse] } });

    const orders = await getSellerOrders();

    expect(getMock).toHaveBeenCalledWith('/seller/orders');
    expect(orders[0].items[0]).toMatchObject({ unit_price: 19.99, line_total: 39.98 });
  });

  it('loads and normalizes one seller order', async () => {
    getMock.mockResolvedValue({ data: { data: sellerOrderResponse } });

    const order = await getSellerOrder(12);

    expect(getMock).toHaveBeenCalledWith('/seller/orders/12');
    expect(order.items[0].unit_price).toBe(19.99);
  });

  it('updates fulfillment with the nested server contract and normalizes money', async () => {
    patchMock.mockResolvedValue({
      data: { data: { ...sellerOrderResponse.items[0], fulfillment_status: 'processing' } },
    });

    const item = await updateSellerItemFulfillment(12, 30, 'processing');

    expect(patchMock).toHaveBeenCalledWith(
      '/seller/orders/12/items/30/fulfillment',
      { fulfillment: { status: 'processing' } },
    );
    expect(item).toMatchObject({ fulfillment_status: 'processing', unit_price: 19.99, line_total: 39.98 });
  });
});
