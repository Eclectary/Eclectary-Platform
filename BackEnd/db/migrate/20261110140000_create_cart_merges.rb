class CreateCartMerges < ActiveRecord::Migration[8.1]
  def change
    create_table :cart_merges do |t|
      t.references :cart, null: false, foreign_key: true
      t.string :merge_identifier, null: false, limit: 128
      t.jsonb :result, null: false

      t.timestamps
    end

    add_index :cart_merges, [ :cart_id, :merge_identifier ], unique: true
  end
end
