import { useNavigate } from "react-router-dom";

import ProductForm from "../components/ProductForm";
import { createProduct } from "../services/productApi";

function AddProduct() {
  const navigate = useNavigate();

  return (
    <section style={{ padding: 24 }}>
      <h2>Add Product</h2>
      <ProductForm
        submitLabel="Create Product"
        onSubmit={async (input) => {
          await createProduct(input);
          navigate("/dashboard/products", { replace: true });
        }}
      />
    </section>
  );
}

export default AddProduct;
