require "test_helper"

class ProductTest < ActiveSupport::TestCase
  test "accepts supported image types" do
    product = products(:one)
    product.images.attach(
      io: StringIO.new("valid image bytes"),
      filename: "listing.webp",
      content_type: "image/webp"
    )

    assert product.valid?
  end

  test "rejects unsupported image types" do
    product = products(:one)
    product.images.attach(
      io: StringIO.new("not an image"),
      filename: "listing.txt",
      content_type: "text/plain"
    )

    assert_not product.valid?
    assert_includes product.errors[:images], "must be JPEG, PNG, or WebP files"
  end

  test "rejects images larger than five megabytes" do
    product = products(:one)
    product.images.attach(
      io: StringIO.new("x" * (5.megabytes + 1)),
      filename: "large.png",
      content_type: "image/png"
    )

    assert_not product.valid?
    assert_includes product.errors[:images], "must each be 5 MB or smaller"
  end

  test "destroys a product without cart or order references" do
    product = create_product

    assert_difference("Product.count", -1) do
      assert product.destroy
    end
    assert product.destroyed?
  end

  test "does not destroy a product referenced by a cart item" do
    product = create_product
    cart_item = CartItem.create!(cart: carts(:one), product: product, quantity: 1)

    assert_no_difference([ "Product.count", "CartItem.count" ]) do
      assert_not product.destroy
    end
    assert product.persisted?
    assert product.errors[:base].present?
    assert_equal product, cart_item.reload.product
  end

  test "does not destroy a product referenced by an order item" do
    product = create_product
    order_item = create_order_item(product)

    assert_no_difference([ "Product.count", "OrderItem.count" ]) do
      assert_not product.destroy
    end
    assert product.persisted?
    assert product.errors[:base].present?
    assert_equal product, order_item.reload.product
  end

  test "does not destroy a product referenced by both cart and order items" do
    product = create_product
    cart_item = CartItem.create!(cart: carts(:one), product: product, quantity: 1)
    order_item = create_order_item(product)

    assert_no_difference([ "Product.count", "CartItem.count", "OrderItem.count" ]) do
      assert_not product.destroy
    end
    assert product.persisted?
    assert product.errors[:base].present?
    assert_equal product, cart_item.reload.product
    assert_equal product, order_item.reload.product
  end

  test "preserves images when a referenced product cannot be destroyed" do
    product = create_product
    product.images.attach(
      io: StringIO.new("valid image bytes"),
      filename: "protected-listing.webp",
      content_type: "image/webp"
    )
    CartItem.create!(cart: carts(:one), product: product, quantity: 1)
    attachment = product.images_attachments.first
    blob = attachment.blob

    assert_no_difference([ "Product.count", "ActiveStorage::Attachment.count", "ActiveStorage::Blob.count" ]) do
      assert_not product.destroy
    end
    assert ActiveStorage::Attachment.exists?(attachment.id)
    assert ActiveStorage::Blob.exists?(blob.id)
    assert product.reload.images.attached?
  end

  test "does not destroy a seller whose product has historical order references" do
    seller = User.create!(
      email: "protected-seller@example.com",
      password: "password123",
      role: "seller"
    )
    product = create_product(seller: seller)
    order_item = create_order_item(product, seller: seller)

    assert_no_difference([ "User.count", "Product.count", "OrderItem.count", "Order.count" ]) do
      assert_not seller.destroy
    end
    assert seller.persisted?
    assert product.reload.persisted?
    assert_equal product, order_item.reload.product
  end

  test "does not destroy a seller whose product is in a cart" do
    seller = User.create!(
      email: "cart-protected-seller@example.com",
      password: "password123",
      role: "seller"
    )
    product = create_product(seller: seller)
    cart_item = CartItem.create!(cart: carts(:one), product: product, quantity: 1)

    assert_no_difference([ "User.count", "Product.count", "CartItem.count" ]) do
      assert_not seller.destroy
    end
    assert seller.persisted?
    assert product.reload.persisted?
    assert_equal product, cart_item.reload.product
  end

  private

  def create_product(seller: users(:two))
    Product.create!(
      title: "Deletion lifecycle product",
      description: "Created for deletion lifecycle tests",
      price: 12.50,
      seller: seller,
      category: categories(:one)
    )
  end

  def create_order_item(product, seller: product.seller)
    OrderItem.create!(
      order: orders(:one),
      product: product,
      seller: seller,
      quantity: 1,
      price: product.price
    )
  end
end
