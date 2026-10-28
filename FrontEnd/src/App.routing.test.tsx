import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from './context/AuthContext';
import App from './App';

vi.mock('./context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

async function outletLayout() {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { default: () => <Outlet /> };
}

vi.mock('./layouts/MainLayout', outletLayout);
vi.mock('./layouts/SellerLayout', outletLayout);
vi.mock('./layouts/DashboardLayout', outletLayout);

vi.mock('./pages/Home', () => ({ default: () => <h1>Home page</h1> }));
vi.mock('./pages/Shop', () => ({ default: () => <h1>Shop page</h1> }));
vi.mock('./pages/SellerDetail', () => ({ default: () => <h1>Seller detail page</h1> }));
vi.mock('./pages/ProductDetail', () => ({ default: () => <h1>Product detail page</h1> }));
vi.mock('./pages/Favorites', () => ({ default: () => <h1>Favorites page</h1> }));
vi.mock('./pages/Categories', () => ({ default: () => <h1>Categories page</h1> }));
vi.mock('./pages/Category', () => ({ default: () => <h1>Category page</h1> }));
vi.mock('./pages/Cart', () => ({ default: () => <h1>Cart page</h1> }));
vi.mock('./pages/Checkout', () => ({ default: () => <h1>Checkout page</h1> }));
vi.mock('./pages/OrderConfirmation', () => ({ default: () => <h1>Order confirmation page</h1> }));
vi.mock('./pages/Login', () => ({ default: () => <h1>Login page</h1> }));
vi.mock('./pages/Register', () => ({ default: () => <h1>Register page</h1> }));
vi.mock('./pages/Profile', () => ({ default: () => <h1>Profile page</h1> }));
vi.mock('./components/ProductCard', () => ({ default: () => <div>Product card</div> }));
vi.mock('./components/SellerCard', () => ({ default: () => <div>Seller card</div> }));

const useAuthMock = vi.mocked(useAuth);

const signedOutAuth = {
  user: null,
  token: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

const signedInAuth = {
  ...signedOutAuth,
  user: { id: 7, email: 'member@example.com', role: 'customer' },
  token: 'stored-token',
};

function renderPath(path: string, authenticated = false) {
  useAuthMock.mockReturnValue(authenticated ? signedInAuth : signedOutAuth);
  window.history.replaceState({}, '', path);
  return render(<App />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('protected application routes', () => {
  it.each([
    '/account/profile',
    '/checkout',
    '/seller',
    '/dashboard',
    '/dashboard/products',
    '/dashboard/products/new',
    '/dashboard/products/1/edit',
    '/dashboard/orders',
    '/dashboard/settings',
  ])('redirects unauthenticated direct access to %s', async (path) => {
    renderPath(path);

    await waitFor(() => expect(window.location.pathname).toBe('/account/login'));
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
  });

  it.each([
    ['/account/profile', 'Profile page'],
    ['/checkout', 'Checkout page'],
    ['/seller', 'Seller Portal'],
    ['/dashboard', 'Dashboard'],
    ['/dashboard/products', 'Products'],
    ['/dashboard/products/new', 'Add Listing'],
    ['/dashboard/products/1/edit', 'Edit Listing'],
    ['/dashboard/orders', 'Orders'],
    ['/dashboard/settings', 'Settings'],
  ])('allows authenticated access to %s', (path, heading) => {
    renderPath(path, true);

    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(window.location.pathname).toBe(path);
  });

  it('keeps the legacy profile alias behind profile protection', async () => {
    renderPath('/profile', true);

    await waitFor(() => expect(window.location.pathname).toBe('/account/profile'));
    expect(screen.getByRole('heading', { name: 'Profile page' })).toBeInTheDocument();
  });
});

describe('public application routes', () => {
  it.each([
    ['/', 'Home page'],
    ['/shop', 'Shop page'],
    ['/seller/1', 'Seller detail page'],
    ['/shop/1', 'Seller detail page'],
    ['/categories', 'Categories page'],
    ['/category/ceramics', 'Category page'],
    ['/product/1', 'Product detail page'],
    ['/about', 'About'],
    ['/cart', 'Cart page'],
    ['/favorites', 'Favorites page'],
    ['/order', 'Order confirmation page'],
    ['/account/login', 'Login page'],
    ['/account/register', 'Register page'],
  ])('leaves guest access to %s unchanged', (path, heading) => {
    renderPath(path);

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(window.location.pathname).toBe(path);
  });

  it('keeps the wishlist alias public', async () => {
    renderPath('/wishlist');

    await waitFor(() => expect(window.location.pathname).toBe('/favorites'));
    expect(screen.getByRole('heading', { name: 'Favorites page' })).toBeInTheDocument();
  });
});
