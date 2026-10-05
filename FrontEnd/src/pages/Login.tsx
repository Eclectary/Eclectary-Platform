import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import Button from "../components/Button";
import heroImage from "../assets/images/herobanner2.png";
import "../styles/login.css";


type LoginErrors = {
  email?: string;
  password?: string;
};

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const { login } = useAuth();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const nextErrors: LoginErrors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    nextErrors.email = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    nextErrors.email = "Enter a valid email address.";
  }

  if (!password) {
    nextErrors.password = "Enter your password.";
  }

  setErrors(nextErrors);

  if (Object.keys(nextErrors).length > 0) {
    return;
  }

  try {
    await login(normalizedEmail, password);

    if (rememberMe) {
      localStorage.setItem("eclectary-auth", "true");
    } else {
      sessionStorage.setItem("eclectary-auth", "true");
    }

    window.dispatchEvent(new Event("eclectary-auth-change"));
    navigate("/");
  } catch {
    setErrors({
      email: "Invalid email or password.",
    });
  }
}

  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-form-panel">
          <div className="login-heading">
            <span className="login-mark" aria-hidden="true">E</span>
            <p className="login-kicker">Welcome back</p>
            <h1 id="login-title">Your finds are waiting.</h1>
            <p className="login-intro">
              Sign in to keep your favourites close and pick up where you left off.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email ? <p className="login-error" id="email-error">{errors.email}</p> : null}
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="password">Password</label>
                <button
                  className="login-text-button"
                  type="button"
                  onClick={() => setShowPassword((isVisible) => !isVisible)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password ? <p className="login-error" id="password-error">{errors.password}</p> : null}
            </div>

            <div className="login-options">
              <label className="login-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <button className="login-text-button" type="button" onClick={() => alert("Password reset is coming soon.")}>
                Forgot password?
              </button>
            </div>

            <Button type="submit" size="lg" fullWidth>
              Sign in <span aria-hidden="true">→</span>
            </Button>
          </form>

          <p className="login-signup">
            New to Eclectary? <Link to="/account/register">Create an account</Link>
          </p>
        </div>

        <aside className="login-visual" style={{ backgroundImage: `url("${heroImage}")` }}>
          <div className="login-visual-content">
            <p className="login-visual-label">A marketplace with a point of view</p>
            <p className="login-quote">“The best things are found when you look a little differently.”</p>
            <div className="login-visual-meta">
              <span>Independent makers</span>
              <span aria-hidden="true">✦</span>
              <span>Thoughtful goods</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default Login;
