import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCategories } from './categoryApi';
import api from './api';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);

describe('getCategories', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('parses Rails data and merges metadata only by exact slug', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 10, name: 'Digital Art from API', slug: 'digital-art' },
          { id: 11, name: 'Digital Art with another slug', slug: 'digital-art-other' },
        ],
      },
    });

    const categories = await getCategories();

    expect(getMock).toHaveBeenCalledWith('/categories');
    expect(categories).toHaveLength(2);
    expect(categories[0]).toMatchObject({
      id: 'digital-art',
      apiId: 10,
      slug: 'digital-art',
      name: 'Digital Art',
      collection: 'digital-creations',
      image: expect.stringContaining('images.unsplash.com'),
      childSubcategories: expect.arrayContaining(['Digital Illustrations']),
    });
    expect(categories[1]).toMatchObject({
      id: 'digital-art-other',
      apiId: 11,
      name: 'Digital Art with another slug',
    });
    expect(categories[1].image).toBeUndefined();
    expect(categories[1].collection).toBeUndefined();
  });

  it('drops duplicate Rails category IDs and slugs', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 10, name: 'First', slug: 'first' },
          { id: 10, name: 'Duplicate ID', slug: 'second' },
          { id: 12, name: 'Duplicate slug', slug: 'first' },
          { id: 13, name: 'Third', slug: 'third' },
        ],
      },
    });

    await expect(getCategories()).resolves.toMatchObject([
      { id: 'first', apiId: 10, name: 'First' },
      { id: 'third', apiId: 13, name: 'Third' },
    ]);
  });

  it('propagates API failures for the caller to handle', async () => {
    getMock.mockRejectedValue(new Error('Network unavailable'));

    await expect(getCategories()).rejects.toThrow('Network unavailable');
  });
});
