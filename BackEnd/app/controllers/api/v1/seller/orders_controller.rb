module Api
  module V1
    module Seller
      class OrdersController < BaseController
        include Authentication
        include Authorization

        require_role :seller

        def index
          items = seller_items.joins(:order).includes(:order, :product)
            .order("orders.created_at DESC", "order_items.id ASC")

          render json: {
            data: items.group_by(&:order_id).map do |_order_id, order_items|
              SellerOrderSerializer.new(order_items.first.order, items: order_items).as_json
            end
          }
        end

        def show
          items = seller_items.where(order_id: params[:id]).includes(:order, :product).order(:id).to_a
          raise ActiveRecord::RecordNotFound if items.empty?

          render json: {
            data: SellerOrderSerializer.new(items.first.order, items: items).as_json
          }
        end

        def update_fulfillment
          item = seller_items.includes(:product).find_by!(
            id: params[:item_id],
            order_id: params[:order_id]
          )

          if item.transition_fulfillment_to(fulfillment_params[:status])
            render json: { data: SellerOrderItemSerializer.new(item).as_json }
          else
            render json: { errors: item.errors.full_messages }, status: :unprocessable_entity
          end
        end

        private

        def seller_items
          current_user.sold_order_items
        end

        def fulfillment_params
          params.require(:fulfillment).permit(:status)
        end

      end
    end
  end
end
