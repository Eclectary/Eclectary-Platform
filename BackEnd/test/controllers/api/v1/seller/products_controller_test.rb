require "test_helper"

class Api::V1::Seller::ProductsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @seller = users(:two)
    @other_seller = User.create!(
      email: "other-seller@example.com",
      password: "password123",
      role: "seller"
    )
    @other_product = @other_seller.products.create!(
      title: "Other seller product",
      description: "Not owned by the fixture seller",
      price: "12.50",
      category: categories(:one)
    )
  end

  def auth_headers(user = @seller)
    { "Authorization" => "Bearer #{JsonWebToken.encode(user_id: user.id)}" }
  end

  def valid_product_params
    {
      product: {
        title: "New seller product",
        description: "Persisted description",
        price: "24.95",
        category_id: categories(:one).id,
        subcategory: "Small batch"
      }
    }
  end

  test "seller endpoints require authentication" do
    get "/api/v1/seller/products"
    assert_response :unauthorized

    post "/api/v1/seller/products", params: valid_product_params
    assert_response :unauthorized
  end

  test "customer and administrator cannot create seller products" do
    [ users(:one), users(:administrator) ].each do |user|
      assert_no_difference -> { Product.count } do
        post "/api/v1/seller/products", params: valid_product_params, headers: auth_headers(user)
      end
      assert_response :forbidden
    end
  end

  test "seller creates a product owned by the authenticated account" do
    assert_difference -> { @seller.products.count }, 1 do
      post "/api/v1/seller/products", params: valid_product_params, headers: auth_headers
    end

    assert_response :created
    product = @seller.products.order(:id).last
    assert_equal "New seller product", product.title
    assert_equal BigDecimal("24.95"), product.price
    assert product.active?
    assert_equal product.id, JSON.parse(response.body).dig("data", "id")
  end

  test "seller cannot choose ownership or initial active state" do
    params = valid_product_params
    params[:product].merge!(seller_id: @other_seller.id, active: false)

    post "/api/v1/seller/products", params: params, headers: auth_headers

    assert_response :created
    product = Product.order(:id).last
    assert_equal @seller, product.seller
    assert product.active?
  end

  test "invalid create returns validation errors without persistence" do
    params = valid_product_params
    params[:product][:title] = ""
    params[:product][:price] = "not-a-price"

    assert_no_difference -> { Product.count } do
      post "/api/v1/seller/products", params: params, headers: auth_headers
    end

    assert_response :unprocessable_entity
    assert JSON.parse(response.body).fetch("errors").any?
  end

  test "zero price is valid" do
    params = valid_product_params
    params[:product][:price] = "0.00"

    post "/api/v1/seller/products", params: params, headers: auth_headers

    assert_response :created
    assert_equal BigDecimal("0"), @seller.products.order(:id).last.price
  end

  test "blank title is rejected" do
    params = valid_product_params
    params[:product][:title] = " "

    assert_no_difference -> { Product.count } do
      post "/api/v1/seller/products", params: params, headers: auth_headers
    end
    assert_response :unprocessable_entity
  end

  test "blank negative and nonnumeric prices are rejected" do
    [ "", "-0.01", "not-a-number" ].each do |price|
      params = valid_product_params
      params[:product][:price] = price

      assert_no_difference -> { Product.count } do
        post "/api/v1/seller/products", params: params, headers: auth_headers
      end
      assert_response :unprocessable_entity
    end
  end

  test "missing and invalid categories are rejected" do
    [ nil, Category.maximum(:id) + 1_000 ].each do |category_id|
      params = valid_product_params
      params[:product][:category_id] = category_id

      assert_no_difference -> { Product.count } do
        post "/api/v1/seller/products", params: params, headers: auth_headers
      end
      assert_response :unprocessable_entity
    end
  end

  test "index includes the seller's active and inactive products only" do
    products(:two).update!(active: false)

    get "/api/v1/seller/products", headers: auth_headers

    assert_response :success
    data = JSON.parse(response.body).fetch("data")
    assert_equal @seller.products.order(:id).pluck(:id), data.map { |product| product.fetch("id") }
    assert_includes data.map { |product| product.fetch("active") }, false
    refute_includes data.map { |product| product.fetch("id") }, @other_product.id
  end

  test "seller can show and update an owned product" do
    get "/api/v1/seller/products/#{products(:one).id}", headers: auth_headers
    assert_response :success

    patch "/api/v1/seller/products/#{products(:one).id}",
      params: { product: { title: "Updated title", price: "8.25" } },
      headers: auth_headers

    assert_response :success
    assert_equal "Updated title", products(:one).reload.title
    assert_equal BigDecimal("8.25"), products(:one).price
  end

  test "seller can retrieve an owned inactive product" do
    products(:one).update!(active: false)

    get "/api/v1/seller/products/#{products(:one).id}", headers: auth_headers

    assert_response :success
    assert_equal false, JSON.parse(response.body).dig("data", "active")
  end

  test "ordinary updates cannot change active state" do
    patch "/api/v1/seller/products/#{products(:one).id}",
      params: { product: { title: "Still active", active: false } },
      headers: auth_headers

    assert_response :success
    assert products(:one).reload.active?

    products(:one).update!(active: false)
    patch "/api/v1/seller/products/#{products(:one).id}",
      params: { product: { title: "Still inactive", active: true } },
      headers: auth_headers

    assert_response :success
    assert_not products(:one).reload.active?
  end

  test "seller cannot show or update another seller's product" do
    get "/api/v1/seller/products/#{@other_product.id}", headers: auth_headers
    assert_response :not_found

    patch "/api/v1/seller/products/#{@other_product.id}",
      params: { product: { title: "Stolen" } },
      headers: auth_headers
    assert_response :not_found
    assert_equal "Other seller product", @other_product.reload.title
  end

  test "seller deactivates an owned product and it remains persisted" do
    assert_no_difference -> { Product.count } do
      patch "/api/v1/seller/products/#{products(:one).id}/deactivate", headers: auth_headers
    end

    assert_response :success
    assert_not products(:one).reload.active?
    assert_equal false, JSON.parse(response.body).dig("data", "active")
  end

  test "seller cannot deactivate another seller's product" do
    patch "/api/v1/seller/products/#{@other_product.id}/deactivate", headers: auth_headers

    assert_response :not_found
    assert @other_product.reload.active?
  end

  test "valid images are attached on create" do
    params = valid_product_params
    params[:product][:images] = [ fixture_file_upload("tiny.png", "image/png") ]

    post "/api/v1/seller/products", params: params, headers: auth_headers

    assert_response :created
    product = @seller.products.order(:id).last
    assert_equal 1, product.images.count
    assert JSON.parse(response.body).dig("data", "image").present?
  end

  test "adding an image on update preserves existing attachments" do
    product = products(:one)
    product.images.attach(
      io: StringIO.new("existing image"),
      filename: "existing.png",
      content_type: "image/png"
    )
    existing_blob_id = product.images.first.blob_id

    patch "/api/v1/seller/products/#{product.id}", params: {
      product: {
        title: "Updated with another image",
        images: [ fixture_file_upload("tiny.png", "image/png") ]
      }
    }, headers: auth_headers

    assert_response :success
    assert_equal 2, product.reload.images.count
    assert_includes product.images.map(&:blob_id), existing_blob_id
  end

  test "ordinary field update preserves existing attachments" do
    product = products(:one)
    product.images.attach(
      io: StringIO.new("existing image"),
      filename: "existing.png",
      content_type: "image/png"
    )

    assert_no_difference -> { product.reload.images.count } do
      patch "/api/v1/seller/products/#{product.id}",
        params: { product: { title: "Text-only update" } },
        headers: auth_headers
    end

    assert_response :success
  end

  test "unsupported image type returns validation errors" do
    params = valid_product_params
    params[:product][:images] = [ fixture_file_upload("tiny.png", "text/plain") ]

    assert_no_difference -> { Product.count } do
      post "/api/v1/seller/products", params: params, headers: auth_headers
    end

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body).fetch("errors").join, "JPEG, PNG, or WebP"
  end
end
