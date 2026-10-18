import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard';
import SellerCard from '../components/SellerCard';
import { getCategory } from '../data/categories';
import { getCategories } from '../services/categoryApi';
import { getProductsByCategory } from '../services/productApi';
import { getSellersByCategory } from '../services/sellerApi';
import type { Category as CategoryType, Product } from '../types';
import '../styles/category-detail.css';

function Category() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const localCategory = id ? getCategory(id) : undefined;
  const [apiCategories, setApiCategories] = useState<CategoryType[] | null>(null);
  const [categoryLookupError, setCategoryLookupError] = useState(false);
  const subcategory = searchParams.get('subcategory') ?? '';
  const apiCategory = apiCategories?.find((item) => item.slug === id);
  const category = apiCategory ?? localCategory;
  const isValidSubcategory = Boolean(category?.childSubcategories?.includes(subcategory));
  const categoryId = apiCategory?.apiId;
  const activeSubcategory = isValidSubcategory ? subcategory : undefined;
  const [productsResult, setProductsResult] = useState<{
    categoryId: string | number;
    subcategory: string | undefined;
    products: Product[];
    error: boolean;
  } | null>(null);
  const isCategoryLoading = apiCategories === null && !categoryLookupError;
  const isLoading = isCategoryLoading || (categoryId !== undefined && (
    productsResult?.categoryId !== categoryId
    || productsResult?.subcategory !== activeSubcategory
  ));
  const categoryProducts = !isLoading && productsResult ? productsResult.products : [];
  const productsError = !isLoading && (categoryLookupError || productsResult?.error);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        const result = await getCategories();
        if (active) {
          setApiCategories(result);
        }
      } catch {
        if (active) {
          setCategoryLookupError(true);
          setApiCategories([]);
        }
      }
    };

    void loadCategories();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (categoryId === undefined) {
      return undefined;
    }

    let active = true;

    async function loadProducts(requestedCategoryId: string | number) {
      try {
        const products = await getProductsByCategory(requestedCategoryId, activeSubcategory);
        if (active) {
          setProductsResult({ categoryId: requestedCategoryId, subcategory: activeSubcategory, products, error: false });
        }
      } catch {
        if (active) {
          setProductsResult({ categoryId: requestedCategoryId, subcategory: activeSubcategory, products: [], error: true });
        }
      }
    }

    void loadProducts(categoryId);
    return () => { active = false; };
  }, [categoryId, activeSubcategory]);

  if (!category && isCategoryLoading) {
    return (
      <section className="category-detail category-detail--empty" role="status">
        <p>Loading category...</p>
      </section>
    );
  }

  if (!category && categoryLookupError) {
    return (
      <section className="category-detail category-detail--empty" role="alert">
        <h1>Unable to load category information.</h1>
        <p>Please try again later.</p>
        <Link className="category-detail__back-link" to="/categories">
          Back to categories
        </Link>
      </section>
    );
  }

  if (!category) {
    return (
      <section className="category-detail category-detail--empty" aria-live="polite">
        <p className="eyebrow">Category not found</p>
        <h1>That category is unavailable.</h1>
        <Link className="category-detail__back-link" to="/shop">
          Return to the shop
        </Link>
      </section>
    );
  }

  const categorySellers = getSellersByCategory(category.id);

  return (
    <section className="category-detail">
      <Link className="category-detail__back-link" to="/categories">
        Back to categories
      </Link>

      <header className="category-detail__hero">
        {category.image && <img className="category-detail__image" src={category.image} alt="" />}
        <div className="category-detail__copy">
          <p className="eyebrow">Marketplace category</p>
          <h1>{category.name}</h1>
          <p className="category-detail__subcategories">
            <Link to={`/category/${category.id}`}>All {category.name}</Link>
            {category.childSubcategories?.map((child) => (
              <Link key={child} to={`/category/${category.id}?subcategory=${encodeURIComponent(child)}`}>
                {child}
              </Link>
            ))}
          </p>
          <p className="category-detail__count">
            {isValidSubcategory ? `${subcategory}: ` : ''}{isLoading ? 'Loading items...' : productsError ? 'Item count unavailable' : `${categoryProducts.length} item${categoryProducts.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="category-detail__empty-state" role="status">
          <p>Loading products...</p>
        </div>
      ) : productsError ? (
        <div className="category-detail__empty-state" role="alert">
          <h2>{categoryLookupError ? 'Unable to load category information.' : 'Unable to load products.'}</h2>
          <p>Please try again later.</p>
        </div>
      ) : categoryProducts.length > 0 ? (
        <div className="category-detail__grid" aria-label={`${category.name} products`}>
          {categoryProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="category-detail__empty-state" aria-live="polite">
          <h2>No products in this category yet.</h2>
          <p>Check back soon as new makers join Eclectary.</p>
        </div>
      )}

      {categorySellers.length > 0 && (
        <section className="category-detail__sellers" aria-label={`Shops in ${category.name}`}>
          <div className="section-heading">
            <p className="eyebrow">Shop by maker</p>
            <h2>Shops in this category</h2>
          </div>

          <div className="category-detail__sellers-grid">
            {categorySellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export default Category;
