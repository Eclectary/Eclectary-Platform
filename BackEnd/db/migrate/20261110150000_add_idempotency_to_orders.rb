class AddIdempotencyToOrders < ActiveRecord::Migration[8.1]
  def change
    add_column :orders, :idempotency_key, :string
    add_column :orders, :idempotency_fingerprint, :string

    add_index :orders, %i[user_id idempotency_key],
      unique: true,
      where: "idempotency_key IS NOT NULL",
      name: "index_orders_on_user_and_idempotency_key_unique"
  end
end
