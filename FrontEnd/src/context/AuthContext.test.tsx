import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import {
  getCurrentUser,
  login as loginApi,
  register as registerApi,
} from '../services/authApi';
import { AuthSessionValidationError } from '../services/authErrors';
import { AUTH_SESSION_UNAUTHORIZED_EVENT } from '../services/authSession';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../services/authApi', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));

const getCurrentUserMock = vi.mocked(getCurrentUser);
const loginApiMock = vi.mocked(loginApi);
const registerApiMock = vi.mocked(registerApi);
const currentUser = {
  id: 7,
  email: 'member@example.com',
  role: 'customer',
};

function AuthState() {
  const { user, token, loading, login, register, logout } = useAuth();
  const [operationFailed, setOperationFailed] = useState(false);

  const runAuthOperation = async (operation: () => Promise<void>) => {
    setOperationFailed(false);

    try {
      await operation();
    } catch (error) {
      setOperationFailed(error instanceof AuthSessionValidationError);
    }
  };

  if (loading) {
    return <p>Loading</p>;
  }

  return (
    <>
      <p>{user?.email ?? 'Signed out'}</p>
      <p>{token ? 'Token present' : 'No token'}</p>
      <p>{operationFailed ? 'Session validation failed' : 'No operation failure'}</p>
      <button type="button" onClick={() => void runAuthOperation(() => login('member@example.com', 'password123', true))}>
        Remembered login
      </button>
      <button type="button" onClick={() => void runAuthOperation(() => login('member@example.com', 'password123', false))}>
        Session login
      </button>
      <button type="button" onClick={() => void runAuthOperation(() => register('member@example.com', 'password123', 'password123'))}>
        Register
      </button>
      <button type="button" onClick={logout}>Log out</button>
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  getCurrentUserMock.mockReset();
  loginApiMock.mockReset();
  registerApiMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('AuthProvider token persistence', () => {
  it('stores a remembered login only in localStorage', async () => {
    loginApiMock.mockResolvedValue({ token: 'remembered-token' });
    getCurrentUserMock.mockResolvedValue(currentUser);
    const user = userEvent.setup();

    render(<AuthProvider><AuthState /></AuthProvider>);
    await screen.findByText('Signed out');
    await user.click(screen.getByRole('button', { name: 'Remembered login' }));

    expect(await screen.findByText(currentUser.email)).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBe('remembered-token');
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });

  it('stores a non-remembered login only in sessionStorage', async () => {
    loginApiMock.mockResolvedValue({ token: 'session-token' });
    getCurrentUserMock.mockResolvedValue(currentUser);
    const user = userEvent.setup();

    render(<AuthProvider><AuthState /></AuthProvider>);
    await screen.findByText('Signed out');
    await user.click(screen.getByRole('button', { name: 'Session login' }));

    expect(await screen.findByText(currentUser.email)).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBe('session-token');
  });

  it('restores and validates a token from localStorage', async () => {
    window.localStorage.setItem('token', 'remembered-token');
    getCurrentUserMock.mockResolvedValue(currentUser);

    render(<AuthProvider><AuthState /></AuthProvider>);

    expect(await screen.findByText(currentUser.email)).toBeInTheDocument();
    expect(screen.getByText('Token present')).toBeInTheDocument();
    expect(getCurrentUserMock).toHaveBeenCalledOnce();
  });

  it('restores and validates a token from sessionStorage', async () => {
    window.sessionStorage.setItem('token', 'session-token');
    getCurrentUserMock.mockResolvedValue(currentUser);

    render(<AuthProvider><AuthState /></AuthProvider>);

    expect(await screen.findByText(currentUser.email)).toBeInTheDocument();
    expect(screen.getByText('Token present')).toBeInTheDocument();
    expect(getCurrentUserMock).toHaveBeenCalledOnce();
  });

  it('removes stale token copies before storing a new login', async () => {
    loginApiMock.mockResolvedValue({ token: 'new-session-token' });
    getCurrentUserMock.mockResolvedValue(currentUser);
    const user = userEvent.setup();

    render(<AuthProvider><AuthState /></AuthProvider>);
    await screen.findByText('Signed out');
    window.localStorage.setItem('token', 'stale-local-token');
    window.sessionStorage.setItem('token', 'stale-session-token');
    await user.click(screen.getByRole('button', { name: 'Session login' }));

    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBe('new-session-token');
  });

  it('keeps registration persistent in localStorage', async () => {
    registerApiMock.mockResolvedValue({ token: 'registration-token' });
    getCurrentUserMock.mockResolvedValue(currentUser);
    const user = userEvent.setup();

    render(<AuthProvider><AuthState /></AuthProvider>);
    await screen.findByText('Signed out');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText(currentUser.email)).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBe('registration-token');
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });

  it('cleans up and rejects when current-user initialization fails after a remembered login', async () => {
    window.localStorage.setItem('token', 'existing-token');
    loginApiMock.mockResolvedValue({ token: 'new-remembered-token' });
    getCurrentUserMock
      .mockResolvedValueOnce(currentUser)
      .mockRejectedValueOnce(new Error('Current user unavailable'));
    const user = userEvent.setup();

    render(<AuthProvider><AuthState /></AuthProvider>);
    expect(await screen.findByText(currentUser.email)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remembered login' }));

    expect(await screen.findByText('Session validation failed')).toBeInTheDocument();
    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('No token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });

  it('cleans up and rejects when current-user initialization fails after a session login', async () => {
    loginApiMock.mockResolvedValue({ token: 'new-session-token' });
    getCurrentUserMock.mockRejectedValue(new Error('Current user unavailable'));
    const user = userEvent.setup();

    render(<AuthProvider><AuthState /></AuthProvider>);
    await screen.findByText('Signed out');
    await user.click(screen.getByRole('button', { name: 'Session login' }));

    expect(await screen.findByText('Session validation failed')).toBeInTheDocument();
    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('No token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });

  it('cleans up and rejects when current-user initialization fails after registration', async () => {
    registerApiMock.mockResolvedValue({ token: 'registration-token' });
    getCurrentUserMock.mockRejectedValue(new Error('Current user unavailable'));
    const user = userEvent.setup();

    render(<AuthProvider><AuthState /></AuthProvider>);
    await screen.findByText('Signed out');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Session validation failed')).toBeInTheDocument();
    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('No token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });

  it('clears JWTs from both locations, authenticated state, and legacy markers', async () => {
    window.localStorage.setItem('token', 'stored-token');
    window.sessionStorage.setItem('token', 'stale-session-token');
    window.localStorage.setItem('eclectary-auth', 'true');
    window.sessionStorage.setItem('eclectary-auth', 'true');
    getCurrentUserMock.mockResolvedValue(currentUser);
    const user = userEvent.setup();

    render(<AuthProvider><AuthState /></AuthProvider>);

    expect(await screen.findByText(currentUser.email)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('No token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
    expect(window.localStorage.getItem('eclectary-auth')).toBeNull();
    expect(window.sessionStorage.getItem('eclectary-auth')).toBeNull();
  });

  it('clears authenticated context state when an unauthorized session is reported', async () => {
    window.localStorage.setItem('token', 'expired-token');
    getCurrentUserMock.mockResolvedValue(currentUser);

    render(<AuthProvider><AuthState /></AuthProvider>);
    expect(await screen.findByText(currentUser.email)).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(AUTH_SESSION_UNAUTHORIZED_EVENT));
    });

    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('No token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });
});
