import api from './api';
import { getProductImageUrl } from '../utils/productImageUrl';
import type {
  AddCartItemInput,
  ApiCart,
  ApiCartItem,
  Cart,
  CartMergeRequest,
  CartMergeResponse,
  CartMergeResult,
  CartResponse,
  MappedCartItem,
  UpdateCartItemInput,
} from '../types/cart';

export function mapServerCartItem(item: ApiCartItem): MappedCartItem {
  const { product } = item;
  const price = Number(product.price);

  if ((typeof product.price === 'string' && !product.price.trim()) || !Number.isFinite(price) || price < 0) {
    throw new Error(`Invalid price for product ${product.id}`);
  }

  return {
    serverItemId: item.id,
    productId: item.product_id,
    quantity: item.quantity,
    status: item.status,
    product: {
      ...product,
      description: product.description ?? undefined,
      subcategory: product.subcategory ?? undefined,
      price,
      image: product.image ? getProductImageUrl(product.image) : product.image,
      images: product.images.map(getProductImageUrl),
    },
  };
}

export function mapServerCart(cart: ApiCart): Cart {
  return {
    id: cart.id,
    items: cart.items.map(mapServerCartItem),
  };
}

function sessionHeaders(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function getCart(token: string): Promise<Cart> {
  const response = await api.get<CartResponse>('/cart', sessionHeaders(token));
  return mapServerCart(response.data.data);
}

// Adding an existing product increments its quantity; updating replaces it.
export async function addCartItem(item: AddCartItemInput, token: string): Promise<Cart> {
  const response = await api.post<CartResponse>('/cart/items', { item }, sessionHeaders(token));
  return mapServerCart(response.data.data);
}

export async function updateCartItem(
  serverItemId: number,
  item: UpdateCartItemInput,
  token: string,
): Promise<Cart> {
  const response = await api.patch<CartResponse>(
    `/cart/items/${encodeURIComponent(String(serverItemId))}`,
    { item },
    sessionHeaders(token),
  );
  return mapServerCart(response.data.data);
}

export async function removeCartItem(serverItemId: number, token: string): Promise<Cart> {
  const response = await api.delete<CartResponse>(
    `/cart/items/${encodeURIComponent(String(serverItemId))}`,
    sessionHeaders(token),
  );
  return mapServerCart(response.data.data);
}

export async function clearCart(token: string): Promise<Cart> {
  const response = await api.delete<CartResponse>('/cart/items', sessionHeaders(token));
  return mapServerCart(response.data.data);
}

// Retry the same guest snapshot with the same identifier to avoid adding it twice.
export async function mergeGuestCart(request: CartMergeRequest, token: string): Promise<CartMergeResult> {
  const response = await api.post<CartMergeResponse>('/cart/merge', request, sessionHeaders(token));
  return {
    cart: mapServerCart(response.data.data),
    merge: response.data.merge,
  };
}
