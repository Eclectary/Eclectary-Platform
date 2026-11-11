import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import userEvent from '@testing-library/user-event';

import Cart from './Cart';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider, useCart } from '../context/CartContext';
import { getProductById } from '../services/productApi';
import type { Product } from '../types';

vi.mock('../services/productApi', () => ({
  getProductById: vi.fn(),
}));

const CART_STORAGE_KEY = 'eclectary-cart';
const apiProduct: Product = {
  id: 987654,
  active: true,
  title: 'Live API Bowl',
  price: 19.99,
  creator: 'Public Clay Studio',
  seller_id: 42,
  image: 'http://localhost:3000/rails/active_storage/blobs/redirect/signed-id/bowl.png',
};

function persistedItem(product: Product, quantity = 1) {
  return { productId: product.id, quantity, product, status: 'available' };
}

function keepRevalidationPending() {
  vi.mocked(getProductById).mockReturnValue(new Promise(() => undefined));
}

function renderCart() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Cart />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>,
  );
}

function CartWithAddControls() {
  const { addToCart } = useCart();
  const updatedProduct = {
    ...apiProduct,
    title: 'Updated API Bowl',
    price: 24.5,
    creator: 'Updated Clay Studio',
  };

  return (
    <>
      <button type="button" onClick={() => addToCart(apiProduct)}>Add API product</button>
      <button type="button" onClick={() => addToCart(updatedProduct, 2)}>Add updated API product</button>
      <Cart />
    </>
  );
}

function renderCartWithAddControls() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <CartWithAddControls />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('Cart', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getProductById).mockReset();
  });

  it('shows an empty-cart state when no items have been added', () => {
    renderCart();

    expect(screen.getByRole('heading', { name: 'Your cart is empty.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute('href', '/shop');
  });

  it('adds and displays a real API product that is absent from the static catalog', async () => {
    const user = userEvent.setup();
    renderCartWithAddControls();

    await user.click(screen.getByRole('button', { name: 'Add API product' }));

    expect(screen.getByRole('heading', { name: apiProduct.title })).toBeInTheDocument();
    expect(screen.getByText(`By ${apiProduct.creator}`)).toBeInTheDocument();
    expect(screen.getByText('$19.99 each')).toBeInTheDocument();
    expect(screen.getByAltText(apiProduct.title)).toHaveAttribute('src', apiProduct.image);
    expect(screen.getByLabelText('Cart summary')).toHaveTextContent('$19.99');
  });

  it('increments quantity and refreshes the snapshot when the same product is added again', async () => {
    const user = userEvent.setup();
    renderCartWithAddControls();

    await user.click(screen.getByRole('button', { name: 'Add API product' }));
    await user.click(screen.getByRole('button', { name: 'Add updated API product' }));

    expect(screen.queryByRole('heading', { name: apiProduct.title })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Updated API Bowl' })).toBeInTheDocument();
    expect(screen.getByText('By Updated Clay Studio')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByLabelText('Cart summary')).toHaveTextContent('$73.50');
  });

  it('loads a persisted product snapshot and calculates the subtotal', () => {
    keepRevalidationPending();
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([persistedItem(apiProduct, 2)]));

    renderCart();

    expect(screen.getByRole('heading', { name: apiProduct.title })).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByLabelText('Cart summary')).toHaveTextContent('$39.98');
  });

  it('increases and decreases an item quantity and updates totals', async () => {
    const user = userEvent.setup();
    keepRevalidationPending();
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([persistedItem(apiProduct)]));
    renderCart();

    await user.click(screen.getByRole('button', { name: `Increase quantity for ${apiProduct.title}` }));
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByLabelText('Cart summary')).toHaveTextContent('$39.98');

    await user.click(screen.getByRole('button', { name: `Decrease quantity for ${apiProduct.title}` }));
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByLabelText('Cart summary')).toHaveTextContent('$19.99');
  });

  it('updates an item quantity from the quantity field and persists it', async () => {
    keepRevalidationPending();
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([persistedItem(apiProduct)]));
    renderCart();

    fireEvent.change(screen.getByRole('spinbutton', { name: `Quantity for ${apiProduct.title}` }), {
      target: { value: '3' },
    });

    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByLabelText('Cart summary')).toHaveTextContent('$59.97');
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '[]')).toMatchObject([
        { productId: apiProduct.id, quantity: 3, product: apiProduct, status: 'available' },
      ]);
    });
  });

  it('removes an item from the cart', async () => {
    const user = userEvent.setup();
    keepRevalidationPending();
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([persistedItem(apiProduct)]));
    renderCart();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.getByRole('heading', { name: 'Your cart is empty.' })).toBeInTheDocument();
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe('[]');
  });

  it('clears all cart entries from the Cart page', async () => {
    const user = userEvent.setup();
    keepRevalidationPending();
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([persistedItem(apiProduct, 2)]));
    renderCart();

    await user.click(screen.getByRole('button', { name: 'Clear cart' }));

    expect(screen.getByRole('heading', { name: 'Your cart is empty.' })).toBeInTheDocument();
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe('[]');
  });

  it('revalidates a legacy ID-only entry through the Product API', async () => {
    vi.mocked(getProductById).mockResolvedValue(apiProduct);
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([
      { productId: apiProduct.id, quantity: 2 },
    ]));

    renderCart();

    expect(screen.getByText('Checking current product details...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: apiProduct.title })).toBeInTheDocument();
    expect(getProductById).toHaveBeenCalledOnce();
    expect(getProductById).toHaveBeenCalledWith(String(apiProduct.id));
    expect(screen.getByLabelText('Cart summary')).toHaveTextContent('$39.98');
  });

  it('keeps a 404 product visible and removable without including it in subtotal', async () => {
    const user = userEvent.setup();
    vi.mocked(getProductById).mockRejectedValue(new AxiosError(
      'Not found',
      '404',
      undefined,
      undefined,
      {
        status: 404,
        statusText: 'Not Found',
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    ));
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([persistedItem(apiProduct, 2)]));

    renderCart();

    expect(await screen.findByText('This product is no longer available.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: apiProduct.title })).toBeInTheDocument();
    expect(screen.getByText('Quantity: 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Cart summary')).toHaveTextContent('$0.00');

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByRole('heading', { name: 'Your cart is empty.' })).toBeInTheDocument();
  });

  it('keeps a valid snapshot available after a transient revalidation failure', async () => {
    vi.mocked(getProductById).mockRejectedValue(new Error('Network unavailable'));
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([persistedItem(apiProduct)]));

    renderCart();

    await waitFor(() => expect(getProductById).toHaveBeenCalledOnce());
    expect(screen.getByRole('heading', { name: apiProduct.title })).toBeInTheDocument();
    expect(screen.queryByText('This product is no longer available.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cart summary')).toHaveTextContent('$19.99');
  });

  it('ignores malformed local storage data safely', () => {
    window.localStorage.setItem(CART_STORAGE_KEY, '{not valid json');

    expect(() => renderCart()).not.toThrow();
    expect(screen.getByRole('heading', { name: 'Your cart is empty.' })).toBeInTheDocument();
  });
});
