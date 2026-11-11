import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AddProduct from './AddProduct';
import EditProduct from './EditProduct';
import { getCategories } from '../services/categoryApi';
import { createProduct, getSellerProduct, updateProduct } from '../services/productApi';

vi.mock('../services/categoryApi', () => ({ getCategories: vi.fn() }));
vi.mock('../services/productApi', () => ({
  createProduct: vi.fn(),
  getSellerProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

const getCategoriesMock = vi.mocked(getCategories);
const createProductMock = vi.mocked(createProduct);
const getSellerProductMock = vi.mocked(getSellerProduct);
const updateProductMock = vi.mocked(updateProduct);
const product = {
  id: 42,
  active: true,
  title: 'Existing bowl',
  description: 'Existing description',
  price: 18.5,
  creator: 'Maker #7',
  seller_id: 7,
  category: '12',
  category_id: 12,
  subcategory: 'Mugs',
};

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Routes>
        <Route path="/dashboard/products/new" element={<AddProduct />} />
        <Route path="/dashboard/products/:id/edit" element={<EditProduct />} />
        <Route path="/dashboard/products" element={<h2>Product manager</h2>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillRequiredFields() {
  await screen.findByRole('option', { name: 'Ceramics' });
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New bowl' } });
  fireEvent.change(screen.getByLabelText('Price'), { target: { value: '24.95' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: '12' } });
}

beforeEach(() => {
  getCategoriesMock.mockResolvedValue([
    { id: 'ceramics', apiId: 12, name: 'Ceramics', childSubcategories: ['Mugs'] },
  ]);
  createProductMock.mockResolvedValue({ ...product, title: 'New bowl', price: 24.95 });
  getSellerProductMock.mockResolvedValue(product);
  updateProductMock.mockResolvedValue({ ...product, title: 'Updated bowl' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('seller product pages', () => {
  it('navigates only after create persistence succeeds', async () => {
    renderPage('/dashboard/products/new');
    await fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));

    await waitFor(() => expect(createProductMock).toHaveBeenCalled());
    expect(await screen.findByRole('heading', { name: 'Product manager' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/products');
  });

  it('keeps create data and route when persistence fails', async () => {
    createProductMock.mockRejectedValue(new Error('Unavailable'));
    renderPage('/dashboard/products/new');
    await fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save this product.');
    expect(screen.getByLabelText('Title')).toHaveValue('New bowl');
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/products/new');
  });

  it('loads edit data from the private seller detail endpoint and persists updates', async () => {
    renderPage('/dashboard/products/42/edit');

    expect(await screen.findByDisplayValue('Existing bowl')).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Ceramics' });
    expect(getSellerProductMock).toHaveBeenCalledWith('42');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Updated bowl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(updateProductMock).toHaveBeenCalledWith('42', expect.objectContaining({
      title: 'Updated bowl',
      category_id: 12,
      price: '18.5',
    })));
    expect(await screen.findByRole('heading', { name: 'Product manager' })).toBeInTheDocument();
  });

  it('keeps edit values and route when update fails', async () => {
    updateProductMock.mockRejectedValue(new Error('Unavailable'));
    renderPage('/dashboard/products/42/edit');
    expect(await screen.findByDisplayValue('Existing bowl')).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Ceramics' });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unsaved bowl' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save this product.');
    expect(screen.getByLabelText('Title')).toHaveValue('Unsaved bowl');
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard/products/42/edit');
  });
});
