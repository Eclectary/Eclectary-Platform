import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from './context/AuthContext';
import { deactivateProduct, getSellerProducts } from './services/productApi';
import type { UserRole } from './types/user';
import App from './App';

vi.mock('./context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./services/productApi', () => ({
  getSellerProducts: vi.fn(),
  deactivateProduct: vi.fn(),
}));

async function outletLayout() {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { default: () => <Outlet /> };
}

vi.mock('./layouts/MainLayout', outletLayout);
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
vi.mock('./pages/AddProduct', () => ({ default: () => <h2>Add Product</h2> }));
vi.mock('./pages/EditProduct', () => ({ default: () => <h2>Edit Product</h2> }));
vi.mock('./pages/SellerOrders', () => ({ default: () => <h2>Seller Orders</h2> }));
vi.mock('./components/ProductCard', () => ({
  default: ({ product }: { product: { title: string } }) => <div>{product.title}</div>,
}));

const useAuthMock = vi.mocked(useAuth);
const getSellerProductsMock = vi.mocked(getSellerProducts);
const deactivateProductMock = vi.mocked(deactivateProduct);

const signedOutAuth = {
  user: null,
  token: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

function renderPath(path: string, role?: UserRole) {
  useAuthMock.mockReturnValue(role ? {
    ...signedOutAuth,
    user: { id: 7, email: `${role}@example.com`, role },
    token: 'stored-token',
  } : signedOutAuth);
  window.history.replaceState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  getSellerProductsMock.mockResolvedValue([]);
});

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
  ])('preserves authenticated customer access to %s', (path, heading) => {
    renderPath(path, 'customer');

    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(window.location.pathname).toBe(path);
  });

  it.each([
    '/seller',
    '/dashboard',
    '/dashboard/products',
    '/dashboard/products/new',
    '/dashboard/products/1/edit',
    '/dashboard/orders',
    '/dashboard/settings',
  ])('denies customer and administrator access to %s', async (path) => {
    for (const role of ['customer', 'administrator'] as const) {
      const view = renderPath(path, role);

      await waitFor(() => expect(window.location.pathname).toBe('/'));
      expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
      view.unmount();
    }
  });

  it.each([
    ['/dashboard', 'Dashboard'],
    ['/dashboard/products', 'Your Products'],
    ['/dashboard/products/new', 'Add Product'],
    ['/dashboard/products/1/edit', 'Edit Product'],
    ['/dashboard/orders', 'Seller Orders'],
    ['/dashboard/settings', 'Settings'],
  ])('allows seller access to %s', async (path, heading) => {
    renderPath(path, 'seller');

    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(window.location.pathname).toBe(path);

    if (path === '/dashboard') {
      expect(await screen.findByText('Your Products: 0')).toBeInTheDocument();
    } else if (path === '/dashboard/products') {
      expect(await screen.findByText('You do not have any products yet.')).toBeInTheDocument();
    }
  });

  it('redirects the authenticated seller management entry point to the dashboard', async () => {
    renderPath('/seller', 'seller');

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('keeps the legacy profile alias behind profile protection', async () => {
    renderPath('/profile', 'customer');

    await waitFor(() => expect(window.location.pathname).toBe('/account/profile'));
    expect(screen.getByRole('heading', { name: 'Profile page' })).toBeInTheDocument();
  });
});

describe('seller dashboard product data', () => {
  it('counts and displays the products returned by the private seller endpoint', async () => {
    getSellerProductsMock.mockResolvedValue([
      { id: 1, title: 'Owned bowl', creator: 'Seller', price: 10, seller_id: 7, active: true },
      { id: 2, title: 'Owned print', creator: 'Seller', price: 15, seller_id: 7, active: false },
    ]);

    const overview = renderPath('/dashboard', 'seller');
    expect(await screen.findByText('Your Products: 2')).toBeInTheDocument();
    overview.unmount();

    renderPath('/dashboard/products', 'seller');
    expect(await screen.findByText('Owned bowl')).toBeInTheDocument();
    expect(screen.getByText('Owned print')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('keeps loading, error, retry, and empty states inside the dashboard page', async () => {
    let rejectInitialRequest!: (error: Error) => void;
    getSellerProductsMock.mockReturnValueOnce(new Promise((_resolve, reject) => {
      rejectInitialRequest = reject;
    })).mockResolvedValueOnce([]);

    renderPath('/dashboard', 'seller');
    expect(screen.getByRole('status')).toHaveTextContent('Loading your product information...');

    rejectInitialRequest(new Error('Unavailable'));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your products. Please try again.');
    expect(screen.queryByText('Your Products: 0')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Your Products: 0')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add Product' })).toHaveAttribute('href', '/dashboard/products/new');
  });

  it('deactivates an owned product and keeps it visible as inactive', async () => {
    const product = { id: 1, title: 'Owned bowl', creator: 'Seller', price: 10, seller_id: 7, active: true };
    getSellerProductsMock.mockResolvedValue([product]);
    deactivateProductMock.mockResolvedValue({ ...product, active: false });

    renderPath('/dashboard/products', 'seller');
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));

    expect(deactivateProductMock).toHaveBeenCalledWith(1);
    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.getByText('Owned bowl')).toBeInTheDocument();
  });

  it('keeps a product active and reports a failed deactivation', async () => {
    const product = { id: 1, title: 'Owned bowl', creator: 'Seller', price: 10, seller_id: 7, active: true };
    getSellerProductsMock.mockResolvedValue([product]);
    deactivateProductMock.mockRejectedValue(new Error('Unavailable'));

    renderPath('/dashboard/products', 'seller');
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not deactivate Owned bowl.');
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
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
