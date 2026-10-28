import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { AuthSessionValidationError } from '../services/authErrors';
import Register from './Register';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = vi.mocked(useAuth);

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/account/register']}>
      <Routes>
        <Route path="*" element={<><Register /><CurrentLocation /></>} />
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

async function submitValidRegistration(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), 'Eclectary Member');
  await user.type(screen.getByLabelText('Email address'), 'member@example.com');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.type(screen.getByLabelText('Confirm password'), 'password123');
  await user.click(screen.getByRole('checkbox', { name: /agree to the terms/i }));
  await user.click(screen.getByRole('button', { name: /create account/i }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Register authentication errors', () => {
  it('shows a clear duplicate-email message', async () => {
    const register = vi.fn().mockRejectedValue(
      railsError(422, { errors: ['Email has already been taken'] }),
    );
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: vi.fn(),
      register,
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderRegister();
    await submitValidRegistration(user);

    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument();
  });

  it('shows other Rails registration validation messages', async () => {
    const register = vi.fn().mockRejectedValue(
      railsError(422, { errors: ["Password confirmation doesn't match"] }),
    );
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: vi.fn(),
      register,
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderRegister();
    await submitValidRegistration(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Please correct the following: Password confirmation doesn't match",
    );
  });

  it('shows a safe message for an unexpected registration failure', async () => {
    const register = vi.fn().mockRejectedValue(new Error('Internal details'));
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: vi.fn(),
      register,
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderRegister();
    await submitValidRegistration(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to create your account right now. Please try again.',
    );
    expect(screen.queryByText('Internal details')).not.toBeInTheDocument();
  });

  it('shows a session message when post-registration current-user loading fails', async () => {
    const register = vi.fn().mockRejectedValue(new AuthSessionValidationError());
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: vi.fn(),
      register,
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderRegister();
    await submitValidRegistration(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your account was created, but we couldn't sign you in. Please sign in.",
    );
  });

  it('still navigates after successful registration', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: vi.fn(),
      register,
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    renderRegister();
    await submitValidRegistration(user);

    expect(register).toHaveBeenCalledWith('member@example.com', 'password123', 'password123');
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });
});
