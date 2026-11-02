require "test_helper"

class Api::V1::Seller::OrdersControllerTest < ActionDispatch::IntegrationTest
  setup do
    @seller = users(:two)
    @other_seller = User.create!(email: "other-seller@example.com", password: "password123", role: "seller")
    @other_product = Product.create!(
      title: "Other seller product", description: "A product owned by another seller",
      price: 12.50, seller: @other_seller, category: categories(:one)
    )
    @mixed_order = Order.create!(
      user: users(:one), status: "pending", customer_name: "Mixed Buyer",
      customer_email: "mixed@example.com", customer_phone: "555-0104",
      shipping_address: "10 Shared St", shipping_city: "Durham",
      shipping_state: "NC", shipping_postal_code: "27701", shipping_amount: 6.50
    )
    @owned_item = @mixed_order.order_items.create!(
      product: products(:one), seller: @seller, quantity: 2, price: products(:one).price
    )
    @other_item = @mixed_order.order_items.create!(
      product: @other_product, seller: @other_seller, quantity: 1, price: @other_product.price
    )
  end

  test "index requires authentication" do
    get "/api/v1/seller/orders"
    assert_response :unauthorized
  end

  test "index rejects customers and administrators" do
    [ users(:one), users(:administrator) ].each do |user|
      get "/api/v1/seller/orders", headers: auth_headers(user)
      assert_response :forbidden
    end
  end

  test "index returns newest orders with only current seller items and private fields" do
    get "/api/v1/seller/orders", headers: auth_headers(@seller)

    assert_response :success
    data = JSON.parse(response.body).fetch("data")
    mixed = data.find { |order| order.fetch("id") == @mixed_order.id }
    assert mixed
    assert_equal [ @owned_item.id ], mixed.fetch("items").map { |item| item.fetch("id") }
    assert_equal "Mixed Buyer", mixed.fetch("recipient_name")
    assert_equal "10 Shared St", mixed.fetch("shipping_address")
    assert_equal %w[created_at id items recipient_name shipping_address shipping_city shipping_postal_code shipping_state], mixed.keys.sort
    assert_equal %w[fulfillment_status id line_total product_id quantity title unit_price], mixed.fetch("items").first.keys.sort
    assert_operator Time.zone.parse(data.first.fetch("created_at")), :>=, Time.zone.parse(data.last.fetch("created_at"))
  end

  test "show returns only an owned portion and hides orders without owned items" do
    get "/api/v1/seller/orders/#{@mixed_order.id}", headers: auth_headers(@seller)
    assert_response :success
    assert_equal [ @owned_item.id ], JSON.parse(response.body).dig("data", "items").map { |item| item.fetch("id") }

    get "/api/v1/seller/orders/#{orders(:one).id}", headers: auth_headers(@other_seller)
    assert_response :not_found
  end

  test "seller access remains based on the order item snapshot after product ownership changes" do
    products(:one).update!(seller: @other_seller)

    get "/api/v1/seller/orders/#{@mixed_order.id}", headers: auth_headers(@seller)
    assert_response :success
    assert_equal [ @owned_item.id ], JSON.parse(response.body).dig("data", "items").map { |item| item.fetch("id") }

    get "/api/v1/seller/orders/#{@mixed_order.id}", headers: auth_headers(@other_seller)
    assert_response :success
    assert_equal [ @other_item.id ], JSON.parse(response.body).dig("data", "items").map { |item| item.fetch("id") }
  end

  test "seller advances an owned item through permitted fulfillment states" do
    patch fulfillment_path(@mixed_order, @owned_item),
      params: { fulfillment: { status: "processing" } }, headers: auth_headers(@seller)
    assert_response :success
    assert_equal "processing", @owned_item.reload.fulfillment_status
    assert_equal "processing", JSON.parse(response.body).dig("data", "fulfillment_status")

    patch fulfillment_path(@mixed_order, @owned_item),
      params: { fulfillment: { status: "fulfilled" } }, headers: auth_headers(@seller)
    assert_response :success
    assert_equal "fulfilled", @owned_item.reload.fulfillment_status
  end

  test "seller cannot skip reverse or invent a fulfillment state" do
    patch fulfillment_path(@mixed_order, @owned_item),
      params: { fulfillment: { status: "fulfilled" } }, headers: auth_headers(@seller)
    assert_response :unprocessable_entity
    assert_equal "unfulfilled", @owned_item.reload.fulfillment_status

    @owned_item.update!(fulfillment_status: "processing")
    patch fulfillment_path(@mixed_order, @owned_item),
      params: { fulfillment: { status: "unfulfilled" } }, headers: auth_headers(@seller)
    assert_response :unprocessable_entity
    assert_equal "processing", @owned_item.reload.fulfillment_status

    patch fulfillment_path(@mixed_order, @owned_item),
      params: { fulfillment: { status: "shipped" } }, headers: auth_headers(@seller)
    assert_response :unprocessable_entity
    assert_equal "processing", @owned_item.reload.fulfillment_status
  end

  test "fulfillment rejects guests customers administrators and another seller ownership" do
    path = fulfillment_path(@mixed_order, @owned_item)
    params = { fulfillment: { status: "processing" } }

    patch path, params: params
    assert_response :unauthorized

    [ users(:one), users(:administrator) ].each do |user|
      patch path, params: params, headers: auth_headers(user)
      assert_response :forbidden
    end

    patch path, params: params, headers: auth_headers(@other_seller)
    assert_response :not_found
    assert_equal "unfulfilled", @owned_item.reload.fulfillment_status
  end

  private

  def auth_headers(user)
    { "Authorization" => "Bearer #{JsonWebToken.encode(user_id: user.id)}" }
  end

  def fulfillment_path(order, item)
    "/api/v1/seller/orders/#{order.id}/items/#{item.id}/fulfillment"
  end
end
