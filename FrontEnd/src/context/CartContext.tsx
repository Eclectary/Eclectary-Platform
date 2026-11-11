/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isAxiosError } from 'axios';

import type { Product } from '../types/product';
import {
  addCartItem,
  clearCart as clearServerCart,
  getCart,
  mergeGuestCart,
  removeCartItem,
  updateCartItem,
} from '../services/cartApi';
import { MAX_CART_QUANTITY } from '../types/cart';
import type { CartMergeResult, CartMergeSkippedItem } from '../types/cart';
import { getProductById } from '../services/productApi';
import { useAuth } from './AuthContext';

type CartItemStatus = 'available' | 'pending' | 'unavailable';

type CartItem = {
  serverItemId?: number;
  productId: number;
  quantity: number;
  product: Product | null;
  status: CartItemStatus;
};

type CartContextValue = {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  mutationLoading: boolean;
  mutationError: string | null;
  mergeLoading: boolean;
  mergeError: string | null;
  mergeRetryable: boolean;
  mergeSkippedItems: CartMergeSkippedItem[];
  retryGuestCartMerge: () => void;
  canModifyCart: boolean;
  addItem: (product: Product, quantity?: number) => void;
  addToCart: (product: Product, quantity?: number) => void;
  removeItem: (productId: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  beginCheckout: () => CheckoutCartReservation | null;
  calculateSubtotal: () => number;
  isInCart: (productId: number) => boolean;
  totalItems: number;
  subtotal: number;
};

type CartSession = {
  userId: number;
  token: string;
};

type CheckoutCartReservation = {
  clear: () => Promise<void>;
  release: () => void;
};

type AccountCartState = {
  session: CartSession;
  items: CartItem[];
  error: string | null;
};

type MutationState = {
  session: CartSession | null;
  loading: boolean;
  error: string | null;
};

type PendingGuestCartTransfer = {
  merge_identifier: string;
  user_id: number;
  source_items: unknown[];
  items: unknown[];
};

type GuestCartMergeState = {
  session: CartSession;
  loading: boolean;
  error: string | null;
  skippedItems: CartMergeSkippedItem[];
  retryable: boolean;
};

const CART_STORAGE_KEY = 'eclectary-cart';
const CART_MERGE_STORAGE_KEY = 'eclectary-cart-merge';
const EMPTY_CART_ITEMS: CartItem[] = [];
const EMPTY_SKIPPED_ITEMS: CartMergeSkippedItem[] = [];
const CartContext = createContext<CartContextValue | undefined>(undefined);

function normalizeQuantity(quantity: number): number {
  return Number.isFinite(quantity)
    ? Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(quantity)))
    : 1;
}

function mutationErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (data && typeof data === 'object') {
      const response = data as { errors?: unknown; error?: unknown };
      if (Array.isArray(response.errors) && typeof response.errors[0] === 'string') {
        return response.errors[0];
      }
      if (typeof response.error === 'string') return response.error;
    }
  }

  return 'We could not update your saved cart. Your cart has not been changed. Please try again.';
}

function readProductSnapshot(value: unknown, productId: number): Product | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const product = value as Partial<Product>;
  const hasValidImage = product.image === undefined
    || product.image === null
    || typeof product.image === 'string';
  const hasValidImages = product.images === undefined
    || (Array.isArray(product.images) && product.images.every((image) => typeof image === 'string'));

  if (
    product.id !== productId
    || typeof product.title !== 'string'
    || !product.title.trim()
    || typeof product.price !== 'number'
    || !Number.isFinite(product.price)
    || product.price < 0
    || typeof product.creator !== 'string'
    || !hasValidImage
    || !hasValidImages
  ) {
    return null;
  }

  return product as Product;
}

function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}

function readStoredCart(): CartItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsedCart = stored ? JSON.parse(stored) : [];

    if (!Array.isArray(parsedCart)) {
      return [];
    }

    const itemsByProductId = parsedCart.reduce<Map<number, CartItem>>((cartItems, item) => {
      if (
        !Number.isInteger(item?.productId)
        || item.productId <= 0
        || typeof item?.quantity !== 'number'
        || item.quantity <= 0
      ) {
        return cartItems;
      }

      const product = readProductSnapshot(item.product, item.productId);
      const existingItem = cartItems.get(item.productId);
      const status: CartItemStatus = product
        ? item.status === 'unavailable' ? 'unavailable' : 'available'
        : 'pending';

      cartItems.set(item.productId, {
        productId: item.productId,
        quantity: normalizeQuantity((existingItem?.quantity ?? 0) + item.quantity),
        product: product ?? existingItem?.product ?? null,
        status: product ? status : existingItem?.status ?? status,
      });

      return cartItems;
    }, new Map<number, CartItem>());

    return [...itemsByProductId.values()];
  } catch {
    return [];
  }
}

