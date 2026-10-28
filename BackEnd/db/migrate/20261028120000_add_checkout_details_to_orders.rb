class AddCheckoutDetailsToOrders < ActiveRecord::Migration[8.1]
  def change
    add_column :orders, :customer_name, :string
    add_column :orders, :customer_email, :string
    add_column :orders, :customer_phone, :string
    add_column :orders, :shipping_address, :string
    add_column :orders, :shipping_city, :string
    add_column :orders, :shipping_state, :string
    add_column :orders, :shipping_postal_code, :string
    add_column :orders, :shipping_amount, :decimal, precision: 10, scale: 2, null: false, default: 0
  end
end
