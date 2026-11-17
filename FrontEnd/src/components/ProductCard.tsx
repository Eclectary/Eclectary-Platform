import { Link } from 'react-router-dom';
import { useState } from 'react';

import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import StarRating from './StarRating';
import ProductImage from './ProductImage';
import type { Product } from '../types/product';
import '../styles/product-card.css';

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  const { addItem, canModifyCart, mutationLoading, mutationError } = useCart();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const [addAttempted, setAddAttempted] = useState(false);
  const isSaved = isWishlisted(product.id);
  const isPurchasable = product.active && (
    product.approval_status === undefined || product.approval_status === 'approved'
  );

  return (
    <article className="product-card">
      <div className="product-card__image-shell">
        <Link className="product-card__image-wrap" to={`/product/${product.id}`} aria-label={`View ${product.title}`}>
          <ProductImage
            image={product.image}
            alt={product.title}
            className="product-card__image"
            fallbackClassName="product-card__image-placeholder"
            loading="lazy"
          />
        </Link>

        <button
          type="button"
          className={`product-card__wishlist ${isSaved ? 'is-active' : ''}`}
          onClick={() => toggleWishlist(product.id)}
          aria-label={isSaved ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
          title={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          {isSaved ? '♥' : '♡'}
        </button>
      </div>

      <div className="product-card__content">
        {product.tag && <span className="product-card__tag">{product.tag}</span>}

        <Link to={`/product/${product.id}`} className="product-card__title-link">
          <h3>{product.title}</h3>
        </Link>

        <p className="product-card__creator">by {product.creator}</p>

        <StarRating
          className="product-card__rating"
          rating={product.rating}
          reviewCount={product.reviewCount}
        />

        <div className="product-card__footer">
          <span className="product-card__price">${product.price.toFixed(2)}</span>
          {isPurchasable ? (
            <button
              type="button"
              className="product-card__cta"
              disabled={!canModifyCart}
              aria-label={`Add ${product.title} to cart`}
              aria-busy={addAttempted && mutationLoading}
              onClick={() => {
                setAddAttempted(true);
                addItem(product);
              }}
            >
              {addAttempted && mutationLoading ? 'Adding...' : 'Add to Cart'}
            </button>
          ) : (
            <Link to={`/product/${product.id}`} className="product-card__cta">
              View item
            </Link>
          )}
        </div>
        {addAttempted && mutationError && (
          <p className="product-card__cart-error" role="alert">{mutationError}</p>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
