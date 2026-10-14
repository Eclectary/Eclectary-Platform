import api from "./api";
import type { Product } from "../types";

interface ProductsResponse {
  data: Product[];
}

export async function getProducts(): Promise<Product[]> {
  const response = await api.get<ProductsResponse>("/products");
  return response.data.data;
}

export async function getProductsByCategory(
  categoryId: string,
  subcategory?: string
): Promise<Product[]> {
  const products = await getProducts();

  return products.filter((product) => (
    product.category === categoryId &&
    (!subcategory || product.subcategory === subcategory)
  ));
}