function readRawGuestCart(): unknown[] | null {
  const stored = window.localStorage.getItem(CART_STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isValidStoredCartItem(item: unknown): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const record = item as Record<string, unknown>;
  return typeof record.productId === 'number'
    && Number.isInteger(record.productId)
    && record.productId > 0
    && typeof record.quantity === 'number'
    && record.quantity > 0;
}

function readInvalidGuestItems(): unknown[] {
  return (readRawGuestCart() ?? []).filter((item) => !isValidStoredCartItem(item));
}

function toMergeItems(items: unknown[]): unknown[] {
  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const record = item as Record<string, unknown>;

    return {
      ...record,
      product_id: record.product_id ?? record.productId,
    };
  });
}

function readPendingTransfer(): PendingGuestCartTransfer | null {
  const stored = window.localStorage.getItem(CART_MERGE_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      parsed
      && typeof parsed === 'object'
      && typeof (parsed as PendingGuestCartTransfer).merge_identifier === 'string'
      && Number.isInteger((parsed as PendingGuestCartTransfer).user_id)
      && Array.isArray((parsed as PendingGuestCartTransfer).source_items)
      && Array.isArray((parsed as PendingGuestCartTransfer).items)
    ) {
      return parsed as PendingGuestCartTransfer;
    }
  } catch {
    return null;
  }

  return null;
}

function createPendingTransfer(userId: number, items: unknown[]): PendingGuestCartTransfer {
  const transfer: PendingGuestCartTransfer = {
    merge_identifier: crypto.randomUUID(),
    user_id: userId,
    source_items: items,
    items: toMergeItems(items),
  };
  window.localStorage.setItem(CART_MERGE_STORAGE_KEY, JSON.stringify(transfer));
  return transfer;
}

function getRemainingGuestItems(
  sourceItems: unknown[],
  result: CartMergeResult,
): unknown[] {
  const addedByIndex = new Map<number, number>();
  result.merge.added_items.forEach(({ index, quantity }) => {
    addedByIndex.set(index, (addedByIndex.get(index) ?? 0) + quantity);
  });

  return sourceItems.flatMap((item, index) => {
    const addedQuantity = addedByIndex.get(index) ?? 0;
    if (addedQuantity <= 0) return [item];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [item];

    const record = item as Record<string, unknown>;
    const quantity = record.quantity;
    if (typeof quantity !== 'number' || quantity <= addedQuantity) return [];
    return [{ ...record, quantity: quantity - addedQuantity }];
  });
}

