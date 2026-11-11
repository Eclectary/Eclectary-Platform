import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { AuthSessionValidationError } from '../services/authErrors';
import Login from './Login';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = vi.mocked(useAuth);

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderLogin(initialEntry: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/account/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntry}>
      <Routes>
        <Route path="*" element={<><Login /><CurrentLocation /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

function railsError(status: number, data: unknown) {
  return {
    isAxiosError: true,
    response: { status, data },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Login persistence choice', () => {
  it('passes the default remembered choice to AuthContext', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login,
      register: vi.fn(),
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('member@example.com', 'password123', true);
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('passes a disabled Remember Me choice to AuthContext', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login,
      register: vi.fn(),
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderLogin();
    await user.click(screen.getByRole('checkbox', { name: 'Remember me' }));
    await user.type(screen.getByLabelText('Email address'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('member@example.com', 'password123', false);
    });
  });

  it('returns to checkout after login when it was the requested protected page', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login,
      register: vi.fn(),
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderLogin([{
      pathname: '/account/login',
      state: { from: { pathname: '/checkout', search: '', hash: '' } },
    }]);
    await user.type(screen.getByLabelText('Email address'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/checkout');
    });
  });

  it('falls back to the homepage for an unsafe redirect destination', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login,
      register: vi.fn(),
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderLogin([{
      pathname: '/account/login',
      state: { from: { pathname: '//malicious.example/checkout' } },
    }]);
    await user.type(screen.getByLabelText('Email address'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
  });

  it.each([
    { errors: ['Invalid email or password'] },
    { error: 'Invalid email or password' },
  ])('shows invalid credentials for the Rails login 401', async (body) => {
    const login = vi.fn().mockRejectedValue(
      railsError(401, body),
    );
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login,
      register: vi.fn(),
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/account/login');
  });

  it('shows the server throttling message without navigating', async () => {
    useAuthMock.mockReturnValue({
      user: null, token: null, loading: false,
      login: vi.fn().mockRejectedValue(railsError(429, { errors: ['Too many requests. Please try again later.'] })),
      register: vi.fn(), logout: vi.fn(),
    });
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please try again later.');
    expect(screen.getByTestId('location')).toHaveTextContent('/account/login');
  });

  it('does not describe a network failure as invalid credentials', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Network unavailable'));
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login,
      register: vi.fn(),
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to sign in right now. Please try again.',
    );
    expect(screen.queryByText('Invalid email or password.')).not.toBeInTheDocument();
  });

  it('shows a session-verification message when post-login current-user loading fails', async () => {
    const login = vi.fn().mockRejectedValue(new AuthSessionValidationError());
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login,
      register: vi.fn(),
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't verify your session. Please sign in again.",
    );
  });
});
