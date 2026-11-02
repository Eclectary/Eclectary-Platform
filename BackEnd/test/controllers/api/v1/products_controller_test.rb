require "test_helper"

class Api::V1::ProductsControllerTest < ActionDispatch::IntegrationTest
  test "index is public and includes only active products" do
    products(:two).update!(active: false)

    get "/api/v1/products"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [ products(:one).id ], body.fetch("data").map { |product| product.fetch("id") }
    assert_equal true, body.fetch("data").first.fetch("active")
    assert_equal 1, body.fetch("pagination").fetch("total")
  end

  test "show is public for an active product" do
    get "/api/v1/products/#{products(:one).id}"

    assert_response :success
    assert_equal products(:one).id, JSON.parse(response.body).dig("data", "id")
    assert_equal true, JSON.parse(response.body).dig("data", "active")
  end

  test "public serialization retains attached image paths" do
    products(:one).images.attach(
      io: StringIO.new("public image"),
      filename: "public.webp",
      content_type: "image/webp"
    )

    get "/api/v1/products/#{products(:one).id}"

    assert_response :success
    body = JSON.parse(response.body).fetch("data")
    assert body.fetch("image").include?("rails/active_storage")
    assert_equal [ body.fetch("image") ], body.fetch("images")
  end

  test "show does not expose an inactive product" do
    products(:one).update!(active: false)

    get "/api/v1/products/#{products(:one).id}"

    assert_response :not_found
  end
end
