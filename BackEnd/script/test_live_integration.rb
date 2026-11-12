require "base64"
require "bigdecimal"
require "json"
require "net/http"
require "openssl"
require "open3"
require "securerandom"
require "socket"
require "uri"
require_relative "../lib/integration_database"

FRONTEND_ORIGIN = ENV.fetch("FRONTEND_ORIGIN", "http://localhost:5173")

class IntegrationFailure < StandardError; end

class PinnedIntegrationHTTP < Net::HTTP
  attr_reader :peer_pid

  def initialize(path, _port)
    super("localhost", 3000)
    @path = path
    self.max_retries = 0
    self.read_timeout = 10
    self.keep_alive_timeout = 60
  end

  private

  def connect
    raise IntegrationFailure, "API connection closed; refusing to reconnect" if @connected_once
    @connected_once = true
    socket = UNIXSocket.new(@path)
    @peer_pid, uid, = socket.getsockopt(Socket::SOL_SOCKET, Socket::SO_PEERCRED).unpack("iii")
    unless @peer_pid.positive? && uid == Process.uid
      socket.close
      raise IntegrationFailure, "API socket peer is not owned by the current user"
    end
    @socket = Net::BufferedIO.new(socket, read_timeout: @read_timeout, write_timeout: @write_timeout)
    @last_communicated = nil
  end
end

