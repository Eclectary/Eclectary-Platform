module Api
  module V1
    class OrdersController < BaseController
      include Authentication

      SHIPPING_AMOUNT = BigDecimal("6.50")
      class InvalidOrderItem < StandardError; end

      def index
        orders = user_orders.includes(order_items: :product)

        render json: {
          data: orders.map { |order| OrderSerializer.new(order).as_json }
        }
      end

      def show
        order = user_orders.includes(order_items: :product).find(params[:id])

        render json: {
          data: OrderSerializer.new(order).as_json
        }
      end

      def create
        attributes = order_params
        items = attributes.delete(:items)
        raise InvalidOrderItem, "Add at least one product to the order." unless items.is_a?(Array) && items.any?

        order = nil
        Order.transaction do
          order = Order.create!(
            attributes.merge(
              user: current_user,
              status: "pending",
              shipping_amount: SHIPPING_AMOUNT
            )
          )

          items.each do |item|
            product_id = positive_integer(item[:product_id], "product ID")
            quantity = positive_integer(item[:quantity], "quantity")
            product = Product.find_by(id: product_id)
            raise InvalidOrderItem, "Product #{product_id} is unavailable." unless product

            order.order_items.create!(
              product: product,
              quantity: quantity,
              price: product.price
            )
          end
        end

        render json: {
          data: OrderSerializer.new(order).as_json
        }, status: :created
      rescue InvalidOrderItem => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      private

      def order_params
        params.require(:order).permit(
          :customer_name,
          :customer_email,
          :customer_phone,
          :shipping_address,
          :shipping_city,
          :shipping_state,
          :shipping_postal_code,
          items: %i[product_id quantity]
        )
      end

      def user_orders
        Order.where(user: current_user)
      end

      def positive_integer(value, label)
        number = if value.is_a?(Integer)
          value
        elsif value.is_a?(String) && value.match?(/\A[1-9]\d*\z/)
          value.to_i
        end

        raise InvalidOrderItem, "Each #{label} must be a positive integer." unless number&.positive?

        number
      end
    end
  end
end
