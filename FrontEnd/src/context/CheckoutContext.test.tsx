import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCart as clearServerCart, getCart } from '../services/cartApi';
import { createOrder } from '../services/orderApi';
import type { Cart } from '../types/cart';
import type { CreateOrderRequest, Order } from '../types/order';
import { useAuth } from './AuthContext';
import { CartProvider, useCart } from './CartContext';
import { useCheckout } from './CheckoutContext';
import { CheckoutProvider } from './CheckoutProvider';

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../services/orderApi', () => ({ createOrder: vi.fn() }));
vi.mock('../services/cartApi', () => ({
  addCartItem: vi.fn(),
  clearCart: vi.fn(),
  getCart: vi.fn(),
  mergeGuestCart: vi.fn(),
  removeCartItem: vi.fn(),
  updateCartItem: vi.fn(),
}));
vi.mock('../services/productApi', () => ({ getProductById: vi.fn() }));

const request: CreateOrderRequest = {
  customer_name: 'Jane Doe',
  customer_email: 'member@example.com',
  customer_phone: '555-0100',
  shipping_address: '1 Main St',
  shipping_city: 'Portland',
  shipping_state: 'OR',
  shipping_postal_code: '97201',
  items: [{ product_id: 42, quantity: 2 }],
};

const order: Order = {
  id: 91,
  user_id: 7,
  status: 'pending',
  ...request,
  shipping_amount: 6.5,
  subtotal: 39.98,
  final_total: 46.48,
  items: [{ id: 1, product_id: 42, title: 'Vase', quantity: 2, price: 19.99 }],
  created_at: '2026-10-28T12:00:00Z',
  updated_at: '2026-10-28T12:00:00Z',
};

const accountCart: Cart = {
  id: 10,
  items: [{
    serverItemId: 100,
    productId: 42,
    quantity: 2,
    product: { id: 42, title: 'Vase', price: 19.99, active: true, creator: 'Maker' },
    status: 'available',
  }],
};

