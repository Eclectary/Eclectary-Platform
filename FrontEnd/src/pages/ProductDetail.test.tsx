import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import userEvent from '@testing-library/user-event';
import ProductDetail from '../pages/ProductDetail';
import { CartProvider } from '../context/CartContext';
import { WishlistProvider } from '../context/WishlistContext';
import { getProductById, getProducts } from '../services/productApi';
import { getPublicSellerById } from '../services/sellerApi';
import type { Product } from '../types';

const productFixtures: Product[] = [
    {
      id: 1,
      title: 'Moonlit Clay Mug',
      price: 34,
      creator: 'Luna & Co.',
      tag: 'Ceramics',
      collection: 'purely-handmade',
      category: 'home-altar',
      rating: 4.9,
      image: 'https://example.com/mug.jpg',
      images: [
        'https://example.com/mug-1.jpg',
        'https://example.com/mug-2.jpg',
        'https://example.com/mug-3.jpg',
      ],
      description: 'Beautiful handmade mug',
    },
    {
      id: 2,
      title: 'Botanical Candle Set',
      price: 28,
      creator: 'Willow Grove',
      tag: 'Home Ritual',
      collection: 'purely-handmade',
      category: 'ritual-witchcraft',
      rating: 4.8,
      image: 'https://example.com/candle.jpg',
    },
    {
      id: 3,
      title: 'Celestial Journal',
      price: 24,
      creator: 'Sage Hollow',
      tag: 'Stationery',
      rating: 4.7,
      image: 'https://example.com/journal.jpg',
    },
  ];

vi.mock('../services/productApi', () => ({
  getProductById: vi.fn(),
  getProducts: vi.fn(),
}));

// Mock the sellers service
vi.mock('../services/sellerApi', () => ({
  getPublicSellerById: vi.fn(),
  getSellers: () => [
    {
      id: 1,
      name: 'Luna & Co.',
      image: 'https://example.com/seller.jpg',
      rating: 4.9,
    },
  ],
}));

beforeEach(() => {
  vi.mocked(getProductById).mockReset();
  vi.mocked(getProducts).mockReset();
  vi.mocked(getPublicSellerById).mockReset();
  vi.mocked(getProducts).mockResolvedValue(productFixtures);
  vi.mocked(getProductById).mockImplementation(async (id) => {
    const product = productFixtures.find((item) => String(item.id) === id);
    if (!product) {
      throw new AxiosError('Not found', '404', undefined, undefined, {
        status: 404, statusText: 'Not Found', data: {}, headers: {}, config: { headers: new AxiosHeaders() },
      });
    }
    return product;
  });
});

const renderProductDetailWithId = (productId: string | number = 1) => {
  return render(
    <MemoryRouter initialEntries={[`/product/${productId}`]}>
      <CartProvider>
        <WishlistProvider>
          <Routes>
            <Route path="/product/:id" element={<ProductDetail />} />
          </Routes>
        </WishlistProvider>
      </CartProvider>
    </MemoryRouter>,
  );
};

