import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import Category from './Category';
import Categories from './Categories';
import { getProductsByCategory } from '../services/productApi';
import type { Product } from '../types';

vi.mock('../services/productApi', () => ({
  getProductsByCategory: vi.fn(),
}));

vi.mock('../services/sellerApi', () => ({
  getSellersByCategory: () => [],
}));

vi.mock('../data/categories', () => {
  const categories = [
    { id: 'jewelry', name: 'Jewelry', image: '/jewelry.jpg', childSubcategories: ['Rings'] },
    { id: 'art', name: 'Art', image: '/art.jpg' },
  ];
  return {
    categories,
    getCategory: (id: string) => categories.find((category) => category.id === id),
  };
});

vi.mock('../components/ProductCard', () => ({
  default: ({ product }: { product: Product }) => <p>{product.title}</p>,
}));

const product: Product = { id: 1, title: 'Silver Ring', price: 20, creator: 'Maker' };
const getProductsMock = vi.mocked(getProductsByCategory);

function deferredProducts() {
  let resolve!: (products: Product[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Product[]>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderCategory(path = '/category/jewelry') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/category/:id" element={<Category />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getProductsMock.mockReset();
});

afterEach(cleanup);

describe('Category asynchronous products', () => {
  it('shows loading before rendering products and the resolved count', async () => {
    const request = deferredProducts();
    getProductsMock.mockReturnValue(request.promise);
    renderCategory();

    expect(screen.getByRole('status')).toHaveTextContent('Loading products...');
    expect(screen.queryByText('No products in this category yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to categories' })).toHaveAttribute('href', '/categories');

    await act(async () => request.resolve([product]));

    expect(screen.getByText('Silver Ring')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('distinguishes a rejected request from an empty category', async () => {
    getProductsMock.mockRejectedValue(new Error('Network unavailable'));
    renderCategory();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load products.');
    expect(screen.queryByText('No products in this category yet.')).not.toBeInTheDocument();
  });

  it('preserves the empty state after a successful empty response', async () => {
    getProductsMock.mockResolvedValue([]);
    renderCategory();
    expect(await screen.findByText('No products in this category yet.')).toBeInTheDocument();
    expect(screen.getByText('0 items')).toBeInTheDocument();
  });

  it('ignores stale failures after subcategory navigation', async () => {
    const first = deferredProducts();
    const second = deferredProducts();
    getProductsMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    renderCategory();

    await userEvent.click(screen.getByRole('link', { name: 'Rings' }));
    expect(getProductsMock).toHaveBeenLastCalledWith('jewelry', 'Rings');
    await act(async () => second.resolve([product]));
    await act(async () => first.reject(new Error('Outdated request')));

    expect(screen.getByText('Rings: 1 item')).toBeInTheDocument();
    expect(screen.getByText('Silver Ring')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides previous products while a new subcategory loads and ignores stale successes', async () => {
    const first = deferredProducts();
    const second = deferredProducts();
    const third = deferredProducts();
    getProductsMock.mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise);
    renderCategory();
    await act(async () => first.resolve([product]));

    await userEvent.click(screen.getByRole('link', { name: 'Rings' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Silver Ring')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'All Jewelry' }));
    await act(async () => third.resolve([]));
    await act(async () => second.resolve([product]));

    expect(screen.getByText('No products in this category yet.')).toBeInTheDocument();
    expect(screen.queryByText('Silver Ring')).not.toBeInTheDocument();
  });

  it('ignores invalid subcategories and does not fetch unknown categories', async () => {
    getProductsMock.mockResolvedValue([]);
    const view = renderCategory('/category/jewelry?subcategory=invalid');
    await screen.findByText('0 items');
    expect(getProductsMock).toHaveBeenCalledWith('jewelry', undefined);
    view.unmount();
    getProductsMock.mockClear();

    renderCategory('/category/unknown');
    expect(screen.getByText('That category is unavailable.')).toBeInTheDocument();
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)('handles a request that %ss after unmount', async (outcome) => {
    const request = deferredProducts();
    getProductsMock.mockReturnValue(request.promise);
    const view = renderCategory();
    view.unmount();
    await act(async () => {
      if (outcome === 'resolve') request.resolve([product]);
      else request.reject(new Error('Unmounted request'));
    });
  });
});

describe('Categories asynchronous counts', () => {
  it('keeps browsing and search available while loading and renders resolved counts', async () => {
    const request = deferredProducts();
    getProductsMock.mockReturnValue(request.promise);
    render(<MemoryRouter><Categories /></MemoryRouter>);

    expect(screen.getAllByText(/Loading items/)).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Browse Jewelry' })).toHaveAttribute('href', '/category/jewelry');
    await userEvent.type(screen.getByRole('searchbox'), 'rings');
    expect(screen.queryByRole('link', { name: 'Browse Art' })).not.toBeInTheDocument();

    await act(async () => request.resolve([product]));
    expect(screen.getByText('1 item · 0 shops')).toBeInTheDocument();
    expect(getProductsMock).toHaveBeenCalledTimes(2);
  });

  it('reports count failures without removing category links', async () => {
    getProductsMock.mockRejectedValue(new Error('Network unavailable'));
    render(<MemoryRouter><Categories /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText(/Unable to load item counts/)).toHaveLength(2));
    expect(screen.getByRole('link', { name: 'Browse Jewelry' })).toBeInTheDocument();
    expect(screen.queryByText(/0 items/)).not.toBeInTheDocument();
  });

  it.each(['resolve', 'reject'] as const)('handles count requests that %s after unmount', async (outcome) => {
    const request = deferredProducts();
    getProductsMock.mockReturnValue(request.promise);
    const view = render(<MemoryRouter><Categories /></MemoryRouter>);
    view.unmount();
    await act(async () => {
      if (outcome === 'resolve') request.resolve([]);
      else request.reject(new Error('Unmounted request'));
    });
  });
});