const guestAuth = {
  user: null,
  token: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

function authenticate(id = 7, token = 'session-a') {
  vi.mocked(useAuth).mockReturnValue({
    ...guestAuth,
    user: { id, email: `member${id}@example.com`, role: 'customer' },
    token,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function CheckoutConsumer({ checkoutRequest = request }: { checkoutRequest?: CreateOrderRequest }) {
  const { state, submit, dismiss } = useCheckout();
  const { canModifyCart, items } = useCart();

  return (
    <>
      <p data-testid="cart-ready">{canModifyCart ? 'ready' : 'busy'}</p>
      <p data-testid="cart-items">{items.map((item) => item.productId).join(',')}</p>
      <p data-testid="checkout-status">{state.status}</p>
      {state.status === 'success' && (
        <>
          <p>Order #{state.order.id}</p>
          {state.cartClearWarning && <p role="alert">{state.cartClearWarning}</p>}
        </>
      )}
      {state.status === 'error' && <p role="alert">{state.error}</p>}
      <button type="button" onClick={() => submit(checkoutRequest)}>Submit order</button>
      <button type="button" onClick={dismiss}>Dismiss checkout</button>
    </>
  );
}

function Harness({
  showConsumer,
  checkoutRequest = request,
}: {
  showConsumer: boolean;
  checkoutRequest?: CreateOrderRequest;
}) {
  return (
    <CartProvider>
      <CheckoutProvider>
        {showConsumer && <CheckoutConsumer checkoutRequest={checkoutRequest} />}
      </CheckoutProvider>
    </CartProvider>
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReset();
  vi.mocked(getCart).mockReset();
  vi.mocked(clearServerCart).mockReset();
  vi.mocked(createOrder).mockReset();
  window.localStorage.clear();
  window.localStorage.setItem('eclectary-cart', '[]');
  authenticate();
  vi.mocked(getCart).mockResolvedValue(accountCart);
  vi.mocked(clearServerCart).mockResolvedValue({ id: 10, items: [] });
  vi.mocked(createOrder).mockResolvedValue(order);
});

afterEach(cleanup);

describe('persistent checkout context', () => {
  it('retains a successful order after its consumer unmounts and remounts', async () => {
    const { rerender } = render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    expect(await screen.findByText('Order #91')).toBeInTheDocument();

    rerender(<Harness showConsumer={false} />);
    expect(screen.queryByText('Order #91')).not.toBeInTheDocument();
    rerender(<Harness showConsumer />);

    expect(screen.getByTestId('checkout-status')).toHaveTextContent('success');
    expect(screen.getByText('Order #91')).toBeInTheDocument();
    expect(createOrder).toHaveBeenCalledOnce();
  });

  it('continues an in-flight order and cart clear while its consumer is unmounted', async () => {
    const pending = deferred<Order>();
    vi.mocked(createOrder).mockReturnValue(pending.promise);
    const { rerender } = render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('pending');
    expect(clearServerCart).not.toHaveBeenCalled();

    rerender(<Harness showConsumer={false} />);
    await act(async () => pending.resolve(order));

    expect(clearServerCart).toHaveBeenCalledOnce();
    expect(clearServerCart).toHaveBeenCalledWith('session-a');
    rerender(<Harness showConsumer />);
    expect(screen.getByText('Order #91')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('success');
  });

  it('rejects repeated submissions synchronously while an order is pending', async () => {
    const pending = deferred<Order>();
    vi.mocked(createOrder).mockReturnValue(pending.promise);
    const { rerender } = render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    const button = screen.getByRole('button', { name: 'Submit order' });

    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(createOrder).toHaveBeenCalledOnce();
    expect(createOrder).toHaveBeenCalledWith(
      request,
      'session-a',
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    );
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('pending');
    rerender(<Harness showConsumer={false} />);
    rerender(<Harness showConsumer />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    expect(createOrder).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(order));
    expect(await screen.findByText('Order #91')).toBeInTheDocument();
  });

  it('blocks another order until the successful result is explicitly dismissed', async () => {
    render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    expect(await screen.findByText('Order #91')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    expect(createOrder).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss checkout' }));
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('idle');
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('checkout-status')).toHaveTextContent('success'));
  });

  it('hides a retained result during logout, authentication loading, and another account', async () => {
    const { rerender } = render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    expect(await screen.findByText('Order #91')).toBeInTheDocument();

    await act(async () => {
      vi.mocked(useAuth).mockReturnValue(guestAuth);
      rerender(<Harness showConsumer />);
    });
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('idle');
    expect(screen.queryByText('Order #91')).not.toBeInTheDocument();

    await act(async () => {
      authenticate(8, 'session-b');
      rerender(<Harness showConsumer />);
    });
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('idle');
    expect(screen.queryByText('Order #91')).not.toBeInTheDocument();

    await act(async () => {
      vi.mocked(useAuth).mockReturnValue({
        ...guestAuth,
        user: { id: 7, email: 'member7@example.com', role: 'customer' },
        token: 'session-a',
        loading: true,
      });
      rerender(<Harness showConsumer />);
    });
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('idle');
    expect(screen.queryByText('Order #91')).not.toBeInTheDocument();

    await act(async () => {
      authenticate();
      rerender(<Harness showConsumer />);
    });
    expect(screen.getByText('Order #91')).toBeInTheDocument();
  });

  it('keeps the confirmed order and warning when clearing the cart fails', async () => {
    vi.mocked(clearServerCart).mockRejectedValue(new Error('Network failed'));
    render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));

    expect(await screen.findByText('Order #91')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('success');
    expect(screen.getByRole('alert')).toHaveTextContent(/saved cart could not be cleared/i);
    expect(screen.getByTestId('cart-items')).toHaveTextContent('42');
    expect(createOrder).toHaveBeenCalledOnce();
  });

  it('retains an order failure without clearing or retrying the cart', async () => {
    vi.mocked(createOrder).mockRejectedValue(new Error('Network failed'));
    render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/check your orders before trying again/i);
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('error');
    expect(screen.getByTestId('cart-items')).toHaveTextContent('42');
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    expect(createOrder).toHaveBeenCalledOnce();
    expect(clearServerCart).not.toHaveBeenCalled();
  });

  it('reuses the idempotency key when an unchanged failed submission is retried', async () => {
    vi.mocked(createOrder)
      .mockRejectedValueOnce(new Error('Network failed'))
      .mockResolvedValueOnce(order);
    render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));

    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/check your orders before trying again/i);
    const firstKey = vi.mocked(createOrder).mock.calls[0][2];

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss checkout' }));
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
    expect(vi.mocked(createOrder).mock.calls[1][2]).toBe(firstKey);
    expect(await screen.findByText('Order #91')).toBeInTheDocument();
  });

  it.each([
    [422, 'Shipping address cannot be blank.'],
    [403, 'You cannot place this order.'],
    [409, 'Idempotency key has already been used with a different order payload.'],
    [429, 'Too many requests. Please try again later.'],
  ] as const)('shows HTTP %s rejection details and keeps the cart and retry key', async (status, message) => {
    vi.mocked(createOrder)
      .mockRejectedValueOnce({
        isAxiosError: true, response: { status, data: { errors: [message] } },
      })
      .mockResolvedValueOnce(order);
    render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(`${message} Your cart has been kept.`);
    expect(screen.getByTestId('cart-items')).toHaveTextContent('42');
    expect(clearServerCart).not.toHaveBeenCalled();
    const firstKey = vi.mocked(createOrder).mock.calls[0][2];

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss checkout' }));
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));

    expect(await screen.findByText('Order #91')).toBeInTheDocument();
    expect(vi.mocked(createOrder).mock.calls[1][2]).toBe(firstKey);
  });

  it.each([
    { isAxiosError: true, code: 'ERR_NETWORK' },
    { isAxiosError: true, code: 'ECONNABORTED' },
    { isAxiosError: true, response: { status: 500, data: { errors: ['Private server details'] } } },
  ])('keeps the order-check warning for uncertain outcomes', async (error) => {
    vi.mocked(createOrder).mockRejectedValue(error);
    render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/check your orders before trying again/i);
    expect(screen.getByTestId('cart-items')).toHaveTextContent('42');
    expect(clearServerCart).not.toHaveBeenCalled();
    expect(screen.queryByText(/Private server details/)).not.toBeInTheDocument();
  });

  it('generates a new idempotency key when the retried payload changes', async () => {
    const changedRequest = { ...request, shipping_city: 'Salem' };
    vi.mocked(createOrder)
      .mockRejectedValueOnce(new Error('Network failed'))
      .mockResolvedValueOnce({ ...order, shipping_city: 'Salem' });
    const { rerender } = render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));

    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/check your orders before trying again/i);
    const firstKey = vi.mocked(createOrder).mock.calls[0][2];

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss checkout' }));
    rerender(<Harness showConsumer checkoutRequest={changedRequest} />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
    expect(createOrder).toHaveBeenLastCalledWith(changedRequest, 'session-a', expect.any(String));
    expect(vi.mocked(createOrder).mock.calls[1][2]).not.toBe(firstKey);
    expect(await screen.findByText('Order #91')).toBeInTheDocument();
  });

  it('does not clear another account cart when authentication changes before order confirmation', async () => {
    const pending = deferred<Order>();
    vi.mocked(createOrder).mockReturnValue(pending.promise);
    const { rerender } = render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));

    await act(async () => {
      authenticate(8, 'session-b');
      rerender(<Harness showConsumer />);
    });
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    await act(async () => pending.resolve(order));

    expect(createOrder).toHaveBeenCalledWith(request, 'session-a', expect.any(String));
    expect(clearServerCart).not.toHaveBeenCalled();
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('idle');
    expect(screen.getByTestId('cart-items')).toHaveTextContent('42');
    expect(screen.queryByText('Order #91')).not.toBeInTheDocument();

    await act(async () => {
      authenticate();
      rerender(<Harness showConsumer />);
    });
    expect(screen.getByText('Order #91')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/saved cart could not be cleared/i);
  });

  it('retains the original account result without clearing after logout during order creation', async () => {
    const pending = deferred<Order>();
    vi.mocked(createOrder).mockReturnValue(pending.promise);
    const { rerender } = render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    await act(async () => {
      vi.mocked(useAuth).mockReturnValue(guestAuth);
      rerender(<Harness showConsumer />);
    });

    await act(async () => pending.resolve(order));
    expect(clearServerCart).not.toHaveBeenCalled();
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('idle');
    expect(screen.queryByText('Order #91')).not.toBeInTheDocument();

    await act(async () => {
      authenticate();
      rerender(<Harness showConsumer />);
    });
    expect(screen.getByText('Order #91')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/saved cart could not be cleared/i);
  });

  it('does not apply an old account cart-clear response to a new account', async () => {
    const pending = deferred<Cart>();
    vi.mocked(clearServerCart).mockReturnValue(pending.promise);
    const { rerender } = render(<Harness showConsumer />);
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit order' }));
    await waitFor(() => expect(clearServerCart).toHaveBeenCalledWith('session-a'));

    await act(async () => {
      authenticate(8, 'session-b');
      rerender(<Harness showConsumer />);
    });
    await waitFor(() => expect(screen.getByTestId('cart-ready')).toHaveTextContent('ready'));
    await act(async () => pending.resolve({ id: 10, items: [] }));

    expect(screen.getByTestId('cart-items')).toHaveTextContent('42');
    expect(screen.getByTestId('checkout-status')).toHaveTextContent('idle');
    expect(screen.queryByText('Order #91')).not.toBeInTheDocument();
    expect(clearServerCart).toHaveBeenCalledOnce();

    await act(async () => {
      authenticate();
      rerender(<Harness showConsumer />);
    });
    expect(screen.getByText('Order #91')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
