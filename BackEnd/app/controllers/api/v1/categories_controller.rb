module Api
  module V1
    class CategoriesController < BaseController
      def index
        categories = Category.order(:name, :id)

        render json: {
          data: categories.map { |category| CategorySerializer.new(category).as_json }
        }
      end

      def show
        category = Category.find(params[:id])

        render json: {
          data: CategorySerializer.new(category).as_json
        }
      end
    end
  end
end
