import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { getCurrentUser } from './services/authApi';

vi.mock('./services/authApi', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));

async function outletLayout() {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { default: () => <Outlet /> };
}

vi.mock('./layouts/MainLayout', outletLayout);
vi.mock('./layouts/DashboardLayout', outletLayout);
vi.mock('./pages/Login', () => ({ default: () => <h1>Login page</h1> }));

const getCurrentUserMock = vi.mocked(getCurrentUser);

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  getCurrentUserMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('application routing with initialized authentication', () => {
  it('redirects signed-out direct navigation to /dashboard to login', async () => {
    window.history.replaceState({}, '', '/dashboard');

    render(
      <AuthProvider>
        <App />
      </AuthProvider>,
    );

    await waitFor(() => expect(window.location.pathname).toBe('/account/login'));
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
    expect(screen.queryByText('404 — Page not found')).not.toBeInTheDocument();
    expect(getCurrentUserMock).not.toHaveBeenCalled();
  });
});
