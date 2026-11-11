require "test_helper"

class Api::V1::CategoriesControllerTest < ActionDispatch::IntegrationTest
  test "index is public and returns serialized category data" do
    alpha = Category.create!(name: "Alpha", slug: "alpha")
    zeta = Category.create!(name: "Zeta", slug: "zeta")
    same_a = Category.create!(name: "Same", slug: "same-a")
    same_b = Category.create!(name: "Same", slug: "same-b")

    fixture_one = categories(:one)
    fixture_two = categories(:two)

    get "/api/v1/categories"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal %w[data], body.keys.sort

    data = body.fetch("data")
    assert_kind_of Array, data
    assert_operator data.length, :>=, 1

    data.each do |category|
      assert_equal %w[created_at id name slug updated_at], category.keys.sort
    end

    returned_ids = data.map { |category| category.fetch("id") }
    assert_includes returned_ids, fixture_one.id
    assert_includes returned_ids, fixture_two.id
    assert_includes returned_ids, alpha.id
    assert_includes returned_ids, zeta.id
    assert_includes returned_ids, same_a.id
    assert_includes returned_ids, same_b.id
  end

  test "index orders categories by name then id" do
    Category.create!(name: "Alpha", slug: "alpha")
    same_a = Category.create!(name: "Same", slug: "same-a")
    same_b = Category.create!(name: "Same", slug: "same-b")
    Category.create!(name: "Zeta", slug: "zeta")

    get "/api/v1/categories"

    assert_response :success
    body = JSON.parse(response.body)
    data = body.fetch("data")

    pairs = data.map { |category| [category.fetch("name"), category.fetch("id")] }
    assert_equal pairs.sort_by { |name, id| [name, id] }, pairs

    same_ids = data.select { |category| category.fetch("name") == "Same" }.map { |category| category.fetch("id") }
    assert_operator same_ids.length, :>=, 2
    assert_equal same_ids.sort, same_ids
  end

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
