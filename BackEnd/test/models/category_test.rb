require "test_helper"

class CategoryTest < ActiveSupport::TestCase
  test "requires a name" do
    category = Category.new(name: " ", slug: "new-category")

    assert_not category.valid?
    assert_includes category.errors[:name], "can't be blank"
  end

  test "requires a slug" do
    category = Category.new(name: "New category", slug: " ")

    assert_not category.valid?
    assert_includes category.errors[:slug], "can't be blank"
  end

  test "requires a unique slug" do
    category = Category.new(name: "Another category", slug: categories(:one).slug)

    assert_not category.valid?
    assert_includes category.errors[:slug], "has already been taken"
  end

  test "category and product associations are bidirectional" do
    category = categories(:one)
    product = products(:one)

    assert_equal category, product.category
    assert_includes category.products, product
  end

  test "category containing products cannot be destroyed and preserves references" do
    category = categories(:one)
    product = products(:one)
    cart_item = cart_items(:one)
    order_item = order_items(:one)

    assert_no_difference -> { Category.count } do
      assert_not category.destroy
    end

    assert category.persisted?
    assert category.errors[:base].present?
    assert Product.exists?(product.id)
    assert CartItem.exists?(cart_item.id)
    assert OrderItem.exists?(order_item.id)
    assert_equal product.id, cart_item.reload.product_id
    assert_equal product.id, order_item.reload.product_id
  end

  test "empty category can be destroyed" do
    category = Category.create!(name: "Empty category", slug: "empty-category")

    assert_difference -> { Category.count }, -1 do
      assert category.destroy
    end

    assert_not category.persisted?
  end
end
