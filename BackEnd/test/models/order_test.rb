require "test_helper"

class OrderTest < ActiveSupport::TestCase
  test "total remains the product subtotal and final total includes shipping" do
    order = orders(:one)

    assert_equal order.order_items.sum { |item| item.quantity * item.price }, order.total
    assert_equal order.total + order.shipping_amount, order.final_total
  end
end
