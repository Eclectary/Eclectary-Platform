# Product Components Testing Guide

## Overview
This document outlines the testing setup for product components in the Eclectary Platform frontend application.

## Test Setup

### Testing Framework
- **Vitest**: Lightning-fast unit test framework built for Vite
- **React Testing Library**: Best practices for testing React components
- **JSDOM**: DOM implementation for Node.js

### Dependencies Installed
- `vitest@^3.0.0` - Test runner
- `@testing-library/react@^16.2.0` - React component testing utilities
- `@testing-library/dom@^10.4.0` - DOM testing utilities
- `@testing-library/user-event@^14.5.2` - User interaction simulation
- `@testing-library/jest-dom@^10.4.0` - Custom Jest DOM matchers
- `jsdom@^25.0.0` - DOM implementation
- `@vitest/ui@^3.0.0` - Optional UI for test visualization

### Configuration Files
- `vitest.config.ts` - Vitest configuration with jsdom environment
- `FrontEnd/src/test/setup.ts` - Test setup file for Jest DOM matchers

## Test Files

### ProductCard Component Tests
**File**: `FrontEnd/src/components/ProductCard.test.tsx`

**Coverage** (10 tests):
- ✅ Renders product card with all required information
- ✅ Renders product image with correct alt text
- ✅ Renders links to product detail page
- ✅ Renders wishlist button with correct aria labels
- ✅ Toggles wishlist on button click
- ✅ Displays View item link in footer
- ✅ Formats price correctly
- ✅ Handles high rating display
- ✅ Handles product with long title
- ✅ Renders as an article element

**Key Features Tested**:
- Product information display (title, price, creator, rating)
- Image rendering with lazy loading
- Navigation links to product detail page
- Wishlist toggle functionality
- Accessibility attributes (aria-labels)
- Price formatting

### ProductDetail Component Tests
**File**: `FrontEnd/src/pages/ProductDetail.test.tsx`

**Coverage** (21 tests):
- ✅ Renders product details when product is found
- ✅ Renders product price formatted correctly
- ✅ Renders product image gallery
- ✅ Renders gallery thumbnail buttons
- ✅ Changes main image when thumbnail is clicked
- ✅ Renders Add to cart button
- ✅ Renders Save for later button
- ✅ Adds product to cart when button is clicked
- ✅ Toggles wishlist when Save for later button is clicked
- ✅ Renders product metadata
- ✅ Renders Back to shop link
- ✅ Renders related products section when products exist
- ✅ Displays seller name with link when seller exists
- ✅ Shows "Product not found" when product does not exist
- ✅ Renders product shipping information
- ✅ Renders product details list
- ✅ Uses product description when provided
- ✅ Renders product as article element
- ✅ Limits related products to 3
- ✅ Has proper accessibility attributes for gallery
- ✅ Has proper accessibility attributes for related products

**Key Features Tested**:
- Product detail rendering
- Image gallery with thumbnail selection
- Add to cart functionality
- Wishlist (Save for later) functionality
- Related products display
- Seller information with links
- Error handling (product not found)
- Accessibility features (aria-labels, semantic HTML)

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test
```

### Run tests once (CI mode)
```bash
npm test -- --run
```

### Homepage-to-marketplace integration

The homepage, Shop, public numeric seller profiles, and product detail pages
use the shared API services. Product service tests include Rails decimal-string
prices, which must be normalized before rendering prices or adding to the cart.
Product detail tests cover API-only IDs, loading, missing products, network
errors, missing images, public seller links, and independent related-product
and seller-profile failures. Footer tests check the existing Shop and makers
navigation destinations.

```powershell
npm test -- --run
npm run build
```

For live verification, run the existing Rails API on port 3000 and the frontend
on `http://localhost:5173`, the origin allowed by the current CORS configuration.
Check `/api/v1/health`, `/api/v1/products`, `/api/v1/categories`, and
`/api/v1/sellers`, then follow homepage, Shop, maker, and product links using
IDs from those responses. Missing product images should show "Image unavailable".
Collection and intention filters require corresponding product metadata; do not
substitute mock products for incomplete API data.

The Rails test environment uses `eclectary_test`, independently of
`DATABASE_NAME`. Test boot also fails if Rails resolves test and development to
the same database, including when a `DATABASE_URL` override takes precedence.
Rails fixtures can replace data in the selected test database.

### View test UI
```bash
npm run test:ui
```

### Generate coverage report
```bash
npm run test:coverage
```

## Test Architecture

### Mocking Strategy
- **Data Mocks**: Product and seller data are mocked using `vi.mock()`
- **Router**: Tests use `MemoryRouter` with route configuration to properly test URL-based behavior
- **Contexts**: Tests wrap components with necessary context providers (CartProvider, WishlistProvider)

### Rendering Helpers
Components are wrapped with necessary providers:
```typescript
// ProductCard Helper
const renderProductCard = (product: Product) => {
  return render(
    <BrowserRouter>
      <WishlistProvider>
        <ProductCard product={product} />
      </WishlistProvider>
    </BrowserRouter>,
  );
};

// ProductDetail Helper
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
```

## Best Practices Used

1. **Accessibility Testing**: Tests verify aria-labels, semantic HTML, and keyboard navigation
2. **User-Centric Testing**: Uses React Testing Library's philosophy of testing user interactions
3. **Async Handling**: Uses `waitFor()` for async operations and state updates
4. **Mock Management**: Properly isolates tests using mocks for external dependencies
5. **Comprehensive Coverage**: Tests both happy paths and error states

## Adding New Tests

When adding new tests for product components:

1. Create test file in same directory as component: `ComponentName.test.tsx`
2. Import necessary testing utilities
3. Mock external dependencies (data, services, hooks)
4. Create a render helper with required providers
5. Write tests following the AAA pattern (Arrange, Act, Assert)
6. Run `npm test` to verify

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(
      <BrowserRouter>
        <MyComponent />
      </BrowserRouter>,
    );
    
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Tests not finding elements
- Ensure component is properly wrapped with required providers
- Use `screen.debug()` to inspect rendered output
- Check if element requires async wait with `waitFor()`

### Mocking issues
- Ensure mocks are defined before imports
- Use `vi.resetModules()` between tests if needed
- Check that mocked values match component expectations

### Performance issues
- Tests should generally complete in under 100ms
- Use `{ timeout: 5000 }` for longer async operations
- Consider splitting large test files

## CI/CD Integration

To integrate into CI/CD pipeline, add to your workflow:
```bash
npm test -- --run --reporter=verbose
```

This will:
- Run all tests to completion
- Report results in verbose format
- Exit with appropriate code (0 for success, 1 for failure)
