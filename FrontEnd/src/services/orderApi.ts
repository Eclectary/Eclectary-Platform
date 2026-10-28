import api from './api';
import type { CreateOrderRequest, Order } from '../types/order';

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

export async function createOrder(order: CreateOrderRequest): Promise<Order> {
  const response = await api.post<{ data: OrderApiResponse }>('/orders', { order });
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