class LiveIntegrationTest
  def initialize
    @passes = []
  end

  def run(verify_only: false)
    verify_database_safety!
    return if verify_only

    verify_environment
    verify_public_catalog
    verify_customer_workflows
    verify_seller_workflows

    puts
    puts "PASS: #{@passes.length} live integration checks"
  rescue IntegrationFailure => error
    warn "FAIL: #{error.message}"
    warn "PASS before failure: #{@passes.length}"
    exit 1
  ensure
    @api_http.finish if @api_http&.started?
  end

  private

  def verify_database_safety!
    IntegrationDatabase.validate_environment!(ENV)
    IntegrationDatabase.validate_secret!(ENV["INTEGRATION_PROOF_SECRET"])
    path = ENV["INTEGRATION_API_SOCKET"].to_s
    assert(path.start_with?("/") && File.socket?(path)) { "INTEGRATION_API_SOCKET must name an existing absolute Unix socket" }
    @api_http = PinnedIntegrationHTTP.new(path, nil, nil)
    @api_http.start
    verify_api_database!
    pass("API process and independently queried PostgreSQL instance match")
  rescue IntegrationDatabase::VerificationError, SystemCallError, IOError => error
    raise IntegrationFailure, "database verification failed: #{error.message}"
  end

  def verify_api_database!
    identity = IntegrationDatabase.validate_identity!(database_scalar(IntegrationDatabase::IDENTITY_SQL), ENV)
    challenge = SecureRandom.hex(32)
    request = Net::HTTP::Get.new("/api/v1/health")
    request["X-Integration-Challenge"] = challenge
    response = @api_http.request(request)
    assert_status(response, 200, "API database verification")
    expected = IntegrationDatabase.proof(ENV.fetch("INTEGRATION_PROOF_SECRET"), challenge, identity, @api_http.peer_pid)
    actual = response["x-integration-proof"].to_s
    assert(actual.bytesize == expected.bytesize && OpenSSL.fixed_length_secure_compare(actual, expected)) do
      "API database proof is missing or does not match the confirmed instance and socket peer"
    end
    [ challenge, expected ]
  rescue IntegrationDatabase::VerificationError, SystemCallError, IOError, Timeout::Error => error
    raise IntegrationFailure, "API database verification failed: #{error.message}"
  end

  def verify_environment
    frontend = request(:get, FRONTEND_ORIGIN)
    assert_status(frontend, 200, "frontend health")
    assert(frontend.body.include?('id="root"')) { "frontend response did not contain the React root" }
    pass("frontend server responds")

    health = api_request(:get, "/health")
    assert_status(health, 200, "API health")
    assert_json_value(health, "status", "ok")
    pass("Rails API health responds with JSON")

    cors = api_request(:options, "/products", headers: {
      "Origin" => FRONTEND_ORIGIN,
      "Access-Control-Request-Method" => "GET"
    })
    assert_status(cors, 200, "CORS preflight")
    assert(cors["access-control-allow-origin"] == FRONTEND_ORIGIN) { "CORS origin was not allowed" }
    assert(cors["access-control-allow-methods"].to_s.include?("GET")) { "CORS GET method was not allowed" }
    pass("CORS permits the frontend origin")
  end

  def verify_public_catalog
    products_response = api_request(:get, "/products", headers: { "Origin" => FRONTEND_ORIGIN })
    assert_status(products_response, 200, "product index")
    assert(products_response["access-control-allow-origin"] == FRONTEND_ORIGIN) do
      "product response omitted the frontend CORS origin"
    end
    products_payload = json(products_response)
    assert(products_payload["data"].is_a?(Array) && products_payload["pagination"].is_a?(Hash)) do
      "product index did not use the data and pagination response format"
    end
    @products = products_payload.fetch("data").to_h { |product| [product.fetch("title"), product] }
    required_products = [
      "Integration Speckled Mug",
      "Integration Linen Table Runner",
      "Integration Botanical Candle Pair",
      "Integration Hand-Bound Notebook"
    ]
    assert((required_products - @products.keys).empty?) { "integration products are missing" }
    pass("integration products exist with the expected response envelope")

    categories = api_request(:get, "/categories")
    assert_status(categories, 200, "category index")
    category_data = json(categories).fetch("data")
    assert(category_data.count { |category| category.fetch("slug").start_with?("integration-") } == 3) do
      "expected three integration categories"
    end
    @category_id = category_data.find { |category| category.fetch("slug") == "integration-ceramics" }.fetch("id")
    pass("integration categories exist")

    sellers = api_request(:get, "/sellers")
    assert_status(sellers, 200, "seller index")
    seller_names = json(sellers).fetch("data").map { |seller| seller.fetch("name") }
    assert(seller_names.include?("Integration Clay Studio") && seller_names.include?("Integration Fiber Works")) do
      "integration sellers are missing"
    end
    pass("integration seller profiles exist")

    search = api_request(:get, "/products?search=Speckled")
    assert_status(search, 200, "product search")
    search_products = json(search).fetch("data")
    assert(search_products.one? && search_products.first.fetch("title") == "Integration Speckled Mug") do
      "product search did not return the expected product"
    end
    category_search = api_request(:get, "/products?search=Integration&category_id=#{@category_id}")
    assert_status(category_search, 200, "product category filter")
    category_products = json(category_search).fetch("data")
    assert(category_products.any? { |product| product.fetch("title") == "Integration Speckled Mug" } &&
      category_products.all? { |product| product.fetch("category_id") == @category_id } &&
      category_products.none? { |product| product.fetch("title") == "Integration Linen Table Runner" }) do
      "product category filtering returned missing or incorrect products"
    end
    pass("product search and category filtering work together")

    textiles_id = category_data.find { |category| category.fetch("slug") == "integration-textiles" }.fetch("id")
    sorted = api_request(:get, "/products?search=Integration&category_id=#{textiles_id}&sort=price-asc")
    assert_status(sorted, 200, "product price sorting")
    sorted_products = json(sorted).fetch("data")
    prices = sorted_products.map { |product| BigDecimal(product.fetch("price").to_s) }
    expected_titles = [ "Integration Botanical Candle Pair", "Integration Linen Table Runner" ]
    assert((expected_titles - sorted_products.map { |product| product.fetch("title") }).empty? &&
      prices.length >= 2 && prices.uniq.length >= 2 && prices == prices.sort &&
      sorted_products.index { |product| product.fetch("title") == expected_titles.first } <
        sorted_products.index { |product| product.fetch("title") == expected_titles.last }) do
      "filtered products were not sorted by ascending price"
    end
    pass("product filtering returns multiple products in ascending price order")

    @seller_one_product = @products.fetch("Integration Speckled Mug")
    @seller_two_product = @products.fetch("Integration Botanical Candle Pair")
    detail = api_request(:get, "/products/#{@seller_one_product.fetch('id')}")
    assert_status(detail, 200, "product detail")
    assert(json(detail).dig("data", "title") == "Integration Speckled Mug") { "product detail returned the wrong record" }
    pass("product detail retrieval works")
  end

  def verify_customer_workflows
    invalid_login = api_request(:post, "/login", body: {
      email: "customer.one@integration.eclectary.test",
      password: "incorrect-password"
    })
    assert_error(invalid_login, 401, "invalid customer credentials")
    pass("invalid credentials are rejected")

    customer_one = login("customer.one@integration.eclectary.test", "EclectaryCustomer1!")
    @customer_one_token = customer_one.fetch("token")
    customer_two = login("customer.two@integration.eclectary.test", "EclectaryCustomer2!")
    @customer_two_token = customer_two.fetch("token")
    pass("integration customers can authenticate")

    me = api_request(:get, "/users/me", token: @customer_one_token)
    assert_status(me, 200, "persisted customer authentication")
    assert(json(me).fetch("email") == "customer.one@integration.eclectary.test") { "JWT resolved the wrong customer" }
    pass("JWT authentication persists across requests")

    assert_error(api_request(:get, "/orders"), 401, "missing JWT")
    assert_error(api_request(:get, "/orders", token: "invalid.jwt.token"), 401, "invalid JWT")
    verify_expired_jwt
    assert_error(api_request(:get, "/seller/products", token: @customer_one_token), 403, "customer seller access")
    pass("missing, invalid, and wrong-role authentication is enforced")

    suffix = "#{Time.now.to_i}.#{SecureRandom.hex(4)}"
    @registered_email = "functional.#{suffix}@integration.eclectary.test"
    registration = api_request(:post, "/users", body: {
      user: {
        email: @registered_email,
        password: "EclectaryFunctional1!",
        password_confirmation: "EclectaryFunctional1!"
      }
    })
    assert_status(registration, 201, "customer registration")
    registration_payload = json(registration)
    @customer_token = registration_payload.fetch("token")
    assert(registration_payload.fetch("role") == "customer") { "registration did not create a customer" }
    pass("customer registration creates a fictional integration account")

    cart = api_request(:get, "/cart", token: @customer_token)
    assert_status(cart, 200, "new customer cart")
    assert(json(cart).dig("data", "items") == []) { "new customer cart was not empty" }

    added = api_request(:post, "/cart/items", token: @customer_token, body: {
      item: { product_id: @seller_one_product.fetch("id"), quantity: 1 }
    })
    assert_status(added, 201, "cart add")
    added_item = json(added).dig("data", "items").find do |item|
      item.fetch("product_id") == @seller_one_product.fetch("id")
    end
    assert(added_item) { "added cart item was not returned" }

    updated = api_request(:patch, "/cart/items/#{added_item.fetch('id')}", token: @customer_token, body: {
      item: { quantity: 3 }
    })
    assert_status(updated, 200, "cart quantity update")
    assert(json(updated).dig("data", "items", 0, "quantity") == 3) { "cart quantity was not updated" }

    merge_identifier = "live-merge-#{suffix}"
    merge_body = {
      merge_identifier: merge_identifier,
      items: [ { product_id: @seller_two_product.fetch("id"), quantity: 2 } ]
    }
    merged = api_request(:post, "/cart/merge", token: @customer_token, body: merge_body)
    assert_status(merged, 200, "guest cart merge")
    assert(json(merged).dig("merge", "repeated") == false) { "initial cart merge was marked repeated" }
    repeated_merge = api_request(:post, "/cart/merge", token: @customer_token, body: merge_body)
    assert_status(repeated_merge, 200, "repeated guest cart merge")
    assert(json(repeated_merge).dig("merge", "repeated") == true) { "repeated cart merge was not idempotent" }
    merged_items = json(repeated_merge).dig("data", "items")
    assert(merged_items.find { |item| item.fetch("product_id") == @seller_two_product.fetch("id") }.fetch("quantity") == 2) do
      "repeated cart merge changed the quantity"
    end

    removed = api_request(:delete, "/cart/items/#{added_item.fetch('id')}", token: @customer_token)
    assert_status(removed, 200, "cart removal")
    assert(json(removed).dig("data", "items").none? { |item| item.fetch("id") == added_item.fetch("id") }) do
      "removed cart item remained in the cart"
    end
    persisted_cart = api_request(:get, "/cart", token: @customer_token)
    assert_status(persisted_cart, 200, "persisted cart")
    persisted_items = json(persisted_cart).dig("data", "items")
    assert(persisted_items.length == 1 &&
      persisted_items.first.fetch("product_id") == @seller_two_product.fetch("id") &&
      persisted_items.first.fetch("quantity") == 2) { "cart changes were not persisted" }
    pass("cart add, quantity update, guest merge, merge retry, and removal persist")

    order_body = order_payload([
      { product_id: @seller_one_product.fetch("id"), quantity: 1 },
      { product_id: @seller_two_product.fetch("id"), quantity: 2 }
    ])
    idempotency_key = "live-order-#{suffix}"
    created_order = api_request(:post, "/orders", token: @customer_token, body: order_body,
      headers: { "Idempotency-Key" => idempotency_key })
    assert_status(created_order, 201, "checkout")
    @mixed_order = json(created_order).fetch("data")
    assert(@mixed_order.fetch("status") == "pending") { "checkout did not create a pending order" }

    replayed_order = api_request(:post, "/orders", token: @customer_token, body: order_body,
      headers: { "Idempotency-Key" => idempotency_key })
    assert_status(replayed_order, 200, "idempotent checkout replay")
    assert(json(replayed_order).dig("data", "id") == @mixed_order.fetch("id")) { "checkout replay created a different order" }

    changed_order_body = Marshal.load(Marshal.dump(order_body))
    changed_order_body[:order][:items][0][:quantity] = 2
    conflict = api_request(:post, "/orders", token: @customer_token, body: changed_order_body,
      headers: { "Idempotency-Key" => idempotency_key })
    assert_error(conflict, 409, "idempotency conflict")
    pass("checkout creates a pending order and preserves idempotency")

    history = api_request(:get, "/orders", token: @customer_token)
    assert_status(history, 200, "order history")
    assert(json(history).fetch("data").any? { |order| order.fetch("id") == @mixed_order.fetch("id") }) do
      "created order was missing from customer history"
    end
    detail = api_request(:get, "/orders/#{@mixed_order.fetch('id')}", token: @customer_token)
    assert_status(detail, 200, "customer order detail")
    assert_error(api_request(:get, "/orders/#{@mixed_order.fetch('id')}", token: @customer_two_token), 404,
      "other customer order access")
    pass("order history, detail, and customer ownership protection work")

    single_seller_order = api_request(:post, "/orders", token: @customer_token,
      body: order_payload([ { product_id: @seller_one_product.fetch("id"), quantity: 1 } ]),
      headers: { "Idempotency-Key" => "single-seller-#{suffix}" })
    assert_status(single_seller_order, 201, "single-seller checkout")
    @seller_one_only_order_id = json(single_seller_order).dig("data", "id")

    persisted_orders = database_scalar("SELECT count(*) FROM orders WHERE user_id = #{Integer(registration_payload.fetch('id'))}").to_i
    assert(persisted_orders == 2) { "PostgreSQL did not persist both live customer orders" }
    pass("PostgreSQL persistence is visible outside the Rails process")
  end

  def verify_seller_workflows
    seller_one = login("seller.one@integration.eclectary.test", "EclectarySeller1!")
    seller_two = login("seller.two@integration.eclectary.test", "EclectarySeller2!")
    @seller_one_token = seller_one.fetch("token")
    @seller_two_token = seller_two.fetch("token")
    pass("integration sellers can authenticate")

    seller_products = api_request(:get, "/seller/products", token: @seller_one_token)
    assert_status(seller_products, 200, "seller product dashboard")
    owned_products = json(seller_products).fetch("data")
    assert(owned_products.any? && owned_products.all? { |product| product.fetch("seller_id") == seller_one.dig("user", "id") }) do
      "seller product list included another seller's product"
    end
    seller_orders = api_request(:get, "/seller/orders", token: @seller_one_token)
    assert_status(seller_orders, 200, "seller order dashboard")
    dashboard_orders = json(seller_orders).fetch("data")
    owned_product_ids = owned_products.map { |product| product.fetch("id") }
    assert(dashboard_orders.any? { |order| order.fetch("id") == @mixed_order.fetch("id") } &&
      dashboard_orders.any? { |order| order.fetch("id") == @seller_one_only_order_id } &&
      dashboard_orders.all? { |order| order.fetch("items").any? &&
        order.fetch("items").all? { |item| owned_product_ids.include?(item.fetch("product_id")) } }) do
      "seller order dashboard omitted expected orders or included items owned by another seller"
    end
    pass("seller dashboard product and order APIs respond with owned data")

    invalid_product = api_request(:post, "/seller/products", token: @seller_one_token, body: {
      product: { title: "", price: "not-a-price", category_id: @category_id }
    })
    assert_error(invalid_product, 422, "invalid seller product")
    pass("validation failures use the standardized error envelope")

    unique_title = "Live Integration Product #{SecureRandom.hex(5)}"
    created = api_request(:post, "/seller/products", token: @seller_one_token, body: {
      product: {
        title: unique_title,
        description: "Fictional product created by automated live integration testing.",
        price: "12.75",
        category_id: @category_id,
        subcategory: "Integration"
      }
    })
    assert_status(created, 201, "seller product creation")
    product = json(created).fetch("data")
    product_id = product.fetch("id")
    assert(database_scalar("SELECT count(*) FROM products WHERE id = #{Integer(product_id)}").to_i == 1) do
      "created seller product was not persisted in PostgreSQL"
    end

    updated = api_request(:patch, "/seller/products/#{product_id}", token: @seller_one_token, body: {
      product: {
        title: "#{unique_title} Updated",
        description: "Updated by automated live integration testing.",
        price: "13.25",
        category_id: @category_id,
        subcategory: "Integration Updated"
      }
    })
    assert_status(updated, 200, "seller product update")
    assert(json(updated).dig("data", "price") == "13.25") { "seller product price was not updated" }
    assert_error(api_request(:patch, "/seller/products/#{product_id}", token: @seller_two_token,
      body: { product: { title: "Unauthorized edit" } }), 404, "other seller product update")

    deactivated = api_request(:patch, "/seller/products/#{product_id}/deactivate", token: @seller_one_token)
    assert_status(deactivated, 200, "seller product deactivation")
    assert(json(deactivated).dig("data", "active") == false) { "seller product remained active" }
    pass("seller product creation, persistence, editing, deactivation, and ownership enforcement work")

    seller_one_order = api_request(:get, "/seller/orders/#{@mixed_order.fetch('id')}", token: @seller_one_token)
    seller_two_order = api_request(:get, "/seller/orders/#{@mixed_order.fetch('id')}", token: @seller_two_token)
    assert_status(seller_one_order, 200, "seller one mixed order")
    assert_status(seller_two_order, 200, "seller two mixed order")
    seller_one_payload = json(seller_one_order).fetch("data")
    seller_two_payload = json(seller_two_order).fetch("data")
    assert(seller_one_payload.fetch("items").map { |item| item.fetch("product_id") } ==
      [ @seller_one_product.fetch("id") ]) { "seller one saw missing or unauthorized line items" }
    assert(seller_two_payload.fetch("items").map { |item| item.fetch("product_id") } ==
      [ @seller_two_product.fetch("id") ]) { "seller two saw missing or unauthorized line items" }
    allowed_order_fields = %w[created_at id items recipient_name shipping_address shipping_city shipping_postal_code shipping_state]
    assert((seller_one_payload.keys - allowed_order_fields).empty?) { "seller order exposed unexpected private fields" }
    assert_error(api_request(:get, "/seller/orders/#{@seller_one_only_order_id}", token: @seller_two_token), 404,
      "seller access to unrelated order")
    pass("mixed-seller orders isolate line items and unrelated private orders")

    seller_one_item = seller_one_payload.fetch("items").first
    fulfillment_path = "/seller/orders/#{@mixed_order.fetch('id')}/items/#{seller_one_item.fetch('id')}/fulfillment"
    assert_error(api_request(:patch, fulfillment_path, token: @seller_two_token,
      body: { fulfillment: { status: "processing" } }), 404, "other seller fulfillment")
    processing = api_request(:patch, fulfillment_path, token: @seller_one_token,
      body: { fulfillment: { status: "processing" } })
    assert_status(processing, 200, "seller fulfillment processing")
    assert(json(processing).dig("data", "fulfillment_status") == "processing") do
      "fulfillment did not advance to processing"
    end
    fulfilled = api_request(:patch, fulfillment_path, token: @seller_one_token,
      body: { fulfillment: { status: "fulfilled" } })
    assert_status(fulfilled, 200, "seller fulfillment completion")
    assert(json(fulfilled).dig("data", "fulfillment_status") == "fulfilled") do
      "fulfillment did not advance to fulfilled"
    end
    reloaded = api_request(:get, "/seller/orders/#{@mixed_order.fetch('id')}", token: @seller_one_token)
    assert_status(reloaded, 200, "persisted seller fulfillment")
    assert(json(reloaded).dig("data", "items", 0, "fulfillment_status") == "fulfilled") do
      "fulfillment status was not persisted"
    end
    pass("fulfillment transitions persist and enforce seller ownership")
  end

  def verify_expired_jwt
    secret_path = File.expand_path("../tmp/local_secret.txt", __dir__)
    assert(File.file?(secret_path)) { "local Rails signing secret is unavailable for expired-JWT verification" }
    secret = File.read(secret_path).strip
    payload = decode_jwt_payload(@customer_one_token)

    current_token = encode_jwt(payload.merge("exp" => Time.now.to_i + 60), secret)
    assert_status(api_request(:get, "/users/me", token: current_token), 200, "locally signed current JWT")

    expired_token = encode_jwt(payload.merge("exp" => Time.now.to_i - 60), secret)
    assert_error(api_request(:get, "/users/me", token: expired_token), 401, "expired JWT")
    pass("validly signed expired JWTs are rejected")
  end

  def order_payload(items)
    {
      order: {
        customer_name: "Functional Integration Customer",
        customer_email: @registered_email,
        customer_phone: "555-010-4848",
        shipping_address: "48 Automated Test Lane",
        shipping_city: "Testville",
        shipping_state: "NC",
        shipping_postal_code: "27048",
        items: items
      }
    }
  end

  def login(email, password)
    response = api_request(:post, "/login", body: { email: email, password: password })
    assert_status(response, 200, "login for #{email}")
    payload = json(response)
    assert(payload["token"].is_a?(String) && payload["user"].is_a?(Hash)) { "login response was malformed" }
    payload
  end

  def api_request(method, path, **options)
    challenge, proof = verify_api_database!
    http_request = build_request(method, URI("http://localhost:3000/api/v1#{path}"), **options)
    http_request["X-Integration-Guard-Challenge"] = challenge
    http_request["X-Integration-Guard-Proof"] = proof
    @api_http.request(http_request)
  rescue SystemCallError, IOError, Timeout::Error => error
    raise IntegrationFailure, "API request failed without reconnecting: #{error.message}"
  end

  def request(method, url, token: nil, body: nil, headers: {})
    uri = URI(url)
    http_request = build_request(method, uri, token: token, body: body, headers: headers)
    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
      http.open_timeout = 5
      http.read_timeout = 10
      http.request(http_request)
    end
  rescue SystemCallError, Timeout::Error => error
    raise IntegrationFailure, "#{method.to_s.upcase} #{url} failed: #{error.message}"
  end

  def build_request(method, uri, token: nil, body: nil, headers: {})
    request_class = {
      get: Net::HTTP::Get,
      post: Net::HTTP::Post,
      patch: Net::HTTP::Patch,
      delete: Net::HTTP::Delete,
      options: Net::HTTP::Options
    }.fetch(method)
    http_request = request_class.new(uri)
    headers.each { |name, value| http_request[name] = value }
    http_request["Authorization"] = "Bearer #{token}" if token
    if body
      http_request["Content-Type"] = "application/json"
      http_request.body = JSON.generate(body)
    end

    http_request
  end

  def database_scalar(sql)
    command = [
      "psql", "-X", "-w", "-qAt", "-v", "ON_ERROR_STOP=1",
      "-h", ENV.fetch("DATABASE_HOST", "localhost"),
      "-p", ENV.fetch("DATABASE_PORT", "5432"),
      "-U", ENV.fetch("DATABASE_USERNAME", "postgres"),
      "-d", IntegrationDatabase::DATABASE,
      "-c", sql
    ]
    stdout, stderr, status = Open3.capture3({ "PGPASSWORD" => ENV.fetch("DATABASE_PASSWORD", "") }, *command)
    raise IntegrationFailure, "PostgreSQL verification failed: #{stderr.strip}" unless status.success?

    stdout.lines.last.to_s.strip
  end

  def decode_jwt_payload(token)
    encoded_payload = token.split(".").fetch(1)
    JSON.parse(Base64.urlsafe_decode64(encoded_payload.ljust((encoded_payload.length + 3) / 4 * 4, "=")))
  end

  def encode_jwt(payload, secret)
    header = { alg: "HS256", typ: "JWT" }
    segments = [header, payload].map do |value|
      Base64.urlsafe_encode64(JSON.generate(value), padding: false)
    end
    signature = OpenSSL::HMAC.digest("SHA256", secret, segments.join("."))
    "#{segments.join('.')}.#{Base64.urlsafe_encode64(signature, padding: false)}"
  end

  def json(response)
    JSON.parse(response.body)
  rescue JSON::ParserError
    raise IntegrationFailure, "HTTP #{response.code} response was not valid JSON"
  end

  def assert_json_value(response, key, expected)
    actual = json(response)[key]
    assert(actual == expected) { "expected #{key}=#{expected.inspect}, received #{actual.inspect}" }
  end

  def assert_status(response, expected, label)
    assert(response.code.to_i == expected) do
      "#{label} returned HTTP #{response.code}, expected #{expected}: #{response.body}"
    end
  end

  def assert_error(response, expected_status, label)
    assert_status(response, expected_status, label)
    payload = json(response)
    assert(payload.keys == ["errors"] && payload["errors"].is_a?(Array) && payload["errors"].any?) do
      "#{label} did not use the standardized errors array"
    end
  end

  def assert(condition)
    return if condition

    message = block_given? ? yield : "assertion failed"
    raise IntegrationFailure, message
  end

  def pass(message)
    @passes << message
    puts "PASS: #{message}"
  end
end

if $PROGRAM_NAME == __FILE__
  abort "Usage: ruby script/test_live_integration.rb [--verify-only]" unless
    ARGV.empty? || ARGV == [ "--verify-only" ]
  LiveIntegrationTest.new.run(verify_only: ARGV == [ "--verify-only" ])
end
