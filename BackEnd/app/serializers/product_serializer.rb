class ProductSerializer
  def initialize(product)
    @product = product
  end

  def as_json
    {
      id: @product.id,
      title: @product.title,
      description: @product.description,
      price: @product.price,
      creator: @product.seller.email,
      seller_id: @product.seller_id,
      category: @product.category_id.to_s,
      category_id: @product.category_id,
      created_at: @product.created_at,
      updated_at: @product.updated_at
    }
  end
end