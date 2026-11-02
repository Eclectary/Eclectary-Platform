module Api
  module V1
    class ProductsController < BaseController
      DEFAULT_PAGE = 1
      DEFAULT_PER_PAGE = 24
      MAX_PER_PAGE = 100

      def index
        products = filtered_products
        total = products.count
        page = normalized_positive_integer(params[:page], default: DEFAULT_PAGE)
        per_page = normalized_positive_integer(params[:per_page], default: DEFAULT_PER_PAGE, maximum: MAX_PER_PAGE)
        total_pages = total.zero? ? 0 : (total.to_f / per_page).ceil

        if pagination_requested?
          products = products.offset((page - 1) * per_page).limit(per_page)
        else
          page = DEFAULT_PAGE
          per_page = total
          total_pages = total.zero? ? 0 : 1
        end

        render json: {
          data: products.map { |product| ProductSerializer.new(product).as_json },
          pagination: {
            page: page,
            per_page: per_page,
            total: total,
            total_pages: total_pages
          }
        }
      end

      def show
        product = Product.active.with_attached_images.find(params[:id])

        render json: {
          data: ProductSerializer.new(product).as_json
        }
      end

      private

      def filtered_products
        products = Product.active
          .left_joins(:seller, :category)
          .preload(:seller, :category, images_attachments: :blob)

        products = filter_by_category(products)
        products = filter_by_search(products)
        sort_products(products)
      end

      def filter_by_category(products)
        return products unless params.key?(:category_id)

        category_id = strict_positive_integer(params[:category_id])
        category_id ? products.where(category_id: category_id) : products.none
      end

      def filter_by_search(products)
        search = params[:search].to_s.strip
        return products if search.blank?

        escaped_search = ActiveRecord::Base.sanitize_sql_like(search)
        pattern = "%#{escaped_search}%"

        products.where(
          <<~SQL.squish,
            products.title ILIKE :pattern
            OR products.description ILIKE :pattern
            OR products.subcategory ILIKE :pattern
            OR users.public_name ILIKE :pattern
            OR categories.name ILIKE :pattern
          SQL
          pattern: pattern
        )
      end

      def sort_products(products)
        case params[:sort]
        when "oldest"
          products.order(created_at: :asc, id: :asc)
        when "price-asc"
          products.order(price: :asc, id: :asc)
        when "price-desc"
          products.order(price: :desc, id: :asc)
        else
          products.order(created_at: :desc, id: :desc)
        end
      end

      def pagination_requested?
        params.key?(:page) || params.key?(:per_page)
      end

      def normalized_positive_integer(value, default:, maximum: nil)
        integer = strict_positive_integer(value) || default
        maximum ? [ integer, maximum ].min : integer
      end

      def strict_positive_integer(value)
        integer = Integer(value, 10)
        integer if integer.positive?
      rescue ArgumentError, TypeError
        nil
      end
    end
  end
end
