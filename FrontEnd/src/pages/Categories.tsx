import { useEffect, useMemo, useState } from 'react';

import CategoryCard from '../components/CategoryCard';
import Searchbar from '../components/Searchbar';
import { getCategories } from '../services/categoryApi';
import { getProducts } from '../services/productApi';
import { getSellersByCategory } from '../services/sellerApi';
import type { Category } from '../types';
import type { Product } from '../types';
import '../styles/categories.css';

function Categories() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);
  const [productCounts, setProductCounts] = useState<Record<string, number> | null>(null);
  const [productsError, setProductsError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const result = await getCategories();
        if (active) {
          setCategories(result);
        }
      } catch {
        if (active) {
          setCategoriesError(true);
        }
      } finally {
        if (active) {
          setCategoriesLoading(false);
        }
      }
    }

    void loadCategories();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (categoriesLoading || categoriesError || categories.length === 0) {
      return undefined;
    }

    let active = true;

    async function loadProductCounts() {
      try {
        const products = await getProducts();
        const counts = Object.fromEntries(categories.map((category) => [
          category.id,
          products.filter((product: Product) => product.category_id === category.apiId).length,
        ]));

        if (active) {
          setProductCounts(counts);
        }
      } catch {
        if (active) {
          setProductsError(true);
        }
      }
    }

    void loadProductCounts();
    return () => { active = false; };
  }, [categories, categoriesError, categoriesLoading]);

  const filteredCategories = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    if (!normalized) {
      return categories;
    }

    return categories.filter((category) => {
      const categoryNameMatch = category.name.toLowerCase().includes(normalized);
      const childCategoryMatch = category.childSubcategories?.some((child) =>
        child.toLowerCase().includes(normalized),
      );

      return categoryNameMatch || Boolean(childCategoryMatch);
    });
  }, [categories, searchTerm]);

  return (
    <div className="categories-page">
      <header className="categories-hero">
        <div>
          <p className="eyebrow">Discover Eclectary</p>
          <h1>Browse every category.</h1>
          <p className="categories-hero__copy">
            Explore products, curated collections, and the independent shops behind them.
          </p>
        </div>

        <div className="categories-summary">
          <span>{categories.length} categories</span>
          <span>New makers joining weekly</span>
        </div>
      </header>

      <Searchbar
        value={searchTerm}
        onChange={setSearchTerm}
        onSubmit={setSearchTerm}
        placeholder="Search categories like crystals, planners, or divination"
        className="categories-search"
      />

      {categoriesLoading ? (
        <p role="status">Loading categories...</p>
      ) : categoriesError ? (
        <p role="alert">Unable to load categories.</p>
      ) : filteredCategories.length > 0 ? (
        <section className="categories-grid" aria-label="All categories">
          {filteredCategories.map((category) => {
            const productCount = productCounts?.[category.id];
            const sellerCount = getSellersByCategory(category.id).length;

            return (
              <div key={category.id} className="categories-grid__item">
                <CategoryCard category={category} />
                <p className="categories-grid__meta">
                  {productsError ? 'Unable to load item counts' : productCount === undefined ? 'Loading items...' : `${productCount} item${productCount === 1 ? '' : 's'}`} · {sellerCount} shop{sellerCount === 1 ? '' : 's'}
                </p>
              </div>
            );
          })}
        </section>
      ) : categories.length === 0 ? (
        <div className="categories-empty-state" aria-live="polite">
          <h2>No categories available yet.</h2>
        </div>
      ) : (
        <div className="categories-empty-state" aria-live="polite">
          <h2>No categories match your search.</h2>
          <p>Try another keyword like "crystals," "planners," or "divination."</p>
          <button type="button" className="categories-clear-search" onClick={() => setSearchTerm('')}>
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}

export default Categories;
