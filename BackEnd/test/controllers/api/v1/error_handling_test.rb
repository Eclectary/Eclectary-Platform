require "test_helper"

class Api::V1::ErrorHandlingTest < ActionDispatch::IntegrationTest
  setup do
    ApplicationController::AUTHENTICATION_RATE_LIMIT_STORE.clear
  end

  teardown do
    ApplicationController::AUTHENTICATION_RATE_LIMIT_STORE.clear
  end

  test "authentication and authorization failures use the error envelope" do
    get "/api/v1/users/me", as: :json
    assert_api_error :unauthorized, "Unauthorized"

    post "/api/v1/login",
      params: { email: users(:one).email, password: "incorrect-password" }, as: :json
    assert_api_error :unauthorized, "Invalid email or password"

    patch "/api/v1/users/me",
      params: { user: { public_name: "Not permitted" } },
      headers: auth_headers(users(:one)), as: :json
    assert_api_error :forbidden, "Forbidden"
  end

  test "missing records use a safe JSON response across public and private lookups" do
    [
      [ "/api/v1/products/0", nil ],
      [ "/api/v1/categories/0", nil ],
      [ "/api/v1/orders/0", users(:one) ],
      [ "/api/v1/seller/products/0", users(:two) ],
      [ "/api/v1/seller/orders/0", users(:two) ]
    ].each do |path, user|
      get path, headers: user ? auth_headers(user) : {}, as: :json
      assert_api_error :not_found, "Record not found."
    end

    get "/api/v1/sellers/0", as: :json
    assert_api_error :not_found, "Seller not found"

    delete "/api/v1/cart/items/0", headers: auth_headers(users(:one)), as: :json
    assert_api_error :not_found, "Cart item not found."
  end

  test "missing wrappers return bad request without changing records" do
    wrapped_requests.each do |method, path, wrapper, user|
      ApplicationController::AUTHENTICATION_RATE_LIMIT_STORE.clear

      assert_no_difference [ "User.count", "Product.count", "CartItem.count", "Order.count" ] do
        public_send(method, path, params: {}, headers: auth_headers(user), as: :json)
      end

      assert_api_error :bad_request, "Missing or invalid parameter: #{wrapper}."
    end
  end

  test "wrong wrapper types return bad request without changing records" do
    wrapped_requests.each do |method, path, wrapper, user|
      [ nil, "invalid", 123, true, false, [], [ { title: "Not an object" } ] ].each do |value|
        ApplicationController::AUTHENTICATION_RATE_LIMIT_STORE.clear

        assert_no_difference [ "User.count", "Product.count", "CartItem.count", "Order.count" ] do
          public_send(method, path,
            params: { wrapper => value }, headers: auth_headers(user), as: :json)
        end

        assert_api_error :bad_request, "Missing or invalid parameter: #{wrapper}."
      end
    end
  end

  test "malformed JSON returns bad request for wrapped requests and login" do
    requests = wrapped_requests + [ [ :post, "/api/v1/login", nil, users(:one) ] ]

    requests.each do |method, path, _wrapper, user|
      ApplicationController::AUTHENTICATION_RATE_LIMIT_STORE.clear

      public_send(method, path, params: '{"invalid":',
        headers: auth_headers(user).merge(
          "Content-Type" => "application/json",
          "Accept" => "application/json"
        ))

      assert_api_error :bad_request, "Malformed JSON request body."
    end
  end

  test "invalid values in object wrappers remain validation errors" do
    [
      [ :post, "/api/v1/users", { user: { email: "invalid" } }, users(:one) ],
      [ :patch, "/api/v1/users/me", { user: { image_url: "invalid" } }, users(:two) ],
      [ :post, "/api/v1/seller/products", { product: { title: " " } }, users(:two) ],
      [ :patch, "/api/v1/seller/products/#{products(:one).id}", { product: { title: " " } }, users(:two) ],
      [ :post, "/api/v1/cart/items", { item: { quantity: -1 } }, users(:one) ],
      [ :patch, "/api/v1/cart/items/#{cart_items(:one).id}", { item: { quantity: -1 } }, users(:one) ],
      [ :post, "/api/v1/orders", { order: { items: [] } }, users(:one) ],
      [ :patch, fulfillment_path, { fulfillment: { status: "invalid" } }, users(:two) ]
    ].each do |method, path, payload, user|
      public_send(method, path, params: payload, headers: auth_headers(user), as: :json)
      assert_api_error :unprocessable_entity
    end
  end

  test "idempotency conflicts use the error envelope and preserve the original order" do
    payload = {
      order: {
        customer_name: "Buyer", customer_email: "buyer@example.com", customer_phone: "555-0101",
        shipping_address: "123 Main St", shipping_city: "Durham", shipping_state: "NC",
        shipping_postal_code: "27701",
        items: [ { product_id: products(:one).id, quantity: 1 } ]
      }
    }
    headers = auth_headers(users(:one)).merge("Idempotency-Key" => "error-contract")

    post "/api/v1/orders", params: payload, headers: headers, as: :json
    assert_response :created

    payload[:order][:shipping_city] = "Raleigh"
    assert_no_difference [ "Order.count", "OrderItem.count" ] do
      post "/api/v1/orders", params: payload, headers: headers, as: :json
    end
    assert_api_error :conflict, "Idempotency key has already been used with a different order payload."
  end

  test "rate limiting uses the error envelope" do
    Api::V1::SessionsController::LOGIN_RATE_LIMIT.times do
      post "/api/v1/login",
        params: { email: users(:one).email, password: "incorrect-password" }, as: :json
      assert_api_error :unauthorized, "Invalid email or password"
    end

    post "/api/v1/login",
      params: { email: users(:one).email, password: "incorrect-password" }, as: :json
    assert_api_error :too_many_requests, "Too many requests. Please try again later."
  end

  private

  def assert_api_error(status, message = nil)
    assert_response status
    assert_equal "application/json", response.media_type
    assert_equal [ "errors" ], response.parsed_body.keys
    errors = response.parsed_body.fetch("errors")
    assert_kind_of Array, errors
    assert errors.any?
    assert errors.all? { |error| error.is_a?(String) && error.present? }
    assert_equal [ message ], errors if message
  end

  def auth_headers(user)
    { "Authorization" => "Bearer #{JsonWebToken.encode(user_id: user.id)}" }
  end

  def fulfillment_path
    item = order_items(:one)
    "/api/v1/seller/orders/#{item.order_id}/items/#{item.id}/fulfillment"
  end

  def wrapped_requests
    [
      [ :post, "/api/v1/users", :user, users(:one) ],
      [ :patch, "/api/v1/users/me", :user, users(:two) ],
      [ :post, "/api/v1/seller/products", :product, users(:two) ],
      [ :patch, "/api/v1/seller/products/#{products(:one).id}", :product, users(:two) ],
      [ :post, "/api/v1/cart/items", :item, users(:one) ],
      [ :patch, "/api/v1/cart/items/#{cart_items(:one).id}", :item, users(:one) ],
      [ :post, "/api/v1/orders", :order, users(:one) ],
      [ :patch, fulfillment_path, :fulfillment, users(:two) ]
    ]
  end
end
