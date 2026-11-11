module Api
  module V1
    class CartsController < BaseController
      include Authentication

      def show
        cart = current_user.with_lock do
          current_user.cart || current_user.create_cart!
        end

        render json: { data: CartSerializer.new(cart).as_json }
      end
    end
  end
end
