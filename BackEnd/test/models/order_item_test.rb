require "test_helper"

class OrderItemTest < ActiveSupport::TestCase
  test "fulfillment defaults to unfulfilled" do
    item = OrderItem.create!(
      order: orders(:one), product: products(:one), seller: users(:two),
      quantity: 1, price: products(:one).price
    )

    assert_equal "unfulfilled", item.fulfillment_status
  end

  test "fulfillment advances one step at a time" do
    item = order_items(:one)

    assert item.transition_fulfillment_to("processing")
    assert_equal "processing", item.reload.fulfillment_status
    assert item.transition_fulfillment_to("fulfilled")
    assert_equal "fulfilled", item.reload.fulfillment_status
  end

  test "fulfillment rejects skipped backward and arbitrary transitions" do
    item = order_items(:one)

    refute item.transition_fulfillment_to("fulfilled")
    assert_equal "unfulfilled", item.reload.fulfillment_status

    item.update!(fulfillment_status: "processing")
    refute item.transition_fulfillment_to("unfulfilled")
    assert_equal "processing", item.reload.fulfillment_status

    refute item.transition_fulfillment_to("shipped")
    assert_equal "processing", item.reload.fulfillment_status
  end

  test "fulfillment validates the exact supported values" do
    item = order_items(:one)
    item.fulfillment_status = "shipped"

    refute item.valid?
    assert_includes item.errors[:fulfillment_status], "is not included in the list"
  end

  test "direct updates cannot bypass the transition sequence" do
    item = order_items(:one)

    refute item.update(fulfillment_status: "fulfilled")
    assert_equal "unfulfilled", item.reload.fulfillment_status
  end
end
