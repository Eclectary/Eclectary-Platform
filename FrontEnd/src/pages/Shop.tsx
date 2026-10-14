import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard';
import DepartmentSidebar from '../components/DepartmentSidebar';
import Searchbar from '../components/Searchbar';
import SellerCard from '../components/SellerCard';
import logo from '../assets/images/eclectary logo nb.png';
import { useCart } from '../context/CartContext';
import { products } from '../data/products';
import { intentions } from '../data/intentions';
import { categories } from '../data/categories';
import { getSellers } from '../services/sellerApi';

import '../styles/shop.css';

const sellers = getSellers();

const PRICE_BUCKETS: Array<{ id: string; label: string; min: number; max?: number }> = [
  { id: 'under-25', label: 'Under $25', min: 0, max: 25 },
  { id: '25-50', label: '$25 to $50', min: 25, max: 50 },
  { id: '50-100', label: '$50 to $100', min: 50, max: 100 },
  { id: 'over-100', label: 'Over $100', min: 100 },
];

const SORT_OPTIONS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Recommended' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'rating-desc', label: 'Top Rated' },
  { id: 'newest', label: 'Newest' },
];

const collectionNames: Record<string, string> = {
  'custom-printing': 'Custom Printing',
  'purely-handmade': 'Handmade',
  'digital-creations': 'Digital Creations',
};

const collectionDescriptions: Record<string, string> = {
  'purely-handmade': 'Handcrafted goods from independent makers.',
  'digital-creations': 'Digital art, resources, and instant downloads.',
  'custom-printing': 'Artist-designed and personalized physical goods.',
};

const AUTH_STORAGE_KEY = 'eclectary-auth';
const AUTH_EVENT_NAME = 'eclectary-auth-change';

// Matches the single-column breakpoint in shop.css.
const DESKTOP_MEDIA_QUERY = '(min-width: 901px)';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window === 'undefined' ? true : window.matchMedia(DESKTOP_MEDIA_QUERY).matches
  ));

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const syncIsDesktop = (event: MediaQueryListEvent) => setIsDesktop(event.matches);

    mediaQuery.addEventListener('change', syncIsDesktop);

    return () => mediaQuery.removeEventListener('change', syncIsDesktop);
  }, []);

  return isDesktop;
}

function hasAuthSession() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    window.localStorage.getItem(AUTH_STORAGE_KEY)
    || window.sessionStorage.getItem(AUTH_STORAGE_KEY),
  );
}

