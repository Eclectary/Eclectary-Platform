import { Link } from 'react-router-dom';

import ProductImage from '../components/ProductImage';
import { useCart } from '../context/CartContext';
import '../styles/cart.css';

function Cart() {
	const { items, subtotal, updateQuantity, removeItem, clearCart } = useCart();

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
				<p className="cart-page__count">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
			</div>

			{items.length === 0 ? (
				<div className="cart-page__empty">
					<h2>Your cart is empty.</h2>
					<p>Your cart is waiting for something special.</p>
					<Link className="cart-page__shop-link" to="/shop">Browse the shop</Link>
				</div>
			) : (
				<div className="cart-page__layout">
					<div className="cart-page__list" aria-label="Products in cart">
						{items.map((item) => {
							const { product } = item;
							const isAvailable = item.status === 'available' && product !== null;
							const title = product?.title ?? `Product #${item.productId}`;
							const productImage = (
								<ProductImage
									image={product?.image}
									alt={title}
									className="cart-item__image"
									fallbackClassName="cart-item__image-placeholder"
								/>
							);

							return (
							<article className={`cart-item ${isAvailable ? '' : 'cart-item--unavailable'}`} key={item.productId}>
								{isAvailable ? (
									<Link className="cart-item__image-link" to={`/product/${item.productId}`}>
										{productImage}
									</Link>
								) : (
									<div className="cart-item__image-link">{productImage}</div>
								)}
								<div className="cart-item__details">
									{isAvailable ? (
										<Link to={`/product/${item.productId}`}><h2>{title}</h2></Link>
									) : <h2>{title}</h2>}
									{product && <p>By {product.creator}</p>}
									{isAvailable && <span>${product.price.toFixed(2)} each</span>}
									{!isAvailable && (
										<p className="cart-item__availability" role="status">
											{item.status === 'pending'
												? 'Checking current product details...'
												: 'This product is no longer available.'}
										</p>
									)}
								</div>
								{isAvailable ? <div className="cart-item__quantity" aria-label={`Quantity for ${title}`}>
									<button
										aria-label={`Decrease quantity for ${title}`}
										onClick={() => handleDecreaseQuantity(item.productId, item.quantity)}
										type="button"
									>
										-
									</button>
									<label className="cart-item__quantity-input">
										<span>Quantity</span>
										<input
											aria-label={`Quantity for ${title}`}
											min="1"
											onChange={(event) => handleQuantityChange(item.productId, event.target.value)}
											step="1"
											type="number"
											value={item.quantity}
										/>
									</label>
									<button
										aria-label={`Increase quantity for ${title}`}
										onClick={() => handleIncreaseQuantity(item.productId, item.quantity)}
										type="button"
									>
										+
									</button>
								</div> : <p className="cart-item__unavailable-quantity">Quantity: {item.quantity}</p>}
								<div className="cart-item__actions">
									<strong>{isAvailable ? `$${(product.price * item.quantity).toFixed(2)}` : 'Unavailable'}</strong>
									<button onClick={() => removeItem(item.productId)} type="button">Remove</button>
								</div>
							</article>
							);
						})}
					</div>
					<aside className="cart-summary" aria-label="Cart summary">
						<h2>Summary</h2>
						<div className="cart-summary__row">
							<span>Subtotal</span>
							<strong>${subtotal.toFixed(2)}</strong>
						</div>
						<Link className="cart-summary__checkout" to="/checkout">Checkout</Link>
						<button className="cart-summary__clear" onClick={clearCart} type="button">Clear cart</button>
					</aside>
				</div>
			)}
		</section>
	);
}

export default Cart;
