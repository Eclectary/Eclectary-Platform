require "test_helper"

class Api::V1::UsersControllerTest < ActionDispatch::IntegrationTest
  def auth_headers(user)
    { "Authorization" => "Bearer #{JsonWebToken.encode(user_id: user.id)}" }
  end

  # --- Registration ---

  test "registration succeeds with valid params" do
    post "/api/v1/users", params: {
      user: { email: "brand_new@example.com", password: "password123", role: "customer" }
    }

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal "brand_new@example.com", body["email"]
    assert_not body.key?("password_digest")
    decoded_token = JsonWebToken.decode(body["token"])
    assert_equal User.find_by!(email: "brand_new@example.com").id, decoded_token["user_id"]
  end

  test "registration fails with duplicate email" do
    post "/api/v1/users", params: {
      user: { email: users(:one).email, password: "password123", role: "customer" }
    }

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body)["errors"].join, "Email has already been taken"
  end

  test "registration fails with invalid role" do
    post "/api/v1/users", params: {
      user: { email: "invalid_role@example.com", password: "password123", role: "superadmin" }
    }

    assert_response :unprocessable_entity
  end

  test "registration cannot self-elevate to administrator" do
    post "/api/v1/users", params: {
      user: { email: "wannabe_admin@example.com", password: "password123", role: "administrator" }
    }

    assert_response :created
    assert_equal "customer", JSON.parse(response.body)["role"]
  end

  # --- Authentication on /me ---

  test "me without a token is unauthorized" do
    get "/api/v1/users/me"

    assert_response :unauthorized
  end

  test "me with an invalid token is unauthorized" do
    get "/api/v1/users/me", headers: { "Authorization" => "Bearer not-a-real-token" }

    assert_response :unauthorized
  end

  test "me with an expired token is unauthorized" do
    expired_token = JsonWebToken.encode({ user_id: users(:one).id }, 1.hour.ago)
    get "/api/v1/users/me", headers: { "Authorization" => "Bearer #{expired_token}" }

    assert_response :unauthorized
  end

  test "me with a valid token returns the current user" do
    get "/api/v1/users/me", headers: auth_headers(users(:one))

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal users(:one).id, body["id"]
    assert_equal users(:one).email, body["email"]
    assert_equal "customer", body["role"]
  end

  # --- Authorization on /index (administrator only) ---

  test "administrator can list users" do
    get "/api/v1/users", headers: auth_headers(users(:administrator))

    assert_response :success
  end

  test "customer cannot list users" do
    get "/api/v1/users", headers: auth_headers(users(:one))

    assert_response :forbidden
  end

  test "seller cannot list users" do
    get "/api/v1/users", headers: auth_headers(users(:two))

    assert_response :forbidden
  end

  test "unauthenticated request to list users is unauthorized, not forbidden" do
    get "/api/v1/users"

    assert_response :unauthorized
  end
end
