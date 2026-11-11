class LimitCartItemQuantities < ActiveRecord::Migration[8.1]
  def up
    invalid_quantities = connection.select_all(<<~SQL)
      SELECT id, quantity
      FROM cart_items
      WHERE quantity NOT BETWEEN 1 AND 99
      ORDER BY id
    SQL

    if invalid_quantities.any?
      raise ActiveRecord::MigrationError,
        "Cannot limit cart item quantities; expected values between 1 and 99, found: #{invalid_quantities.to_a.inspect}"
    end

    remove_check_constraint :cart_items, name: "cart_items_quantity_positive"
    add_check_constraint :cart_items, "quantity BETWEEN 1 AND 99",
      name: "cart_items_quantity_between_1_and_99"
  end

  def down
    remove_check_constraint :cart_items, name: "cart_items_quantity_between_1_and_99"
    add_check_constraint :cart_items, "quantity > 0", name: "cart_items_quantity_positive"
  end
end
