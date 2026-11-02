class SellerOrderItemSerializer
  def initialize(order_item)
    @order_item = order_item
  end

  def as_json(*)
    {
      id: order_item.id,
      product_id: order_item.product_id,
      title: order_item.product.title,
      quantity: order_item.quantity,
      unit_price: order_item.price.to_f,
      line_total: (order_item.price * order_item.quantity).to_f,
      fulfillment_status: order_item.fulfillment_status
    }
  end

  private

  attr_reader :order_item
end
