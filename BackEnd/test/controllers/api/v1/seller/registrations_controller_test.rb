require "test_helper"

class Api::V1::Seller::RegistrationsControllerTest < ActionDispatch::IntegrationTest
  def auth_headers(user)
    { "Authorization" => "Bearer #{JsonWebToken.encode(user_id: user.id)}" }
  end

  def registration_params
    {
      seller: {
        public_name: "North Star Studio",
        specialty: "Ceramics",
        bio: "Small-batch functional pottery.",
        image_url: "https://example.com/north-star.jpg"
      }
    }
  end

  test "customer promotes their existing account and keeps buyer associations" do
    customer = users(:one)
    cart = customer.cart
    orders = customer.orders.to_a

    assert_no_difference -> { User.count } do
      post "/api/v1/seller/registration",
        params: registration_params,
        headers: auth_headers(customer)
    end

    assert_response :created
    customer.reload
    assert customer.seller?
    assert_equal "North Star Studio", customer.public_name
    assert_equal "Ceramics", customer.specialty
    assert_equal cart, customer.cart
    assert_equal orders, customer.orders.to_a
    assert_equal "seller", response.parsed_body.fetch("role")

    get "/api/v1/cart", headers: auth_headers(customer)
    assert_response :success
    get "/api/v1/orders", headers: auth_headers(customer)
    assert_response :success
  end

  test "registration requires authentication and complete shop identity" do
    post "/api/v1/seller/registration", params: registration_params
    assert_response :unauthorized

    post "/api/v1/seller/registration",
      params: { seller: { public_name: "", specialty: "" } },
      headers: auth_headers(users(:one))
    assert_response :unprocessable_entity
    assert_includes response.parsed_body.fetch("errors"), "Shop name can't be blank"
    assert_includes response.parsed_body.fetch("errors"), "Specialty can't be blank"
  end

  test "existing seller cannot register twice" do
    assert_no_changes -> { users(:two).reload.attributes } do
      post "/api/v1/seller/registration",
        params: registration_params,
        headers: auth_headers(users(:two))
    end

    assert_response :conflict
  end

  test "administrator cannot register as a seller" do
    post "/api/v1/seller/registration",
      params: registration_params,
      headers: auth_headers(users(:administrator))

    assert_response :forbidden
    assert users(:administrator).reload.administrator?
  end

  test "registration ignores protected account fields" do
    original_email = users(:one).email
    params = registration_params
    params[:seller].merge!(email: "changed@example.com", role: "administrator", password: "changed-password")

    post "/api/v1/seller/registration", params: params, headers: auth_headers(users(:one))

    assert_response :created
    assert_equal original_email, users(:one).reload.email
    assert users(:one).seller?
  end
end