function Shop() {
  const { totalItems } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearchTerm = searchParams.get('search') ?? '';
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [isLoggedIn, setIsLoggedIn] = useState(() => hasAuthSession());
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const isDesktop = useIsDesktop();
  const [openFilterSections, setOpenFilterSections] = useState(() => ({
    categories: true,
    intentions: false,
    price: false,
  }));
  const collection = searchParams.get('collection') ?? '';
  const intention = searchParams.get('intention') ?? '';
  const category = searchParams.get('category') ?? '';
  const subcategory = searchParams.get('subcategory') ?? '';
  const priceBucket = searchParams.get('price') ?? '';
  const sort = searchParams.get('sort') ?? '';
  const collectionName = collectionNames[collection];
  const departmentCategories = collection
    ? categories.filter((item) => item.collection === collection)
    : [];
  const selectedCategory = departmentCategories.find((item) => item.id === category);
  const activeCategory = selectedCategory ? category : '';
  const activeSubcategory = selectedCategory?.childSubcategories?.includes(subcategory) ? subcategory : '';

  const setFilterParam = (key: string, nextValue: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextValue) {
      nextParams.set(key, nextValue);
    } else {
      nextParams.delete(key);
    }

    setSearchParams(nextParams);
  };

  const selectIntention = (nextIntention: string) => setFilterParam('intention', nextIntention);
  const selectCategory = (nextCategory: string, nextSubcategory = '') => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextCategory) {
      nextParams.set('category', nextCategory);
    } else {
      nextParams.delete('category');
    }
    if (nextSubcategory) {
      nextParams.set('subcategory', nextSubcategory);
    } else {
      nextParams.delete('subcategory');
    }
    setSearchParams(nextParams);
  };
  const selectPrice = (nextPrice: string) => setFilterParam('price', nextPrice);
  const selectSort = (nextSort: string) => setFilterParam('sort', nextSort);

  const clearDepartmentFilters = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('intention');
    nextParams.delete('category');
    nextParams.delete('subcategory');
    nextParams.delete('price');
    nextParams.delete('sort');
    setSearchParams(nextParams);
  };

  useEffect(() => {
    const syncAuthState = () => setIsLoggedIn(hasAuthSession());

    window.addEventListener('storage', syncAuthState);
    window.addEventListener(AUTH_EVENT_NAME, syncAuthState);

    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener(AUTH_EVENT_NAME, syncAuthState);
    };
  }, []);

  useEffect(() => {
    if (!isFiltersOpen || isDesktop) {
      return undefined;
    }

    const firstFocusable = sidebarRef.current?.querySelector<HTMLElement>('button, summary');
    firstFocusable?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFiltersOpen(false);
        filterToggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isDesktop, isFiltersOpen]);

  useEffect(() => {
    if (category && !selectedCategory) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('category');
      nextParams.delete('subcategory');
      setSearchParams(nextParams, { replace: true });
      return;
    }

    if (subcategory && !activeSubcategory) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('subcategory');
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeSubcategory, category, searchParams, selectedCategory, setSearchParams, subcategory]);

  const activePriceBucket = PRICE_BUCKETS.find((bucket) => bucket.id === priceBucket);

  const filteredProducts = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    const collectionProducts = collection
      ? products.filter((product) => product.collection === collection)
      : products;
    const categoryProducts = activeCategory
      ? collectionProducts.filter((product) => product.category === activeCategory)
      : collectionProducts;
    const subcategoryProducts = activeSubcategory
      ? categoryProducts.filter((product) => product.subcategory === activeSubcategory)
      : categoryProducts;
    const intentionProducts = intention
      ? subcategoryProducts.filter((product) => product.intentions?.includes(intention))
      : subcategoryProducts;
    const priceProducts = activePriceBucket
      ? intentionProducts.filter((product) => (
        product.price >= activePriceBucket.min
        && (activePriceBucket.max === undefined || product.price < activePriceBucket.max)
      ))
      : intentionProducts;

    const searchedProducts = normalized
      ? priceProducts.filter((product) => {
        const haystack = [product.title, product.creator, product.tag].join(' ').toLowerCase();
        return haystack.includes(normalized);
      })
      : priceProducts;

    const sortedProducts = [...searchedProducts];

    switch (sort) {
      case 'price-asc':
        sortedProducts.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        sortedProducts.sort((a, b) => b.price - a.price);
        break;
      case 'rating-desc':
        sortedProducts.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case 'newest':
        sortedProducts.sort((a, b) => b.id - a.id);
        break;
      default:
        break;
    }

    return sortedProducts;
  }, [activeCategory, activePriceBucket, activeSubcategory, collection, intention, searchTerm, sort]);

  const filteredSellers = useMemo(() => {
    if (collection) {
      return [];
    }

    const normalized = searchTerm.trim().toLowerCase();

    if (!normalized) {
      return sellers;
    }

    return sellers.filter((seller) => {
      const haystack = [seller.name, seller.specialty, seller.bio].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [collection, searchTerm]);

  return (
    <div className="shop-page">
      {collectionName && (
        <section className="shop-collection-nav" aria-label={`${collectionName} collection navigation`}>
          <div className="shop-collection-nav__bottom" aria-label={`${collectionName} quick navigation`}>
            <Link className="shop-collection-nav__brand" to="/" aria-label="Eclectary home">
              <img src={logo} alt="Eclectary" />
            </Link>

            <label className="shop-collection-nav__search">
              <span className="shop-collection-nav__search-icon" aria-hidden="true">✦</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search creations, creators, ideas..."
                aria-label="Search creations, creators, ideas"
              />
            </label>

            <div className="shop-collection-nav__actions">
              <Link
                to={`/shop?collection=${collection}`}
                className="shop-collection-nav__action shop-collection-nav__action--collection"
                title={`Explore ${collectionName}`}
                aria-label={`Explore ${collectionName}`}
              >
                <span aria-hidden="true">✶</span>
                <span>{collectionName}</span>
              </Link>

              <Link
                to={isLoggedIn ? '/account/profile' : '/account/login'}
                className="shop-collection-nav__action"
                title={isLoggedIn ? 'Profile' : 'Login'}
                aria-label={isLoggedIn ? 'Profile' : 'Login'}
              >
                <span aria-hidden="true">♙</span>
                <span>{isLoggedIn ? 'Profile' : 'Login'}</span>
              </Link>

              {isLoggedIn && (
                <Link to="/favorites" className="shop-collection-nav__action" title="Favorites" aria-label="Favorites">
                  <span aria-hidden="true">♡</span>
                  <span>Favorites</span>
                </Link>
              )}

              <Link to="/cart" className="shop-collection-nav__action" title="Cart" aria-label="Cart">
                <span aria-hidden="true">🛒</span>
                <span>{totalItems > 0 ? `Cart (${totalItems})` : 'Cart'}</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <header className={`shop-hero${collectionName ? ' shop-hero--collection' : ''}`}>
        <div>
          {!collectionName && <p className="eyebrow">Shop the collection</p>}
          <h1>{collectionName ?? 'Find pieces made with intention.'}</h1>
          {collectionDescriptions[collection] && <p>{collectionDescriptions[collection]}</p>}
        </div>
      </header>

      {!collection && (
        <Searchbar
          value={searchTerm}
          onChange={setSearchTerm}
          onSubmit={setSearchTerm}
          className="shop-search"
        />
      )}

      {collectionName ? (
        <div className="shop-layout">
          <button
            type="button"
            className="shop-filters-toggle"
            ref={filterToggleRef}
            aria-expanded={isFiltersOpen}
            aria-controls="shop-filters"
            onClick={() => setIsFiltersOpen((isOpen) => !isOpen)}
          >
            <span aria-hidden="true">✦</span>
            Browse {collectionName}
          </button>

          <aside
            id="shop-filters"
            ref={sidebarRef}
            className={`shop-sidebar${isFiltersOpen ? ' shop-sidebar--open' : ''}`}
            aria-label={`${collectionName} navigation and filters`}
            aria-modal={!isDesktop}
            tabIndex={-1}
          >
            <DepartmentSidebar
              key={collection}
              department={collection as 'purely-handmade' | 'digital-creations' | 'custom-printing'}
              categories={departmentCategories}
              activeCategory={activeCategory}
              activeSubcategory={activeSubcategory}
              activeIntention={intention}
              activePrice={priceBucket}
              priceBuckets={PRICE_BUCKETS}
              intentions={intentions}
              openSections={openFilterSections}
              onSectionToggle={(section, open) => setOpenFilterSections((sections) => ({ ...sections, [section]: open }))}
              onCategorySelect={selectCategory}
              onIntentionSelect={selectIntention}
              onPriceSelect={selectPrice}
              onClear={clearDepartmentFilters}
            />
          </aside>
          {isFiltersOpen && !isDesktop && (
            <button type="button" className="shop-sidebar-backdrop" aria-label="Close department navigation" onClick={() => { setIsFiltersOpen(false); filterToggleRef.current?.focus(); }} />
          )}

          <div className="shop-main">
            <div className="shop-toolbar">
              {(searchTerm || intention || category || priceBucket) ? (
                <p className="shop-results-summary">
                  {filteredProducts.length} result{filteredProducts.length === 1 ? '' : 's'}
                  {searchTerm && ` for “${searchTerm}”`}
                  {intention && ` with the intention “${intention}”`}
                  {activeCategory && ` in “${departmentCategories.find((item) => item.id === activeCategory)?.name ?? activeCategory}”`}
                  {activeSubcategory && ` / ${activeSubcategory}`}
                  {activePriceBucket && ` priced ${activePriceBucket.label.toLowerCase()}`}
                </p>
              ) : <span />}

              <label className="shop-sort">
                <span>Sort by</span>
                <select value={sort} onChange={(event) => selectSort(event.target.value)}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.id || 'default'} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {filteredProducts.length > 0 ? (
              <section className="shop-grid" aria-label="Shop products">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </section>
            ) : (
              <div className="shop-empty-state" aria-live="polite">
                <h2>No products match these filters.</h2>
                <p>Try clearing a filter or searching a different keyword.</p>
                <button type="button" className="shop-clear-search" onClick={clearDepartmentFilters}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <section className="shop-intentions" aria-labelledby="shop-intentions-heading">
            <div className="section-heading">
              <p className="eyebrow">Shop by intention</p>
              <h2 id="shop-intentions-heading">Find what calls to you.</h2>
            </div>
            <div className="shop-intentions__list" role="group" aria-label="Filter products by intention">
              <button
                type="button"
                className={`shop-intention${!intention ? ' shop-intention--active' : ''}`}
                aria-pressed={!intention}
                onClick={() => selectIntention('')}
              >
                All intentions
              </button>
              {intentions.map((availableIntention) => (
                <button
                  key={availableIntention}
                  type="button"
                  className={`shop-intention${intention === availableIntention ? ' shop-intention--active' : ''}`}
                  aria-pressed={intention === availableIntention}
                  onClick={() => selectIntention(availableIntention)}
                >
                  {availableIntention}
                </button>
              ))}
            </div>
          </section>

          {(searchTerm || intention || filteredProducts.length > 0) && (
            <div className="shop-toolbar">
              {(searchTerm || intention) ? (
                <p className="shop-results-summary">
                  {filteredProducts.length + filteredSellers.length} result{filteredProducts.length + filteredSellers.length === 1 ? '' : 's'}
                  {searchTerm && ` for “${searchTerm}”`}
                  {intention && ` with the intention “${intention}”`}
                </p>
              ) : <span />}

              {filteredProducts.length > 0 && (
                <label className="shop-sort">
                  <span>Sort by</span>
                  <select value={sort} onChange={(event) => selectSort(event.target.value)}>
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.id || 'default'} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {filteredProducts.length > 0 ? (
            <section className="shop-grid" aria-label="Shop products">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </section>
          ) : (
            <div className="shop-empty-state" aria-live="polite">
              <h2>No products match your search.</h2>
              <p>Try another keyword like “ceramics,” “journal,” or “moss.”</p>
              <button type="button" className="shop-clear-search" onClick={() => setSearchTerm('')}>
                Clear search
              </button>
            </div>
          )}
        </>
      )}

      {filteredSellers.length > 0 && (
        <section className="shop-sellers" aria-label="Seller search results">
          <div className="section-heading section-heading--row">
            <div>
              <p className="eyebrow">Shop by maker</p>
              <h2>Matching sellers</h2>
            </div>
          </div>

          <div className="shop-sellers-grid">
            {filteredSellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default Shop;
