import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import Navbar from './Navbar';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));

const useAuthMock = vi.mocked(useAuth);

function renderNavbar(role: 'customer' | 'seller' | 'administrator') {
  vi.mocked(useCart).mockReturnValue({ totalItems: 0 } as ReturnType<typeof useCart>);
  useAuthMock.mockReturnValue({
    user: { id: 7, email: `${role}@example.com`, role },
    token: 'stored-token', loading: false, login: vi.fn(), register: vi.fn(), becomeSeller: vi.fn(), logout: vi.fn(),
  });
  return render(<MemoryRouter><Navbar /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('seller navigation', () => {
  it('offers seller onboarding to signed-in customers', () => {
    renderNavbar('customer');
    expect(screen.getByRole('link', { name: 'Become a Seller' })).toHaveAttribute('href', '/account/become-seller');
    expect(screen.queryByRole('link', { name: 'Seller Dashboard' })).not.toBeInTheDocument();
  });

  it('replaces onboarding with the dashboard for sellers', () => {
    renderNavbar('seller');
    expect(screen.getByRole('link', { name: 'Seller Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: 'Become a Seller' })).not.toBeInTheDocument();
  });

  it('does not offer seller actions to administrators', () => {
    renderNavbar('administrator');
    expect(screen.queryByRole('link', { name: 'Become a Seller' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Seller Dashboard' })).not.toBeInTheDocument();
  });
});
