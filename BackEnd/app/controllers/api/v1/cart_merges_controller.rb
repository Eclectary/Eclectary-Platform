module Api
  module V1
    class CartMergesController < BaseController
      include Authentication

      class InvalidMerge < StandardError; end

      def create
        identifier = params[:merge_identifier]
        unless identifier.is_a?(String) && identifier.present? &&
            identifier.length <= CartMerge::MAX_IDENTIFIER_LENGTH
          raise InvalidMerge, "Merge identifier must be a nonblank string of at most #{CartMerge::MAX_IDENTIFIER_LENGTH} characters."
        end
        raise InvalidMerge, "Items must be an array." unless params[:items].is_a?(Array)

        payload = current_user.with_lock do
          cart = current_user.cart || current_user.create_cart!
          merge = cart.cart_merges.find_by(merge_identifier: identifier)
          repeated = merge.present?

          unless repeated
            items = params[:items].map do |item|
              item.is_a?(ActionController::Parameters) ? item.permit(:product_id, :quantity).to_h : item
            end
            result = GuestCartMerger.new(cart, items).call
            merge = cart.cart_merges.create!(merge_identifier: identifier, result: result)
          end

          {
            data: CartSerializer.new(cart).as_json,
            merge: merge.result.merge(
              "merge_identifier" => merge.merge_identifier,
              "repeated" => repeated
            )
          }
        end

        render json: payload
      rescue InvalidMerge => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end
    end
  end
end
