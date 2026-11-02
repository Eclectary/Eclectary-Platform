import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';
import {
  createProduct,
  deactivateProduct,
  getProductById,
  getProducts,
  getProductsByCategory,
  getSellerProduct,
  getSellerProducts,
  updateProduct,
} from './productApi';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const patchMock = vi.mocked(api.patch);

describe('Rails product responses', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
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
    getMock.mockResolvedValue({ data: { data: {
      id: 42,
      title: 'API bowl',
      description: 'Hand-thrown ceramic bowl',
      price: '19.99',
      image: '/rails/active_storage/blobs/redirect/primary/bowl.png',
      images: [
        '/rails/active_storage/blobs/redirect/primary/bowl.png',
        '/rails/active_storage/blobs/redirect/detail/bowl.png',
      ],
      creator: 'Maker #7',
      seller_id: 7,
      category: '12',
      category_id: 12,
      created_at: '2026-10-27T12:00:00.000Z',
      updated_at: '2026-10-27T13:00:00.000Z',
    } } });

    await expect(getProductById('42')).resolves.toEqual({
      id: 42,
      title: 'API bowl',
      description: 'Hand-thrown ceramic bowl',
      price: 19.99,
      image: 'http://localhost:3000/rails/active_storage/blobs/redirect/primary/bowl.png',
      images: [
        'http://localhost:3000/rails/active_storage/blobs/redirect/primary/bowl.png',
        'http://localhost:3000/rails/active_storage/blobs/redirect/detail/bowl.png',
      ],
      creator: 'Maker #7',
      seller_id: 7,
      category: '12',
      category_id: 12,
      created_at: '2026-10-27T12:00:00.000Z',
      updated_at: '2026-10-27T13:00:00.000Z',
    });
    expect(getMock).toHaveBeenCalledWith('/products/42');
  });

  it('normalizes Rails-relative image paths for an individual API product', async () => {
    getMock.mockResolvedValue({ data: { data: {
      id: 42,
      title: 'API bowl',
      price: '19.99',
      creator: 'Maker #7',
      image: '/rails/active_storage/blobs/redirect/signed-id/bowl.png',
      images: [
        '/rails/active_storage/blobs/redirect/signed-id/bowl.png',
        '/rails/active_storage/blobs/redirect/signed-id/bowl-detail.png',
      ],
    } } });

    await expect(getProductById('42')).resolves.toMatchObject({
      image: 'http://localhost:3000/rails/active_storage/blobs/redirect/signed-id/bowl.png',
      images: [
        'http://localhost:3000/rails/active_storage/blobs/redirect/signed-id/bowl.png',
        'http://localhost:3000/rails/active_storage/blobs/redirect/signed-id/bowl-detail.png',
      ],
    });
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

describe('seller product mutations', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
  });

  const responseProduct = {
    id: 42,
    title: 'Seller bowl',
    description: 'Hand-thrown',
    price: '24.95',
    active: true,
    creator: 'Maker #7',
    seller_id: 7,
    category: '12',
    category_id: 12,
  };

  const input = {
    title: 'Seller bowl',
    description: 'Hand-thrown',
    price: '24.95',
    category_id: 12,
    subcategory: 'Bowls',
  };

  it('uses private seller endpoints for list and detail retrieval', async () => {
    getMock
      .mockResolvedValueOnce({ data: { data: [responseProduct] } })
      .mockResolvedValueOnce({ data: { data: responseProduct } });

    await expect(getSellerProducts()).resolves.toMatchObject([{ id: 42, price: 24.95, active: true }]);
    await expect(getSellerProduct('42')).resolves.toMatchObject({ id: 42, price: 24.95, active: true });
    expect(getMock).toHaveBeenNthCalledWith(1, '/seller/products');
    expect(getMock).toHaveBeenNthCalledWith(2, '/seller/products/42');
  });

  it('creates a product with normalized JSON attributes when no files are selected', async () => {
    postMock.mockResolvedValue({ data: { data: responseProduct } });

    await expect(createProduct(input)).resolves.toMatchObject({ id: 42, price: 24.95 });
    expect(postMock).toHaveBeenCalledWith('/seller/products', { product: input });
  });

  it('whitelists mutation attributes and never sends ownership, availability, or collection metadata', async () => {
    postMock.mockResolvedValue({ data: { data: responseProduct } });
    const unsafeInput = {
      ...input,
      seller_id: 99,
      active: false,
      collection: 'purely-handmade',
    } as typeof input;

    await createProduct(unsafeInput);

    const submitted = postMock.mock.calls[0][1] as { product: Record<string, unknown> };
    expect(submitted.product).toEqual(input);
    expect(submitted.product).not.toHaveProperty('seller_id');
    expect(submitted.product).not.toHaveProperty('active');
    expect(submitted.product).not.toHaveProperty('collection');
  });

  it('updates a product and normalizes its response', async () => {
    patchMock.mockResolvedValue({ data: { data: { ...responseProduct, title: 'Updated bowl' } } });

    await expect(updateProduct('42', { ...input, title: 'Updated bowl' }))
      .resolves.toMatchObject({ id: 42, title: 'Updated bowl', price: 24.95 });
    expect(patchMock).toHaveBeenCalledWith('/seller/products/42', {
      product: { ...input, title: 'Updated bowl' },
    });
  });

  it('uses multipart field names for Rails when images are selected', async () => {
    postMock.mockResolvedValue({ data: { data: responseProduct } });
    const image = new File(['image bytes'], 'bowl.webp', { type: 'image/webp' });

    await createProduct({ ...input, images: [image] });

    const body = postMock.mock.calls[0][1] as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('product[title]')).toBe('Seller bowl');
    expect(body.get('product[price]')).toBe('24.95');
    expect(body.get('product[category_id]')).toBe('12');
    expect(body.get('product[images][]')).toBe(image);
    expect(body.has('product[seller_id]')).toBe(false);
    expect(body.has('product[active]')).toBe(false);
  });

  it('deactivates through the dedicated member endpoint', async () => {
    patchMock.mockResolvedValue({ data: { data: { ...responseProduct, active: false } } });

    await expect(deactivateProduct(42)).resolves.toMatchObject({ id: 42, active: false });
    expect(patchMock).toHaveBeenCalledWith('/seller/products/42/deactivate');
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

  it('filters Rails products by numeric category_id and subcategory together', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 1, title: 'Matching ring', price: 10, creator: 'Maker', category_id: 42, subcategory: 'Rings' },
          { id: 2, title: 'Matching necklace', price: 20, creator: 'Maker', category_id: 42, subcategory: 'Necklaces' },
          { id: 3, title: 'Other ring', price: 30, creator: 'Maker', category_id: 43, subcategory: 'Rings' },
        ],
      },
    });

    await expect(getProductsByCategory(42, 'Rings')).resolves.toMatchObject([
      { id: 1, title: 'Matching ring', category_id: 42, subcategory: 'Rings' },
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
