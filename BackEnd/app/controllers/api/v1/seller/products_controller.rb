module Api
  module V1
    module Seller
      class ProductsController < Api::V1::BaseController
        include Authentication
        include Authorization

        require_role :seller

        before_action :set_product, only: %i[show update deactivate]

        def index
          products = current_user.products.with_attached_images.order(:id)

          render json: {
            data: products.map { |product| ProductSerializer.new(product).as_json }
          }
        end

        def show
          render_product(@product)
        end

        def create
          product = current_user.products.build(product_attributes)
          assign_images(product)

          if product.save
            render_product(product, status: :created)
          else
            render_validation_errors(product)
          end
        end

        def update
          @product.assign_attributes(product_attributes)
          assign_images(@product, preserve_existing: true)

          if @product.save
            render_product(@product)
          else
            render_validation_errors(@product)
          end
        end

        def deactivate
          if @product.update(active: false)
            render_product(@product)
          else
            render_validation_errors(@product)
          end
        end

        private

        def set_product
          @product = current_user.products.with_attached_images.find(params[:id])
        end

        def product_params
          @product_params ||= params.require(:product).permit(
            :title,
            :description,
            :price,
            :category_id,
            :subcategory,
            images: []
          )
        end

        def product_attributes
          product_params.except(:images)
        end

        def uploaded_images
          Array(product_params[:images]).compact_blank
        end

        def assign_images(product, preserve_existing: false)
          return if uploaded_images.empty?

          attachables = preserve_existing ? product.images.blobs + uploaded_images : uploaded_images
          product.images = attachables
        end

        def render_product(product, status: :ok)
          render json: {
            data: ProductSerializer.new(product).as_json
          }, status: status
        end

        def render_validation_errors(product)
          render json: { errors: product.errors.full_messages }, status: :unprocessable_entity
        end
      end
    end
  end
end
