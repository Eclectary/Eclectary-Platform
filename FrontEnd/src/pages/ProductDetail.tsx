import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard';
import { getStarSegments } from '../components/StarRating';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { products } from '../data/products';
import { getSellers } from '../services/sellerApi';
import '../styles/product-detail.css';

function ProductDetail() {
  const { id } = useParams();
  return <ProductDetailContent key={id} productId={id} />;
}

function ProductDetailContent({ productId }: { productId?: string }) {
  const numericProductId = Number(productId);
  const { addToCart, isInCart } = useCart();
  const { toggleWishlist, isWishlisted } = useWishlist();

  const product = useMemo(
    () => products.find((item) => item.id === numericProductId),
    [numericProductId],
  );
  const seller = product ? getSellers().find((item) => item.name === product.creator) : undefined;

  const [selectedImage, setSelectedImage] = useState(product?.image ?? '');
  const [quantity, setQuantity] = useState(1);

  const relatedProducts = useMemo(
    () => (product ? products.filter((item) => item.id !== product.id).slice(0, 3) : []),
    [product],
  );

  if (!product) {
    return (
      <section className="product-detail product-detail--empty" aria-live="polite">
        <p className="product-detail__eyebrow">Product not found</p>
        <h1>That item is no longer available.</h1>
        <Link className="product-detail__back-link" to="/shop">
          Return to the shop
        </Link>
      </section>
    );
  }

  const gallery = product.images && product.images.length > 0
    ? product.images
    : product.image
      ? [product.image, product.image, product.image]
      : [];

  const handleAddToCart = () => addToCart(product, quantity);
  const handleToggleWishlist = () => toggleWishlist(product.id);
  const productType = product.collection ?? 'handcrafted item';
  // Temporary display value until review counts are supplied with product data.
  const reviewCount = product.reviewCount ?? 24;
  const rating = product.rating;
  const ratingSegments = rating === undefined ? undefined : getStarSegments(rating);
  const starDisplay = ratingSegments
    ? `${'★'.repeat(ratingSegments.filled)}${'☆'.repeat(ratingSegments.empty)}`
    : '';
  const mainImage = selectedImage || product.image;

  return (
    <article className="product-detail">
      <Link className="product-detail__back-link" to="/shop">
        ← Back to shop
      </Link>

      <div className="product-detail__layout">
        <div className="product-detail__gallery" aria-label="Product gallery">
          <div className="product-detail__thumbs">
            {gallery.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                className={`product-detail__thumb ${selectedImage === image ? 'is-active' : ''}`}
                onClick={() => setSelectedImage(image)}
                aria-label={`View product image ${index + 1}`}
              >
                <img src={image} alt={`${product.title} view ${index + 1}`} />
              </button>
            ))}
          </div>

          <div className="product-detail__main-image-wrap">
            {mainImage && (
              <img
                className="product-detail__main-image"
                src={mainImage}
                alt={product.title}
              />
            )}
          </div>
        </div>

        <div className="product-detail__content">
          {product.tag && <p className="product-detail__eyebrow">{product.tag}</p>}
          <h1>{product.title}</h1>

          {rating !== undefined ? (
            <div className="product-detail__rating" aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${reviewCount} reviews`}>
              <span className="product-detail__stars" aria-hidden="true">{starDisplay}</span>
              <span>{rating.toFixed(1)}</span>
              <button type="button" className="product-detail__review-link">· {reviewCount} reviews</button>
            </div>
          ) : (
            <p className="product-detail__rating">No reviews yet</p>
          )}

          <div className="product-detail__price">${product.price.toFixed(2)}</div>

          <p className="product-detail__description">
            {product.description ?? 'Thoughtfully designed and made to bring a sense of calm, beauty, and individuality into everyday rituals.'}
          </p>

          <div className="product-detail__seller">
            <span>Made by {seller ? <Link to={`/seller/${seller.id}`}><strong>{product.creator}</strong></Link> : <strong>{product.creator}</strong>}</span>
            {seller && <Link className="product-detail__shop-link" to={`/seller/${seller.id}`}>Visit shop</Link>}
          </div>

          <div className="product-detail__actions">
            <div className="product-detail__quantity">
              <span id="quantity-label">Quantity</span>
              <div className="product-detail__quantity-control" role="group" aria-labelledby="quantity-label">
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Decrease quantity">−</button>
                <output aria-live="polite">{quantity}</output>
                <button type="button" onClick={() => setQuantity((current) => current + 1)} aria-label="Increase quantity">+</button>
              </div>
            </div>
            <button type="button" className="product-detail__secondary" onClick={handleToggleWishlist}>
              {isWishlisted(product.id) ? '♥ Saved to wishlist' : '♡ Save for later'}
            </button>
            <button type="button" className="product-detail__button" onClick={handleAddToCart}>
              {isInCart(product.id) ? 'Add another' : 'Add to cart'}
            </button>
          </div>

          <div className="product-detail__purchase-shipping">
            <span>Ships in 3–5 days</span>
            <span>Returns accepted</span>
          </div>
        </div>
      </div>

      <div className="product-detail__information">
        <section className="product-detail__info-section">
          <h2>About this item</h2>
          <p>{product.description ?? 'Thoughtfully designed and made to bring a sense of calm, beauty, and individuality into everyday rituals.'}</p>
        </section>

        <section className="product-detail__info-section">
          <h2>Item details</h2>
          <dl className="product-detail__details">
            <div><dt>Collection</dt><dd>{productType}</dd></div>
            {product.category && <div><dt>Category</dt><dd>{product.category}</dd></div>}
            {product.tag && <div><dt>Product type</dt><dd>{product.tag}</dd></div>}
            {product.intentions && product.intentions.length > 0 && <div><dt>Intentions</dt><dd>{product.intentions.join(', ')}</dd></div>}
          </dl>
        </section>

        <section className="product-detail__info-section">
          <h2>Shipping &amp; returns</h2>
          <p>Ships in 3–5 days</p>
          <p>Returns accepted. Free shipping over $50.</p>
        </section>

        {seller && (
          <section className="product-detail__info-section product-detail__maker">
            <img className="product-detail__maker-image" src={seller.image} alt="" />
            <div>
              <p className="product-detail__eyebrow">Meet the maker</p>
              <h2>{seller.name}</h2>
              {seller.specialty && <p>{seller.specialty}</p>}
              {seller.bio && <p>{seller.bio}</p>}
              <Link className="product-detail__shop-link" to={`/seller/${seller.id}`}>Visit shop</Link>
            </div>
          </section>
        )}

        <section className="product-detail__info-section product-detail__reviews" aria-labelledby="customer-reviews-heading">
          <h2 id="customer-reviews-heading">Customer reviews</h2>
          <div className="product-detail__rating">
            {rating !== undefined ? (
              <>
                <span className="product-detail__stars" aria-hidden="true">{starDisplay}</span>
                <span>{rating.toFixed(1)}</span>
                <span>· {reviewCount} reviews</span>
              </>
            ) : (
              <span>No reviews yet</span>
            )}
          </div>
          <p>Customer reviews will appear here as they become available.</p>
        </section>
      </div>

      {relatedProducts.length > 0 && (
        <section className="product-detail__related" aria-label="Related products">
          <div className="product-detail__related-header">
            <h2>You May Also Like</h2>
            <Link className="product-detail__related-link" to="/shop">View all</Link>
          </div>

          <div className="product-detail__related-grid">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

export default ProductDetail;
