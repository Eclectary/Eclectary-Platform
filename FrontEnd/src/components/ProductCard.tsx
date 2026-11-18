
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

function SellerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 2h3l2.5 13h13l2.5-10H5" />
    </svg>
  );
}

function ProductCard({ product }: ProductCardProps) {
  const { addItem, canModifyCart, mutationLoading, mutationError } = useCart();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const [addAttempted, setAddAttempted] = useState(false);

  const isSaved = isWishlisted(product.id);
  const isPurchasable = product.active && (
    product.approval_status === undefined ||
    product.approval_status === 'approved'
  );

  return (
    <article className="product-card">
      <div className="product-card__image-shell">
        <Link
          className="product-card__image-wrap"
          to={`/product/${product.id}`}
          aria-label={`View ${product.title}`}
        >
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
          aria-label={
            isSaved
              ? `Remove ${product.title} from wishlist`
              : `Add ${product.title} to wishlist`
          }
          title={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          {isSaved ? '♥' : '♡'}
        </button>
      </div>

      <div className="product-card__content">
        {product.tag && (
          <span className="product-card__tag">{product.tag}</span>
        )}

        <Link
          to={`/product/${product.id}`}
          className="product-card__title-link"
        >
          <h3>{product.title}</h3>
        </Link>

        <p className="product-card__creator">
          <SellerIcon />
          <span>{product.creator}</span>
        </p>

        <StarRating
          className="product-card__rating"
          rating={product.rating}
          reviewCount={product.reviewCount}
        />

        <div className="product-card__footer">
          <span className="product-card__price">
            ${product.price.toFixed(2)}
          </span>

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
              {addAttempted && mutationLoading ? (
                'Adding...'
              ) : (
                <>
                  <CartIcon />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
          ) : (
            <Link
              to={`/product/${product.id}`}
              className="product-card__cta"
            >
              View item
            </Link>
          )}
        </div>

        {addAttempted && mutationError && (
          <p className="product-card__cart-error" role="alert">
            {mutationError}
          </p>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
