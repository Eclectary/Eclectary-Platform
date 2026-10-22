import { Link } from 'react-router-dom';

import { useWishlist } from '../context/WishlistContext';
import StarRating from './StarRating';
import ProductImage from './ProductImage';
import type { Product } from '../types/product';
import '../styles/product-card.css';

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  const { toggleWishlist, isWishlisted } = useWishlist();
  const isSaved = isWishlisted(product.id);

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
        <div className="product-card__meta">
          {product.tag && <span className="product-card__tag">{product.tag}</span>}
          <StarRating
            className="product-card__rating"
            rating={product.rating}
            reviewCount={product.reviewCount}
          />
        </div>

        <Link to={`/product/${product.id}`} className="product-card__title-link">
          <h3>{product.title}</h3>
        </Link>

        <p className="product-card__creator">by {product.creator}</p>

        <div className="product-card__footer">
          <span className="product-card__price">${product.price.toFixed(2)}</span>
          <Link to={`/product/${product.id}`} className="product-card__cta">
            View item
          </Link>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
