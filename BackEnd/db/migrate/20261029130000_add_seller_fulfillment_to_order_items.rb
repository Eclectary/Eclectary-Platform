class AddSellerFulfillmentToOrderItems < ActiveRecord::Migration[8.1]
  def up
    add_column :order_items, :seller_id, :bigint
    add_column :order_items, :fulfillment_status, :string, null: false, default: "unfulfilled"

    execute <<~SQL.squish
      UPDATE order_items
      SET seller_id = products.seller_id
      FROM products
      WHERE order_items.product_id = products.id
    SQL

    missing_seller_count = select_value(<<~SQL.squish).to_i
      SELECT COUNT(*)
      FROM order_items
      WHERE seller_id IS NULL
    SQL

    if missing_seller_count.positive?
      raise ActiveRecord::MigrationError,
        "Cannot backfill seller ownership for #{missing_seller_count} order item(s)."
    end

    change_column_null :order_items, :seller_id, false
    add_foreign_key :order_items, :users, column: :seller_id
    add_index :order_items, %i[seller_id order_id]
  end

  def down
    remove_index :order_items, column: %i[seller_id order_id]
    remove_foreign_key :order_items, column: :seller_id
    remove_column :order_items, :fulfillment_status
    remove_column :order_items, :seller_id
  end
end
