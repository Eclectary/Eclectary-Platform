require "test_helper"

class Api::V1::SellersControllerTest < ActionDispatch::IntegrationTest
  setup do
    @seller = users(:two)
    @seller.update!(
      public_name: "Clay Studio",
      image_url: "https://example.com/clay.jpg",
      specialty: "Ceramics",
      bio: "Handmade bowls."
    )
  end

  test "public index returns only sellers and an explicit public profile allowlist" do
    other_seller = User.create!(email: "another@example.com", password: "password123", role: "seller")
    get "/api/v1/sellers"

    assert_response :success
    body = response.parsed_body
    assert_equal [ "data" ], body.keys
    assert_equal [ @seller.id, other_seller.id ].sort, body["data"].map { |seller| seller["id"] }
    body["data"].each do |seller|
      assert_equal %w[bio id image name specialty], seller.keys.sort
    end
    assert_equal({
      "id" => @seller.id,
      "name" => "Clay Studio",
      "image" => "https://example.com/clay.jpg",
      "specialty" => "Ceramics",
      "bio" => "Handmade bowls."
    }, body["data"].find { |seller| seller["id"] == @seller.id })
    assert_equal "Maker ##{other_seller.id}", body["data"].find { |seller| seller["id"] == other_seller.id }["name"]
    assert_not_includes response.body, @seller.email
    assert_not_includes response.body, @seller.password_digest
  end

  test "index returns an empty data array when there are no sellers" do
    User.where(role: "seller").update_all(role: "customer")
    get "/api/v1/sellers"

    assert_response :success
    assert_equal({ "data" => [] }, response.parsed_body)
  end

  test "public show returns only the public seller profile" do
    get "/api/v1/sellers/#{@seller.id}"

    assert_response :success
    assert_equal %w[bio id image name specialty], response.parsed_body["data"].keys.sort
    assert_equal "Clay Studio", response.parsed_body["data"]["name"]
    assert_not_includes response.body, @seller.email
    assert_not_includes response.body, @seller.password_digest
  end

  test "show does not expose customer administrator or missing accounts" do
    [ users(:one).id, users(:administrator).id, User.maximum(:id) + 1 ].each do |id|
      get "/api/v1/sellers/#{id}"

      assert_response :not_found
      assert_equal({ "error" => "Seller not found" }, response.parsed_body)
    end
  end

  test "incomplete profiles do not derive public information from email" do
    @seller.update!(public_name: " ", image_url: nil, specialty: nil, bio: nil)
    get "/api/v1/sellers/#{@seller.id}"

    assert_response :success
    assert_equal({
      "id" => @seller.id, "name" => "Maker ##{@seller.id}",
      "image" => nil, "specialty" => nil, "bio" => nil
    }, response.parsed_body["data"])
  end
end
