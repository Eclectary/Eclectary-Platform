import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Routes, Route } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import SellerDetail from "./pages/SellerDetail";
import ProductDetail from "./pages/ProductDetail";
import Favorites from "./pages/Favorites";
import Categories from "./pages/Categories";
import Category from "./pages/Category";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import Orders from "./pages/Orders";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import AddProduct from "./pages/AddProduct";
import EditProduct from "./pages/EditProduct";
import SellerOrders from "./pages/SellerOrders";
import ProductCard from "./components/ProductCard";
import ProtectedRoute from "./components/ProtectedRoute";
import { deactivateProduct, getSellerProducts } from "./services/productApi";
import { useAuth } from "./context/AuthContext";
import type { Product } from "./types";
import "./App.css";

function NotFound() {
  return (
    <div style={{ padding: 40 }}>
      <h2>404 — Page not found</h2>
      <p>The page you requested does not exist.</p>
    </div>
  )
}

function About() {
  return <div style={{ padding: 24 }}><h2>About</h2><p>About Eclectary.</p></div>
}

function useSellerProducts() {
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const retry = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSellerProducts(await getSellerProducts());
    } catch {
      setError("We could not load your products. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void getSellerProducts()
      .then((products) => {
        if (active) {
          setSellerProducts(products);
          setError(null);
        }
      })
      .catch(() => {
        if (active) {
          setError("We could not load your products. Please try again.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const replaceProduct = useCallback((updatedProduct: Product) => {
    setSellerProducts((current) => current.map((product) => (
      product.id === updatedProduct.id ? updatedProduct : product
    )));
  }, []);

  return { sellerProducts, loading, error, retry, replaceProduct };
}

function DashboardOverview() {
  const { sellerProducts, loading, error, retry } = useSellerProducts();

  return (
    <section style={{ padding: 24 }}>
      <h2>Dashboard</h2>
      <p>Manage your products and public store.</p>

      {loading && <p role="status">Loading your product information...</p>}

      {!loading && error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void retry()}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div style={{ marginTop: 24 }}>
          <strong>Your Products: {sellerProducts.length}</strong>
          <p>
            {sellerProducts.length === 0
              ? "You do not have any products yet."
              : "Review the products currently associated with your seller account."}
          </p>
          <Link to={sellerProducts.length === 0 ? "/dashboard/products/new" : "/dashboard/products"}>
            {sellerProducts.length === 0 ? "Add Product" : "Manage Products"}
          </Link>
        </div>
      )}
    </section>
  )
}

function Products() {
  const { sellerProducts, loading, error, retry, replaceProduct } = useSellerProducts();
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const deactivate = async (product: Product) => {
    setDeactivatingId(product.id);
    setActionError(null);
    try {
      replaceProduct(await deactivateProduct(product.id));
    } catch {
      setActionError(`We could not deactivate ${product.title}. Please try again.`);
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <section style={{ padding: 24 }}>
      <h2>Your Products</h2>
      <p><Link to="/dashboard/products/new">Add Product</Link></p>

      {actionError && <p role="alert">{actionError}</p>}

      {loading && <p role="status">Loading your products...</p>}

      {!loading && error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void retry()}>Retry</button>
        </div>
      )}

      {!loading && !error && sellerProducts.length === 0 && (
        <div role="status">
          <p>You do not have any products yet.</p>
          <Link to="/dashboard/products/new">Add Product</Link>
        </div>
      )}

      {!loading && !error && sellerProducts.length > 0 && (
        <>
          <p>{sellerProducts.length} {sellerProducts.length === 1 ? "product" : "products"}</p>
          <div className="shop-grid" style={{ marginTop: 24 }}>
            {sellerProducts.map((product) => (
              <article key={product.id}>
                <ProductCard product={product} />
                <p><strong>{product.active ? "Active" : "Inactive"}</strong></p>
                <p><Link to={`/dashboard/products/${product.id}/edit`}>Edit</Link></p>
                {product.active && (
                  <button
                    type="button"
                    disabled={deactivatingId === product.id}
                    onClick={() => void deactivate(product)}
                  >
                    {deactivatingId === product.id ? "Deactivating..." : "Deactivate"}
                  </button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function AccountIndex() {
  const { user, token, loading } = useAuth();

  if (loading) {
    return null;
  }

  return <Navigate to={user && token ? "/account/profile" : "/account/login"} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes wrapped in MainLayout */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/seller/:id" element={<SellerDetail />} />
          <Route path="/shop/:id" element={<SellerDetail />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/category/:id" element={<Category />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/wishlist" element={<Navigate to="/favorites" replace />} />
          <Route path="/about" element={<About />} />

          {/* Authentication */}
          <Route path="/account" element={<AccountIndex />} />
          <Route path="/account/login" element={<Login />} />
          <Route path="/account/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/account/profile" element={<Profile />} />
            <Route path="/account/orders" element={<Orders />} />
            <Route path="/checkout" element={<Checkout />} />
          </Route>

          {/* Backward-compatible auth redirects */}
          <Route path="/login" element={<Navigate to="/account/login" replace />} />
          <Route path="/register" element={<Navigate to="/account/register" replace />} />
          <Route path="/profile" element={<Navigate to="/account/profile" replace />} />

          {/* Shopping */}
          <Route path="/cart" element={<Cart />} />
          <Route path="/order" element={<OrderConfirmation />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["seller"]} />}>
          <Route path="/seller" element={<Navigate to="/dashboard" replace />} />

          {/* Seller dashboard routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="products" element={<Products />} />
            <Route path="products/new" element={<AddProduct />} />
            <Route path="products/:id/edit" element={<EditProduct />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="settings" element={<div style={{ padding: 24 }}>Settings</div>} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
