import api from './api';
import type {
  CreateOrderRequest,
  FulfillmentStatus,
  Order,
  SellerOrder,
  SellerOrderItem,
} from '../types/order';

interface OrderApiResponse extends Omit<Order, 'shipping_amount' | 'subtotal' | 'final_total' | 'items'> {
  shipping_amount: number | string;
  subtotal: number | string;
  final_total: number | string;
  items: Array<Omit<Order['items'][number], 'price'> & { price: number | string }>;
}

function normalizeOrder(order: OrderApiResponse): Order {
  return {
    ...order,
    shipping_amount: Number(order.shipping_amount),
    subtotal: Number(order.subtotal),
    final_total: Number(order.final_total),
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price),
    })),
  };
}

interface SellerOrderItemApiResponse extends Omit<SellerOrderItem, 'unit_price' | 'line_total'> {
  unit_price: number | string;
  line_total: number | string;
}

interface SellerOrderApiResponse extends Omit<SellerOrder, 'items'> {
  items: SellerOrderItemApiResponse[];
}

function normalizeSellerOrderItem(item: SellerOrderItemApiResponse): SellerOrderItem {
  return {
    ...item,
    unit_price: Number(item.unit_price),
    line_total: Number(item.line_total),
  };
}

function normalizeSellerOrder(order: SellerOrderApiResponse): SellerOrder {
  return {
    ...order,
    items: order.items.map(normalizeSellerOrderItem),
  };
}

export async function createOrder(
  order: CreateOrderRequest,
  token: string,
  idempotencyKey: string,
): Promise<Order> {
  const response = await api.post<{ data: OrderApiResponse }>('/orders', { order }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
  });
  const createdOrder = response.data.data;

  return normalizeOrder(createdOrder);
}

export async function getOrders(): Promise<Order[]> {
  const response = await api.get<{ data: OrderApiResponse[] }>('/orders');
  const orders = response.data.data || [];

  return orders.map((order) => normalizeOrder(order));
}

export async function getOrder(id: number | string): Promise<Order> {
  const response = await api.get<{ data: OrderApiResponse }>('/orders/' + id);
  const order = response.data.data;

  return normalizeOrder(order);
}

export async function getSellerOrders(): Promise<SellerOrder[]> {
  const response = await api.get<{ data: SellerOrderApiResponse[] }>('/seller/orders');
  return (response.data.data || []).map(normalizeSellerOrder);
}

export async function getSellerOrder(id: number | string): Promise<SellerOrder> {
  const response = await api.get<{ data: SellerOrderApiResponse }>(`/seller/orders/${id}`);
  return normalizeSellerOrder(response.data.data);
}

export async function updateSellerItemFulfillment(
  orderId: number | string,
  itemId: number | string,
  status: FulfillmentStatus,
): Promise<SellerOrderItem> {
  const response = await api.patch<{ data: SellerOrderItemApiResponse }>(
    `/seller/orders/${orderId}/items/${itemId}/fulfillment`,
    { fulfillment: { status } },
  );
  return normalizeSellerOrderItem(response.data.data);
}
