import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';
import { getPublicSellerById, getPublicSellers, registerSeller } from './sellerApi';

vi.mock('./api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const seller = {
  id: 42,
  name: 'Clay Studio',
  image: 'https://example.com/clay.jpg',
  specialty: 'Ceramics',
  bio: 'Handmade bowls.',
};

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
});

describe('public seller API', () => {
  it('uses the shared API client and maps the Rails data envelope', async () => {
    getMock.mockResolvedValue({ data: { data: [seller] } });
    await expect(getPublicSellers()).resolves.toEqual([seller]);
    expect(getMock).toHaveBeenCalledWith('/sellers');
  });

  it('uses a local placeholder and blank optional copy for incomplete profiles', async () => {
    getMock.mockResolvedValue({
      data: { data: [{ id: 42, name: 'Maker #42', image: null, specialty: null, bio: null }] },
    });
    await expect(getPublicSellers()).resolves.toEqual([{
      id: 42, name: 'Maker #42', image: '/favicon.svg', specialty: '', bio: '',
    }]);
  });

  it('returns an empty list when the API has no sellers', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    await expect(getPublicSellers()).resolves.toEqual([]);
  });

  it('fetches a public seller by ID', async () => {
    getMock.mockResolvedValue({ data: { data: seller } });
    await expect(getPublicSellerById('42')).resolves.toEqual(seller);
    expect(getMock).toHaveBeenCalledWith('/sellers/42');
  });

  it('propagates list and detail failures instead of falling back to mock sellers', async () => {
    getMock.mockRejectedValue(new Error('Network unavailable'));
    await expect(getPublicSellers()).rejects.toThrow('Network unavailable');
    await expect(getPublicSellerById('42')).rejects.toThrow('Network unavailable');
  });
});

describe('seller registration API', () => {
  it('promotes the authenticated account with shop fields', async () => {
    const input = {
      public_name: 'Clay Studio',
      specialty: 'Ceramics',
      bio: 'Handmade bowls.',
      image_url: 'https://example.com/clay.jpg',
    };
    const sellerUser = { id: 42, email: 'maker@example.com', role: 'seller' as const, ...input };
    postMock.mockResolvedValue({ data: sellerUser });

    await expect(registerSeller(input)).resolves.toEqual(sellerUser);
    expect(postMock).toHaveBeenCalledWith('/seller/registration', { seller: input });
  });
});
