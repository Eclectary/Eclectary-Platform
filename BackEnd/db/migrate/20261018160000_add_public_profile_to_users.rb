class AddPublicProfileToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :public_name, :string
    add_column :users, :image_url, :string
    add_column :users, :specialty, :string
    add_column :users, :bio, :text
  end
end
