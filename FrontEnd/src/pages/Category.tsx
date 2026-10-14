import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import ProductCard from '../components/ProductCard';
import SellerCard from '../components/SellerCard';
import { getCategory } from '../data/categories';
import { getProductsByCategory } from '../services/productApi';
import { getSellersByCategory } from '../services/sellerApi';
import type { Product } from '../types';
import '../styles/category-detail.css';

function Category() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const category = id ? getCategory(id) : undefined;
  const subcategory = searchParams.get('subcategory') ?? '';
  const isValidSubcategory = Boolean(category?.childSubcategories?.includes(subcategory));
  const categoryId = category?.id;
  const activeSubcategory = isValidSubcategory ? subcategory : undefined;
  const [productsResult, setProductsResult] = useState<{
    categoryId: string;
    subcategory: string | undefined;
    products: Product[];
    error: boolean;
  } | null>(null);
  const isLoading = productsResult?.categoryId !== categoryId
    || productsResult?.subcategory !== activeSubcategory;
  const categoryProducts = !isLoading && productsResult ? productsResult.products : [];
  const productsError = !isLoading && productsResult?.error;

  useEffect(() => {
    if (!categoryId) {
      return;
    }

    let active = true;

    async function loadProducts(requestedCategoryId: string) {
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
        <img className="category-detail__image" src={category.image} alt="" />
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
          <h2>Unable to load products.</h2>
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
