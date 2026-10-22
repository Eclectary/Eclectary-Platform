import { Link } from 'react-router-dom';

import ProductImage from '../components/ProductImage';
import { useCart } from '../context/CartContext';
import { products } from '../data/products';
import '../styles/cart.css';

function Cart() {
	const { items, subtotal, updateQuantity, removeItem } = useCart();
	const cartProducts = items
		.map((item) => ({ item, product: products.find((product) => product.id === item.productId) }))
		.filter((entry): entry is typeof entry & { product: NonNullable<typeof entry.product> } => Boolean(entry.product));

	const handleQuantityChange = (productId: number, value: string) => {
		const parsedQuantity = Number.parseInt(value, 10);

		if (Number.isNaN(parsedQuantity)) {
			return;
		}

		updateQuantity(productId, Math.max(1, parsedQuantity));
	};

	const handleDecreaseQuantity = (productId: number, quantity: number) => {
		updateQuantity(productId, Math.max(1, quantity - 1));
	};

	const handleIncreaseQuantity = (productId: number, quantity: number) => {
		updateQuantity(productId, quantity + 1);
	};

	return (
		<section className="cart-page">
			<div className="cart-page__header">
				<div>
					<h1>Cart</h1>
				</div>
				<p className="cart-page__count">{cartProducts.length} {cartProducts.length === 1 ? 'item' : 'items'}</p>
			</div>

			{cartProducts.length === 0 ? (
				<div className="cart-page__empty">
					<h2>Your cart is empty.</h2>
					<p>Your cart is waiting for something special.</p>
					<Link className="cart-page__shop-link" to="/shop">Browse the shop</Link>
				</div>
			) : (
				<div className="cart-page__layout">
					<div className="cart-page__list" aria-label="Products in cart">
						{cartProducts.map(({ item, product }) => (
							<article className="cart-item" key={product.id}>
								<Link className="cart-item__image-link" to={`/product/${product.id}`}>
									<ProductImage
										image={product.image}
										alt={product.title}
										className="cart-item__image"
										fallbackClassName="cart-item__image-placeholder"
									/>
								</Link>
								<div className="cart-item__details">
									<Link to={`/product/${product.id}`}>
										<h2>{product.title}</h2>
									</Link>
									<p>By {product.creator}</p>
									<span>${product.price.toFixed(2)} each</span>
								</div>
								<div className="cart-item__quantity" aria-label={`Quantity for ${product.title}`}>
									<button
										aria-label={`Decrease quantity for ${product.title}`}
										onClick={() => handleDecreaseQuantity(product.id, item.quantity)}
										type="button"
									>
										-
									</button>
									<label className="cart-item__quantity-input">
										<span>Quantity</span>
										<input
											aria-label={`Quantity for ${product.title}`}
											min="1"
											onChange={(event) => handleQuantityChange(product.id, event.target.value)}
											step="1"
											type="number"
											value={item.quantity}
										/>
									</label>
									<button
										aria-label={`Increase quantity for ${product.title}`}
										onClick={() => handleIncreaseQuantity(product.id, item.quantity)}
										type="button"
									>
										+
									</button>
								</div>
								<div className="cart-item__actions">
									<strong>${(product.price * item.quantity).toFixed(2)}</strong>
									<button onClick={() => removeItem(product.id)} type="button">Remove</button>
								</div>
							</article>
						))}
					</div>
					<aside className="cart-summary" aria-label="Cart summary">
						<h2>Summary</h2>
						<div className="cart-summary__row">
							<span>Subtotal</span>
							<strong>${subtotal.toFixed(2)}</strong>
						</div>
						<Link className="cart-summary__checkout" to="/checkout">Checkout</Link>
					</aside>
				</div>
			)}
		</section>
	);
}

export default Cart;
