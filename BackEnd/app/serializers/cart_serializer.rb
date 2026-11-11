class CartSerializer
  def initialize(cart)
    @cart = cart
  end

  def as_json
    {
      id: @cart.id,
      items: cart_items.map do |cart_item|
        product = cart_item.product
        {
          id: cart_item.id,
          product_id: cart_item.product_id,
          quantity: cart_item.quantity,
          status: product.active? ? "available" : "unavailable",
          product: ProductSerializer.new(product).as_json
        }
      end
    }
  end

  private

  def cart_items
    @cart.cart_items.includes(
      product: [ :seller, :category, { images_attachments: :blob } ]
    ).order(:id)
  end
end
