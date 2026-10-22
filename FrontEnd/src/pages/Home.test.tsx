import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { CartProvider } from '../context/CartContext';
import { WishlistProvider } from '../context/WishlistContext';
import { getCategories } from '../services/categoryApi';
import { getProducts } from '../services/productApi';
import { getPublicSellers } from '../services/sellerApi';
import type { Product } from '../types';
import Home from './Home';

vi.mock('../services/categoryApi', () => ({
  getCategories: vi.fn(),
}));

vi.mock('../services/productApi', () => ({
  getProducts: vi.fn(),
}));

vi.mock('../services/sellerApi', () => ({
  getPublicSellers: vi.fn(),
}));

const getCategoriesMock = vi.mocked(getCategories);
const getProductsMock = vi.mocked(getProducts);
const getPublicSellersMock = vi.mocked(getPublicSellers);

const products: Product[] = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  title: `Product ${index + 1}`,
  price: 12,
  creator: 'Test maker',
  rating: 5 - index / 10,
}));

function deferredProducts() {
  let resolve!: (value: Product[]) => void;
  const promise = new Promise<Product[]>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderHome() {
  return render(
    <MemoryRouter>
      <CartProvider>
        <WishlistProvider>
          <Home />
        </WishlistProvider>
      </CartProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getCategoriesMock.mockReset();
  getCategoriesMock.mockResolvedValue([]);
  getProductsMock.mockReset();
  getProductsMock.mockResolvedValue([]);
  getPublicSellersMock.mockReset();
  getPublicSellersMock.mockResolvedValue([]);
});

describe('Homepage products', () => {
  it('renders loaded products in trending and recommendations', async () => {
    getProductsMock.mockResolvedValue(products);
    renderHome();

    expect(await screen.findByRole('heading', { name: 'Product 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product 5' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product 6' })).toBeInTheDocument();
    expect(getProductsMock).toHaveBeenCalledOnce();
  });

  it('shows loading feedback and does not report no search matches before products load', async () => {
    const request = deferredProducts();
    getProductsMock.mockReturnValue(request.promise);
    const user = userEvent.setup();
    renderHome();

    expect(screen.getByText('Loading products...')).toHaveAttribute('role', 'status');
    expect(screen.getByText('Recommendations will appear when products finish loading.'))
      .toHaveAttribute('role', 'status');
    await user.type(screen.getByRole('searchbox'), 'not-a-match');

    expect(screen.getByText('Loading product results...')).toBeInTheDocument();
    expect(screen.queryByText('No products match your search.')).not.toBeInTheDocument();
    expect(screen.queryByText(/0 products and/)).not.toBeInTheDocument();

    await act(async () => request.resolve(products));
    expect(await screen.findByText('No products match your search.')).toBeInTheDocument();
  });

  it('shows product errors in search and retries the request', async () => {
    getProductsMock.mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(products);
    const user = userEvent.setup();
    renderHome();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load marketplace products.');
    expect(screen.getByText('Recommendations are unavailable until products can be loaded.'))
      .toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'missing');
    expect(screen.getByText(/Product results are unavailable/)).toBeInTheDocument();
    expect(screen.queryByText('No products match your search.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry loading products' }));
    expect(await screen.findByRole('heading', { name: 'Product 1' })).toBeInTheDocument();
    expect(getProductsMock).toHaveBeenCalledTimes(2);
  });

  it('shows friendly empty states when no products are returned', async () => {
    const user = userEvent.setup();
    renderHome();

    expect(await screen.findByText('No products available yet.')).toBeInTheDocument();
    expect(screen.getByText('No recommendations available yet.')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox'), 'anything');
    expect(screen.getByText('No products match your search.')).toBeInTheDocument();
  });

  it('explains when no recommendations are available for a small product set', async () => {
    getProductsMock.mockResolvedValue(products.slice(0, 2));
    renderHome();

    expect(await screen.findByRole('heading', { name: 'Product 1' })).toBeInTheDocument();
    expect(screen.getByText('More recommendations will appear as the marketplace grows.'))
      .toBeInTheDocument();
  });
});

describe('Homepage makers', () => {
  const makers = Array.from({ length: 5 }, (_, index) => ({
    id: index + 101,
    name: `Real Maker ${index + 1}`,
    image: '/maker.jpg',
    specialty: index === 4 ? 'Pottery' : 'Textiles',
    bio: `Public studio biography ${index + 1}`,
  }));

  it('loads real makers, limits the initial display to four, and preserves shop links', async () => {
    getPublicSellersMock.mockResolvedValue(makers);
    renderHome();

    expect(await screen.findByRole('heading', { name: 'Real Maker 1' })).toBeInTheDocument();
    expect(getPublicSellersMock).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('link', { name: 'Visit Shop' })).toHaveLength(4);
    expect(screen.getByRole('link', { name: "View Real Maker 1's shop" }))
      .toHaveAttribute('href', '/seller/101');
    expect(screen.getByRole('img', { name: 'Real Maker 1, Textiles' }))
      .toHaveAttribute('src', '/maker.jpg');
    expect(screen.queryByText('Real Maker 5')).not.toBeInTheDocument();
    expect(screen.queryByText('Moss Atelier')).not.toBeInTheDocument();
  });

  it('shows loading followed by an empty state', async () => {
    let resolveSellers!: (sellers: Awaited<ReturnType<typeof getPublicSellers>>) => void;
    getPublicSellersMock.mockReturnValue(new Promise((resolve) => {
      resolveSellers = resolve;
    }));
    renderHome();
    expect(screen.getByText('Loading makers...')).toHaveAttribute('role', 'status');
    resolveSellers([]);
    expect(await screen.findByText('No makers available yet.')).toBeInTheDocument();
    expect(screen.queryByText('Loading makers...')).not.toBeInTheDocument();
  });

  it('shows a maker-specific error and leaves other homepage sections visible', async () => {
    getPublicSellersMock.mockRejectedValue(new Error('Network unavailable'));
    renderHome();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load makers.');
    expect(screen.queryByText('No makers available yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trending now' })).toBeInTheDocument();
  });

  it('links View All Makers directly to the maker discovery section', async () => {
    getPublicSellersMock.mockResolvedValue(makers);
    renderHome();

    const link = await screen.findByRole('link', { name: /View All Makers/ });
    expect(link).toHaveAttribute('href', '/shop#makers');
  });

  it('searches all API makers by name, specialty, and bio and reports no matches', async () => {
    getPublicSellersMock.mockResolvedValue(makers);
    const user = userEvent.setup();
    renderHome();
    await screen.findByRole('heading', { name: 'Real Maker 1' });
    const search = screen.getByRole('searchbox');

    for (const term of ['Real Maker 5', 'pottery', 'biography 5']) {
      await user.clear(search);
      await user.type(search, term);
      expect(screen.getByRole('heading', { name: 'Real Maker 5' })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: 'Visit Shop' })).toHaveLength(1);
    }

    await user.clear(search);
    await user.type(search, 'no-such-maker');
    expect(screen.getByText('No makers match your search.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Visit Shop' })).not.toBeInTheDocument();
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Homepage categories', () => {
  it('renders API categories with their stable slug links', async () => {
    getCategoriesMock.mockResolvedValue([
      {
        id: 'digital-art',
        apiId: 17,
        slug: 'digital-art',
        name: 'Digital Art',
        image: '/digital-art.jpg',
        collection: 'digital-creations',
      },
    ]);

    renderHome();

    expect(await screen.findByRole('link', { name: 'Browse Digital Art' }))
      .toHaveAttribute('href', '/category/digital-art');
    expect(screen.getByRole('link', { name: 'Browse Digital Art' }).querySelector('img'))
      .toHaveAttribute('src', '/digital-art.jpg');
    expect(screen.queryByText('Loading categories...')).not.toBeInTheDocument();
  });

  it('shows loading and empty states for an empty API response', async () => {
    let resolveCategories!: (categories: Awaited<ReturnType<typeof getCategories>>) => void;
    getCategoriesMock.mockReturnValue(new Promise((resolve) => {
      resolveCategories = resolve;
    }));

    renderHome();
    expect(screen.getByText('Loading categories...')).toBeInTheDocument();

    resolveCategories([]);
    expect(await screen.findByText('No categories available yet.')).toBeInTheDocument();
  });

  it('shows a category-specific error without removing other homepage sections', async () => {
    getCategoriesMock.mockRejectedValue(new Error('Network unavailable'));

    renderHome();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load categories.');
    expect(screen.getByRole('heading', { name: 'Trending now' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Shop by category' })).toBeInTheDocument();
  });
});
