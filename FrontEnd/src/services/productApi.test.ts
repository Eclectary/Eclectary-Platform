import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';
import { getProductsByCategory } from './productApi';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);

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
