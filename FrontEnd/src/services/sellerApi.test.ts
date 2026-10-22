import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';
import { getPublicSellerById, getPublicSellers } from './sellerApi';

vi.mock('./api', () => ({ default: { get: vi.fn() } }));
const getMock = vi.mocked(api.get);
const seller = {
  id: 42,
  name: 'Clay Studio',
  image: 'https://example.com/clay.jpg',
  specialty: 'Ceramics',
  bio: 'Handmade bowls.',
};

beforeEach(() => { getMock.mockReset(); });

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
