class AddCategoryIntegrityConstraints < ActiveRecord::Migration[8.1]
  def up
    duplicate_slug_count = select_value(<<~SQL).to_i
      SELECT COUNT(*) FROM (
        SELECT slug
        FROM categories
        WHERE slug IS NOT NULL
        GROUP BY slug
        HAVING COUNT(*) > 1
      ) AS duplicate_slugs
    SQL

    if duplicate_slug_count.positive?
      raise ActiveRecord::MigrationError,
            "Cannot add unique index on categories.slug: found #{duplicate_slug_count} duplicate slug value(s)."
    end

    null_name_count = select_value("SELECT COUNT(*) FROM categories WHERE name IS NULL").to_i
    if null_name_count.positive?
      raise ActiveRecord::MigrationError,
            "Cannot enforce NOT NULL on categories.name: found #{null_name_count} row(s) with NULL name."
    end

    null_slug_count = select_value("SELECT COUNT(*) FROM categories WHERE slug IS NULL").to_i
    if null_slug_count.positive?
      raise ActiveRecord::MigrationError,
            "Cannot enforce NOT NULL on categories.slug: found #{null_slug_count} row(s) with NULL slug."
    end

    change_column_null :categories, :name, false
    change_column_null :categories, :slug, false

    add_index :categories, :slug, unique: true unless index_exists?(:categories, :slug, unique: true)
  end

  def down
    remove_index :categories, :slug if index_exists?(:categories, :slug)
    change_column_null :categories, :slug, true
    change_column_null :categories, :name, true
  end
end

