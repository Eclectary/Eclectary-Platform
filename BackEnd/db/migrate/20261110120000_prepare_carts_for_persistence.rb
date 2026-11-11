class PrepareCartsForPersistence < ActiveRecord::Migration[8.1]
  def up
    ensure_existing_cart_data_is_unambiguous!

    remove_index :carts, name: "index_carts_on_user_id"
    add_index :carts, :user_id, unique: true, name: "index_carts_on_user_id"

    add_index :cart_items, [ :cart_id, :product_id ],
      unique: true,
      name: "index_cart_items_on_cart_id_and_product_id"
    add_check_constraint :cart_items, "quantity > 0", name: "cart_items_quantity_positive"
  end

  def down
    remove_check_constraint :cart_items, name: "cart_items_quantity_positive"
    remove_index :cart_items, name: "index_cart_items_on_cart_id_and_product_id"
    remove_index :carts, name: "index_carts_on_user_id"
    add_index :carts, :user_id, name: "index_carts_on_user_id"
  end

  private

  def ensure_existing_cart_data_is_unambiguous!
    duplicate_carts = connection.select_all(<<~SQL)
      SELECT user_id, array_agg(id ORDER BY id) AS cart_ids
      FROM carts
      GROUP BY user_id
      HAVING COUNT(*) > 1
      ORDER BY user_id
    SQL

    duplicate_items = connection.select_all(<<~SQL)
      SELECT cart_id, product_id, array_agg(id ORDER BY id) AS cart_item_ids
      FROM cart_items
      GROUP BY cart_id, product_id
      HAVING COUNT(*) > 1
      ORDER BY cart_id, product_id
    SQL

    invalid_quantities = connection.select_all(<<~SQL)
      SELECT id, quantity
      FROM cart_items
      WHERE quantity <= 0
      ORDER BY id
    SQL

    return if duplicate_carts.empty? && duplicate_items.empty? && invalid_quantities.empty?

    details = []
    details << "multiple carts for users: #{duplicate_carts.to_a.inspect}" if duplicate_carts.any?
    details << "duplicate products in carts: #{duplicate_items.to_a.inspect}" if duplicate_items.any?
    details << "non-positive cart item quantities: #{invalid_quantities.to_a.inspect}" if invalid_quantities.any?
    raise ActiveRecord::MigrationError,
      "Cannot add cart integrity constraints without manual data resolution: #{details.join('; ')}"
  end
end
