import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

import { CartProvider } from '../context/CartContext';
import { WishlistProvider } from '../context/WishlistContext';
import { getCategories } from '../services/categoryApi';
import { getProducts } from '../services/productApi';
import { getPublicSellers } from '../services/sellerApi';
import type { Category, Product, Seller } from '../types';
import Shop from './Shop';

vi.mock('../services/categoryApi', () => ({ getCategories: vi.fn() }));
vi.mock('../services/productApi', () => ({ getProducts: vi.fn() }));
vi.mock('../services/sellerApi', () => ({ getPublicSellers: vi.fn() }));

const getCategoriesMock = vi.mocked(getCategories);
const getProductsMock = vi.mocked(getProducts);
const getPublicSellersMock = vi.mocked(getPublicSellers);
const categories: Category[] = [
  { id: 'art', apiId: 77, slug: 'art', name: 'Art', collection: 'custom-printing' },
];
const products: Product[] = [
  {
    id: 1,
    title: 'First Product',
    description: 'Wheel-thrown stoneware for daily rituals',
    price: 30,
    creator: 'Maker One',
    category: 'art',
    category_id: 77,
    category_name: 'Ceramics',
    subcategory: 'Mugs',
    collection: 'custom-printing',
    rating: 4,
  },
  { id: 2, title: 'Second Product', price: 10, creator: 'Maker Two', category: 'art', category_id: 77, collection: 'custom-printing', rating: 5 },
  { id: 3, title: 'Other Product', price: 20, creator: 'Maker Two', category: 'other', category_id: 88, rating: 3 },
];
const sellers: Seller[] = [
  { id: 42, name: 'Maker One', image: '/maker.jpg', specialty: 'Prints', bio: 'Studio one' },
  { id: 91, name: 'Maker Two', image: '/maker.jpg', specialty: 'Paper', bio: 'Studio two' },
];

function RouterTestControls() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="location-search">{location.search}</output>
      <button type="button" onClick={() => navigate('/shop?search=Other')}>Navigate to another search</button>
    </>
  );
}

