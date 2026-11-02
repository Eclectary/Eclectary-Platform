import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = vi.mocked(useAuth);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('seller dashboard navigation', () => {
  it('shows only currently supported sidebar destinations', () => {
    render(<MemoryRouter><DashboardSidebar /></MemoryRouter>);

    expect(screen.getByRole('link', { name: /Overview/ })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /Products/ })).toHaveAttribute('href', '/dashboard/products');
    expect(screen.getByRole('link', { name: /Add Product/ })).toHaveAttribute('href', '/dashboard/products/new');
    expect(screen.getByRole('link', { name: /Orders/ })).toHaveAttribute('href', '/dashboard/orders');
    expect(screen.getByRole('link', { name: /Return to Marketplace/ })).toHaveAttribute('href', '/');

    for (const unsupportedLabel of ['Messages', 'Analytics', 'Store Profile', 'Store Appearance', 'Reviews', 'Settings']) {
      expect(screen.queryByRole('link', { name: unsupportedLabel })).not.toBeInTheDocument();
    }
  });

  it('links to the authenticated seller store and shows their email', () => {
    useAuthMock.mockReturnValue({
      user: { id: 42, email: 'seller@example.com', role: 'seller' },
      token: 'stored-token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<MemoryRouter><DashboardHeader /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'View Store' })).toHaveAttribute('href', '/seller/42');
    expect(screen.getByText('seller@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open dashboard menu' })).not.toBeInTheDocument();
  });
});
