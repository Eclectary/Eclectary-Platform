import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { parseApiError } from "../services/apiErrors";
import heroImage from "../assets/images/herobanner2.png";
import "../styles/login.css";
import "../styles/seller-onboarding.css";

interface SellerFormErrors {
  publicName?: string;
  specialty?: string;
  imageUrl?: string;
  form?: string;
}

function BecomeSeller() {
  const navigate = useNavigate();
  const { user, becomeSeller } = useAuth();
  const [publicName, setPublicName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [errors, setErrors] = useState<SellerFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  if (user?.role === "seller") {
    return <Navigate to="/dashboard" replace />;
  }

  if (user?.role === "administrator") {
    return <Navigate to="/account/profile" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const normalizedName = publicName.trim();
    const normalizedSpecialty = specialty.trim();
    const normalizedImageUrl = imageUrl.trim();
    const nextErrors: SellerFormErrors = {};

    if (!normalizedName) nextErrors.publicName = "Enter your shop name.";
    if (!normalizedSpecialty) nextErrors.specialty = "Describe what your shop makes.";
    if (normalizedImageUrl && !/^https?:\/\/[^\s]+$/i.test(normalizedImageUrl)) {
      nextErrors.imageUrl = "Enter a valid HTTP or HTTPS image URL.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await becomeSeller({
        public_name: normalizedName,
        specialty: normalizedSpecialty,
        bio: bio.trim(),
        image_url: normalizedImageUrl,
      });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const parsed = parseApiError(error, "We could not create your seller profile. Please try again.");
      setErrors({
        form: parsed.status === 409
          ? "This account already has a seller profile."
          : parsed.message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page seller-onboarding-page">
      <section className="login-shell" aria-labelledby="seller-onboarding-title">
        <div className="login-form-panel">
          <div className="login-heading">
            <span className="login-mark" aria-hidden="true">E</span>
            <p className="login-kicker">Open your shop</p>
            <h1 id="seller-onboarding-title">Become an Eclectary seller.</h1>
            <p className="login-intro">
              Tell buyers about your work. You can start using the seller dashboard immediately.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="seller-public-name">Shop name</label>
              <input
                id="seller-public-name"
                value={publicName}
                onChange={(event) => setPublicName(event.target.value)}
                aria-invalid={Boolean(errors.publicName)}
                required
              />
              {errors.publicName && <p className="login-error">{errors.publicName}</p>}
            </div>

            <div className="login-field">
              <label htmlFor="seller-specialty">What do you make?</label>
              <input
                id="seller-specialty"
                value={specialty}
                onChange={(event) => setSpecialty(event.target.value)}
                placeholder="Ceramics, textiles, digital art..."
                aria-invalid={Boolean(errors.specialty)}
                required
              />
              {errors.specialty && <p className="login-error">{errors.specialty}</p>}
            </div>

            <div className="login-field">
              <label htmlFor="seller-bio">Shop story <span>(optional)</span></label>
              <textarea
                id="seller-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={2000}
                rows={4}
              />
            </div>

            <div className="login-field">
              <label htmlFor="seller-image-url">Shop image URL <span>(optional)</span></label>
              <input
                id="seller-image-url"
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                aria-invalid={Boolean(errors.imageUrl)}
              />
              {errors.imageUrl && <p className="login-error">{errors.imageUrl}</p>}
            </div>

            {errors.form && <p className="login-error" role="alert">{errors.form}</p>}

            <Button type="submit" size="lg" fullWidth disabled={submitting}>
              {submitting ? "Creating your shop..." : "Create seller profile"}
            </Button>
          </form>
        </div>

        <aside className="login-visual" style={{ backgroundImage: `url("${heroImage}")` }}>
          <div className="login-visual-content">
            <p className="login-visual-label">One Eclectary account</p>
            <p className="login-quote">Keep shopping while you build your own collection.</p>
            <div className="login-visual-meta">
              <span>Immediate dashboard access</span>
              <span aria-hidden="true">✦</span>
              <span>Thoughtful quality review</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default BecomeSeller;
