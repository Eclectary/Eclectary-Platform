import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductForm from './ProductForm';
import { getCategories } from '../services/categoryApi';

vi.mock('../services/categoryApi', () => ({
  getCategories: vi.fn(),
}));

const getCategoriesMock = vi.mocked(getCategories);
const categories = [
  { id: 'ceramics', apiId: 12, name: 'Ceramics', childSubcategories: ['Bowls', 'Mugs'] },
];

beforeEach(() => {
  getCategoriesMock.mockResolvedValue(categories);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProductForm', () => {
  it.each([
    [422, "Title can't be blank."],
    [403, 'You cannot edit this product.'],
    [409, 'This product has changed. Please reload.'],
    [429, 'Too many requests. Please try again later.'],
  ] as const)('shows a safe server message for HTTP %s and preserves entered values', async (status, message) => {
    const onSubmit = vi.fn().mockRejectedValue({
      isAxiosError: true, response: { status, data: { errors: [message] } },
    });
    render(<ProductForm submitLabel="Create Product" onSubmit={onSubmit} />);
    await screen.findByRole('option', { name: 'Ceramics' });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Clay bowl' } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '24.95' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Title')).toHaveValue('Clay bowl');
  });

  it('does not expose server exception details on save', async () => {
    const onSubmit = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { errors: ['Private server details'] } },
    });
    render(<ProductForm submitLabel="Create Product" onSubmit={onSubmit} />);
    await screen.findByRole('option', { name: 'Ceramics' });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Clay bowl' } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '24.95' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save this product.');
    expect(screen.queryByText(/Private server details/)).not.toBeInTheDocument();
  });

  it('validates title, decimal price, and a Rails category ID before submission', async () => {
    const onSubmit = vi.fn();
    render(<ProductForm submitLabel="Create Product" onSubmit={onSubmit} />);
    await screen.findByRole('option', { name: 'Ceramics' });

    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '-1' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Product' }).closest('form')!);

    expect(screen.getByText('Enter a product title.')).toBeInTheDocument();
    expect(screen.getByText('Enter a nonnegative decimal price.')).toBeInTheDocument();
    expect(screen.getByText('Choose a valid category.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the numeric category ID and a decimal string', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductForm submitLabel="Create Product" onSubmit={onSubmit} />);
    await screen.findByRole('option', { name: 'Ceramics' });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Clay bowl  ' } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '24.95' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText(/Subcategory/), { target: { value: 'Bowls' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Clay bowl',
      price: '24.95',
      category_id: 12,
      subcategory: 'Bowls',
    })));
  });

  it('accepts zero price and keeps description and subcategory optional', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductForm submitLabel="Create Product" onSubmit={onSubmit} />);
    await screen.findByRole('option', { name: 'Ceramics' });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Free pattern' } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '0.00' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      price: '0.00',
      description: '',
      subcategory: '',
    })));
  });

  it.each(['-1', 'not-a-price', 'NaN', 'Infinity'])('rejects invalid price %s', async (price) => {
    const onSubmit = vi.fn();
    render(<ProductForm submitLabel="Create Product" onSubmit={onSubmit} />);
    await screen.findByRole('option', { name: 'Ceramics' });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Clay bowl' } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: price } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));

    expect(screen.getByText('Enter a nonnegative decimal price.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits selected image files', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductForm submitLabel="Create Product" onSubmit={onSubmit} />);
    await screen.findByRole('option', { name: 'Ceramics' });
    const image = new File(['image bytes'], 'bowl.png', { type: 'image/png' });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Clay bowl' } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '12.00' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText(/^Images/), { target: { files: [image] } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ images: [image] })));
  });

  it('prevents duplicate submission while a save is pending', async () => {
    let resolveSave!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    render(<ProductForm submitLabel="Create Product" onSubmit={onSubmit} />);
    await screen.findByRole('option', { name: 'Ceramics' });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Clay bowl' } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '12.00' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));
    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Saving...' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => resolveSave());
  });

  it('preserves entered values and reports a failed save', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Unavailable'));
    render(<ProductForm submitLabel="Create Product" onSubmit={onSubmit} />);
    await screen.findByRole('option', { name: 'Ceramics' });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Clay bowl' } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '24.95' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save this product. Please try again.');
    expect(screen.getByLabelText('Title')).toHaveValue('Clay bowl');
    expect(screen.getByLabelText('Price')).toHaveValue('24.95');
    expect(screen.getByLabelText('Category')).toHaveValue('12');
  });

  it('loads edit values and accepts only the supported image formats', async () => {
    render(
      <ProductForm
        submitLabel="Save Changes"
        onSubmit={vi.fn()}
        initialProduct={{
          id: 42,
          title: 'Existing bowl',
          description: 'Existing description',
          price: 18.5,
          active: false,
          creator: 'Maker #7',
          category_id: 12,
          subcategory: 'Mugs',
          images: ['/existing.png'],
        }}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Category')).toHaveValue('12'));
    expect(screen.getByLabelText('Title')).toHaveValue('Existing bowl');
    expect(screen.getByLabelText('Price')).toHaveValue('18.5');
    expect(screen.getByRole('region', { name: 'Existing product images' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Add images/)).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  });

  it('shows category loading failures independently and retries', async () => {
    getCategoriesMock.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(categories);
    render(<ProductForm submitLabel="Create Product" onSubmit={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load categories.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry categories' }));

    expect(await screen.findByRole('option', { name: 'Ceramics' })).toBeInTheDocument();
  });
});
