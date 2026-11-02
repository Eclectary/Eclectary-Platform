class SellerOrderSerializer
  def initialize(order, items:)
    @order = order
    @items = items
  end

  def as_json(*)
    {
      id: order.id,
      created_at: order.created_at,
      recipient_name: order.customer_name,
      shipping_address: order.shipping_address,
      shipping_city: order.shipping_city,
      shipping_state: order.shipping_state,
      shipping_postal_code: order.shipping_postal_code,
      items: items.map { |item| SellerOrderItemSerializer.new(item).as_json }
    }
  end

  private

  attr_reader :order, :items
end
