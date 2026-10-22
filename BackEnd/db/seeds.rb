require "securerandom"

categories = {
  "ceramics-clay" => "Ceramics & Clay",
  "candles-wax" => "Candles & Wax",
  "fiber-arts-textiles" => "Fiber Arts & Textiles",
  "handmade-art" => "Handmade Art",
  "handmade-books-journals" => "Handmade Books & Journals"
}.each_with_object({}) do |(slug, name), seeded_categories|
  category = Category.find_or_initialize_by(slug: slug)
  category.name = name
  category.save!
  seeded_categories[slug] = category
end

makers = [
  {
    key: "moss-atelier",
    email: "seed-moss-atelier@eclectary.test",
    name: "Moss Atelier",
    specialty: "Ceramics & tableware",
    bio: "Hand-thrown stoneware and quiet everyday rituals for slow living.",
    image_url: "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&q=80"
  },
  {
    key: "hearth-thread",
    email: "seed-hearth-thread@eclectary.test",
    name: "Hearth & Thread",
    specialty: "Textiles & home",
    bio: "Natural fibers, layered textures, and cozy pieces for soulful spaces.",
    image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80"
  },
  {
    key: "petal-foundry",
    email: "seed-petal-foundry@eclectary.test",
    name: "Petal Foundry",
    specialty: "Art prints & botanicals",
    bio: "Pressed floral work, thoughtful stationery, and tactile keepsakes.",
    image_url: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80"
  }
].each_with_object({}) do |maker, seeded_makers|
  seller = User.find_or_initialize_by(email: maker[:email])
  if seller.persisted? && !seller.seller?
    raise "Seed maker email #{maker[:email]} belongs to a non-seller; refusing to change that account."
  end

  seller.role = "seller"
  seller.public_name = maker[:name]
  seller.specialty = maker[:specialty]
  seller.bio = maker[:bio]
  seller.image_url = maker[:image_url]
  unless seller.persisted?
    password = SecureRandom.hex(32)
    seller.password = password
    seller.password_confirmation = password
  end
  seller.save!
  seeded_makers[maker[:key]] = seller
end

products = [
  {
    title: "Moonlit Clay Mug",
    description: "A hand-thrown stoneware mug with a soft, moonlit glaze, made for slow mornings and evening tea.",
    price: 34.00,
    maker: "moss-atelier",
    category: "ceramics-clay",
    image: "moonlit-clay-mug.png"
  },
  {
    title: "Botanical Candle Set",
    description: "A small-batch pair of botanical-scented candles for a calm, welcoming home.",
    price: 28.00,
    maker: "hearth-thread",
    category: "candles-wax",
    image: "botanical-candle-set.png"
  },
  {
    title: "Sage Linen Throw",
    description: "A softly textured linen throw in a muted sage tone, woven for everyday comfort.",
    price: 58.00,
    maker: "hearth-thread",
    category: "fiber-arts-textiles",
    image: "sage-linen-throw.png"
  },
  {
    title: "Pressed Herb Bundle",
    description: "A carefully arranged bundle of pressed botanicals, gathered as a nature-inspired keepsake.",
    price: 18.00,
    maker: "petal-foundry",
    category: "handmade-art",
    image: "pressed-herb-bundle.png"
  },
  {
    title: "Wildflower Press Set",
    description: "A set of botanical art prints featuring delicate wildflower forms for a bright, thoughtful space.",
    price: 32.00,
    maker: "petal-foundry",
    category: "handmade-art",
    image: "wildflower-press-set.png"
  },
  {
    title: "Celestial Journal",
    description: "A thoughtfully bound journal with a celestial-inspired cover for notes, sketches, and reflection.",
    price: 24.00,
    maker: "petal-foundry",
    category: "handmade-books-journals",
    image: "celestial-journal.png"
  }
].each do |attributes|
  product = Product.find_or_initialize_by(title: attributes[:title])
  product.description = attributes[:description]
  product.price = attributes[:price]
  product.seller = makers.fetch(attributes[:maker])
  product.category = categories.fetch(attributes[:category])
  product.save!

  unless product.images.attached?
    image_path = Rails.root.join("public", "product-images", attributes[:image])
    File.open(image_path, "rb") do |image|
      product.images.attach(
        io: image,
        filename: attributes[:image],
        content_type: "image/png"
      )
    end
  end
end
