import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";

import ProductForm from "../components/ProductForm";
import { getSellerProduct, updateProduct } from "../services/productApi";
import type { Product } from "../types";

function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!id) {
      setError("This product is unavailable.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setProduct(await getSellerProduct(id));
    } catch (requestError) {
      setError(isAxiosError(requestError) && requestError.response?.status === 404
        ? "This product is unavailable or does not belong to your seller account."
        : "We could not load this product. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    if (!id) {
      return;
    }

    void getSellerProduct(id)
      .then((data) => { if (active) setProduct(data); })
      .catch((requestError: unknown) => {
        if (active) {
          setError(isAxiosError(requestError) && requestError.response?.status === 404
            ? "This product is unavailable or does not belong to your seller account."
            : "We could not load this product. Please try again.");
        }
      })
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <section style={{ padding: 24 }} role="status">Loading product...</section>;

  if (error || !product || !id) {
    return (
      <section style={{ padding: 24 }} role="alert">
        <p>{error ?? "This product is unavailable."}</p>
        {id && <button type="button" onClick={() => void loadProduct()}>Retry</button>}
        <Link to="/dashboard/products">Return to products</Link>
      </section>
    );
  }

  return (
    <section style={{ padding: 24 }}>
      <h2>Edit Product</h2>
      <ProductForm
        key={product.id}
        initialProduct={product}
        submitLabel="Save Changes"
        onSubmit={async (input) => {
          await updateProduct(id, input);
          navigate("/dashboard/products", { replace: true });
        }}
      />
    </section>
  );
}

export default EditProduct;
