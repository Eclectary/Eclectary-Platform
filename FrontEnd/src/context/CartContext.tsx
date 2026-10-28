/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isAxiosError } from 'axios';

import type { Product } from '../types/product';
import { getProductById } from '../services/productApi';

type CartItemStatus = 'available' | 'pending' | 'unavailable';

type CartItem = {
  productId: number;
  quantity: number;
  product: Product | null;
  status: CartItemStatus;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  addToCart: (product: Product, quantity?: number) => void;
  removeItem: (productId: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  calculateSubtotal: () => number;
  isInCart: (productId: number) => boolean;
  totalItems: number;
  subtotal: number;
};

const CART_STORAGE_KEY = 'eclectary-cart';
const CartContext = createContext<CartContextValue | undefined>(undefined);

function normalizeQuantity(quantity: number): number {
  return Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readStoredCart());
  const initialProductIds = useRef(items.map((item) => item.productId));

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    let active = true;

    initialProductIds.current.forEach((productId) => {
      void getProductById(String(productId))
        .then((product) => {
          if (!active) return;

          setItems((currentItems) => currentItems.map((item) => (
            item.productId === productId
              ? { ...item, product, status: 'available' }
              : item
          )));
        })
        .catch((error: unknown) => {
          if (!active || !isNotFound(error)) return;

          setItems((currentItems) => currentItems.map((item) => (
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

  const addItem = useCallback((product: Product, quantity = 1) => {
    const normalizedQuantity = normalizeQuantity(quantity);

    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.productId === product.id);

      if (existingItem) {
        return currentItems.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + normalizedQuantity,
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
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((currentItems) => currentItems.filter((item) => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    setItems((currentItems) => {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return currentItems.filter((item) => item.productId !== productId);
      }

      return currentItems.map((item) =>
        item.productId === productId ? { ...item, quantity: Math.floor(quantity) } : item,
      );
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

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
      addItem,
      addToCart: addItem,
      removeItem,
      removeFromCart: removeItem,
      updateQuantity,
      clearCart,
      calculateSubtotal,
      isInCart: (productId: number) => items.some((item) => item.productId === productId),
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      subtotal,
    };
  }, [items, addItem, removeItem, updateQuantity, clearCart, calculateSubtotal]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
}

export type { CartItem };
