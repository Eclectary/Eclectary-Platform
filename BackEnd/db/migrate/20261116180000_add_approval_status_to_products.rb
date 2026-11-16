class AddApprovalStatusToProducts < ActiveRecord::Migration[8.1]
  def up
    add_column :products, :approval_status, :string

    execute <<~SQL.squish
      UPDATE products
      SET approval_status = 'approved'
    SQL

    change_column_default :products, :approval_status, from: nil, to: "pending"
    change_column_null :products, :approval_status, false
    add_check_constraint :products,
      "approval_status IN ('pending', 'approved', 'rejected')",
      name: "products_approval_status_valid"
    add_index :products, [ :active, :approval_status ]
  end

  def down
    remove_index :products, [ :active, :approval_status ]
    remove_check_constraint :products, name: "products_approval_status_valid"
    remove_column :products, :approval_status
  end
end
