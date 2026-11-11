import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addCartItem,
  clearCart as clearServerCart,
  getCart,
  mergeGuestCart,
  removeCartItem,
  updateCartItem,
} from '../services/cartApi';
import { getProductById } from '../services/productApi';
import type { Cart, CartMergeResult } from '../types/cart';
import { useAuth } from './AuthContext';
import { CartProvider, useCart } from './CartContext';

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../services/cartApi', () => ({
  addCartItem: vi.fn(),
  clearCart: vi.fn(),
  getCart: vi.fn(),
  mergeGuestCart: vi.fn(),
  removeCartItem: vi.fn(),
  updateCartItem: vi.fn(),
}));
vi.mock('../services/productApi', () => ({ getProductById: vi.fn() }));

const guestAuth = {
  user: null,
  token: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};
const guestProduct = {
  id: 1, title: 'Guest mug', price: 12, active: true, creator: 'Guest maker',
};
const guestItems = [{
  productId: 1, quantity: 2, product: guestProduct, status: 'available',
}];
const accountCart: Cart = {
  id: 10,
  items: [{
    serverItemId: 100,
    productId: 2,
    quantity: 3,
    product: { id: 2, title: 'Saved bowl', price: 20, active: true, creator: 'Account maker' },
    status: 'available',
  }],
};

function authenticate(id = 7, token = 'session-a') {
  vi.mocked(useAuth).mockReturnValue({
    ...guestAuth,
    user: { id, email: `member${id}@example.com`, role: 'customer' },
    token,
  });
}

