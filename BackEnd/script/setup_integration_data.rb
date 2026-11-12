require_relative "../lib/integration_database"

abort "Refusing to prepare integration data outside development." unless Rails.env.development?
begin
  IntegrationDatabase.validate_connection!(ActiveRecord::Base.connection, ENV)
rescue IntegrationDatabase::VerificationError => error
  abort "Refusing to prepare integration data: #{error.message}"
end

accounts = [
  {
    key: :customer_one,
    email: "customer.one@integration.eclectary.test",
    password: "EclectaryCustomer1!",
    role: "customer",
    public_name: "Integration Customer One"
  },
  {
    key: :customer_two,
    email: "customer.two@integration.eclectary.test",
    password: "EclectaryCustomer2!",
    role: "customer",
    public_name: "Integration Customer Two"
  },
  {
    key: :seller_one,
    email: "seller.one@integration.eclectary.test",
    password: "EclectarySeller1!",
    role: "seller",
    public_name: "Integration Clay Studio",
    specialty: "Integration ceramics and tableware",
    bio: "A fictional maker account used only for local Eclectary integration testing."
  },
  {
    key: :seller_two,
    email: "seller.two@integration.eclectary.test",
    password: "EclectarySeller2!",
    role: "seller",
    public_name: "Integration Fiber Works",
    specialty: "Integration textiles and paper goods",
    bio: "A fictional maker account used only for local Eclectary integration testing."
  }
].freeze

existing_accounts = User.where(email: accounts.pluck(:email)).index_by(&:email)
accounts.each do |attributes|
  existing_account = existing_accounts[attributes.fetch(:email)]
  next unless existing_account && existing_account.role != attributes.fetch(:role)

  abort <<~MESSAGE
    Refusing to prepare integration data.
    #{attributes.fetch(:email)} already belongs to a #{existing_account.role.inspect} account.
  MESSAGE
end

category_definitions = [
  { key: :ceramics, slug: "integration-ceramics", name: "Integration Ceramics" },
  { key: :textiles, slug: "integration-textiles", name: "Integration Textiles" },
  { key: :paper_goods, slug: "integration-paper-goods", name: "Integration Paper Goods" }
].freeze

product_definitions = [
  {
    key: :speckled_mug,
    seller: :seller_one,
    category: :ceramics,
    title: "Integration Speckled Mug",
    description: "Fictional active product for cart and checkout integration tests.",
    price: "24.00",
    subcategory: "Mugs",
    active: true
  },
  {
    key: :linen_runner,
    seller: :seller_one,
    category: :textiles,
    title: "Integration Linen Table Runner",
    description: "Fictional active product for mixed-seller order and fulfillment tests.",
    price: "38.00",
    subcategory: "Table Linens",
    active: true
  },
  {
    key: :retired_planter,
    seller: :seller_one,
    category: :ceramics,
    title: "Integration Retired Planter",
    description: "Fictional inactive product for unavailable-product integration tests.",
    price: "20.00",
    subcategory: "Planters",
    active: false
  },
  {
    key: :candle_pair,
    seller: :seller_two,
    category: :textiles,
    title: "Integration Botanical Candle Pair",
    description: "Fictional active product for mixed-seller cart and checkout tests.",
    price: "18.00",
    subcategory: "Candles",
    active: true
  },
  {
    key: :bound_notebook,
    seller: :seller_two,
    category: :paper_goods,
    title: "Integration Hand-Bound Notebook",
    description: "Fictional active product for mixed-seller order and fulfillment tests.",
    price: "16.00",
    subcategory: "Notebooks",
    active: true
  }
].freeze

seeded_accounts = {}
seeded_categories = {}
seeded_products = {}

ApplicationRecord.transaction do
  accounts.each do |attributes|
    account = User.find_or_initialize_by(email: attributes.fetch(:email))
    account.assign_attributes(
      role: attributes.fetch(:role),
      password: attributes.fetch(:password),
      password_confirmation: attributes.fetch(:password),
      public_name: attributes.fetch(:public_name),
      specialty: attributes[:specialty],
      bio: attributes[:bio],
      image_url: nil
    )
    account.save!
    seeded_accounts[attributes.fetch(:key)] = account
  end

  category_definitions.each do |attributes|
    category = Category.find_or_initialize_by(slug: attributes.fetch(:slug))
    category.update!(name: attributes.fetch(:name))
    seeded_categories[attributes.fetch(:key)] = category
  end

  product_definitions.each do |attributes|
    seller = seeded_accounts.fetch(attributes.fetch(:seller))
    product = Product.find_or_initialize_by(
      seller: seller,
      title: attributes.fetch(:title)
    )
    product.update!(
      category: seeded_categories.fetch(attributes.fetch(:category)),
      description: attributes.fetch(:description),
      price: BigDecimal(attributes.fetch(:price)),
      subcategory: attributes.fetch(:subcategory),
      active: attributes.fetch(:active)
    )
    seeded_products[attributes.fetch(:key)] = product
  end

  mixed_cart = Cart.find_or_create_by!(user: seeded_accounts.fetch(:customer_one))
  mixed_cart.cart_items.delete_all
  mixed_cart.cart_items.create!(product: seeded_products.fetch(:speckled_mug), quantity: 1)
  mixed_cart.cart_items.create!(product: seeded_products.fetch(:candle_pair), quantity: 2)

  fulfillment_order = Order.find_or_initialize_by(
    user: seeded_accounts.fetch(:customer_two),
    idempotency_key: "integration-fulfillment-order-v1"
  )
  fulfillment_order.update!(
    idempotency_fingerprint: "integration-managed-fixture-v1",
    customer_name: "Integration Recipient",
    customer_email: "recipient@integration.eclectary.test",
    customer_phone: "555-010-2000",
    shipping_address: "200 Integration Test Way",
    shipping_city: "Testville",
    shipping_state: "NC",
    shipping_postal_code: "27000",
    shipping_amount: BigDecimal("6.50"),
    status: "pending"
  )
  fulfillment_order.order_items.delete_all
  fulfillment_order.order_items.create!(
    product: seeded_products.fetch(:linen_runner),
    seller: seeded_accounts.fetch(:seller_one),
    quantity: 1,
    price: seeded_products.fetch(:linen_runner).price,
    fulfillment_status: "unfulfilled"
  )
  fulfillment_order.order_items.create!(
    product: seeded_products.fetch(:bound_notebook),
    seller: seeded_accounts.fetch(:seller_two),
    quantity: 2,
    price: seeded_products.fetch(:bound_notebook).price,
    fulfillment_status: "unfulfilled"
  )
end

puts "Integration data is ready in #{IntegrationDatabase::DATABASE}."
puts "Managed records: #{seeded_accounts.size} accounts, #{seeded_categories.size} categories, " \
  "#{seeded_products.size} products, 1 mixed-seller cart, and 1 mixed-seller fulfillment order."
