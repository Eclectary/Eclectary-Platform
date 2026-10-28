import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Checkout from './Checkout';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { createOrder } from '../services/orderApi';
import type { Order } from '../types/order';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));
vi.mock('../services/orderApi', () => ({ createOrder: vi.fn() }));
vi.mock('../components/ProductImage', () => ({
  default: ({ image, alt }: { image?: string | null; alt: string }) => <img src={image ?? undefined} alt={alt} />,
}));

const useAuthMock = vi.mocked(useAuth);
const useCartMock = vi.mocked(useCart);
const createOrderMock = vi.mocked(createOrder);
const clearCart = vi.fn();
const product = { id: 42, title: 'API-only vase', price: 19.99, image: '/real.jpg', creator: 'Real Maker' };
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
  const destinationOrder = (location.state as { order?: Order } | null)?.order;
  return <h1>Order {destinationOrder?.id}</h1>;
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
  useAuthMock.mockReturnValue({
    user: { id: 7, email: 'member@example.com', role: 'customer' }, token: 'token', loading: false,
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  });
  useCartMock.mockReturnValue({
    items: [availableItem], subtotal: 39.98, totalItems: 2, clearCart,
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
    expect(createOrderMock).not.toHaveBeenCalled();
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
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('submits only customer/shipping and item identity, clears after success, and navigates with the order', async () => {
    createOrderMock.mockResolvedValue(order);
    renderCheckout();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /create pending order/i }));

    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(1));
    expect(createOrderMock).toHaveBeenCalledWith({
      customer_name: 'Jane Doe', customer_email: 'member@example.com', customer_phone: '555-0100',
      shipping_address: '1 Main St', shipping_city: 'Portland', shipping_state: 'OR',
      shipping_postal_code: '97201', items: [{ product_id: 42, quantity: 2 }],
    });
    expect(clearCart).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Order 91' })).toBeInTheDocument();
  });

  it('prevents duplicate submissions while pending', async () => {
    createOrderMock.mockReturnValue(new Promise(() => undefined));
    renderCheckout();
    fillValidForm();
    const button = screen.getByRole('button', { name: /create pending order/i });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /creating order/i })).toBeDisabled();
  });

  it('keeps the cart and shows a safe error when submission fails', async () => {
    createOrderMock.mockRejectedValue(new Error('secret server detail'));
    renderCheckout();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /create pending order/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not create your order/i);
    expect(screen.queryByText(/secret server detail/i)).not.toBeInTheDocument();
    expect(clearCart).not.toHaveBeenCalled();
    expect(screen.getByText('API-only vase')).toBeInTheDocument();
  });
});
