import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';

import customPrinting from '../assets/images/custom-printing.png';
import digitalCreations from '../assets/images/digital-creations.png';
import purelyHandmade from '../assets/images/purely-handmade.png';
import heroBanner from '../assets/images/herobanner3.png';
import logo from '../assets/images/eclectary logo nb.png';
import SellerCard from '../components/SellerCard';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import CategoryCard from '../components/CategoryCard';
import { getCategories } from '../services/categoryApi';
import { getProducts } from '../services/productApi';
import { getPublicSellers } from '../services/sellerApi';

import '../styles/home.css';
import type { Category, Product, Seller } from '../types';

const AUTH_STORAGE_KEY = 'eclectary-auth';
const AUTH_EVENT_NAME = 'eclectary-auth-change';
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL || 'http://localhost:3000';

function hasAuthSession() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    window.localStorage.getItem(AUTH_STORAGE_KEY)
    || window.sessionStorage.getItem(AUTH_STORAGE_KEY),
  );
}

function Home() {
  const { items: cartItems, totalItems } = useCart();
  const { ids: wishlistIds } = useWishlist();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(() => hasAuthSession());
  const [marketplaceProducts, setMarketplaceProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [marketplaceCategories, setMarketplaceCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [sellersError, setSellersError] = useState<string | null>(null);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const engagedProductIds = [...wishlistIds, ...cartItems.map((item) => item.productId)];
  const engagedProducts = marketplaceProducts.filter((product) =>
    engagedProductIds.includes(product.id)
  );
  const recommendationCategories = new Set(engagedProducts.map((product) => product.category));
  const trendingProducts = [...marketplaceProducts]
    .sort((first, second) => (second.rating ?? 0) - (first.rating ?? 0))
    .slice(0, 4);
  const recommendedProducts = (
    engagedProducts.length > 0
      ? marketplaceProducts.filter(
          (product) =>
            recommendationCategories.has(product.category) &&
            !engagedProductIds.includes(product.id)
        )
      : marketplaceProducts.slice(4, 8)
  ).slice(0, 4);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);

    try {
      const data = await getProducts();
      setMarketplaceProducts(data);
    } catch {
      setProductsError('Unable to load marketplace products.');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        const data = await getCategories();
        if (active) {
          setMarketplaceCategories(data);
        }
      } catch {
        if (active) {
          setCategoriesError('Unable to load categories.');
        }
      } finally {
        if (active) {
          setCategoriesLoading(false);
        }
      }
    };

    void loadCategories();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    const loadSellers = async () => {
      try {
        const data = await getPublicSellers();
        if (active) {
          setSellers(data);
        }
      } catch {
        if (active) {
          setSellersError('Unable to load makers.');
        }
      } finally {
        if (active) {
          setSellersLoading(false);
        }
      }
    };

    void loadSellers();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const syncAuthState = () => setIsLoggedIn(hasAuthSession());

    window.addEventListener('storage', syncAuthState);
    window.addEventListener(AUTH_EVENT_NAME, syncAuthState);

    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener(AUTH_EVENT_NAME, syncAuthState);
    };
  }, []);
  const filteredSellers = useMemo(
    () => normalizedSearch
      ? sellers.filter((seller) => [seller.name, seller.specialty, seller.bio].join(' ').toLowerCase().includes(normalizedSearch))
      : sellers.slice(0, 4),
    [normalizedSearch, sellers],
  );
  const filteredProducts = useMemo(
    () => normalizedSearch
      ? marketplaceProducts.filter((product) =>
          [product.title, product.creator, product.tag]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
        )
      : [],
    [normalizedSearch, marketplaceProducts],
  );

  return (
    <div className="legacy-home">
      <div className="legacy-search-container">
        <div className="home-bottom-nav" aria-label="Home quick navigation">
          <Link className="home-bottom-nav__brand" to="/" aria-label="Eclectary home">
            <img src={logo} alt="Eclectary" />
          </Link>

          <label className="legacy-search-bar home-bottom-nav__search">
            <span className="legacy-search-icon" aria-hidden="true">✦</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search creations, creators, ideas..."
              aria-label="Search creations, creators, ideas"
            />
          </label>

          <div className="home-bottom-nav__actions">
            <Link
              to={isLoggedIn ? '/account/profile' : '/account/login'}
              className="home-bottom-nav__action"
              title={isLoggedIn ? 'Profile' : 'Login'}
              aria-label={isLoggedIn ? 'Profile' : 'Login'}
            >
              <span aria-hidden="true">♙</span>
              <span>{isLoggedIn ? 'Profile' : 'Login'}</span>
            </Link>

            <Link to="/cart" className="home-bottom-nav__action" title="Cart" aria-label="Cart">
              <span aria-hidden="true">🛒</span>
              <span>{totalItems > 0 ? `Cart (${totalItems})` : 'Cart'}</span>
            </Link>
          </div>
        </div>
      </div>

      <section className="legacy-category-banner" aria-label="Browse Eclectary collections">
        <Link to="/shop?collection=custom-printing"><img src={customPrinting} alt="Custom Printing" /></Link>
        <Link to="/shop?collection=purely-handmade"><img src={purelyHandmade} alt="Purely Handmade" /></Link>
        <Link to="/shop?collection=digital-creations"><img src={digitalCreations} alt="Digital Creations" /></Link>
      </section>

      {normalizedSearch && (
        <section className="home-search-results" aria-label="Search results">
          <div className="makers-header">
            <h2>Search results</h2>
            {!productsLoading && !productsError && (
              <p>{filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'} and {filteredSellers.length} maker{filteredSellers.length === 1 ? '' : 's'} found</p>
            )}
          </div>

          {productsLoading && <p className="home-product-state" role="status">Loading product results...</p>}
          {!productsLoading && productsError && (
            <p className="home-product-state" role="status">
              Product results are unavailable. Retry loading products in Trending now.
            </p>
          )}
          {!productsLoading && !productsError && filteredProducts.length === 0 && (
            <p className="home-product-state" role="status">No products match your search.</p>
          )}
          {!productsLoading && !productsError && filteredProducts.length > 0 && (
            <div className="home-search-products">
              {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          )}
        </section>
      )}

      <section className="legacy-hero-banner" aria-label="Eclectary introduction">
        <img src={heroBanner} alt="Find what calls to you and discover creations made with passion." />
      </section>

      <section className="home-market-section" aria-labelledby="trending-heading">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">Popular right now</p>
            <h2 id="trending-heading">Trending now</h2>
          </div>
          <Link to="/shop" className="home-section-link">See all <span aria-hidden="true">→</span></Link>
        </div>
        <div className="home-product-grid">
          {productsLoading && <p className="home-product-state" role="status">Loading products...</p>}

          {!productsLoading && productsError && (
            <div className="home-product-state" role="alert">
              <p>{productsError}</p>
              <button type="button" className="home-product-retry" onClick={() => void loadProducts()}>
                Retry loading products
              </button>
            </div>
          )}

          {!productsLoading && !productsError && trendingProducts.length === 0 && (
            <p className="home-product-state" role="status">No products available yet.</p>
          )}

          {!productsLoading && !productsError && trendingProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="home-market-section home-category-section" aria-labelledby="categories-heading">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">Find your next favorite</p>
            <h2 id="categories-heading">Shop by category</h2>
          </div>
          <Link to="/categories" className="home-section-link">Browse categories <span aria-hidden="true">→</span></Link>
        </div>
        <div className="home-category-grid">
          {categoriesLoading && <p role="status">Loading categories...</p>}
          {!categoriesLoading && categoriesError && <p role="alert">{categoriesError}</p>}
          {!categoriesLoading && !categoriesError && marketplaceCategories.length === 0 && (
            <p>No categories available yet.</p>
          )}
          {!categoriesLoading && !categoriesError && marketplaceCategories.slice(0, 10).map((category) => (
            <CategoryCard key={category.apiId ?? category.id} category={category} />
          ))}
        </div>
      </section>

      <section className="home-market-section home-recommendation-section" aria-labelledby="recommendations-heading">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">A little inspiration</p>
            <h2 id="recommendations-heading">Picked for you</h2>
          </div>
          <Link to="/shop" className="home-section-link">Explore more <span aria-hidden="true">→</span></Link>
        </div>
        <div className="home-product-grid">
          {productsLoading && (
            <p className="home-product-state" role="status">Recommendations will appear when products finish loading.</p>
          )}
          {!productsLoading && productsError && (
            <p className="home-product-state">Recommendations are unavailable until products can be loaded.</p>
          )}
          {!productsLoading && !productsError && marketplaceProducts.length === 0 && (
            <p className="home-product-state" role="status">No recommendations available yet.</p>
          )}
          {!productsLoading && !productsError && marketplaceProducts.length > 0 && recommendedProducts.length === 0 && (
            <p className="home-product-state" role="status">More recommendations will appear as the marketplace grows.</p>
          )}
          {recommendedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      <section className="makers-section">
        <div className="makers-header"><h2>Meet the Makers</h2></div>
        <div className="makers-grid">
          {sellersLoading && <p role="status">Loading makers...</p>}
          {!sellersLoading && sellersError && <p role="alert">{sellersError}</p>}
          {!sellersLoading && !sellersError && filteredSellers.length === 0 && (
            <p>{normalizedSearch ? 'No makers match your search.' : 'No makers available yet.'}</p>
          )}
          {!sellersLoading && !sellersError && filteredSellers.map((seller) => <SellerCard key={seller.id} seller={seller} />)}
        </div>
        <div className="makers-footer"><Link to="/shop#makers">View All Makers <span aria-hidden="true">→</span></Link></div>
      </section>

      <section className="home-feedback-banner" aria-labelledby="feedback-heading">
        <div>
          <p className="home-section-kicker">Help shape Eclectary</p>
          <h2 id="feedback-heading">Have an idea or request?</h2>
          <p>Tell us what you would love to see, find, or experience next.</p>
        </div>
        <a className="home-feedback-banner__link" href={FEEDBACK_URL}>Share feedback <span aria-hidden="true">→</span></a>
      </section>
    </div>
  );
}

export default Home;
