class OrderItemSerializer
  def initialize(order_item)
    @order_item = order_item
  end

  def as_json
    {
      id: @order_item.id,
      order_id: @order_item.order_id,
      product_id: @order_item.product_id,
      title: @order_item.product.title,
      quantity: @order_item.quantity,
      price: @order_item.price.to_f,
      created_at: @order_item.created_at,
      updated_at: @order_item.updated_at
    }
  end
end
