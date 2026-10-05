import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import Button from "../components/Button";
import heroImage from "../assets/images/herobanner2.png";
import "../styles/login.css";

type RegisterErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreeToTerms?: string;
};

function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const { register } = useAuth();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const nextErrors: RegisterErrors = {};
  const normalizedName = fullName.trim();
  const normalizedEmail = email.trim();

  if (!normalizedName) {
    nextErrors.fullName = "Enter your full name.";
  }

  if (!normalizedEmail) {
    nextErrors.email = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    nextErrors.email = "Enter a valid email address.";
  }

  if (!password) {
    nextErrors.password = "Enter your password.";
  } else if (password.length < 8) {
    nextErrors.password = "Use at least 8 characters.";
  }

  if (!confirmPassword) {
    nextErrors.confirmPassword = "Confirm your password.";
  } else if (password !== confirmPassword) {
    nextErrors.confirmPassword = "Passwords do not match.";
  }

  if (!agreeToTerms) {
    nextErrors.agreeToTerms = "Please agree to the terms to continue.";
  }

  setErrors(nextErrors);

  if (Object.keys(nextErrors).length > 0) {
    return;
  }

  try {
    await register(normalizedEmail, password, confirmPassword);

    window.dispatchEvent(new Event("eclectary-auth-change"));
    navigate("/");
  } catch {
    setErrors({
      email: "Unable to create your account. Please try again.",
    });
  }
}

  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="register-title">
        <div className="login-form-panel">
          <div className="login-heading">
            <span className="login-mark" aria-hidden="true">E</span>
            <p className="login-kicker">Create account</p>
            <h1 id="register-title">Join the Eclectary community.</h1>
            <p className="login-intro">
              Start collecting thoughtful finds and discover pieces that feel personal.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={errors.fullName ? "fullName-error" : undefined}
              />
              {errors.fullName ? <p className="login-error" id="fullName-error">{errors.fullName}</p> : null}
            </div>

            <div className="login-field">
              <label htmlFor="register-email">Email address</label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "register-email-error" : undefined}
              />
              {errors.email ? <p className="login-error" id="register-email-error">{errors.email}</p> : null}
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="register-password">Password</label>
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
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "register-password-error" : undefined}
              />
              {errors.password ? <p className="login-error" id="register-password-error">{errors.password}</p> : null}
            </div>

            <div className="login-field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              />
              {errors.confirmPassword ? <p className="login-error" id="confirmPassword-error">{errors.confirmPassword}</p> : null}
            </div>

            <label className="login-checkbox">
              <input
                type="checkbox"
                id="agreeToTerms"
                name="agreeToTerms"
                checked={agreeToTerms}
                onChange={(event) => {
                  const isChecked = event.target.checked;
                  setAgreeToTerms(isChecked);

                  if (isChecked && errors.agreeToTerms) {
                    setErrors((current) => ({
                      ...current,
                      agreeToTerms: undefined,
                    }));
                  }
                }}
                aria-invalid={Boolean(errors.agreeToTerms)}
                aria-describedby={errors.agreeToTerms ? "agreeToTerms-error" : undefined}
              />
              <span>I agree to the terms and privacy policy</span>
            </label>
            {errors.agreeToTerms ? <p className="login-error" id="agreeToTerms-error">{errors.agreeToTerms}</p> : null}

            <Button type="submit" size="lg" fullWidth>
              Create account <span aria-hidden="true">→</span>
            </Button>
          </form>

          <p className="login-signup">
            Already have an account? <Link to="/account/login">Sign in</Link>
          </p>
        </div>

        <aside className="login-visual" style={{ backgroundImage: `url("${heroImage}")` }}>
          <div className="login-visual-content">
            <p className="login-visual-label">A marketplace with a point of view</p>
            <p className="login-quote">“Curated goods, discovered by people who care.”</p>
            <div className="login-visual-meta">
              <span>Independent makers</span>
              <span aria-hidden="true">✦</span>
              <span>Thoughtful finds</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default Register;
