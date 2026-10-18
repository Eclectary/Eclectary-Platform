import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { CartProvider } from '../context/CartContext';
import { WishlistProvider } from '../context/WishlistContext';
import { getCategories } from '../services/categoryApi';
import Home from './Home';

vi.mock('../services/categoryApi', () => ({
  getCategories: vi.fn(),
}));

vi.mock('../services/productApi', () => ({
  getProducts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/sellerApi', () => ({
  getSellers: () => [],
}));

const getCategoriesMock = vi.mocked(getCategories);

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
