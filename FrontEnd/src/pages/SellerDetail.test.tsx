import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';

import { WishlistProvider } from '../context/WishlistContext';
import { getPublicSellerById } from '../services/sellerApi';
import { getProducts } from '../services/productApi';
import SellerDetail from './SellerDetail';

vi.mock('../services/sellerApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/sellerApi')>(),
  getPublicSellerById: vi.fn(),
}));
vi.mock('../services/productApi', () => ({ getProducts: vi.fn() }));

const getSellerMock = vi.mocked(getPublicSellerById);
const getProductsMock = vi.mocked(getProducts);
const seller = { id: 42, name: 'Clay Studio', image: '/maker.jpg', specialty: 'Clay', bio: 'Public bio' };
const notFoundError = new AxiosError('Not found', '404', undefined, undefined, {
  status: 404, statusText: 'Not Found', data: {}, headers: {}, config: { headers: new AxiosHeaders() },
});

function renderShop(id = '42') {
  return render(
    <MemoryRouter initialEntries={[`/seller/${id}`]}>
      <WishlistProvider>
        <Routes><Route path="/seller/:id" element={<SellerDetail />} /></Routes>
      </WishlistProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getSellerMock.mockReset();
  getProductsMock.mockReset();
  getSellerMock.mockResolvedValue(seller);
  getProductsMock.mockResolvedValue([]);
});
afterEach(cleanup);

describe('public seller shop links', () => {
  it('loads the real seller and filters products by seller ID, not creator name', async () => {
    getProductsMock.mockResolvedValue([
      { id: 1, title: 'Real bowl', price: 25, creator: 'Private account name', seller_id: 42 },
      { id: 2, title: 'Another shop', price: 15, creator: 'Clay Studio', seller_id: 99 },
    ]);
    renderShop();
    expect(screen.getByRole('status')).toHaveTextContent('Loading shop...');
    expect(await screen.findByRole('heading', { name: 'Clay Studio' })).toBeInTheDocument();
    expect(getSellerMock).toHaveBeenCalledWith('42');
    expect(screen.getByRole('heading', { name: 'Real bowl' })).toBeInTheDocument();
    expect(screen.queryByText('Another shop')).not.toBeInTheDocument();
    expect(screen.queryByText('Private account name')).not.toBeInTheDocument();
    expect(screen.queryByText('average rating')).not.toBeInTheDocument();
  });

  it('shows an empty catalog rather than mock products', async () => {
    renderShop();
    expect(await screen.findByText('This maker is preparing their first collection.')).toBeInTheDocument();
  });

  it('shows an explicit network error', async () => {
    getSellerMock.mockRejectedValue(new Error('Network unavailable'));
    renderShop();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this shop.');
  });

  it.each([new Error('Network unavailable'), notFoundError])('does not hide catalog failures behind an empty or missing seller state (%s)', async (error) => {
    getProductsMock.mockRejectedValue(error);
    renderShop();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this shop.');
  });

  it('shows the unavailable shop state for a missing public seller', async () => {
    getSellerMock.mockRejectedValue(notFoundError);
    renderShop();
    expect(await screen.findByRole('heading', { name: 'That shop is unavailable.' })).toBeInTheDocument();
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it('preserves legacy slug-based shop links without requesting numeric API profiles', () => {
    renderShop('moss-atelier');
    expect(screen.getByRole('heading', { name: 'Moss Atelier' })).toBeInTheDocument();
    expect(getSellerMock).not.toHaveBeenCalled();
  });
});
