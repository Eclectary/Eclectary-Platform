import api from "./api";
import { getProductImageUrl } from "../utils/productImageUrl";
import type { Product } from "../types";

interface ApiProduct extends Omit<Product, "price"> {
  price: number | string;
}

interface ProductsResponse {
  data: ApiProduct[];
}

function toProduct(product: ApiProduct): Product {
  const price = Number(product.price);
  if ((typeof product.price === "string" && !product.price.trim()) || !Number.isFinite(price) || price < 0) {
    throw new Error(`Invalid price for product ${product.id}`);
  }
  return {
    ...product,
    image: product.image ? getProductImageUrl(product.image) : product.image,
    images: product.images?.map(getProductImageUrl),
    price,
  };
}

export async function getProducts(): Promise<Product[]> {
  const response = await api.get<ProductsResponse>("/products");
  return response.data.data.map(toProduct);
}

export async function getProductById(id: string): Promise<Product> {
  const response = await api.get<{ data: ApiProduct }>(`/products/${encodeURIComponent(id)}`);
  return toProduct(response.data.data);
}

export async function getProductsByCategory(
  categoryId: string | number,
  subcategory?: string
): Promise<Product[]> {
  const products = await getProducts();

  return products.filter((product) => (
    (typeof categoryId === 'number'
      ? product.category_id === categoryId
      : product.category === categoryId) &&
    (!subcategory || product.subcategory === subcategory)
  ));
}