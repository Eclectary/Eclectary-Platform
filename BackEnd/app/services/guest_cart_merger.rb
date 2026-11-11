class GuestCartMerger
  def initialize(cart, items)
    @cart = cart
    @items = items
  end

  # The caller must hold the owning user's row lock inside a transaction.
  def call
    added_items = []
    skipped_items = []

    @items.each_with_index do |item, index|
      unless item.is_a?(Hash)
        skipped_items << { index: index, reason: "invalid_item" }
        next
      end

      product_id = positive_integer(item["product_id"])
      quantity = positive_integer(item["quantity"])
      unless product_id && quantity
        skipped_items << { index: index, product_id: product_id, reason: "invalid_product_id_or_quantity" }
        next
      end

      product = Product.active.lock("FOR SHARE").find_by(id: product_id)
      unless product
        skipped_items << { index: index, product_id: product_id, reason: "unavailable_product" }
        next
      end

      cart_item = @cart.cart_items.find_or_initialize_by(product: product)
      current_quantity = cart_item.new_record? ? 0 : cart_item.quantity
      added_quantity = [ quantity, CartItem::MAX_QUANTITY - current_quantity ].min

      if added_quantity.positive?
        cart_item.update!(quantity: current_quantity + added_quantity)
        added_items << { index: index, product_id: product_id, quantity: added_quantity }
      end

      if added_quantity < quantity
        skipped_items << {
          index: index,
          product_id: product_id,
          reason: "quantity_limit",
          skipped_quantity: quantity - added_quantity
        }
      end
    end

    { added_items: added_items, skipped_items: skipped_items }
  end

  private

  def positive_integer(value)
    integer = if value.is_a?(Integer)
      value
    elsif value.is_a?(String) && value.match?(/\A[1-9]\d*\z/)
      value.to_i
    end

    integer if integer&.positive?
  end
end
