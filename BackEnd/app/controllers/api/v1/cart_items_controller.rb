module Api
  module V1
    class CartItemsController < BaseController
      include Authentication

      InvalidCartItem = Class.new(StandardError)

      def create
        attributes = item_params
        product_id = positive_integer(attributes[:product_id], "Product ID")
        quantity = positive_integer(attributes.fetch(:quantity, 1), "Quantity")
        validate_maximum_quantity(quantity)

        created = false
        cart = with_locked_cart do |user_cart|
          product = Product.active.find_by(id: product_id)
          raise InvalidCartItem, "Product #{product_id} is unavailable." unless product

          cart_item = user_cart.cart_items.find_or_initialize_by(product: product)
          created = cart_item.new_record?
          next_quantity = created ? quantity : cart_item.quantity + quantity
          validate_maximum_quantity(next_quantity)
          cart_item.update!(quantity: next_quantity)
          user_cart
        end

        render_cart(cart, status: created ? :created : :ok)
      rescue InvalidCartItem, ActiveRecord::RecordInvalid => e
        render_errors(e)
      end

      def update
        quantity = positive_integer(item_params[:quantity], "Quantity")
        validate_maximum_quantity(quantity)

        cart = with_locked_cart do |user_cart|
          user_cart.cart_items.find(params[:id]).update!(quantity: quantity)
          user_cart
        end

        render_cart(cart)
      rescue InvalidCartItem, ActiveRecord::RecordInvalid => e
        render_errors(e)
      rescue ActiveRecord::RecordNotFound
        render_api_error("Cart item not found.", status: :not_found)
      end

      def destroy
        cart = with_locked_cart do |user_cart|
          user_cart.cart_items.find(params[:id]).destroy!
          user_cart
        end

        render_cart(cart)
      rescue ActiveRecord::RecordNotFound
        render_api_error("Cart item not found.", status: :not_found)
      end

      def clear
        cart = with_locked_cart do |user_cart|
          user_cart.cart_items.destroy_all
          user_cart
        end

        render_cart(cart)
      end

      private

      def item_params
        require_object_parameter(:item).permit(:product_id, :quantity)
      end

      def with_locked_cart
        current_user.with_lock do
          cart = current_user.cart || current_user.create_cart!
          yield cart
        end
      end

      def positive_integer(value, label)
        integer = if value.is_a?(Integer)
          value
        elsif value.is_a?(String) && value.match?(/\A[1-9]\d*\z/)
          value.to_i
        end

        raise InvalidCartItem, "#{label} must be a positive integer." unless integer&.positive?

        integer
      end

      def validate_maximum_quantity(quantity)
        return if quantity <= CartItem::MAX_QUANTITY

        raise InvalidCartItem, "Quantity cannot exceed #{CartItem::MAX_QUANTITY} per product."
      end

      def render_cart(cart, status: :ok)
        render json: { data: CartSerializer.new(cart).as_json }, status: status
      end

      def render_errors(error)
        errors = if error.is_a?(ActiveRecord::RecordInvalid)
          error.record.errors.full_messages
        else
          [ error.message ]
        end
        render_api_error(errors, status: :unprocessable_entity)
      end
    end
  end
end
