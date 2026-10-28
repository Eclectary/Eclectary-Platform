import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import Profile from './Profile';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = vi.mocked(useAuth);

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/account/profile']}>
      <Routes>
        <Route path="*" element={<><Profile /><CurrentLocation /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Profile authenticated behavior', () => {
  it('renders the validated AuthContext user and logs out through AuthContext', async () => {
    const logout = vi.fn();
    useAuthMock.mockReturnValue({
      user: { id: 7, email: 'member@example.com', role: 'customer' },
      token: 'stored-token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout,
    });
    const user = userEvent.setup();

    renderProfile();

    expect(screen.getAllByText('member@example.com').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

});
