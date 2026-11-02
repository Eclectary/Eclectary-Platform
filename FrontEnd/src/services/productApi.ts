import api from "./api";
import { getProductImageUrl } from "../utils/productImageUrl";
import type { Product } from "../types";

interface ApiProduct extends Omit<Product, "price" | "active"> {
  price: number | string;
  active: boolean;
}

interface ProductsResponse {
  data: ApiProduct[];
}

export interface ProductMutationInput {
  title: string;
  description?: string;
  price: string;
  category_id: number;
  subcategory?: string;
  images?: File[];
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

function productRequestBody(input: ProductMutationInput): FormData | { product: Omit<ProductMutationInput, "images"> } {
  const images = input.images ?? [];
  const attributes = {
    title: input.title,
    description: input.description,
    price: input.price,
    category_id: input.category_id,
    subcategory: input.subcategory,
  };

  if (images.length === 0) {
    return { product: attributes };
  }

  const body = new FormData();
  body.append("product[title]", attributes.title);
  body.append("product[description]", attributes.description ?? "");
  body.append("product[price]", attributes.price);
  body.append("product[category_id]", String(attributes.category_id));
  body.append("product[subcategory]", attributes.subcategory ?? "");
  images.forEach((image) => body.append("product[images][]", image));
  return body;
}

export async function getProducts(): Promise<Product[]> {
  const response = await api.get<ProductsResponse>("/products");
  return response.data.data.map(toProduct);
}

export async function getProductById(id: string): Promise<Product> {
  const response = await api.get<{ data: ApiProduct }>(`/products/${encodeURIComponent(id)}`);
  return toProduct(response.data.data);
}

export async function getSellerProducts(): Promise<Product[]> {
  const response = await api.get<ProductsResponse>("/seller/products");
  return response.data.data.map(toProduct);
}

export async function getSellerProduct(id: string): Promise<Product> {
  const response = await api.get<{ data: ApiProduct }>(`/seller/products/${encodeURIComponent(id)}`);
  return toProduct(response.data.data);
}

export async function createProduct(input: ProductMutationInput): Promise<Product> {
  const response = await api.post<{ data: ApiProduct }>("/seller/products", productRequestBody(input));
  return toProduct(response.data.data);
}

export async function updateProduct(id: string, input: ProductMutationInput): Promise<Product> {
  const response = await api.patch<{ data: ApiProduct }>(
    `/seller/products/${encodeURIComponent(id)}`,
    productRequestBody(input),
  );
  return toProduct(response.data.data);
}

export async function deactivateProduct(id: number | string): Promise<Product> {
  const response = await api.patch<{ data: ApiProduct }>(
    `/seller/products/${encodeURIComponent(String(id))}/deactivate`,
  );
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
