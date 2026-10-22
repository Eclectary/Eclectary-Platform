import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import Footer from './Footer';

describe('Footer marketplace navigation', () => {
  it.each([
    ['All Products', '/shop'],
    ['Purely Handmade', '/shop?collection=purely-handmade'],
    ['Digital Creations', '/shop?collection=digital-creations'],
    ['Custom Printing', '/shop?collection=custom-printing'],
    ['Meet the Creators', '/shop#makers'],
  ])('links %s to its existing marketplace route', (name, href) => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
  });
});
