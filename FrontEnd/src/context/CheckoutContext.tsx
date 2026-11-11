import { createContext, useContext } from 'react';

import type { CreateOrderRequest, Order } from '../types/order';

export type CheckoutState =
  | { status: 'idle' }
  | { status: 'pending'; order?: Order }
  | { status: 'success'; order: Order; cartClearWarning: string | null }
  | { status: 'error'; error: string };

type CheckoutContextValue = {
  state: CheckoutState;
  submit: (request: CreateOrderRequest) => boolean;
  dismiss: () => void;
};

export const CheckoutContext = createContext<CheckoutContextValue | undefined>(undefined);

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) throw new Error('useCheckout must be used within a CheckoutProvider');
  return context;
}
