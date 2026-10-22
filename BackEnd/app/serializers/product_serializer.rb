class ProductSerializer
  def initialize(product)
    @product = product
  end

  def as_json
    image_urls = @product.images_attachments.to_a.sort_by(&:id).map do |attachment|
      Rails.application.routes.url_helpers.rails_blob_path(attachment.blob, only_path: true)
    end

    {
      id: @product.id,
      title: @product.title,
      description: @product.description,
      price: @product.price,
      image: image_urls.first,
      images: image_urls,
      creator: @product.seller.public_name.presence || "Maker ##{@product.seller.id}",
      seller_id: @product.seller_id,
      category: @product.category_id.to_s,
      category_id: @product.category_id,
      created_at: @product.created_at,
      updated_at: @product.updated_at
    }
  end
end