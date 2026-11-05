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
    assert_equal 1, body.fetch("pagination").fetch("total_pages")
  end

  test "index filters by category and excludes other and inactive products" do
    inactive = create_product(category: categories(:one), title: "Inactive match", active: false)

    get "/api/v1/products", params: { category_id: categories(:one).id }

    assert_response :success
    body = JSON.parse(response.body)
    ids = body.fetch("data").map { |product| product.fetch("id") }
    assert_includes ids, products(:one).id
    assert_not_includes ids, products(:two).id
    assert_not_includes ids, inactive.id
    assert body.fetch("data").all? { |product| product.fetch("category_id") == categories(:one).id }
  end

  test "index safely returns no products for nonpositive malformed or nonexistent categories" do
    [ 0, -1, "not-a-number", Category.maximum(:id) + 1 ].each do |category_id|
      get "/api/v1/products", params: { category_id: category_id }

      assert_response :success
      body = JSON.parse(response.body)
      assert_empty body.fetch("data")
      assert_equal 0, body.dig("pagination", "total")
    end
  end

  test "index searches product titles with case-insensitive partial matching" do
    products(:one).update!(title: "Handwoven Sunburst Basket")
    products(:two).update!(title: "Unrelated Object")

    get "/api/v1/products", params: { search: "SUNBURST" }

    assert_response :success
    assert_equal [ products(:one).id ], response_product_ids
  end

  test "index searches product descriptions" do
    products(:one).update!(description: "Made with a rare indigo weave")
    products(:two).update!(description: "Plain description")

    get "/api/v1/products", params: { search: "indigo weave" }

    assert_response :success
    assert_equal [ products(:one).id ], response_product_ids
  end

  test "index searches category names" do
    categories(:one).update!(name: "Ceramic Sculpture")
    categories(:two).update!(name: "Textiles")

    get "/api/v1/products", params: { search: "ceramic" }

    assert_response :success
    assert_equal [ products(:one).id ], response_product_ids
  end

  test "index searches seller public names" do
    users(:two).update!(public_name: "North Star Studio")

    get "/api/v1/products", params: { search: "star studio" }

    assert_response :success
    assert_equal [ products(:two).id, products(:one).id ].sort, response_product_ids.sort
  end

  test "index treats blank search as no search filter" do
    get "/api/v1/products", params: { search: "   " }

    assert_response :success
    assert_equal Product.active.count, JSON.parse(response.body).dig("pagination", "total")
  end

  test "index treats SQL wildcard characters as literals" do
    percent_product = create_product(title: "100% Hand Dyed")
    underscore_product = create_product(title: "Studio_One")
    create_product(title: "1000 Hand Dyed")
    create_product(title: "StudioXOne")

    get "/api/v1/products", params: { search: "%" }
    assert_equal [ percent_product.id ], response_product_ids

    get "/api/v1/products", params: { search: "_" }
    assert_equal [ underscore_product.id ], response_product_ids
  end

  test "index sorts newest first by default and for newest" do
    older, newer = prepare_sort_products

    get "/api/v1/products", params: { sort: "newest" }

    assert_equal [ newer.id, older.id ], response_product_ids
  end

  test "index sorts oldest first" do
    older, newer = prepare_sort_products

    get "/api/v1/products", params: { sort: "oldest" }

    assert_equal [ older.id, newer.id ], response_product_ids
  end

  test "index sorts by ascending price with id as a tiebreaker" do
    lower, higher = prepare_price_products

    get "/api/v1/products", params: { sort: "price-asc" }

    assert_equal [ lower.id, higher.id ], response_product_ids
  end

  test "index sorts by descending price with id as a tiebreaker" do
    lower, higher = prepare_price_products

    get "/api/v1/products", params: { sort: "price-desc" }

    assert_equal [ higher.id, lower.id ], response_product_ids
  end

  test "index falls back to newest sorting for an invalid sort" do
    older, newer = prepare_sort_products

    get "/api/v1/products", params: { sort: "products.price DESC; DROP TABLE products" }

    assert_equal [ newer.id, older.id ], response_product_ids
  end

  test "index uses default pagination when pagination is requested" do
    23.times { |index| create_product(title: "Pagination product #{index}") }

    get "/api/v1/products", params: { page: 1 }

    body = JSON.parse(response.body)
    assert_equal 24, body.fetch("data").length
    assert_equal({ "page" => 1, "per_page" => 24, "total" => 25, "total_pages" => 2 }, body.fetch("pagination"))
  end

  test "index supports requested page and per page" do
    older, newer = prepare_sort_products

    get "/api/v1/products", params: { page: 2, per_page: 1, sort: "oldest" }

    body = JSON.parse(response.body)
    assert_equal [ newer.id ], body.fetch("data").map { |product| product.fetch("id") }
    assert_equal({ "page" => 2, "per_page" => 1, "total" => 2, "total_pages" => 2 }, body.fetch("pagination"))
    assert_not_equal older.id, body.fetch("data").first.fetch("id")
  end

  test "index limits requested page size to one hundred" do
    get "/api/v1/products", params: { per_page: 1_000 }

    assert_equal 100, JSON.parse(response.body).dig("pagination", "per_page")
  end

  test "index normalizes zero negative and malformed pagination values" do
    [ [ 0, 0 ], [ -2, -5 ], [ "nope", "invalid" ] ].each do |page, per_page|
      get "/api/v1/products", params: { page: page, per_page: per_page }

      pagination = JSON.parse(response.body).fetch("pagination")
      assert_equal 1, pagination.fetch("page")
      assert_equal 24, pagination.fetch("per_page")
      assert_equal Product.active.count, pagination.fetch("total")
      assert_equal 1, pagination.fetch("total_pages")
    end
  end

  test "index returns an empty page beyond the available results with correct metadata" do
    get "/api/v1/products", params: { page: 3, per_page: 1 }

    body = JSON.parse(response.body)
    assert_empty body.fetch("data")
    assert_equal({ "page" => 3, "per_page" => 1, "total" => 2, "total_pages" => 2 }, body.fetch("pagination"))
  end

  test "index returns sensible pagination metadata for an empty result" do
    Product.update_all(active: false)

    get "/api/v1/products", params: { page: 1 }

    body = JSON.parse(response.body)
    assert_empty body.fetch("data")
    assert_equal({ "page" => 1, "per_page" => 24, "total" => 0, "total_pages" => 0 }, body.fetch("pagination"))
  end

  test "index composes active category search sorting and pagination" do
    cheap = create_product(category: categories(:one), title: "Woven Moon Small", price: 10)
    expensive = create_product(category: categories(:one), title: "Woven Moon Large", price: 30)
    create_product(category: categories(:one), title: "Woven Moon Hidden", price: 50, active: false)
    create_product(category: categories(:two), title: "Woven Moon Other Category", price: 100)

    get "/api/v1/products", params: {
      category_id: categories(:one).id,
      search: "woven moon",
      sort: "price-desc",
      page: 1,
      per_page: 1
    }

    body = JSON.parse(response.body)
    assert_equal [ expensive.id ], body.fetch("data").map { |product| product.fetch("id") }
    assert_equal({ "page" => 1, "per_page" => 1, "total" => 2, "total_pages" => 2 }, body.fetch("pagination"))
    assert_not_equal cheap.id, body.fetch("data").first.fetch("id")
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

  private

  def create_product(title:, category: categories(:one), description: "Marketplace product", price: 15, active: true)
    Product.create!(
      title: title,
      description: description,
      price: price,
      seller: users(:two),
      category: category,
      active: active
    )
  end

  def response_product_ids
    JSON.parse(response.body).fetch("data").map { |product| product.fetch("id") }
  end

  def prepare_sort_products
    products(:one).update_columns(created_at: 2.days.ago)
    products(:two).update_columns(created_at: 1.day.ago)
    [ products(:one), products(:two) ]
  end

  def prepare_price_products
    products(:one).update!(price: 5)
    products(:two).update!(price: 25)
    [ products(:one), products(:two) ]
  end
end
