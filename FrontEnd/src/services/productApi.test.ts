import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';
import { getProductById, getProducts, getProductsByCategory } from './productApi';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);

describe('Rails product responses', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('normalizes Rails decimal prices for all product consumers', async () => {
    getMock.mockResolvedValue({ data: { data: [
      {
        id: 42,
        title: 'API bowl',
        price: '19.99',
        creator: 'Maker #7',
        image: '/rails/active_storage/blobs/redirect/signed-id/bowl.png',
        images: ['/rails/active_storage/blobs/redirect/signed-id/bowl.png'],
      },
      { id: 43, title: 'Free pattern', price: 0, creator: 'Maker #7' },
    ] } });
    const products = await getProducts();
    expect(getMock).toHaveBeenCalledWith('/products');
    expect(products.map((product) => product.price.toFixed(2))).toEqual(['19.99', '0.00']);
    expect(products[0].image).toBe('http://localhost:3000/rails/active_storage/blobs/redirect/signed-id/bowl.png');
    expect(products[0].images).toEqual([products[0].image]);
  });

  it('loads and normalizes an individual API product', async () => {
    getMock.mockResolvedValue({ data: { data: { id: 42, price: '9.99' } } });
    await expect(getProductById('42')).resolves.toMatchObject({ id: 42, price: 9.99 });
    expect(getMock).toHaveBeenCalledWith('/products/42');
  });

  it('resolves backend-relative image paths to the API origin', async () => {
    getMock.mockResolvedValue({ data: { data: [
      { id: 52, title: 'Mocked mug', price: 12, creator: 'Maker', image: '/product-images/moonlit-clay-mug.png' },
    ] } });

    await expect(getProducts()).resolves.toMatchObject([
      { image: 'http://localhost:3000/product-images/moonlit-clay-mug.png' },
    ]);
  });

  it.each(['', 'invalid', 'Infinity', '-1'])('rejects invalid price %s rather than rendering a misleading price', async (price) => {
    getMock.mockResolvedValue({ data: { data: [{ id: 42, price }] } });
    await expect(getProducts()).rejects.toThrow('Invalid price for product 42');
  });

  it('propagates request failures to the page error state', async () => {
    getMock.mockRejectedValue(new Error('Network unavailable'));
    await expect(getProducts()).rejects.toThrow('Network unavailable');
    await expect(getProductById('42')).rejects.toThrow('Network unavailable');
  });
});

describe('getProductsByCategory', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('filters Rails products by the numeric category_id field', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 1, title: 'Matching item', price: 10, creator: 'Maker', category: '42', category_id: 42 },
          { id: 2, title: 'Other item', price: 20, creator: 'Maker', category: '43', category_id: 43 },
        ],
      },
    });

    await expect(getProductsByCategory(42)).resolves.toMatchObject([
      { id: 1, title: 'Matching item', category_id: 42 },
    ]);
  });

  it('preserves filtering for the local slug-based product data', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 1, title: 'Matching item', price: 10, creator: 'Maker', category: 'digital-art' },
          { id: 2, title: 'Other item', price: 20, creator: 'Maker', category: 'handmade-art' },
        ],
      },
    });

    await expect(getProductsByCategory('digital-art')).resolves.toMatchObject([
      { id: 1, title: 'Matching item', category: 'digital-art' },
    ]);
  });
});
