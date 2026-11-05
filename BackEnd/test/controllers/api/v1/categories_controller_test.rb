require "test_helper"

class Api::V1::CategoriesControllerTest < ActionDispatch::IntegrationTest
  test "show is public and returns serialized category data" do
    category = categories(:one)

    get "/api/v1/categories/#{category.id}"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal %w[data], body.keys.sort

    data = body.fetch("data")
    assert_equal %w[created_at id name slug updated_at], data.keys.sort
    assert_equal category.id, data.fetch("id")
    assert_equal category.name, data.fetch("name")
    assert_equal category.slug, data.fetch("slug")
    assert_equal category.created_at.as_json, data.fetch("created_at")
    assert_equal category.updated_at.as_json, data.fetch("updated_at")
  end

  test "show returns not found for a nonexistent category" do
    get "/api/v1/categories/#{Category.maximum(:id) + 1}"

    assert_response :not_found
  end

  test "show returns not found for a malformed category id" do
    get "/api/v1/categories/not-a-number"

    assert_response :not_found
  end
end
