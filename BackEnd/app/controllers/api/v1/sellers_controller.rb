module Api
  module V1
    class SellersController < BaseController
      def index
        sellers = User.where(role: "seller").order(:id)

        render json: {
          data: sellers.map { |seller| SellerSerializer.new(seller).as_json }
        }
      end

      def show
        seller = User.where(role: "seller").find_by(id: params[:id])

        if seller
          render json: { data: SellerSerializer.new(seller).as_json }
        else
          render json: { error: "Seller not found" }, status: :not_found
        end
      end
    end
  end
end
