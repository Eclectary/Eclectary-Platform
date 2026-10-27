class AddSubcategoryToProducts < ActiveRecord::Migration[8.1]
  def change
    add_column :products, :subcategory, :string
  end
end