require "test_helper"

class CorsTest < ActionDispatch::IntegrationTest
  test "allows a local frontend preflight request" do
    options "/api/v1/categories", headers: preflight_headers("http://localhost:5173")

    assert_response :ok
    assert_equal "http://localhost:5173", response.headers["Access-Control-Allow-Origin"]
    assert_includes response.headers["Access-Control-Allow-Methods"], "GET"
  end

  test "does not allow an unapproved frontend origin" do
    options "/api/v1/categories", headers: preflight_headers("https://unapproved.example")

    assert_nil response.headers["Access-Control-Allow-Origin"]
  end

  private

  def preflight_headers(origin)
    {
      "Origin" => origin,
      "Access-Control-Request-Method" => "GET",
      "Access-Control-Request-Headers" => "Authorization, Content-Type"
    }
  end
end
