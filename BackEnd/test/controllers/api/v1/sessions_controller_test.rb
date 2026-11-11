require "test_helper"

class Api::V1::SessionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    ApplicationController::AUTHENTICATION_RATE_LIMIT_STORE.clear
  end

  teardown do
    ApplicationController::AUTHENTICATION_RATE_LIMIT_STORE.clear
  end

  test "valid login returns a JWT and user info" do
    post "/api/v1/login", params: { email: users(:one).email, password: "password123" }

    assert_response :success
    body = JSON.parse(response.body)
    assert body["token"].present?
    assert_equal users(:one).id, body["user"]["id"]
    assert_equal "customer", body["user"]["role"]
    assert_not body["user"].key?("password_digest")
  end

  test "login normalizes email casing and whitespace" do
    post "/api/v1/login", params: {
      email: "  #{users(:one).email.upcase}  ",
      password: "password123"
    }

    assert_response :success
    body = JSON.parse(response.body)
    assert body.fetch("token").present?
    assert_equal users(:one).id, body.dig("user", "id")
    assert_equal users(:one).email, body.dig("user", "email")
  end

  test "login returns JSON too many requests after the threshold" do
    Api::V1::SessionsController::LOGIN_RATE_LIMIT.times do
      post "/api/v1/login", params: {
        email: users(:one).email,
        password: "incorrect-password"
      }
      assert_response :unauthorized
    end

    post "/api/v1/login", params: {
      email: users(:one).email,
      password: "incorrect-password"
    }

    assert_response :too_many_requests
    assert_equal(
      { "error" => "Too many requests. Please try again later." },
      JSON.parse(response.body)
    )
  end

  test "login limit does not throttle registration or unrelated public endpoints" do
    Api::V1::SessionsController::LOGIN_RATE_LIMIT.times do
      post "/api/v1/login", params: {
        email: users(:one).email,
        password: "incorrect-password"
      }
    end

    post "/api/v1/login", params: {
      email: users(:one).email,
      password: "incorrect-password"
    }
    assert_response :too_many_requests

    post "/api/v1/users", params: {
      user: {
        email: "independent-limit@example.com",
        password: "password123",
        role: "customer"
      }
    }
    assert_response :created

    get "/api/v1/health"
    assert_response :success
  end

  test "login limit expires after its configured window" do
    Api::V1::SessionsController::LOGIN_RATE_LIMIT.times do
      post "/api/v1/login", params: {
        email: users(:one).email,
        password: "incorrect-password"
      }
      assert_response :unauthorized
    end

    travel Api::V1::SessionsController::LOGIN_RATE_LIMIT_WINDOW + 1.second do
      post "/api/v1/login", params: {
        email: users(:one).email,
        password: "incorrect-password"
      }
      assert_response :unauthorized
    end
  end

  test "invalid password returns unauthorized" do
    post "/api/v1/login", params: { email: users(:one).email, password: "wrong-password" }

    assert_response :unauthorized
    assert_equal "Invalid email or password", JSON.parse(response.body)["error"]
  end

  test "unknown email returns unauthorized" do
    post "/api/v1/login", params: { email: "nobody@example.com", password: "password123" }

    assert_response :unauthorized
  end
end
