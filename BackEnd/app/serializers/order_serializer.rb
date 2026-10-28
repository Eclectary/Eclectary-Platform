class OrderSerializer
  def initialize(order)
    @order = order
  end

  def as_json
    {
      id: @order.id,
      user_id: @order.user_id,
      status: @order.status,
      customer_name: @order.customer_name,
      customer_email: @order.customer_email,
      customer_phone: @order.customer_phone,
      shipping_address: @order.shipping_address,
      shipping_city: @order.shipping_city,
      shipping_state: @order.shipping_state,
      shipping_postal_code: @order.shipping_postal_code,
      shipping_amount: @order.shipping_amount.to_f,
      subtotal: @order.total.to_f,
      final_total: @order.final_total.to_f,
      items: @order.order_items.map { |item| OrderItemSerializer.new(item).as_json },
      created_at: @order.created_at,
      updated_at: @order.updated_at
    }
  end
end
