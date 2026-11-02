import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = vi.mocked(useAuth);

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderProtectedRoute(allowedRoles?: Array<'customer' | 'seller' | 'administrator'>) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
          <Route path="/protected" element={<h1>Protected content</h1>} />
        </Route>
        <Route path="/account/login" element={<h1>Login</h1>} />
        <Route path="/" element={<h1>Home</h1>} />
      </Routes>
      <CurrentLocation />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProtectedRoute', () => {
  it('does not redirect while authentication is loading', () => {
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderProtectedRoute();

    expect(screen.getByTestId('location')).toHaveTextContent('/protected');
    expect(screen.queryByRole('heading', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('renders protected content for an authenticated user', () => {
    useAuthMock.mockReturnValue({
      user: { id: 7, email: 'member@example.com', role: 'customer' },
      token: 'stored-token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderProtectedRoute();

    expect(screen.getByRole('heading', { name: 'Protected content' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/protected');
  });

  it('renders role-protected content for an authenticated user with an allowed role', () => {
    useAuthMock.mockReturnValue({
      user: { id: 7, email: 'seller@example.com', role: 'seller' },
      token: 'stored-token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderProtectedRoute(['seller']);

    expect(screen.getByRole('heading', { name: 'Protected content' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/protected');
  });

  it.each(['customer', 'administrator'] as const)('redirects an authenticated %s without the required role', (role) => {
    useAuthMock.mockReturnValue({
      user: { id: 7, email: `${role}@example.com`, role },
      token: 'stored-token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderProtectedRoute(['seller']);

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('redirects an unauthenticated user after initialization', () => {
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderProtectedRoute();

    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/account/login');
  });
});
