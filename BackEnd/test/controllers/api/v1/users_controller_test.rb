require "test_helper"

class Api::V1::UsersControllerTest < ActionDispatch::IntegrationTest
  setup do
    ApplicationController::AUTHENTICATION_RATE_LIMIT_STORE.clear
  end

  teardown do
    ApplicationController::AUTHENTICATION_RATE_LIMIT_STORE.clear
  end

  def auth_headers(user)
    { "Authorization" => "Bearer #{JsonWebToken.encode(user_id: user.id)}" }
  end

  # --- Registration ---

  test "registration succeeds without authentication" do
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

  test "registration accepts an eight character password" do
    post "/api/v1/users", params: {
      user: { email: "eight@example.com", password: "eight888", role: "customer" }
    }

    assert_response :created
    assert User.find_by!(email: "eight@example.com").authenticate("eight888")
  end

  test "registration rejects a password shorter than eight characters" do
    assert_no_difference -> { User.count } do
      post "/api/v1/users", params: {
        user: { email: "short@example.com", password: "short7", role: "customer" }
      }
    end

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body).fetch("errors").join, "Password is too short"
  end

  test "registration rejects a missing password" do
    assert_no_difference -> { User.count } do
      post "/api/v1/users", params: {
        user: { email: "missing-password@example.com", role: "customer" }
      }
    end

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body).fetch("errors").join, "Password can't be blank"
  end

  test "registration rejects a mismatched password confirmation" do
    assert_no_difference -> { User.count } do
      post "/api/v1/users", params: {
        user: {
          email: "mismatch@example.com",
          password: "password123",
          password_confirmation: "different-password",
          role: "customer"
        }
      }
    end

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body).fetch("errors").join, "Password confirmation doesn't match"
  end

  test "registration normalizes email casing and whitespace" do
    post "/api/v1/users", params: {
      user: { email: "  New.Member@Example.COM  ", password: "password123", role: "customer" }
    }

    assert_response :created
    assert_equal "new.member@example.com", JSON.parse(response.body).fetch("email")
    assert User.exists?(email: "new.member@example.com")
  end

  test "registration fails with duplicate email" do
    post "/api/v1/users", params: {
      user: { email: users(:one).email, password: "password123", role: "customer" }
    }

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body)["errors"].join, "Email has already been taken"
  end

  test "registration rejects a case-variant duplicate email" do
    assert_no_difference -> { User.count } do
      post "/api/v1/users", params: {
        user: { email: users(:one).email.upcase, password: "password123", role: "customer" }
      }
    end

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body).fetch("errors").join, "Email has already been taken"
  end

  test "registration returns JSON too many requests after the threshold" do
    invalid_registration = {
      user: {
        email: "rate-limited@example.com",
        password: "short",
        role: "customer"
      }
    }

    Api::V1::UsersController::REGISTRATION_RATE_LIMIT.times do
      post "/api/v1/users", params: invalid_registration
      assert_response :unprocessable_entity
    end

    post "/api/v1/users", params: invalid_registration

    assert_response :too_many_requests
    assert_equal(
      { "error" => "Too many requests. Please try again later." },
      JSON.parse(response.body)
    )
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

  test "seller registration accepts public profile fields" do
    post "/api/v1/users", params: {
      user: {
        email: "new_seller@example.com", password: "password123", role: "seller",
        public_name: "New Studio", image_url: "https://example.com/studio.jpg",
        specialty: "Textiles", bio: "Handwoven goods."
      }
    }

    assert_response :created
    seller = User.find_by!(email: "new_seller@example.com")
    assert_equal "New Studio", seller.public_name
    assert_equal "https://example.com/studio.jpg", seller.image_url
    assert_equal "Textiles", seller.specialty
    assert_equal "Handwoven goods.", seller.bio
  end

  test "me without a token is unauthorized" do
    get "/api/v1/users/me"

    assert_response :unauthorized
  end

  test "me with a malformed Authorization header is unauthorized" do
    [ "Bearer", "Bearer token extra", "Bearer " ].each do |authorization|
      get "/api/v1/users/me", headers: { "Authorization" => authorization }

      assert_response :unauthorized
    end
  end

  test "me with an incorrect Authorization scheme is unauthorized" do
    get "/api/v1/users/me", headers: { "Authorization" => "Basic token" }

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

  test "me with a valid Bearer token returns the current user" do
    get "/api/v1/users/me", headers: auth_headers(users(:one))

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal users(:one).id, body["id"]
    assert_equal users(:one).email, body["email"]
    assert_equal "customer", body["role"]
  end

  test "me with a token missing the user ID is unauthorized" do
    token = JsonWebToken.encode({})
    get "/api/v1/users/me", headers: { "Authorization" => "Bearer #{token}" }

    assert_response :unauthorized
    assert_equal({ "error" => "Unauthorized" }, JSON.parse(response.body))
  end

  test "me with a token for a nonexistent user is unauthorized" do
    token = JsonWebToken.encode(user_id: User.maximum(:id).to_i + 1)
    get "/api/v1/users/me", headers: { "Authorization" => "Bearer #{token}" }

    assert_response :unauthorized
    assert_equal({ "error" => "Unauthorized" }, JSON.parse(response.body))
  end

  test "me with a token with an invalid signature is unauthorized" do
    token = JWT.encode({ user_id: users(:one).id }, "incorrect-signing-key", "HS256")
    get "/api/v1/users/me", headers: { "Authorization" => "Bearer #{token}" }

    assert_response :unauthorized
    assert_equal({ "error" => "Unauthorized" }, JSON.parse(response.body))
  end

  test "me with a token using an unsupported algorithm is unauthorized" do
    token = JWT.encode({ user_id: users(:one).id }, JsonWebToken::SECRET_KEY, "HS384")
    get "/api/v1/users/me", headers: { "Authorization" => "Bearer #{token}" }

    assert_response :unauthorized
    assert_equal({ "error" => "Unauthorized" }, JSON.parse(response.body))
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
