require "test_helper"

class Api::V1::OrdersControllerTest < ActionDispatch::IntegrationTest
  def auth_headers(user = users(:one))
    { "Authorization" => "Bearer #{JsonWebToken.encode(user_id: user.id)}" }
  end

  def valid_order_payload
    {
      order: {
        customer_name: "Customer One",
        customer_email: "customer@example.com",
        customer_phone: "555-555-0101",
        shipping_address: "123 Main St",
        shipping_city: "Winston-Salem",
        shipping_state: "NC",
        shipping_postal_code: "27101",
        items: [
          { product_id: products(:one).id, quantity: 2 },
          { product_id: products(:two).id, quantity: 1 }
        ]
      }
    }
  end

  test "create requires authentication" do
    post "/api/v1/orders", params: valid_order_payload

    assert_response :unauthorized
  end

  test "create persists an owned pending order and all server-priced items" do
    assert_difference -> { Order.count }, 1 do
      assert_difference -> { OrderItem.count }, 2 do
        post "/api/v1/orders", params: valid_order_payload, headers: auth_headers
      end
    end

    assert_response :created
    order = Order.order(:id).last
    assert_equal users(:one), order.user
    assert_equal "pending", order.status
    assert_equal BigDecimal("6.50"), order.shipping_amount
    assert_equal [ products(:one).price, products(:two).price ], order.order_items.order(:id).map(&:price)

    body = JSON.parse(response.body).fetch("data")
    assert_equal order.id, body.fetch("id")
    assert_equal "pending", body.fetch("status")
    assert_equal "Customer One", body.fetch("customer_name")
    assert_equal "customer@example.com", body.fetch("customer_email")
    assert_equal "123 Main St", body.fetch("shipping_address")
    assert_equal "Winston-Salem", body.fetch("shipping_city")
    assert_equal "NC", body.fetch("shipping_state")
    assert_equal "27101", body.fetch("shipping_postal_code")
    assert_equal 6.5, body.fetch("shipping_amount")
    assert_equal 2, body.fetch("items").length
    assert_equal order.total.to_f, body.fetch("subtotal")
    assert_equal order.final_total.to_f, body.fetch("final_total")
    assert_equal products(:one).title, body.fetch("items").first.fetch("title")
  end

  test "server-owned values cannot be overridden by the client" do
    payload = valid_order_payload
    payload[:order].merge!(
      user_id: users(:two).id,
      status: "paid",
      shipping_amount: 0
    )
    payload[:order][:items].first[:price] = 0

    post "/api/v1/orders", params: payload, headers: auth_headers

    assert_response :created
    order = Order.order(:id).last
    assert_equal users(:one), order.user
    assert_equal "pending", order.status
    assert_equal BigDecimal("6.50"), order.shipping_amount
    assert_equal products(:one).price, order.order_items.order(:id).first.price
  end

  test "create rejects an empty item list" do
    payload = valid_order_payload
    payload[:order][:items] = []

    assert_no_difference [ -> { Order.count }, -> { OrderItem.count } ] do
      post "/api/v1/orders", params: payload, headers: auth_headers
    end

    assert_response :unprocessable_entity
  end

  test "create rejects invalid quantities" do
    [ 0, -1, 1.5, "1.5" ].each do |quantity|
      payload = valid_order_payload
      payload[:order][:items] = [ { product_id: products(:one).id, quantity: quantity } ]

      assert_no_difference [ -> { Order.count }, -> { OrderItem.count } ] do
        post "/api/v1/orders", params: payload, headers: auth_headers
      end
      assert_response :unprocessable_entity
    end
  end

  test "a missing product rolls back the entire order and every item" do
    payload = valid_order_payload
    payload[:order][:items] << { product_id: Product.maximum(:id) + 1_000, quantity: 1 }

    assert_no_difference [ -> { Order.count }, -> { OrderItem.count } ] do
      post "/api/v1/orders", params: payload, headers: auth_headers
    end

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body).fetch("errors").join, "unavailable"
  end

  test "required customer and shipping fields are validated" do
    %i[customer_name customer_email customer_phone shipping_address shipping_city shipping_state shipping_postal_code].each do |field|
      payload = valid_order_payload
      payload[:order][field] = ""

      assert_no_difference -> { Order.count } do
        post "/api/v1/orders", params: payload, headers: auth_headers
      end
      assert_response :unprocessable_entity
    end
  end

  test "show and index remain scoped to the current user" do
    get "/api/v1/orders", headers: auth_headers
    assert_response :success
    assert_equal [ orders(:one).id ], JSON.parse(response.body).fetch("data").map { |order| order.fetch("id") }

    get "/api/v1/orders/#{orders(:two).id}", headers: auth_headers
    assert_response :not_found
  end
end
