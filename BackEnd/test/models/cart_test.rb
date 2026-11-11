require "test_helper"

class CartTest < ActiveSupport::TestCase
  test "belongs to a user and has many cart items" do
    cart = carts(:one)

    assert_equal users(:one), cart.user
    assert_equal [ cart_items(:one) ], cart.cart_items
    assert_equal cart, users(:one).cart
  end

  test "rejects a second cart for the same user" do
    cart = Cart.new(user: users(:one))

    assert_not cart.valid?
    assert_includes cart.errors[:user_id], "has already been taken"
  end
end
