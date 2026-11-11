import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import {
  getCurrentUser,
  login as loginApi,
  register as registerApi,
} from '../services/authApi';
import { AuthSessionValidationError } from '../services/authErrors';
import {
  notifyUnauthorizedAuthSession,
} from '../services/authSession';
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
  role: 'customer' as const,
};
const newerUser = {
  id: 8,
  email: 'newer@example.com',
  role: 'customer' as const,
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

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

function AuthRaceState() {
  const { user, token, loading, login, register, logout } = useAuth();

  const runAuthOperation = (operation: () => Promise<void>) => {
    void operation().catch(() => undefined);
  };

  return (
    <>
      <p>{loading ? 'Loading' : 'Loaded'}</p>
      <p>{user?.email ?? 'Signed out'}</p>
      <p>{token ?? 'No token'}</p>
      <button type="button" onClick={() => runAuthOperation(() => login('older@example.com', 'password123', true))}>
        Older login
      </button>
      <button type="button" onClick={() => runAuthOperation(() => login('newer@example.com', 'password123', false))}>
        Newer login
      </button>
      <button type="button" onClick={() => runAuthOperation(() => register('newer@example.com', 'password123', 'password123'))}>
        Replacement registration
      </button>
      <button type="button" onClick={logout}>Race logout</button>
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
      notifyUnauthorizedAuthSession('expired-token');
    });

    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('No token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });
});

describe('AuthProvider session generation guards', () => {
  it('keeps the newer login when an overlapping older login response finishes last', async () => {
    const olderLogin = createDeferred<{ token: string }>();
    const newerLogin = createDeferred<{ token: string }>();
    loginApiMock
      .mockReturnValueOnce(olderLogin.promise)
      .mockReturnValueOnce(newerLogin.promise);
    getCurrentUserMock.mockResolvedValue(newerUser);
    const user = userEvent.setup();

    render(<AuthProvider><AuthRaceState /></AuthProvider>);
    await screen.findByText('Loaded');
    await user.click(screen.getByRole('button', { name: 'Older login' }));
    await user.click(screen.getByRole('button', { name: 'Newer login' }));

    await act(async () => {
      newerLogin.resolve({ token: 'newer-session-token' });
      await newerLogin.promise;
    });

    expect(await screen.findByText(newerUser.email)).toBeInTheDocument();
    expect(screen.getByText('newer-session-token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBe('newer-session-token');

    await act(async () => {
      olderLogin.resolve({ token: 'older-remembered-token' });
      await olderLogin.promise;
    });

    expect(screen.getByText(newerUser.email)).toBeInTheDocument();
    expect(screen.getByText('newer-session-token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBe('newer-session-token');
    expect(getCurrentUserMock).toHaveBeenCalledOnce();
  });

  it('does not restore a user or token after logout while restoration is pending', async () => {
    const restoration = createDeferred<typeof currentUser>();
    window.localStorage.setItem('token', 'restoration-token');
    getCurrentUserMock.mockReturnValue(restoration.promise);
    const user = userEvent.setup();

    render(<AuthProvider><AuthRaceState /></AuthProvider>);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Race logout' }));

    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();

    await act(async () => {
      restoration.resolve(currentUser);
      await restoration.promise;
    });

    expect(await screen.findByText('Loaded')).toBeInTheDocument();
    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('No token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });

  it('does not finish a login after logout while its user validation is pending', async () => {
    const validation = createDeferred<typeof currentUser>();
    loginApiMock.mockResolvedValue({ token: 'pending-login-token' });
    getCurrentUserMock.mockReturnValue(validation.promise);
    const user = userEvent.setup();

    render(<AuthProvider><AuthRaceState /></AuthProvider>);
    await screen.findByText('Loaded');
    await user.click(screen.getByRole('button', { name: 'Older login' }));
    await waitFor(() => expect(window.localStorage.getItem('token')).toBe('pending-login-token'));
    await user.click(screen.getByRole('button', { name: 'Race logout' }));

    await act(async () => {
      validation.resolve(currentUser);
      await validation.promise;
    });

    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('No token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
  });

  it('keeps a new login when an older session restoration finishes afterward', async () => {
    const restoration = createDeferred<typeof currentUser>();
    window.localStorage.setItem('token', 'restoration-token');
    loginApiMock.mockResolvedValue({ token: 'replacement-session-token' });
    getCurrentUserMock
      .mockReturnValueOnce(restoration.promise)
      .mockResolvedValueOnce(newerUser);
    const user = userEvent.setup();

    render(<AuthProvider><AuthRaceState /></AuthProvider>);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Newer login' }));

    expect(await screen.findByText(newerUser.email)).toBeInTheDocument();
    expect(screen.getByText('replacement-session-token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBe('replacement-session-token');

    await act(async () => {
      restoration.resolve(currentUser);
      await restoration.promise;
    });

    expect(await screen.findByText('Loaded')).toBeInTheDocument();
    expect(screen.getByText(newerUser.email)).toBeInTheDocument();
    expect(screen.queryByText(currentUser.email)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBe('replacement-session-token');
  });

  it('keeps a newer login when stale validation fails and clears its superseded JWT', async () => {
    const staleValidation = createDeferred<typeof currentUser>();
    const newerLogin = createDeferred<{ token: string }>();
    loginApiMock
      .mockResolvedValueOnce({ token: 'stale-remembered-token' })
      .mockReturnValueOnce(newerLogin.promise);
    getCurrentUserMock
      .mockReturnValueOnce(staleValidation.promise)
      .mockResolvedValueOnce(newerUser);
    const user = userEvent.setup();

    render(<AuthProvider><AuthRaceState /></AuthProvider>);
    await screen.findByText('Loaded');
    await user.click(screen.getByRole('button', { name: 'Older login' }));
    await waitFor(() => expect(window.localStorage.getItem('token')).toBe('stale-remembered-token'));

    await user.click(screen.getByRole('button', { name: 'Newer login' }));
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
    expect(screen.getByText('No token')).toBeInTheDocument();

    await act(async () => {
      newerLogin.resolve({ token: 'newer-session-token' });
      await newerLogin.promise;
    });

    expect(await screen.findByText(newerUser.email)).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBe('newer-session-token');

    await act(async () => {
      staleValidation.reject(new Error('Stale current-user validation failed'));
      await staleValidation.promise.catch(() => undefined);
    });

    expect(screen.getByText(newerUser.email)).toBeInTheDocument();
    expect(screen.getByText('newer-session-token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBe('newer-session-token');
  });

  it('ignores an unauthorized-session event from an older request after a newer login succeeds', async () => {
    loginApiMock.mockResolvedValue({ token: 'newer-session-token' });
    getCurrentUserMock.mockResolvedValue(newerUser);
    const user = userEvent.setup();

    render(<AuthProvider><AuthRaceState /></AuthProvider>);
    await screen.findByText('Loaded');
    await user.click(screen.getByRole('button', { name: 'Newer login' }));
    expect(await screen.findByText(newerUser.email)).toBeInTheDocument();

    act(() => {
      notifyUnauthorizedAuthSession('older-token');
    });

    expect(screen.getByText(newerUser.email)).toBeInTheDocument();
    expect(screen.getByText('newer-session-token')).toBeInTheDocument();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBe('newer-session-token');
  });
});