function mergeSkippedMessage(skippedItems: CartMergeSkippedItem[]): string {
  if (skippedItems.length === 0) return '';
  return `${skippedItems.length} guest cart ${skippedItems.length === 1 ? 'item could' : 'items could'} not be transferred. They remain in your guest cart.`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, token, loading: authLoading } = useAuth();
  const userId = user?.id;
  const isGuest = !token;
  const session = useMemo<CartSession | null>(() => (
    !authLoading && userId !== undefined && token ? { userId, token } : null
  ), [authLoading, userId, token]);
  const [guestItems, setGuestItems] = useState<CartItem[]>(() => readStoredCart());
  const [invalidGuestItems, setInvalidGuestItems] = useState<unknown[]>(() => readInvalidGuestItems());
  const [accountCart, setAccountCart] = useState<AccountCartState | null>(null);
  const [mutationState, setMutationState] = useState<MutationState | null>(null);
  const [guestMergeState, setGuestMergeState] = useState<GuestCartMergeState | null>(null);
  const [mergeRetryVersion, setMergeRetryVersion] = useState(0);
  const activeSessionRef = useRef(session);
  const inFlightMutationRef = useRef<{ session: CartSession | null } | null>(null);
  const inFlightMergeRef = useRef(new Map<string, Promise<CartMergeResult>>());
  const initialProductIds = useRef(guestItems.map((item) => item.productId));
  const previousGuestStateRef = useRef(isGuest);

  useLayoutEffect(() => {
    activeSessionRef.current = session;
  }, [session]);

  // Session identity hides old account data during the render, before effect cleanup.
  const currentAccountCart = accountCart?.session === session ? accountCart : null;
  const currentMutationState = mutationState?.session === session ? mutationState : null;
  const mutationLoading = currentMutationState?.loading ?? false;
  const currentMergeState = guestMergeState?.session === session ? guestMergeState : null;
  const mergeLoading = currentMergeState?.loading ?? false;
  const mergeError = currentMergeState?.error ?? null;
  const mergeRetryable = currentMergeState?.retryable ?? false;
  const mergeSkippedItems = currentMergeState?.skippedItems ?? EMPTY_SKIPPED_ITEMS;
  const items = isGuest ? guestItems : currentAccountCart?.items ?? EMPTY_CART_ITEMS;
  const loading = !isGuest && (!session || !currentAccountCart);
  const error = isGuest ? null : currentAccountCart?.error ?? null;
  const mutationError = currentMutationState?.error ?? null;

  useEffect(() => {
    const returnedToGuest = isGuest && !previousGuestStateRef.current;
    previousGuestStateRef.current = isGuest;
    if (returnedToGuest) return;
    if (isGuest) {
      if (readRawGuestCart() !== null) {
        window.localStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify([...guestItems, ...invalidGuestItems]),
        );
      }
    }
  }, [guestItems, invalidGuestItems, isGuest]);

  useEffect(() => {
    let active = true;

    if (!session) return;

    const loadAccountCart = async () => {
      let mergeAttempted = false;
      try {
        let transfer = readPendingTransfer();
        if (!transfer && window.localStorage.getItem(CART_MERGE_STORAGE_KEY)) {
          setGuestMergeState({
            session,
            loading: false,
            error: 'A previous guest cart transfer could not be resumed safely. Your guest items are preserved.',
            skippedItems: [],
            retryable: false,
          });
          const cart = await getCart(session.token);
          if (active && activeSessionRef.current === session) {
            setAccountCart({ session, items: cart.items, error: null });
          }
          return;
        }
        if (!transfer) {
          const guestItems = readRawGuestCart();
          if (guestItems === null) {
            setGuestMergeState({
              session,
              loading: false,
              error: 'Your guest cart could not be read, so its items were kept. Please check the saved cart data and retry.',
              skippedItems: [],
              retryable: false,
            });
            const cart = await getCart(session.token);
            if (active && activeSessionRef.current === session) {
              setAccountCart({ session, items: cart.items, error: null });
            }
            return;
          }
          if (guestItems.length > 0) {
            transfer = createPendingTransfer(session.userId, guestItems);
          }
        }

        if (transfer && transfer.user_id !== session.userId) {
          setGuestMergeState({
            session,
            loading: false,
            error: 'Guest items are awaiting confirmation in another account. Sign in to that account to finish the transfer; your guest items are preserved.',
            skippedItems: [],
            retryable: false,
          });
          const cart = await getCart(session.token);
          if (active && activeSessionRef.current === session) {
            setAccountCart({ session, items: cart.items, error: null });
          }
          return;
        }

        if (!transfer) {
          const cart = await getCart(session.token);
          if (active && activeSessionRef.current === session) {
            setAccountCart({ session, items: cart.items, error: null });
          }
          return;
        }

        setGuestMergeState({
          session,
          loading: true,
          error: null,
          skippedItems: [],
          retryable: false,
        });
        mergeAttempted = true;
        const requestKey = JSON.stringify([session.userId, session.token, transfer.merge_identifier]);
        let request = inFlightMergeRef.current.get(requestKey);
        if (!request) {
          request = mergeGuestCart({
            merge_identifier: transfer.merge_identifier,
            items: transfer.items,
          }, session.token);
          inFlightMergeRef.current.set(requestKey, request);
          void request.then(() => {
            if (inFlightMergeRef.current.get(requestKey) === request) {
              inFlightMergeRef.current.delete(requestKey);
            }
          }, () => {
            if (inFlightMergeRef.current.get(requestKey) === request) {
              inFlightMergeRef.current.delete(requestKey);
            }
          });
        }
        const result = await request;
        if (!active || activeSessionRef.current !== session) return;

        const storedTransfer = readPendingTransfer();
        const storedGuestItems = readRawGuestCart();
        if (
          storedTransfer?.merge_identifier !== transfer.merge_identifier
          || !storedGuestItems
          || JSON.stringify(storedGuestItems) !== JSON.stringify(transfer.source_items)
        ) {
          setGuestMergeState({
            session,
            loading: false,
            error: 'Your guest cart changed during transfer. The saved items were kept; review your guest cart before retrying.',
            skippedItems: result.merge.skipped_items,
            retryable: false,
          });
          setAccountCart({ session, items: result.cart.items, error: null });
          return;
        }

        const remainingItems = getRemainingGuestItems(transfer.source_items, result);
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(remainingItems));
        window.localStorage.removeItem(CART_MERGE_STORAGE_KEY);
        setGuestItems(readStoredCart());
        setInvalidGuestItems(remainingItems.filter((item) => !isValidStoredCartItem(item)));
        setAccountCart({ session, items: result.cart.items, error: null });
        const skippedItems = result.merge.skipped_items;
        setGuestMergeState({
          session,
          loading: false,
          error: mergeSkippedMessage(skippedItems) || null,
          skippedItems,
          retryable: skippedItems.length > 0,
        });
      } catch {
        if (!active || activeSessionRef.current !== session) return;
        if (!mergeAttempted) {
          setAccountCart({
            session,
            items: [],
            error: 'We could not load your saved cart. Please reload to try again.',
          });
          return;
        }
        setGuestMergeState({
          session,
          loading: false,
          error: 'We could not transfer your guest cart. Your guest items are preserved. Retry to try again safely.',
          skippedItems: [],
          retryable: true,
        });
        try {
          const cart = await getCart(session.token);
          if (active && activeSessionRef.current === session) {
            setAccountCart({ session, items: cart.items, error: null });
          }
        } catch {
          if (active && activeSessionRef.current === session) {
            setAccountCart({
              session,
              items: [],
              error: 'We could not load your saved cart. Please reload to try again.',
            });
          }
        }
      }
    };

    void loadAccountCart();

    return () => {
      active = false;
    };
  }, [mergeRetryVersion, session]);

  useEffect(() => {
    let active = true;

    initialProductIds.current.forEach((productId) => {
      void getProductById(String(productId))
        .then((product) => {
          if (!active) return;

          setGuestItems((currentItems) => currentItems.map((item) => (
            item.productId === productId
              ? { ...item, product, status: 'available' }
              : item
          )));
        })
        .catch((error: unknown) => {
          if (!active || !isNotFound(error)) return;

          setGuestItems((currentItems) => currentItems.map((item) => (
            item.productId === productId
              ? { ...item, status: 'unavailable' }
              : item
          )));
        });
    });

    return () => {
      active = false;
    };
  }, []);

  const runAccountMutation = useCallback(async (mutation: (session: CartSession) => Promise<{ items: CartItem[] }>) => {
    if (!session || !currentAccountCart || currentAccountCart.error) {
      setMutationState({
        session,
        loading: false,
        error: 'Your saved cart is still loading. Please try again.',
      });
      return;
    }
    if (inFlightMutationRef.current?.session === session) return;

    const operation = { session };
    inFlightMutationRef.current = operation;
    setMutationState({ session, loading: true, error: null });
    try {
      const updatedCart = await mutation(session);
      if (activeSessionRef.current === session) {
        setAccountCart({ session, items: updatedCart.items, error: null });
        setMutationState({ session, loading: false, error: null });
      }
    } catch (mutationError) {
      if (activeSessionRef.current === session) {
        setMutationState({
          session,
          loading: false,
          error: mutationErrorMessage(mutationError),
        });
      }
    } finally {
      if (inFlightMutationRef.current === operation) {
        inFlightMutationRef.current = null;
      }
    }
  }, [currentAccountCart, session]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    const normalizedQuantity = normalizeQuantity(quantity);

    if (!isGuest) {
      void runAccountMutation((session) => addCartItem({
        product_id: product.id,
        quantity: normalizedQuantity,
      }, session.token));
      return;
    }

    setGuestItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.productId === product.id);

      if (existingItem) {
        return currentItems.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: Math.min(MAX_CART_QUANTITY, item.quantity + normalizedQuantity),
                product,
                status: 'available',
              }
            : item,
        );
      }

      return [
        ...currentItems,
        {
          productId: product.id,
          quantity: normalizedQuantity,
          product,
          status: 'available',
        },
      ];
    });
  }, [isGuest, runAccountMutation]);

  const removeItem = useCallback((productId: number) => {
    if (!isGuest) {
      const item = currentAccountCart?.items.find((cartItem) => cartItem.productId === productId);
      const serverItemId = item?.serverItemId;
      if (serverItemId === undefined) {
        setMutationState({
          session,
          loading: false,
          error: 'That item could not be found in your saved cart. Please reload and try again.',
        });
        return;
      }
      void runAccountMutation((session) => removeCartItem(serverItemId, session.token));
      return;
    }

    setGuestItems((currentItems) => currentItems.filter((item) => item.productId !== productId));
  }, [currentAccountCart, isGuest, runAccountMutation, session]);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (!isGuest) {
      const item = currentAccountCart?.items.find((cartItem) => cartItem.productId === productId);
      const serverItemId = item?.serverItemId;
      if (serverItemId === undefined) {
        setMutationState({
          session,
          loading: false,
          error: 'That item could not be found in your saved cart. Please reload and try again.',
        });
        return;
      }
      void runAccountMutation((session) => updateCartItem(serverItemId, {
        quantity: normalizeQuantity(quantity),
      }, session.token));
      return;
    }

    setGuestItems((currentItems) => {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return currentItems.filter((item) => item.productId !== productId);
      }

      return currentItems.map((item) =>
        item.productId === productId
          ? { ...item, quantity: normalizeQuantity(quantity) }
          : item,
      );
    });
  }, [currentAccountCart, isGuest, runAccountMutation, session]);

  const clearCart = useCallback(() => {
    if (!isGuest) {
      void runAccountMutation((session) => clearServerCart(session.token));
      return;
    }

    setGuestItems([]);
    setInvalidGuestItems([]);
  }, [isGuest, runAccountMutation]);

  const beginCheckout = useCallback((): CheckoutCartReservation | null => {
    if (
      !session
      || activeSessionRef.current !== session
      || !currentAccountCart
      || currentAccountCart.error
      || inFlightMutationRef.current?.session === session
      || currentMergeState?.loading
    ) return null;

    const operation = { session };
    inFlightMutationRef.current = operation;
    setMutationState({ session, loading: true, error: null });

    return {
      clear: async () => {
        if (activeSessionRef.current !== session || inFlightMutationRef.current !== operation) {
          throw new Error('Checkout session has changed.');
        }
        try {
          const cart = await clearServerCart(session.token);
          if (activeSessionRef.current === session) {
            setAccountCart({ session, items: cart.items, error: null });
          }
        } catch (error) {
          if (activeSessionRef.current === session) {
            setMutationState({ session, loading: true, error: mutationErrorMessage(error) });
          }
          throw error;
        }
      },
      release: () => {
        if (inFlightMutationRef.current === operation) {
          inFlightMutationRef.current = null;
          if (activeSessionRef.current === session) {
            setMutationState((current) => (
              current?.session === session ? { ...current, loading: false } : current
            ));
          }
        }
      },
    };
  }, [session, currentAccountCart, currentMergeState]);

  const retryGuestCartMerge = useCallback(() => {
    if (!currentMergeState?.retryable || !session) return;
    setGuestMergeState({ ...currentMergeState, loading: true, error: null });
    setMergeRetryVersion((version) => version + 1);
  }, [currentMergeState, session]);

  const calculateSubtotal = useCallback(() => items.reduce((total, item) => {
    return total + (
      item.status === 'available' && item.product
        ? item.product.price * item.quantity
        : 0
    );
  }, 0), [items]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = calculateSubtotal();

    return {
      items,
      loading,
      error,
      mutationLoading,
      mutationError,
      mergeLoading,
      mergeError,
      mergeRetryable,
      mergeSkippedItems,
      retryGuestCartMerge,
      canModifyCart: isGuest || Boolean(session && currentAccountCart && !currentAccountCart.error && !mutationLoading),
      addItem,
      addToCart: addItem,
      removeItem,
      removeFromCart: removeItem,
      updateQuantity,
      clearCart,
      beginCheckout,
      calculateSubtotal,
      isInCart: (productId: number) => items.some((item) => item.productId === productId),
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      subtotal,
    };
  }, [items, loading, error, mutationLoading, mutationError, mergeLoading, mergeError, mergeRetryable, mergeSkippedItems, retryGuestCartMerge, isGuest, session, currentAccountCart, addItem, removeItem, updateQuantity, clearCart, beginCheckout, calculateSubtotal]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
}

export type { CartItem };
