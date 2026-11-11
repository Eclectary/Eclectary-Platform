import type { Product } from './product';

export const MAX_CART_QUANTITY = 99;

export type CartItemAvailability = 'available' | 'unavailable';

export interface ApiCartProduct {
  id: number;
  title: string;
  description: string | null;
  price: number | string;
  active: boolean;
  image: string | null;
  images: string[];
  creator: string;
  seller_id: number;
  category: string;
  category_id: number;
  category_name: string;
  subcategory: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiCartItem {
  id: number;
  product_id: number;
  quantity: number;
  status: CartItemAvailability;
  product: ApiCartProduct;
}

export interface ApiCart {
  id: number;
  items: ApiCartItem[];
}

export interface CartResponse {
  data: ApiCart;
}

// Structurally compatible with the existing CartItem, with the mutation ID retained.
export interface MappedCartItem {
  serverItemId: number;
  productId: number;
  quantity: number;
  product: Product;
  status: CartItemAvailability;
}

export interface Cart {
  id: number;
  items: MappedCartItem[];
}

export interface AddCartItemInput {
  product_id: number;
  quantity?: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}

export interface GuestCartItemInput {
  product_id: number;
  quantity: number;
}

export interface CartMergeRequest {
  merge_identifier: string;
  items: unknown[];
}

export interface CartMergeAddedItem {
  index: number;
  product_id: number;
  quantity: number;
}

export type CartMergeSkippedItem =
  | { index: number; reason: 'invalid_item' }
  | {
      index: number;
      product_id: number | null;
      reason: 'invalid_product_id_or_quantity';
    }
  | { index: number; product_id: number; reason: 'unavailable_product' }
  | {
      index: number;
      product_id: number;
      reason: 'quantity_limit';
      skipped_quantity: number;
    };

export interface CartMergeReport {
  added_items: CartMergeAddedItem[];
  skipped_items: CartMergeSkippedItem[];
  merge_identifier: string;
  repeated: boolean;
}

export interface CartMergeResponse extends CartResponse {
  merge: CartMergeReport;
}

export interface CartMergeResult {
  cart: Cart;
  merge: CartMergeReport;
}

export type CartApiErrorResponse =
  | { errors: string[] }
  | { error: string };
