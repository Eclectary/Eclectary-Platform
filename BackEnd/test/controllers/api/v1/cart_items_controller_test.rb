require "test_helper"

class Api::V1::CartItemsControllerTest < ActionDispatch::IntegrationTest
  def auth_headers(user = users(:one))
    { "Authorization" => "Bearer #{JsonWebToken.encode(user_id: user.id)}" }
  end

  test "cart endpoints require authentication" do
    get "/api/v1/cart"
    assert_response :unauthorized

    post "/api/v1/cart/items", params: { item: { product_id: products(:one).id } }
    assert_response :unauthorized

    patch "/api/v1/cart/items/#{cart_items(:one).id}", params: { item: { quantity: 2 } }
    assert_response :unauthorized

    delete "/api/v1/cart/items/#{cart_items(:one).id}"
    assert_response :unauthorized

    delete "/api/v1/cart/items"
    assert_response :unauthorized
  end

  test "show returns the authenticated user's cart and product details" do
    get "/api/v1/cart", headers: auth_headers

    assert_response :success
    body = JSON.parse(response.body).fetch("data")
    assert_equal carts(:one).id, body.fetch("id")
    item = body.fetch("items").sole
    assert_equal cart_items(:one).id, item.fetch("id")
    assert_equal products(:one).id, item.fetch("product_id")
    assert_equal 1, item.fetch("quantity")
    assert_equal "available", item.fetch("status")
    assert_equal products(:one).title, item.dig("product", "title")
    assert item.dig("product", "price")
    assert item.dig("product", "creator")
  end

  test "add creates an item owned by the current user and ignores ownership parameters" do
    assert_difference -> { CartItem.count }, 1 do
      post "/api/v1/cart/items",
        params: {
          item: {
            product_id: products(:two).id,
            quantity: 2,
            cart_id: carts(:two).id,
            user_id: users(:two).id
          }
        },
        headers: auth_headers
    end

    assert_response :created
    cart_item = CartItem.order(:id).last
    assert_equal carts(:one), cart_item.cart
    assert_equal 2, cart_item.quantity
  end

  test "adding an existing product increases its quantity" do
    assert_no_difference -> { CartItem.count } do
      post "/api/v1/cart/items",
        params: { item: { product_id: products(:one).id, quantity: 2 } },
        headers: auth_headers
    end

    assert_response :ok
    assert_equal 3, cart_items(:one).reload.quantity
  end

  test "add rejects unavailable products and invalid or excessive quantities" do
    products(:two).update!(active: false)
    post "/api/v1/cart/items",
      params: { item: { product_id: products(:two).id } },
      headers: auth_headers
    assert_response :unprocessable_entity

    [ 0, -1, 1.5, "1.5", 100 ].each do |quantity|
      post "/api/v1/cart/items",
        params: { item: { product_id: products(:two).id, quantity: quantity } },
        headers: auth_headers
      assert_response :unprocessable_entity
    end
  end

  test "update and delete are scoped to the current user's cart" do
    owned_item_id = cart_items(:one).id

    patch "/api/v1/cart/items/#{cart_items(:two).id}",
      params: { item: { quantity: 4 } },
      headers: auth_headers
    assert_response :not_found

    patch "/api/v1/cart/items/#{cart_items(:one).id}",
      params: { item: { quantity: 4 } },
      headers: auth_headers
    assert_response :success
    assert_equal 4, cart_items(:one).reload.quantity

    delete "/api/v1/cart/items/#{cart_items(:two).id}", headers: auth_headers
    assert_response :not_found

    delete "/api/v1/cart/items/#{owned_item_id}", headers: auth_headers
    assert_response :success
    assert_not CartItem.exists?(owned_item_id)
  end

  test "update validates quantity limits" do
    [ 0, -1, 1.5, "1.5", 100 ].each do |quantity|
      patch "/api/v1/cart/items/#{cart_items(:one).id}",
        params: { item: { quantity: quantity } },
        headers: auth_headers
      assert_response :unprocessable_entity
    end

    assert_equal 1, cart_items(:one).reload.quantity
  end

  test "clear removes only the authenticated user's cart items" do
    owned_item_id = cart_items(:one).id
    other_item_id = cart_items(:two).id

    delete "/api/v1/cart/items", headers: auth_headers

    assert_response :success
    assert_empty JSON.parse(response.body).dig("data", "items")
    assert_not CartItem.exists?(owned_item_id)
    assert CartItem.exists?(other_item_id)
  end
end