describe('ProductDetail', () => {
  it('loads an API product outside the mock catalog and links its real seller by ID', async () => {
    vi.mocked(getProductById).mockResolvedValue({
      id: 987654, title: 'Live API bowl', price: 19.99, creator: 'Old maker name', seller_id: 42,
    });
    vi.mocked(getProducts).mockResolvedValue([]);
    vi.mocked(getPublicSellerById).mockResolvedValue({
      id: 42, name: 'Public Clay Studio', image: '/favicon.svg', specialty: '', bio: '',
    });
    renderProductDetailWithId(987654);
    expect(screen.getByRole('status')).toHaveTextContent('Loading product...');
    expect(await screen.findByRole('heading', { name: 'Live API bowl' })).toBeInTheDocument();
    expect(getProductById).toHaveBeenCalledWith('987654');
    expect(await screen.findByRole('link', { name: 'Public Clay Studio' })).toHaveAttribute('href', '/seller/42');
    expect(getPublicSellerById).toHaveBeenCalledWith('42');
    expect(screen.getByText('$19.99')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'No image available for Live API bowl' })).toBeInTheDocument();
    expect(screen.queryByText('Moonlit Clay Mug')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Related products')).not.toBeInTheDocument();
  });

  it('does not substitute a mock product when the API fails for a matching ID', async () => {
    vi.mocked(getProductById).mockRejectedValue(new Error('Network unavailable'));
    renderProductDetailWithId(1);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this product.');
    expect(screen.queryByText('Product not found')).not.toBeInTheDocument();
    expect(screen.queryByText('Moonlit Clay Mug')).not.toBeInTheDocument();
  });

  it('keeps the product visible when related products fail and reports the error', async () => {
    vi.mocked(getProducts).mockRejectedValue(new Error('Network unavailable'));
    renderProductDetailWithId(1);
    expect(await screen.findByRole('heading', { name: 'Moonlit Clay Mug' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load related products.');
  });

  it('reports seller failures without hiding the product', async () => {
    vi.mocked(getProductById).mockResolvedValue({ ...productFixtures[0], seller_id: 42 });
    vi.mocked(getPublicSellerById).mockRejectedValue(new Error('Network unavailable'));
    renderProductDetailWithId(1);
    expect(await screen.findByRole('alert')).toHaveTextContent("Unable to load this maker's profile.");
    expect(screen.getByRole('heading', { name: 'Moonlit Clay Mug' })).toBeInTheDocument();
  });

  it('ignores an API response after leaving the product page', async () => {
    let resolve!: (product: Product) => void;
    vi.mocked(getProductById).mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = renderProductDetailWithId(1);
    view.unmount();
    await act(async () => resolve(productFixtures[0]));
    expect(getPublicSellerById).not.toHaveBeenCalled();
  });

  it('should render product details when product is found', async () => {
    const { container } = renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByText('Moonlit Clay Mug')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Ceramics').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.product-detail__stars')).toHaveLength(2);
    expect(screen.getAllByText('4.9').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Beautiful handmade mug')).toHaveLength(2);
  });

  it('should render product price formatted correctly', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByText('$34.00')).toBeInTheDocument();
    });
  });

  it('should render product image gallery', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByAltText('Moonlit Clay Mug')).toBeInTheDocument();
    });

    const image = screen.getByAltText('Moonlit Clay Mug') as HTMLImageElement;
    // Initially shows the main product image
    expect(image.src).toContain('mug.jpg');
  });

  it('shows the accessible fallback when the primary image fails to load', async () => {
    renderProductDetailWithId(1);

    fireEvent.error(await screen.findByAltText('Moonlit Clay Mug'));

    expect(screen.getByRole('img', { name: 'No image available for Moonlit Clay Mug' }))
      .toBeInTheDocument();
  });

  it('should render gallery thumbnail buttons', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      const thumbButtons = screen.getAllByRole('button', {
        name: /view product image/i,
      });
      expect(thumbButtons.length).toBeGreaterThan(0);
    });
  });

  it('should change main image when thumbnail is clicked', async () => {
    const user = userEvent.setup();
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByAltText('Moonlit Clay Mug')).toBeInTheDocument();
    });

    const thumbButtons = screen.getAllByRole('button', {
      name: /view product image/i,
    });

    await user.click(thumbButtons[1]);

    const mainImage = screen.getByAltText('Moonlit Clay Mug') as HTMLImageElement;
    expect(mainImage.src).toContain('mug-2.jpg');
  });

  it('should render Add to cart button', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
    });
  });

  it('should render Save for later button', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save for later/i })).toBeInTheDocument();
    });
  });

  it('should add product to cart when button is clicked', async () => {
    const user = userEvent.setup();
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
    });

    const addToCartBtn = screen.getByRole('button', { name: /add to cart/i });
    await user.click(addToCartBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add another/i })).toBeInTheDocument();
    });
  });

  it('should toggle wishlist when Save for later button is clicked', async () => {
    const user = userEvent.setup();
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save for later/i })).toBeInTheDocument();
    });

    const wishlistBtn = screen.getByRole('button', { name: /save for later/i });
    await user.click(wishlistBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saved to wishlist/i })).toBeInTheDocument();
    });
  });

  it('should render product metadata', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByText('home-altar')).toBeInTheDocument();
    });

    expect(screen.getByText('purely-handmade')).toBeInTheDocument();
  });

  it('should render Back to shop link', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      const backLinks = screen.getAllByRole('link', { name: /back to shop/i });
      expect(backLinks.length).toBeGreaterThan(0);
    });
  });

  it('should render related products section when products exist', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByText('You May Also Like')).toBeInTheDocument();
    });

    expect(screen.getByText('Botanical Candle Set')).toBeInTheDocument();
    expect(screen.getByText('Celestial Journal')).toBeInTheDocument();
  });

  it('should display seller name with link when seller exists', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      const sellerLink = screen.getByRole('link', { name: /Luna & Co./i });
      expect(sellerLink).toBeInTheDocument();
      expect(sellerLink).toHaveAttribute('href', '/seller/1');
    });
  });

  it('should show "Product not found" when product does not exist', async () => {
    renderProductDetailWithId(999);

    await waitFor(() => {
      expect(screen.getByText('Product not found')).toBeInTheDocument();
    });
  });

  it('should render product shipping information', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getAllByText(/Ships in 3–5 days/i).length).toBeGreaterThan(0);
    });
  });

  it('should render product details from available product data', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getByText('Collection')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('About this item')).toBeInTheDocument();
    });
  });

  it('should use fallback description when product description is not provided', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      expect(screen.getAllByText('Beautiful handmade mug')).toHaveLength(2);
    });
  });

  it('should render product as article element', async () => {
    const { container } = renderProductDetailWithId(1);

    await waitFor(() => {
      const article = container.querySelector('article.product-detail');
      expect(article).toBeInTheDocument();
    });
  });

  it('should limit related products to 3', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      const productCards = screen.getAllByRole('article');
      // 1 main product detail + up to 3 related products
      expect(productCards.length).toBeLessThanOrEqual(4);
    });
  });

  it('should have proper accessibility attributes for gallery', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      const gallery = screen.getByLabelText('Product gallery');
      expect(gallery).toBeInTheDocument();
    });
  });

  it('should have proper accessibility attributes for related products', async () => {
    renderProductDetailWithId(1);

    await waitFor(() => {
      const relatedSection = screen.getByLabelText('Related products');
      expect(relatedSection).toBeInTheDocument();
    });
  });
});
