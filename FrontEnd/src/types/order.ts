export interface CreateOrderItemRequest {
  product_id: number;
  quantity: number;
}

export interface CreateOrderRequest {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  items: CreateOrderItemRequest[];
}

export interface OrderItem {
  id: number;
  product_id: number;
  title: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  user_id: number;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_amount: number;
  subtotal: number;
  final_total: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export type FulfillmentStatus = 'unfulfilled' | 'processing' | 'fulfilled';

export interface SellerOrderItem {
  id: number;
  product_id: number;
  title: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  fulfillment_status: FulfillmentStatus;
}

export interface SellerOrder {
  id: number;
  created_at: string;
  recipient_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  items: SellerOrderItem[];
}