function deferredCart() {
  let resolve!: (cart: Cart) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Cart>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function deferredMerge() {
  let resolve!: (result: CartMergeResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<CartMergeResult>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.mocked(useAuth).mockReset();
  vi.mocked(useAuth).mockReturnValue(guestAuth);
  vi.mocked(getCart).mockReset();
  vi.mocked(getCart).mockResolvedValue(accountCart);
  vi.mocked(mergeGuestCart).mockReset();
  vi.mocked(addCartItem).mockReset();
  vi.mocked(updateCartItem).mockReset();
  vi.mocked(removeCartItem).mockReset();
  vi.mocked(clearServerCart).mockReset();
  vi.mocked(getProductById).mockReset();
  vi.mocked(getProductById).mockReturnValue(new Promise(() => undefined));
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem('eclectary-cart', JSON.stringify([]));
});

afterEach(cleanup);

describe('authentication-aware cart state', () => {
  it('preserves guest editing and the existing storage format without loading an account cart', () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    const { result } = renderHook(useCart, { wrapper: CartProvider });

    expect(result.current.loading).toBe(false);
    expect(result.current.canModifyCart).toBe(true);
    expect(result.current.items).toEqual(guestItems);

    act(() => result.current.addToCart(guestProduct));

    expect(result.current.totalItems).toBe(3);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([
      { ...guestItems[0], quantity: 3 },
    ]);
    expect(getCart).not.toHaveBeenCalled();
  });

  it('hides guest items while restoring authentication and hydrating the account cart', async () => {
    vi.mocked(useAuth).mockReturnValue({ ...guestAuth, token: 'session-a', loading: true });
    const pending = deferredCart();
    vi.mocked(getCart).mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.canModifyCart).toBe(false);
    expect(getCart).not.toHaveBeenCalled();

    authenticate();
    rerender();

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(getCart).toHaveBeenCalledOnce();
    expect(getCart).toHaveBeenCalledWith('session-a');

    await act(async () => pending.resolve(accountCart));

    expect(result.current.items).toEqual(accountCart.items);
    expect(result.current.items[0].serverItemId).toBe(100);
    expect(result.current.loading).toBe(false);
    expect(result.current.subtotal).toBe(60);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it('restores only the separate guest cart immediately on logout', async () => {
    authenticate();
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(result.current.items).toEqual(accountCart.items));

    vi.mocked(useAuth).mockReturnValue(guestAuth);
    rerender();

    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.canModifyCart).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it('ignores a hydration response arriving after logout', async () => {
    authenticate();
    const pending = deferredCart();
    vi.mocked(getCart).mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });

    vi.mocked(useAuth).mockReturnValue(guestAuth);
    rerender();
    act(() => result.current.updateQuantity(1, 4));
    await act(async () => pending.resolve(accountCart));

    expect(result.current.items).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it('restores guest state on token removal even if authentication is still loading', () => {
    vi.mocked(useAuth).mockReturnValue({ ...guestAuth, token: 'session-a', loading: true });
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    expect(result.current.items).toEqual([]);

    vi.mocked(useAuth).mockReturnValue({ ...guestAuth, loading: true });
    rerender();

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.canModifyCart).toBe(true);
    expect(getCart).not.toHaveBeenCalled();
  });

  it('does not replace another user cart with a late successful response', async () => {
    authenticate();
    const previous = deferredCart();
    const next = deferredCart();
    vi.mocked(getCart).mockReturnValueOnce(previous.promise).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    expect(getCart).toHaveBeenCalledTimes(1);

    authenticate(8, 'session-b');
    rerender();
    expect(getCart).toHaveBeenCalledTimes(2);
    expect(getCart).toHaveBeenNthCalledWith(1, 'session-a');
    expect(getCart).toHaveBeenNthCalledWith(2, 'session-b');
    await act(async () => next.resolve({ id: 20, items: [] }));
    await act(async () => previous.resolve(accountCart));

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it('ignores stale responses and errors when switching users', async () => {
    authenticate();
    const previous = deferredCart();
    const next = deferredCart();
    vi.mocked(getCart).mockReturnValueOnce(previous.promise).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    expect(getCart).toHaveBeenCalledTimes(1);

    authenticate(8, 'session-b');
    rerender();
    expect(getCart).toHaveBeenCalledTimes(2);
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(true);

    await act(async () => previous.reject(new Error('Previous session failed')));
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => next.resolve({ id: 20, items: [] }));
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('reloads for a new token and never exposes the previous account cart while loading', async () => {
    authenticate();
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(result.current.items).toEqual(accountCart.items));
    const next = deferredCart();
    vi.mocked(getCart).mockReturnValue(next.promise);

    authenticate(7, 'replacement-token');
    rerender();

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(true);
    await act(async () => next.resolve({ id: 10, items: [] }));
    expect(result.current.loading).toBe(false);
    expect(getCart).toHaveBeenCalledTimes(2);
  });

  it('reports hydration failures without falling back to guest items', async () => {
    authenticate();
    vi.mocked(getCart).mockRejectedValue(new Error('Network failed'));
    const { result } = renderHook(useCart, { wrapper: CartProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/could not load your saved cart/i);
    expect(result.current.items).toEqual([]);
    expect(result.current.canModifyCart).toBe(false);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it('uses server item IDs and applies the confirmed response for authenticated mutations', async () => {
    authenticate();
    const { result } = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updatedCart = {
      ...accountCart,
      items: [{ ...accountCart.items[0], quantity: 99 }],
    };
    vi.mocked(updateCartItem).mockResolvedValue(updatedCart);

    await act(async () => result.current.updateQuantity(2, 150));
    await waitFor(() => expect(result.current.items).toEqual(updatedCart.items));
    expect(updateCartItem).toHaveBeenCalledWith(100, { quantity: 99 }, 'session-a');
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it('connects authenticated add, remove, and clear to the server and adopts returned carts', async () => {
    authenticate();
    const { result } = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const addedCart = {
      ...accountCart,
      items: [...accountCart.items, {
        serverItemId: 101,
        productId: guestProduct.id,
        quantity: 2,
        product: guestProduct,
        status: 'available' as const,
      }],
    };
    vi.mocked(addCartItem).mockResolvedValue(addedCart);
    act(() => result.current.addToCart(guestProduct, 2));
    await waitFor(() => expect(result.current.items).toEqual(addedCart.items));
    expect(addCartItem).toHaveBeenCalledWith({ product_id: guestProduct.id, quantity: 2 }, 'session-a');

    const removedCart = { ...accountCart, items: [] };
    vi.mocked(removeCartItem).mockResolvedValue(removedCart);
    act(() => result.current.removeItem(guestProduct.id));
    await waitFor(() => expect(result.current.items).toEqual(removedCart.items));
    expect(removeCartItem).toHaveBeenCalledWith(101, 'session-a');

    vi.mocked(clearServerCart).mockResolvedValue(removedCart);
    act(() => result.current.clearCart());
    await waitFor(() => expect(clearServerCart).toHaveBeenCalledOnce());
    expect(clearServerCart).toHaveBeenCalledWith('session-a');
    expect(result.current.items).toEqual(removedCart.items);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it('keeps the confirmed account cart and exposes mutation failures', async () => {
    authenticate();
    const { result } = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(removeCartItem).mockRejectedValue(new Error('network unavailable'));

    act(() => result.current.removeItem(2));
    await waitFor(() => expect(result.current.mutationError).toMatch(/could not update your saved cart/i));

    expect(result.current.items).toEqual(accountCart.items);
    expect(result.current.mutationLoading).toBe(false);
    expect(result.current.canModifyCart).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it.each([
    [422, { errors: ['Quantity cannot exceed 99 per product.'] }, 'Quantity cannot exceed 99 per product.'],
    [403, { error: 'You cannot update this cart.' }, 'You cannot update this cart.'],
    [409, { message: 'Your cart changed. Please reload.' }, 'Your cart changed. Please reload.'],
    [429, { errors: ['Please wait before updating your cart.'] }, 'Please wait before updating your cart.'],
    [500, { errors: ['Private details'] }, 'We could not update your saved cart.'],
  ] as const)('shows safe HTTP %s mutation errors without changing the saved cart', async (status, data, message) => {
    authenticate();
    const { result } = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(removeCartItem).mockRejectedValue({
      isAxiosError: true, response: { status, data },
    });

    act(() => result.current.removeItem(2));

    await waitFor(() => expect(result.current.mutationError).toContain(message));
    expect(result.current.items).toEqual(accountCart.items);
    expect(result.current.mutationLoading).toBe(false);
    expect(result.current.mutationError).not.toContain('Private details');
  });

  it('does not start overlapping mutations or apply an old account mutation response', async () => {
    authenticate();
    const pendingMutation = deferredCart();
    vi.mocked(addCartItem).mockReturnValue(pendingMutation.promise);
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.addToCart(guestProduct);
      result.current.addToCart(guestProduct);
    });
    expect(addCartItem).toHaveBeenCalledOnce();

    authenticate(8, 'session-b');
    const otherAccountCart: Cart = { id: 20, items: [] };
    vi.mocked(getCart).mockResolvedValue(otherAccountCart);
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => pendingMutation.resolve({
      ...accountCart,
      items: [{
        serverItemId: 102,
        productId: guestProduct.id,
        quantity: 1,
        product: guestProduct,
        status: 'available',
      }],
    }));

    expect(result.current.items).toEqual([]);
    expect(result.current.mutationError).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it('merges guest items during restored-session hydration and clears them after confirmation', async () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    authenticate();
    vi.mocked(mergeGuestCart).mockResolvedValue({
      cart: accountCart,
      merge: {
        added_items: [{ index: 0, product_id: 1, quantity: 2 }],
        skipped_items: [],
        merge_identifier: 'confirmed-transfer',
        repeated: false,
      },
    });

    const { result } = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(mergeGuestCart).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.items).toEqual(accountCart.items));

    expect(mergeGuestCart).toHaveBeenCalledWith({
      merge_identifier: expect.any(String),
      items: [{ productId: 1, quantity: 2, product: guestProduct, status: 'available', product_id: 1 }],
    }, 'session-a');
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
    expect(window.localStorage.getItem('eclectary-cart-merge')).toBeNull();
  });

  it('retries a failed merge using the same persisted identifier', async () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    authenticate();
    vi.mocked(mergeGuestCart)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({
        cart: accountCart,
        merge: {
          added_items: [{ index: 0, product_id: 1, quantity: 2 }],
          skipped_items: [],
          merge_identifier: 'same-transfer',
          repeated: true,
        },
      });
    const { result } = renderHook(useCart, { wrapper: CartProvider });

    await waitFor(() => expect(result.current.mergeRetryable).toBe(true));
    const persisted = JSON.parse(window.localStorage.getItem('eclectary-cart-merge')!);
    act(() => result.current.retryGuestCartMerge());
    await waitFor(() => expect(mergeGuestCart).toHaveBeenCalledTimes(2));

    expect(vi.mocked(mergeGuestCart).mock.calls[0][0].merge_identifier).toBe(persisted.merge_identifier);
    expect(vi.mocked(mergeGuestCart).mock.calls[1][0].merge_identifier).toBe(persisted.merge_identifier);
    expect(window.localStorage.getItem('eclectary-cart-merge')).toBeNull();
  });

  it('keeps partially skipped items and the rejected quantity in guest storage', async () => {
    const guestSnapshot = [
      { productId: 1, quantity: 4, product: guestProduct, status: 'available' },
      { productId: 2, quantity: 1 },
    ];
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestSnapshot));
    authenticate();
    vi.mocked(mergeGuestCart).mockResolvedValue({
      cart: accountCart,
      merge: {
        added_items: [{ index: 0, product_id: 1, quantity: 2 }],
        skipped_items: [
          { index: 0, product_id: 1, reason: 'quantity_limit', skipped_quantity: 2 },
          { index: 1, product_id: 2, reason: 'unavailable_product' },
        ],
        merge_identifier: 'partial-transfer',
        repeated: false,
      },
    });
    const { result } = renderHook(useCart, { wrapper: CartProvider });

    await waitFor(() => expect(result.current.mergeSkippedItems).toHaveLength(2));
    expect(result.current.mergeError).toMatch(/2 guest cart items could not be transferred/i);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([
      { ...guestSnapshot[0], quantity: 2 },
      guestSnapshot[1],
    ]);
    expect(window.localStorage.getItem('eclectary-cart-merge')).toBeNull();
  });

  it('does not clear guest data when a merge response arrives after logout', async () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    authenticate();
    const pending = deferredMerge();
    vi.mocked(mergeGuestCart).mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(mergeGuestCart).toHaveBeenCalledOnce());

    vi.mocked(useAuth).mockReturnValue(guestAuth);
    rerender();
    await act(async () => pending.resolve({
      cart: accountCart,
      merge: {
        added_items: [{ index: 0, product_id: 1, quantity: 2 }],
        skipped_items: [],
        merge_identifier: 'stale-transfer',
        repeated: false,
      },
    }));

    expect(result.current.items).toEqual(guestItems);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual(guestItems);
  });

  it('does not send a pending account transfer to a different user', async () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    authenticate(7, 'session-a');
    vi.mocked(mergeGuestCart).mockRejectedValue(new Error('network unavailable'));
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    await waitFor(() => expect(result.current.mergeRetryable).toBe(true));
    const transfer = window.localStorage.getItem('eclectary-cart-merge');

    authenticate(8, 'session-b');
    rerender();
    await waitFor(() => expect(result.current.mergeError).toMatch(/another account/i));

    expect(mergeGuestCart).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem('eclectary-cart-merge')).toBe(transfer);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual(guestItems);
  });

  it('reports a new account hydration failure without treating another account transfer as failed', async () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    window.localStorage.setItem('eclectary-cart-merge', JSON.stringify({
      merge_identifier: 'pending-transfer',
      user_id: 7,
      source_items: guestItems,
      items: guestItems,
    }));
    authenticate(8, 'session-b');
    vi.mocked(getCart).mockRejectedValue(new Error('Current account hydration failed'));
    const { result } = renderHook(useCart, { wrapper: CartProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/could not load your saved cart/i);
    expect(result.current.mergeError).toMatch(/another account/i);
    expect(result.current.mergeRetryable).toBe(false);
    expect(getCart).toHaveBeenCalledOnce();
    expect(mergeGuestCart).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual(guestItems);
  });

  it('does not apply a previous account merge response after switching users', async () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    authenticate();
    const pending = deferredMerge();
    vi.mocked(mergeGuestCart).mockReturnValue(pending.promise);
    const otherCart: Cart = { id: 20, items: [] };
    vi.mocked(getCart).mockResolvedValue(otherCart);
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    expect(mergeGuestCart).toHaveBeenCalledOnce();
    const transfer = window.localStorage.getItem('eclectary-cart-merge');

    authenticate(8, 'session-b');
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.mergeError).toMatch(/another account/i);

    await act(async () => pending.resolve({
      cart: accountCart,
      merge: {
        added_items: [{ index: 0, product_id: 1, quantity: 2 }],
        skipped_items: [],
        merge_identifier: 'stale-transfer',
        repeated: false,
      },
    }));

    expect(result.current.items).toEqual(otherCart.items);
    expect(result.current.error).toBeNull();
    expect(result.current.mergeError).toMatch(/another account/i);
    expect(window.localStorage.getItem('eclectary-cart-merge')).toBe(transfer);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual(guestItems);
  });

  it('ignores a previous account merge failure while the new account is hydrating', async () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    authenticate();
    const pendingMerge = deferredMerge();
    const pendingCart = deferredCart();
    vi.mocked(mergeGuestCart).mockReturnValue(pendingMerge.promise);
    vi.mocked(getCart).mockReturnValue(pendingCart.promise);
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    expect(mergeGuestCart).toHaveBeenCalledOnce();
    const transfer = window.localStorage.getItem('eclectary-cart-merge');

    authenticate(8, 'session-b');
    rerender();
    expect(getCart).toHaveBeenCalledOnce();
    expect(result.current.loading).toBe(true);

    await act(async () => pendingMerge.reject(new Error('Previous transfer failed')));
    expect(result.current.error).toBeNull();
    expect(result.current.mergeError).toMatch(/another account/i);
    expect(result.current.mergeRetryable).toBe(false);
    expect(result.current.loading).toBe(true);
    expect(getCart).toHaveBeenCalledOnce();

    await act(async () => pendingCart.resolve({ id: 20, items: [] }));
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(window.localStorage.getItem('eclectary-cart-merge')).toBe(transfer);
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual(guestItems);
  });

  it('resumes the same pending merge when switching back to its account', async () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    authenticate();
    const pending = deferredMerge();
    vi.mocked(mergeGuestCart).mockReturnValue(pending.promise);
    vi.mocked(getCart).mockResolvedValue({ id: 20, items: [] });
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    expect(mergeGuestCart).toHaveBeenCalledOnce();
    const transfer = JSON.parse(window.localStorage.getItem('eclectary-cart-merge')!);

    authenticate(8, 'session-b');
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));

    authenticate();
    rerender();
    expect(result.current.items).toEqual([]);
    expect(result.current.mergeLoading).toBe(true);
    expect(mergeGuestCart).toHaveBeenCalledOnce();
    expect(vi.mocked(mergeGuestCart).mock.calls[0][0].merge_identifier).toBe(transfer.merge_identifier);

    await act(async () => pending.resolve({
      cart: accountCart,
      merge: {
        added_items: [{ index: 0, product_id: 1, quantity: 2 }],
        skipped_items: [],
        merge_identifier: transfer.merge_identifier,
        repeated: false,
      },
    }));

    expect(result.current.items).toEqual(accountCart.items);
    expect(result.current.mergeError).toBeNull();
    expect(window.localStorage.getItem('eclectary-cart-merge')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it('does not reuse a pending merge request after the session token changes', async () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    authenticate();
    const previous = deferredMerge();
    const next = deferredMerge();
    vi.mocked(mergeGuestCart).mockReturnValueOnce(previous.promise).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(useCart, { wrapper: CartProvider });
    expect(mergeGuestCart).toHaveBeenCalledOnce();
    const transfer = JSON.parse(window.localStorage.getItem('eclectary-cart-merge')!);

    authenticate(7, 'replacement-token');
    rerender();
    expect(mergeGuestCart).toHaveBeenCalledTimes(2);
    expect(vi.mocked(mergeGuestCart).mock.calls[0][0].merge_identifier).toBe(transfer.merge_identifier);
    expect(vi.mocked(mergeGuestCart).mock.calls[1][0].merge_identifier).toBe(transfer.merge_identifier);
    expect(vi.mocked(mergeGuestCart).mock.calls[0][1]).toBe('session-a');
    expect(vi.mocked(mergeGuestCart).mock.calls[1][1]).toBe('replacement-token');

    await act(async () => previous.reject(new Error('Previous session failed')));
    expect(result.current.mergeError).toBeNull();
    expect(result.current.mergeLoading).toBe(true);
    expect(result.current.loading).toBe(true);
    expect(getCart).not.toHaveBeenCalled();

    await act(async () => next.resolve({
      cart: accountCart,
      merge: {
        added_items: [{ index: 0, product_id: 1, quantity: 2 }],
        skipped_items: [],
        merge_identifier: transfer.merge_identifier,
        repeated: true,
      },
    }));

    expect(result.current.items).toEqual(accountCart.items);
    expect(result.current.mergeError).toBeNull();
    expect(window.localStorage.getItem('eclectary-cart-merge')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });

  it('shares an in-flight merge across Strict Mode effect replay', async () => {
    window.localStorage.setItem('eclectary-cart', JSON.stringify(guestItems));
    authenticate();
    const pending = deferredMerge();
    vi.mocked(mergeGuestCart).mockReturnValue(pending.promise);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode><CartProvider>{children}</CartProvider></StrictMode>
    );
    const { result } = renderHook(useCart, { wrapper });
    expect(mergeGuestCart).toHaveBeenCalledOnce();
    const transfer = JSON.parse(window.localStorage.getItem('eclectary-cart-merge')!);

    await act(async () => pending.resolve({
      cart: accountCart,
      merge: {
        added_items: [{ index: 0, product_id: 1, quantity: 2 }],
        skipped_items: [],
        merge_identifier: transfer.merge_identifier,
        repeated: false,
      },
    }));

    expect(result.current.items).toEqual(accountCart.items);
    expect(window.localStorage.getItem('eclectary-cart-merge')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('eclectary-cart')!)).toEqual([]);
  });
});
