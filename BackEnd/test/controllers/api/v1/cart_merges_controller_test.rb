require "test_helper"

class Api::V1::CartMergesControllerTest < ActionDispatch::IntegrationTest
  def auth_headers(user = users(:one))
    { "Authorization" => "Bearer #{JsonWebToken.encode(user_id: user.id)}" }
  end

  def merge_cart(items, identifier: "guest-transfer-1", user: users(:one))
    post "/api/v1/cart/merge",
      params: { merge_identifier: identifier, items: items },
      headers: auth_headers(user),
      as: :json
  end

  def response_body
    JSON.parse(response.body)
  end

  test "merge requires authentication" do
    assert_no_difference [ "CartItem.count", "CartMerge.count" ] do
      post "/api/v1/cart/merge",
        params: {
          merge_identifier: "unauthenticated",
          items: [ { product_id: products(:one).id, quantity: 2 } ]
        },
        as: :json
    end

    assert_response :unauthorized
  end

  test "merge adds new products with the requested quantities and serializes the cart" do
    assert_difference [ "CartItem.count", "CartMerge.count" ], 1 do
      merge_cart([ { product_id: products(:two).id, quantity: 2 } ])
    end

    assert_response :success
    item = carts(:one).cart_items.find_by!(product: products(:two))
    assert_equal 2, item.quantity
    assert_equal carts(:one).id, response_body.dig("data", "id")
    serialized_item = response_body.dig("data", "items").find { |entry| entry["id"] == item.id }
    assert_equal products(:two).title, serialized_item.dig("product", "title")
    assert_equal "available", serialized_item.fetch("status")
    assert_equal false, response_body.dig("merge", "repeated")
    assert_empty response_body.dig("merge", "skipped_items")
    assert_equal 2, response_body.dig("merge", "added_items", 0, "quantity")
    assert_equal carts(:one), CartMerge.last.cart
  end

  test "merge creates a cart for an account without one" do
    assert_nil users(:administrator).cart

    assert_difference [ "Cart.count", "CartItem.count", "CartMerge.count" ], 1 do
      merge_cart([ { product_id: products(:one).id, quantity: 3 } ], user: users(:administrator))
    end

    assert_response :success
    cart = users(:administrator).reload.cart
    assert_equal 3, cart.cart_items.sole.quantity
    assert_equal cart.id, response_body.dig("data", "id")
  end

  test "duplicate products combine into one existing or new cart item" do
    assert_difference "CartItem.count", 1 do
      merge_cart([
        { product_id: products(:one).id, quantity: 2 },
        { product_id: products(:one).id, quantity: 3 },
        { product_id: products(:two).id, quantity: 4 },
        { product_id: products(:two).id, quantity: 5 }
      ])
    end

    assert_response :success
    assert_equal 6, cart_items(:one).reload.quantity
    assert_equal 9, carts(:one).cart_items.find_by!(product: products(:two)).quantity
    assert_empty response_body.dig("merge", "skipped_items")
  end

  test "quantities cap at 99 and report only excess quantities as skipped" do
    cart_items(:one).update!(quantity: 97)
    merge_cart([
      { product_id: products(:one).id, quantity: 5 },
      { product_id: products(:one).id, quantity: 1 },
      { product_id: products(:two).id, quantity: 100 }
    ])

    assert_response :success
    assert_equal 99, cart_items(:one).reload.quantity
    assert_equal 99, carts(:one).cart_items.find_by!(product: products(:two)).quantity
    assert_equal [ 2, 99 ], response_body.dig("merge", "added_items").map { |item| item["quantity"] }
    skipped = response_body.dig("merge", "skipped_items")
    assert_equal [ "quantity_limit" ] * 3, skipped.map { |item| item["reason"] }
    assert_equal [ 3, 1, 1 ], skipped.map { |item| item["skipped_quantity"] }
  end

  test "inactive and deleted products are skipped and valid products still merge" do
    products(:two).update!(active: false)
    deleted_product = Product.create!(
      title: "Deleted guest product", price: 5, seller: users(:two), category: categories(:one)
    )
    deleted_id = deleted_product.id
    deleted_product.destroy!

    merge_cart([
      { product_id: products(:two).id, quantity: 2 },
      { product_id: deleted_id, quantity: 1 },
      { product_id: products(:one).id, quantity: 2 }
    ])

    assert_response :success
    assert_equal 3, cart_items(:one).reload.quantity
    assert_not carts(:one).cart_items.exists?(product: products(:two))
    skipped = response_body.dig("merge", "skipped_items")
    assert_equal [ products(:two).id, deleted_id ], skipped.map { |item| item["product_id"] }
    assert_equal [ "unavailable_product" ] * 2, skipped.map { |item| item["reason"] }
  end

  test "malformed entries and invalid quantities are reported without changing quantities" do
    invalid_quantities = [ 0, -1, 1.5, "1.5", true, nil ]
    items = invalid_quantities.map { |quantity| { product_id: products(:one).id, quantity: quantity } }
    items << { product_id: "bad-id", quantity: 1 }
    items << "not-an-item"
    items << { product_id: products(:one).id.to_s, quantity: "2" }

    merge_cart(items)

    assert_response :success
    assert_equal 3, cart_items(:one).reload.quantity
    skipped = response_body.dig("merge", "skipped_items")
    assert_equal 8, skipped.length
    assert_equal (0..7).to_a, skipped.map { |item| item["index"] }
    assert_equal "invalid_item", skipped.last.fetch("reason")
  end

  test "ownership fields cannot direct the merge to another user's cart" do
    post "/api/v1/cart/merge",
      params: {
        merge_identifier: "ownership-test",
        user_id: users(:two).id,
        cart_id: carts(:two).id,
        items: [
          {
            product_id: products(:two).id,
            quantity: 4,
            cart_id: carts(:two).id,
            user_id: users(:two).id
          }
        ]
      },
      headers: auth_headers,
      as: :json

    assert_response :success
    assert_equal carts(:one).id, response_body.dig("data", "id")
    assert_equal 4, carts(:one).cart_items.find_by!(product: products(:two)).quantity
    assert_equal 2, cart_items(:two).reload.quantity
    assert_equal carts(:one), CartMerge.last.cart
  end

  test "repeated identifiers preserve recorded results without applying quantities again" do
    items = [
      { product_id: products(:one).id, quantity: 2 },
      { product_id: products(:two).id, quantity: 100 }
    ]
    merge_cart(items)
    assert_response :success
    original_result = response_body.fetch("merge")

    assert_no_difference [ "CartItem.count", "CartMerge.count" ] do
      merge_cart(items)
    end

    assert_response :success
    assert_equal 3, cart_items(:one).reload.quantity
    assert_equal 99, carts(:one).cart_items.find_by!(product: products(:two)).quantity
    assert_equal true, response_body.dig("merge", "repeated")
    assert_equal original_result.fetch("added_items"), response_body.dig("merge", "added_items")
    assert_equal original_result.fetch("skipped_items"), response_body.dig("merge", "skipped_items")
  end

  test "reusing an identifier with changed items never replays a cleared merge" do
    merge_cart([ { product_id: products(:one).id, quantity: 2 } ])
    assert_response :success
    delete "/api/v1/cart/items", headers: auth_headers
    assert_response :success

    assert_no_difference [ "CartItem.count", "CartMerge.count" ] do
      merge_cart([ { product_id: products(:two).id, quantity: 8 } ])
    end

    assert_response :success
    assert_equal true, response_body.dig("merge", "repeated")
    assert_empty response_body.dig("data", "items")
  end

  test "merge identifiers are independent for different users and new transfers" do
    items = [ { product_id: products(:one).id, quantity: 2 } ]
    merge_cart(items)
    assert_response :success
    merge_cart(items, user: users(:two))
    assert_response :success
    assert_equal false, response_body.dig("merge", "repeated")
    assert_equal 2, carts(:two).cart_items.find_by!(product: products(:one)).quantity
    assert_equal 3, cart_items(:one).reload.quantity

    merge_cart(items, identifier: "guest-transfer-2")
    assert_response :success
    assert_equal 5, cart_items(:one).reload.quantity
    assert_equal 3, CartMerge.count
  end

  test "invalid request shapes return errors without persisting changes" do
    [
      { items: [] },
      { merge_identifier: " ", items: [] },
      { merge_identifier: "x" * 129, items: [] },
      { merge_identifier: 12, items: [] },
      { merge_identifier: "missing-items" },
      { merge_identifier: "invalid-items", items: "not-an-array" }
    ].each do |payload|
      assert_no_difference [ "Cart.count", "CartItem.count", "CartMerge.count" ] do
        post "/api/v1/cart/merge", params: payload, headers: auth_headers, as: :json
      end
      assert_response :unprocessable_entity
      assert response_body.fetch("errors").any?
    end
  end

  test "empty merges are recorded and safe to retry" do
    assert_difference "CartMerge.count", 1 do
      merge_cart([])
    end
    assert_response :success
    assert_empty response_body.dig("merge", "added_items")
    assert_empty response_body.dig("merge", "skipped_items")

    assert_no_difference "CartMerge.count" do
      merge_cart([])
    end
    assert_response :success
    assert_equal true, response_body.dig("merge", "repeated")
  end
end
