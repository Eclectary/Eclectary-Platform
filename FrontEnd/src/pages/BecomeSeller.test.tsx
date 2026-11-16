import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import BecomeSeller from './BecomeSeller';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
const useAuthMock = vi.mocked(useAuth);

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account/become-seller']}>
      <Routes>
        <Route path="*" element={<><BecomeSeller /><CurrentLocation /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('seller onboarding', () => {
  it('submits normalized shop information and redirects to the dashboard', async () => {
    const becomeSeller = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: { id: 7, email: 'buyer@example.com', role: 'customer' },
      token: 'stored-token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      becomeSeller,
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderPage();
    await user.type(screen.getByLabelText('Shop name'), '  Clay Studio  ');
    await user.type(screen.getByLabelText('What do you make?'), '  Ceramics  ');
    await user.type(screen.getByLabelText(/Shop story/), '  Handmade bowls.  ');
    await user.click(screen.getByRole('button', { name: 'Create seller profile' }));

    expect(becomeSeller).toHaveBeenCalledWith({
      public_name: 'Clay Studio',
      specialty: 'Ceramics',
      bio: 'Handmade bowls.',
      image_url: '',
    });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'));
  });

  it('validates required fields without submitting', async () => {
    const becomeSeller = vi.fn();
    useAuthMock.mockReturnValue({
      user: { id: 7, email: 'buyer@example.com', role: 'customer' },
      token: 'stored-token', loading: false, login: vi.fn(), register: vi.fn(), becomeSeller, logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Create seller profile' }));

    expect(screen.getByText('Enter your shop name.')).toBeInTheDocument();
    expect(screen.getByText('Describe what your shop makes.')).toBeInTheDocument();
    expect(becomeSeller).not.toHaveBeenCalled();
  });

  it('redirects an existing seller to the dashboard', () => {
    useAuthMock.mockReturnValue({
      user: { id: 7, email: 'seller@example.com', role: 'seller' },
      token: 'stored-token', loading: false, login: vi.fn(), register: vi.fn(), becomeSeller: vi.fn(), logout: vi.fn(),
    });

    renderPage();

    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });
});