function renderShop(path = '/shop') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CartProvider>
        <WishlistProvider>
          <Shop />
          <RouterTestControls />
        </WishlistProvider>
      </CartProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  getCategoriesMock.mockReset();
  getCategoriesMock.mockResolvedValue(categories);
  getProductsMock.mockReset();
  getProductsMock.mockResolvedValue(products);
  getPublicSellersMock.mockReset();
  getPublicSellersMock.mockResolvedValue(sellers);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Shop live marketplace data', () => {
  it('loads API products and sellers with existing detail navigation', async () => {
    renderShop();

    expect(await screen.findByRole('heading', { name: 'First Product' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Other Product' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meet the Makers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View First Product' })).toHaveAttribute('href', '/product/1');
    expect(screen.getByRole('link', { name: "View Maker One's shop" })).toHaveAttribute('href', '/seller/42');
    expect(getProductsMock).toHaveBeenCalledOnce();
    expect(getPublicSellersMock).toHaveBeenCalledOnce();
  });

  it('scrolls directly to the makers section when opened with the homepage anchor', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderShop('/shop#makers');

    await screen.findByRole('heading', { name: 'Meet the Makers' });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('shows loading feedback while products are pending', async () => {
    let resolveProducts!: (data: Product[]) => void;
    getProductsMock.mockReturnValue(new Promise((resolve) => { resolveProducts = resolve; }));
    renderShop('/shop?search=First');

    expect(screen.getByText('Loading products...')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('heading', { name: 'No products match your search.' })).not.toBeInTheDocument();
    await act(async () => resolveProducts(products));
    expect(await screen.findByRole('heading', { name: 'First Product' })).toBeInTheDocument();
  });

  it('shows a product error and retries the API request', async () => {
    getProductsMock.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(products);
    const user = userEvent.setup();
    renderShop('/shop?search=First');

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load products.');
    expect(screen.queryByRole('heading', { name: 'No products match your search.' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry loading products' }));
    expect(await screen.findByRole('heading', { name: 'First Product' })).toBeInTheDocument();
    expect(getProductsMock).toHaveBeenCalledTimes(2);
  });

  it('submits an encoded search query while preserving existing URL filters', async () => {
    const user = userEvent.setup();
    renderShop('/shop?intention=focus&price=under-25&sort=price-asc');

    await user.type(screen.getByRole('searchbox'), 'Second Product');
    await user.click(screen.getByRole('button', { name: 'Submit search' }));

    const params = new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
    expect(params.get('search')).toBe('Second Product');
    expect(params.get('intention')).toBe('focus');
    expect(params.get('price')).toBe('under-25');
    expect(params.get('sort')).toBe('price-asc');
    expect(screen.getByTestId('location-search')).toHaveTextContent('search=Second+Product');
  });

  it('removes only the search parameter when search is cleared', async () => {
    const user = userEvent.setup();
    renderShop('/shop?search=First&intention=focus&price=under-25');

    const search = screen.getByRole('searchbox');
    expect(search).toHaveValue('First');
    await user.clear(search);

    const params = new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
    expect(params.has('search')).toBe(false);
    expect(params.get('intention')).toBe('focus');
    expect(params.get('price')).toBe('under-25');
  });

  it('loads and filters from a direct search URL', async () => {
    renderShop('/shop?search=Second');

    expect(screen.getByRole('searchbox')).toHaveValue('Second');
    expect(await screen.findByRole('heading', { name: 'Second Product' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Product' })).not.toBeInTheDocument();
  });

  it('reacts to search URL changes while Shop remains mounted', async () => {
    const user = userEvent.setup();
    renderShop('/shop?search=First');
    expect(await screen.findByRole('heading', { name: 'First Product' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Navigate to another search' }));

    expect(screen.getByRole('searchbox')).toHaveValue('Other');
    expect(await screen.findByRole('heading', { name: 'Other Product' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Product' })).not.toBeInTheDocument();
  });

  it.each([
    ['title', 'First Product'],
    ['description', 'stoneware'],
    ['creator', 'Maker One'],
    ['category name', 'Ceramics'],
    ['subcategory', 'Mugs'],
  ])('matches Rails-shaped product %s text', async (_field, query) => {
    renderShop(`/shop?search=${encodeURIComponent(query)}`);

    expect(await screen.findByRole('heading', { name: 'First Product' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Second Product' })).not.toBeInTheDocument();
  });

  it('shows the search empty state for a successful nonmatching query', async () => {
    renderShop('/shop?search=not-a-real-product');

    expect(await screen.findByRole('heading', { name: 'No products match your search.' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an empty product state after a successful empty response', async () => {
    getProductsMock.mockResolvedValue([]);
    getPublicSellersMock.mockResolvedValue([]);
    renderShop();

    expect(await screen.findByRole('heading', { name: 'No products match your search.' })).toBeInTheDocument();
    expect(screen.getByText('No makers available yet.')).toBeInTheDocument();
  });

  it('filters products by search term and the API category slug/ID', async () => {
    const user = userEvent.setup();
    renderShop('/shop?collection=custom-printing');
    await screen.findByRole('button', { name: 'Art' });

    await user.click(screen.getByRole('button', { name: 'Art' }));
    expect(screen.getByRole('heading', { name: 'First Product' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Second Product' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Other Product' })).not.toBeInTheDocument();

    const search = screen.getByRole('searchbox');
    await user.type(search, 'Second');
    expect(screen.getByRole('heading', { name: 'Second Product' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Product' })).not.toBeInTheDocument();
  });

  it('filters seller cards by API seller data and preserves sorting', async () => {
    const user = userEvent.setup();
    renderShop();
    await screen.findByRole('heading', { name: 'First Product' });

    await user.type(screen.getByRole('searchbox'), 'Maker Two');
    expect(screen.getByRole('link', { name: "View Maker Two's shop" })).toHaveAttribute('href', '/seller/91');
    expect(screen.queryByRole('link', { name: "View Maker One's shop" })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.selectOptions(screen.getByRole('combobox', { name: /sort by/i }), 'price-asc');
    await waitFor(() => {
      const productHeadings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
      expect(productHeadings.slice(0, 3)).toEqual(['Second Product', 'Other Product', 'First Product']);
    });
  });

  it('shows and retries seller loading errors', async () => {
    getPublicSellersMock.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(sellers);
    const user = userEvent.setup();
    renderShop();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load makers.');
    await user.click(screen.getByRole('button', { name: 'Retry loading makers' }));
    expect(await screen.findByRole('link', { name: "View Maker One's shop" })).toBeInTheDocument();
  });
});
