import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { getSellerOrders, updateSellerItemFulfillment } from '../services/orderApi';
import type { SellerOrder } from '../types/order';
import SellerOrders from './SellerOrders';

vi.mock('../services/orderApi', () => ({
  getSellerOrders: vi.fn(),
  updateSellerItemFulfillment: vi.fn(),
}));

const getSellerOrdersMock = vi.mocked(getSellerOrders);
const updateFulfillmentMock = vi.mocked(updateSellerItemFulfillment);

const order: SellerOrder = {
  id: 12,
  created_at: '2026-10-29T12:00:00Z',
  recipient_name: 'Buyer Name',
  shipping_address: '1 Main St',
  shipping_city: 'Durham',
  shipping_state: 'NC',
  shipping_postal_code: '27701',
  items: [
    { id: 30, product_id: 42, title: 'First item', quantity: 2, unit_price: 10, line_total: 20, fulfillment_status: 'unfulfilled' },
    { id: 31, product_id: 43, title: 'Finished item', quantity: 1, unit_price: 5, line_total: 5, fulfillment_status: 'fulfilled' },
  ],
};

function renderPage() {
  return render(<MemoryRouter><SellerOrders /></MemoryRouter>);
}

beforeEach(() => {
  getSellerOrdersMock.mockResolvedValue([order]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SellerOrders', () => {
  it('keeps the shell visible while loading and renders seller-scoped order fields', async () => {
    let resolve!: (orders: SellerOrder[]) => void;
    getSellerOrdersMock.mockReturnValue(new Promise((done) => { resolve = done; }));

    renderPage();
    expect(screen.getByRole('heading', { name: 'Seller Orders' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading seller orders');

    resolve([order]);
    expect(await screen.findByText('Order #12')).toBeInTheDocument();
    expect(screen.getByText('Buyer Name')).toBeInTheDocument();
    expect(screen.getByText('First item')).toBeInTheDocument();
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/shipping total/i)).not.toBeInTheDocument();
  });

  it('renders empty and error retry states', async () => {
    getSellerOrdersMock.mockResolvedValueOnce([]);
    const empty = renderPage();
    expect(await screen.findByText('You do not have any seller orders yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage Products' })).toHaveAttribute('href', '/dashboard/products');
    empty.unmount();

    getSellerOrdersMock.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce([order]);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your seller orders');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Order #12')).toBeInTheDocument();
  });

  it('persists a forward transition before updating only the selected item', async () => {
    let resolve!: (item: SellerOrder['items'][number]) => void;
    updateFulfillmentMock
      .mockReturnValueOnce(new Promise((done) => { resolve = done; }))
      .mockResolvedValueOnce({ ...order.items[0], fulfillment_status: 'fulfilled' });
    renderPage();

    const firstItem = await screen.findByText('First item');
    const itemSection = firstItem.closest('section') as HTMLElement;
    fireEvent.click(within(itemSection).getByRole('button', { name: 'Move to Processing' }));

    expect(updateFulfillmentMock).toHaveBeenCalledWith(12, 30, 'processing');
    expect(within(itemSection).getByRole('button')).toHaveTextContent('Updating...');
    expect(within(itemSection).getByText(/Status:/)).toHaveTextContent('unfulfilled');

    resolve({ ...order.items[0], fulfillment_status: 'processing' });
    await waitFor(() => expect(within(itemSection).getByText(/Status:/)).toHaveTextContent('processing'));
    fireEvent.click(within(itemSection).getByRole('button', { name: 'Mark Fulfilled' }));
    expect(updateFulfillmentMock).toHaveBeenLastCalledWith(12, 30, 'fulfilled');
    await waitFor(() => expect(within(itemSection).getByText(/Status:/)).toHaveTextContent('fulfilled'));
    expect(within(itemSection).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Finished item').closest('section')).not.toHaveTextContent('Mark Fulfilled');
  });

  it('keeps the persisted status and shows an item-local error when a mutation fails', async () => {
    updateFulfillmentMock.mockRejectedValue(new Error('Unavailable'));
    renderPage();

    const firstItem = await screen.findByText('First item');
    const itemSection = firstItem.closest('section') as HTMLElement;
    fireEvent.click(within(itemSection).getByRole('button', { name: 'Move to Processing' }));

    expect(await within(itemSection).findByRole('alert')).toHaveTextContent('We could not update this item');
    expect(within(itemSection).getByText(/Status:/)).toHaveTextContent('unfulfilled');
    expect(within(itemSection).getByRole('button', { name: 'Move to Processing' })).toBeInTheDocument();
  });
});
