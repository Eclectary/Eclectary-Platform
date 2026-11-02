class AddActiveToProducts < ActiveRecord::Migration[8.1]
  def change
    add_column :products, :active, :boolean, null: false, default: true
  end
end
