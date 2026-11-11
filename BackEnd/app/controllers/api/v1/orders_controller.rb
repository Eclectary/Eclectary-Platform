require "digest"

module Api
  module V1
    class OrdersController < BaseController
      include Authentication

      SHIPPING_AMOUNT = BigDecimal("6.50")
      FINGERPRINT_ATTRIBUTES = %w[
        customer_name
        customer_email
        customer_phone
        shipping_address
        shipping_city
        shipping_state
        shipping_postal_code
      ].freeze

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
        attributes = order_params.to_h.symbolize_keys
        items = attributes.delete(:items)
        raise InvalidOrderItem, "Add at least one product to the order." unless items.is_a?(Array) && items.any?

        items = normalize_items(items)
        order_attributes = attributes.merge(
          user: current_user,
          status: "pending",
          shipping_amount: SHIPPING_AMOUNT
        )
        validate_order!(order_attributes)

        idempotency_key = request.headers["Idempotency-Key"].presence
        fingerprint = order_fingerprint(order_attributes, items) if idempotency_key

        if idempotency_key && (existing_order = find_idempotent_order(idempotency_key))
          return render_idempotent_order(existing_order, fingerprint)
        end

        order = create_order!(order_attributes, items, idempotency_key, fingerprint)
        render_order(order, status: :created)
      rescue InvalidOrderItem => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      rescue ActiveRecord::RecordNotUnique
        # PostgreSQL aborts a transaction after a uniqueness violation, so the
        # winning order must be resolved here, after create_order! has rolled back.
        raise unless idempotency_key

        existing_order = Order.uncached { find_idempotent_order(idempotency_key) }
        raise unless existing_order

        render_idempotent_order(existing_order, fingerprint)
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

      def normalize_items(items)
        items.map do |item|
          item = item.respond_to?(:to_h) ? item.to_h.with_indifferent_access : {}

          {
            product_id: positive_integer(item[:product_id], "product ID"),
            quantity: positive_integer(item[:quantity], "quantity")
          }
        end
      end

      def validate_order!(attributes)
        order = Order.new(attributes)
        raise ActiveRecord::RecordInvalid, order unless order.valid?
      end

      def order_fingerprint(attributes, items)
        order = Order.new(attributes)
        payload = order.slice(*FINGERPRINT_ATTRIBUTES).merge(
          "items" => items.map { |item| item.stringify_keys }
        )

        Digest::SHA256.hexdigest(JSON.generate(payload))
      end

      def create_order!(attributes, items, idempotency_key, fingerprint)
        Order.transaction do
          order = Order.create!(
            attributes.merge(
              idempotency_key: idempotency_key,
              idempotency_fingerprint: fingerprint
            )
          )

          items.each do |item|
            product = Product.active.find_by(id: item[:product_id])
            raise InvalidOrderItem, "Product #{item[:product_id]} is unavailable." unless product

            order.order_items.create!(
              product: product,
              seller: product.seller,
              quantity: item[:quantity],
              price: product.price
            )
          end

          order
        end
      end

      def find_idempotent_order(key)
        user_orders.find_by(idempotency_key: key)
      end

      def render_idempotent_order(order, fingerprint)
        if order.idempotency_fingerprint != fingerprint
          return render json: {
            errors: [ "Idempotency key has already been used with a different order payload." ]
          }, status: :conflict
        end

        render_order(order, status: :ok)
      end

      def render_order(order, status:)
        render json: {
          data: OrderSerializer.new(order).as_json
        }, status: status
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
