require "test_helper"

class CartItemTest < ActiveSupport::TestCase
  test "belongs to a cart and product" do
    cart_item = cart_items(:one)

    assert_equal carts(:one), cart_item.cart
    assert_equal products(:one), cart_item.product
  end

  test "rejects a duplicate product in the same cart" do
    cart_item = CartItem.new(cart: carts(:one), product: products(:one), quantity: 1)

    assert_not cart_item.valid?
    assert_includes cart_item.errors[:product_id], "has already been taken"
  end

  test "allows the same product in a different cart" do
    cart_item = CartItem.new(cart: carts(:two), product: products(:one), quantity: 1)

    assert_predicate cart_item, :valid?
  end

  test "requires a positive integer quantity" do
    [ nil, 0, -1, 1.5, "1.5" ].each do |quantity|
      cart_item = CartItem.new(cart: carts(:one), product: products(:two), quantity: quantity)

      assert_not cart_item.valid?, "expected #{quantity.inspect} to be invalid"
    end
  end

  test "accepts a positive integer quantity" do
    cart_item = CartItem.new(cart: carts(:one), product: products(:two), quantity: "3")

    assert_predicate cart_item, :valid?
    assert_equal 3, cart_item.quantity
  end
end
