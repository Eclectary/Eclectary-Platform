import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ProductImage from '../components/ProductImage';
import { useCart } from '../context/CartContext';
import { products } from '../data/products';
import '../styles/checkout.css';

type CustomerInfo = {
	fullName: string;
	email: string;
	phone: string;
	address: string;
	city: string;
	postalCode: string;
};

type CustomerErrors = Partial<Record<keyof CustomerInfo, string>>;

const SHIPPING_ESTIMATE = 6.5;

function Checkout() {
	const navigate = useNavigate();
	const { items, subtotal, clearCart } = useCart();
	const [customer, setCustomer] = useState<CustomerInfo>({
		fullName: '',
		email: '',
		phone: '',
		address: '',
		city: '',
		postalCode: '',
	});
	const [errors, setErrors] = useState<CustomerErrors>({});

	const cartProducts = items
		.map((item) => ({ item, product: products.find((product) => product.id === item.productId) }))
		.filter((entry): entry is typeof entry & { product: NonNullable<typeof entry.product> } => Boolean(entry.product));

	const shipping = cartProducts.length > 0 ? SHIPPING_ESTIMATE : 0;
	const total = subtotal + shipping;

	if (items.length === 0) {
		return (
			<section className="checkout-page checkout-page--empty">
				<h1>Your checkout is empty.</h1>
				<p>Add something from the shop before checking out.</p>
				<Link to="/shop">Return to the shop</Link>
			</section>
		);
	}

	const handleFieldChange = (field: keyof CustomerInfo, value: string) => {
		setCustomer((current) => ({ ...current, [field]: value }));
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const nextErrors: CustomerErrors = {};

		if (!customer.fullName.trim()) {
			nextErrors.fullName = 'Enter your full name.';
		}

		if (!customer.email.trim()) {
			nextErrors.email = 'Enter your email address.';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
			nextErrors.email = 'Enter a valid email address.';
		}

		if (!customer.phone.trim()) {
			nextErrors.phone = 'Enter a phone number.';
		}

		if (!customer.address.trim()) {
			nextErrors.address = 'Enter a shipping address.';
		}

		if (!customer.city.trim()) {
			nextErrors.city = 'Enter a city.';
		}

		if (!customer.postalCode.trim()) {
			nextErrors.postalCode = 'Enter a postal code.';
		}

		setErrors(nextErrors);

		if (Object.keys(nextErrors).length > 0) {
			return;
		}

		clearCart();
		navigate('/');
	};

	return (
		<section className="checkout-page">
			<div className="checkout-page__header">
				<p className="eyebrow">Almost yours</p>
				<h1>Checkout</h1>
			</div>

			<div className="checkout-page__layout">
				<form className="checkout-form" onSubmit={handleSubmit} noValidate>
					<section className="checkout-section" aria-labelledby="customer-info-heading">
						<h2 id="customer-info-heading">Customer information</h2>
						<div className="checkout-field">
							<label htmlFor="fullName">Full name</label>
							<input
								id="fullName"
								name="fullName"
								type="text"
								autoComplete="name"
								placeholder="Jane Doe"
								value={customer.fullName}
								onChange={(event) => handleFieldChange('fullName', event.target.value)}
								aria-invalid={Boolean(errors.fullName)}
								aria-describedby={errors.fullName ? 'fullName-error' : undefined}
							/>
							{errors.fullName ? <p className="checkout-error" id="fullName-error">{errors.fullName}</p> : null}
						</div>

						<div className="checkout-field-row">
							<div className="checkout-field">
								<label htmlFor="email">Email address</label>
								<input
									id="email"
									name="email"
									type="email"
									autoComplete="email"
									placeholder="you@example.com"
									value={customer.email}
									onChange={(event) => handleFieldChange('email', event.target.value)}
									aria-invalid={Boolean(errors.email)}
									aria-describedby={errors.email ? 'email-error' : undefined}
								/>
								{errors.email ? <p className="checkout-error" id="email-error">{errors.email}</p> : null}
							</div>

							<div className="checkout-field">
								<label htmlFor="phone">Phone number</label>
								<input
									id="phone"
									name="phone"
									type="tel"
									autoComplete="tel"
									placeholder="(555) 123-4567"
									value={customer.phone}
									onChange={(event) => handleFieldChange('phone', event.target.value)}
									aria-invalid={Boolean(errors.phone)}
									aria-describedby={errors.phone ? 'phone-error' : undefined}
								/>
								{errors.phone ? <p className="checkout-error" id="phone-error">{errors.phone}</p> : null}
							</div>
						</div>

						<div className="checkout-field">
							<label htmlFor="address">Street address</label>
							<input
								id="address"
								name="address"
								type="text"
								autoComplete="street-address"
								placeholder="123 Maker Lane"
								value={customer.address}
								onChange={(event) => handleFieldChange('address', event.target.value)}
								aria-invalid={Boolean(errors.address)}
								aria-describedby={errors.address ? 'address-error' : undefined}
							/>
							{errors.address ? <p className="checkout-error" id="address-error">{errors.address}</p> : null}
						</div>

						<div className="checkout-field-row">
							<div className="checkout-field">
								<label htmlFor="city">City</label>
								<input
									id="city"
									name="city"
									type="text"
									autoComplete="address-level2"
									placeholder="Portland"
									value={customer.city}
									onChange={(event) => handleFieldChange('city', event.target.value)}
									aria-invalid={Boolean(errors.city)}
									aria-describedby={errors.city ? 'city-error' : undefined}
								/>
								{errors.city ? <p className="checkout-error" id="city-error">{errors.city}</p> : null}
							</div>

							<div className="checkout-field">
								<label htmlFor="postalCode">Postal code</label>
								<input
									id="postalCode"
									name="postalCode"
									type="text"
									autoComplete="postal-code"
									placeholder="97201"
									value={customer.postalCode}
									onChange={(event) => handleFieldChange('postalCode', event.target.value)}
									aria-invalid={Boolean(errors.postalCode)}
									aria-describedby={errors.postalCode ? 'postalCode-error' : undefined}
								/>
								{errors.postalCode ? <p className="checkout-error" id="postalCode-error">{errors.postalCode}</p> : null}
							</div>
						</div>
					</section>

					<section className="checkout-section checkout-section--placeholder" aria-labelledby="shipping-heading">
						<h2 id="shipping-heading">Shipping</h2>
						<p className="checkout-placeholder-note">Shipping method selection is coming soon. A standard rate is applied for now.</p>
						<div className="checkout-placeholder-card">
							<span>Standard shipping</span>
							<strong>${SHIPPING_ESTIMATE.toFixed(2)}</strong>
						</div>
					</section>

					<section className="checkout-section checkout-section--placeholder" aria-labelledby="payment-heading">
						<h2 id="payment-heading">Payment</h2>
						<p className="checkout-placeholder-note">Payment processing is coming soon. No charge will be made for this mock order.</p>
						<div className="checkout-placeholder-card">
							<span>Card ending in ****</span>
							<strong>Not connected</strong>
						</div>
					</section>

					<button className="checkout-submit" type="submit">Place mock order</button>
					<p className="checkout-back-link"><Link to="/cart">Back to cart</Link></p>
				</form>

				<aside className="checkout-summary" aria-label="Order summary">
					<h2>Order summary</h2>
					<div className="checkout-summary__list">
						{cartProducts.map(({ item, product }) => (
							<div className="checkout-summary__item" key={product.id}>
								<ProductImage
									image={product.image}
									alt={product.title}
									className="checkout-summary__image"
									fallbackClassName="checkout-summary__image-placeholder"
								/>
								<div className="checkout-summary__item-details">
									<span>{product.title}</span>
									<span className="checkout-summary__item-quantity">Qty {item.quantity}</span>
								</div>
								<strong>${(product.price * item.quantity).toFixed(2)}</strong>
							</div>
						))}
					</div>
					<div className="checkout-summary__row">
						<span>Subtotal</span>
						<span>${subtotal.toFixed(2)}</span>
					</div>
					<div className="checkout-summary__row">
						<span>Shipping</span>
						<span>${shipping.toFixed(2)}</span>
					</div>
					<div className="checkout-summary__row checkout-summary__row--total">
						<span>Total</span>
						<strong>${total.toFixed(2)}</strong>
					</div>
				</aside>
			</div>
		</section>
	);
}

export default Checkout;
