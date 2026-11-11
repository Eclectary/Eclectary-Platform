import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { createOrder } from '../services/orderApi';
import type { CreateOrderRequest, Order } from '../types/order';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { CheckoutContext } from './CheckoutContext';
import type { CheckoutState } from './CheckoutContext';

const IDLE: CheckoutState = { status: 'idle' };

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const { user, token, loading } = useAuth();
  const { beginCheckout } = useCart();
  const userId = user?.id;
  const activeSessionRef = useRef<{ userId: number; token: string } | null>(null);
  const recordsRef = useRef(new Map<number, CheckoutState>());
  const [records, setRecords] = useState<Map<number, CheckoutState>>(() => new Map());

  useLayoutEffect(() => {
    activeSessionRef.current = !loading && userId !== undefined && token
      ? { userId, token }
      : null;
  }, [loading, userId, token]);

  const updateRecord = useCallback((accountId: number, state: CheckoutState) => {
    recordsRef.current.set(accountId, state);
    setRecords(new Map(recordsRef.current));
  }, []);

  const submit = useCallback((request: CreateOrderRequest): boolean => {
    const active = activeSessionRef.current;
    if (
      loading || userId === undefined || !token
      || !active || active.userId !== userId || active.token !== token
      || recordsRef.current.has(userId)
    ) return false;

    const reservation = beginCheckout();
    if (!reservation) {
      updateRecord(userId, {
        status: 'error',
        error: 'Your cart is not ready for checkout. Please wait and try again.',
      });
      return false;
    }

    updateRecord(userId, { status: 'pending' });
    void (async () => {
      try {
        let order: Order;
        try {
          order = await createOrder(request, token);
        } catch {
          updateRecord(userId, {
            status: 'error',
            error: 'We could not confirm your order. Your cart has been kept. Check your orders before trying again.',
          });
          return;
        }

        if (order.user_id !== userId) {
          updateRecord(userId, {
            status: 'error',
            error: 'We could not confirm the account for your order. Your cart has been kept. Check your orders before trying again.',
          });
          return;
        }

        updateRecord(userId, { status: 'pending', order });
        let cartClearWarning: string | null = null;
        try {
          await reservation.clear();
        } catch {
          cartClearWarning = 'Your order was created, but your saved cart could not be cleared. Please review your cart before placing another order.';
        }
        updateRecord(userId, { status: 'success', order, cartClearWarning });
      } finally {
        reservation.release();
      }
    })();

    return true;
  }, [beginCheckout, loading, token, updateRecord, userId]);

  const dismiss = useCallback(() => {
    const active = activeSessionRef.current;
    if (
      loading || userId === undefined || !token
      || !active || active.userId !== userId || active.token !== token
      || recordsRef.current.get(userId)?.status === 'pending'
    ) return;

    recordsRef.current.delete(userId);
    setRecords(new Map(recordsRef.current));
  }, [loading, token, userId]);

  const state = !loading && userId !== undefined && token
    ? records.get(userId) ?? IDLE
    : IDLE;

  return (
    <CheckoutContext.Provider value={{ state, submit, dismiss }}>
      {children}
    </CheckoutContext.Provider>
  );
}
