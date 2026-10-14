import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import ProductCard from '../components/ProductCard';
import type { Product } from '../types/product';
import { WishlistProvider } from '../context/WishlistContext';

const mockProduct: Product = {
  id: 1,
  title: 'Test Mug',
  price: 29.99,
  creator: 'Test Creator',
  tag: 'Ceramics',
  rating: 4.5,
  image: 'https://example.com/mug.jpg',
};

const renderProductCard = (product: Product = mockProduct) => {
  return render(
    <BrowserRouter>
      <WishlistProvider>
        <ProductCard product={product} />
      </WishlistProvider>
    </BrowserRouter>,
  );
};

describe('ProductCard', () => {
  it('should render product card with all required information', () => {
    renderProductCard();

    expect(screen.getByText('Test Mug')).toBeInTheDocument();
    expect(screen.getByText('Ceramics')).toBeInTheDocument();
    expect(screen.getByLabelText('Rated 4.5 out of 5.')).toBeInTheDocument();
    expect(screen.getByText('by Test Creator')).toBeInTheDocument();
    expect(screen.getByText('$29.99')).toBeInTheDocument();
  });

  it('should render product image with correct alt text', () => {
    renderProductCard();

    const image = screen.getByAltText('Test Mug');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/mug.jpg');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('should render safely when optional product fields are unavailable', () => {
    renderProductCard({
      id: 2,
      title: 'Unrated Item',
      price: 12,
      creator: 'Seller',
    });

    expect(screen.queryByRole('img', { name: 'Unrated Item' })).not.toBeInTheDocument();
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('should render links to product detail page', () => {
    renderProductCard();

    const links = screen.getAllByRole('link');
    const productLinks = links.filter((link) => link.getAttribute('href') === '/product/1');

    expect(productLinks.length).toBeGreaterThan(0);
  });

  it('should render wishlist button with correct aria labels when not saved', () => {
    renderProductCard();

    const wishlistBtn = screen.getByRole('button', {
      name: /add Test Mug to wishlist/i,
    });

    expect(wishlistBtn).toBeInTheDocument();
    expect(wishlistBtn).toHaveAttribute('title', 'Add to wishlist');
  });

  it('should toggle wishlist on button click', async () => {
    const user = userEvent.setup();
    renderProductCard();

    const wishlistBtn = screen.getByRole('button', {
      name: /add Test Mug to wishlist/i,
    });

    expect(wishlistBtn).toHaveTextContent('♡');

    await user.click(wishlistBtn);

    const removedBtn = screen.getByRole('button', {
      name: /remove Test Mug from wishlist/i,
    });

    expect(removedBtn).toHaveTextContent('♥');
  });

  it('should have View item link in footer', () => {
    renderProductCard();

    const viewItemLink = screen.getByRole('link', {
      name: /View item/i,
    });

    expect(viewItemLink).toBeInTheDocument();
    expect(viewItemLink).toHaveAttribute('href', '/product/1');
  });

  it('should format price correctly', () => {
    const productWithDecimal: Product = {
      ...mockProduct,
      price: 29.5,
    };

    renderProductCard(productWithDecimal);
    expect(screen.getByText('$29.50')).toBeInTheDocument();
  });

  it('should handle high rating display', () => {
    const productWithHighRating: Product = {
      ...mockProduct,
      rating: 4.9,
    };

    renderProductCard(productWithHighRating);
    expect(screen.getByLabelText('Rated 4.9 out of 5.')).toBeInTheDocument();
  });

  it('should display review count with correct singular/plural wording', () => {
    const productWithOneReview: Product = {
      ...mockProduct,
      rating: 5.0,
      reviewCount: 1,
    };

    renderProductCard(productWithOneReview);
    expect(screen.getByLabelText('Rated 5.0 out of 5 from 1 review.')).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();

    const productWithManyReviews: Product = {
      ...mockProduct,
      rating: 4.8,
      reviewCount: 24,
    };

    renderProductCard(productWithManyReviews);
    expect(screen.getByLabelText('Rated 4.8 out of 5 from 24 reviews.')).toBeInTheDocument();
    expect(screen.getByText('(24)')).toBeInTheDocument();
  });

  it('should show "No reviews yet" for products with zero reviews', () => {
    const productWithNoReviews: Product = {
      ...mockProduct,
      reviewCount: 0,
    };

    renderProductCard(productWithNoReviews);
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.queryByText('★★★★★')).not.toBeInTheDocument();
  });

  it('should handle product with long title', () => {
    const productWithLongTitle: Product = {
      ...mockProduct,
      title: 'This is a very long product title that might wrap to multiple lines',
    };

    renderProductCard(productWithLongTitle);
    expect(screen.getByText('This is a very long product title that might wrap to multiple lines')).toBeInTheDocument();
  });

  it('should render as an article element', () => {
    const { container } = renderProductCard();
    const article = container.querySelector('article.product-card');
    expect(article).toBeInTheDocument();
  });
});
