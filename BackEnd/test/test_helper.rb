ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ForeignKeySafeFixtureLoading
  INSERTION_ORDER = %w[
    users
    categories
    products
    carts
    orders
    cart_items
    order_items
  ].freeze
  DELETION_ORDER = INSERTION_ORDER.reverse.freeze

  private

  def load_fixtures(config)
    requested_fixtures = self.class.fixture_table_names
    unknown_fixtures = requested_fixtures - INSERTION_ORDER

    if unknown_fixtures.any?
      raise "Add fixture dependencies for: #{unknown_fixtures.join(', ')}"
    end

    fixture_sets = build_fixture_sets(requested_fixtures)

    config.connection_pool.with_connection do |connection|
      connection.transaction(requires_new: true) do
        delete_fixture_rows(connection, requested_fixtures)
        insert_fixture_rows(connection, fixture_sets)
      end

      reset_fixture_sequences(connection, fixture_sets)
    end

    fixture_sets.index_by(&:name)
  end

  def build_fixture_sets(requested_fixtures)
    directory_glob = "{#{self.class.fixture_paths.join(',')}}"

    INSERTION_ORDER.filter_map do |fixture_name|
      next unless requested_fixtures.include?(fixture_name)

      ActiveRecord::FixtureSet.new(
        nil,
        fixture_name,
        self.class.fixture_class_names[fixture_name],
        File.join(directory_glob, fixture_name)
      )
    end
  end

  def delete_fixture_rows(connection, requested_fixtures)
    DELETION_ORDER.each do |table_name|
      next unless requested_fixtures.include?(table_name)

      connection.delete("DELETE FROM #{connection.quote_table_name(table_name)}", "Fixtures Cleanup")
    end
  end

  def insert_fixture_rows(connection, fixture_sets)
    fixture_sets.each do |fixture_set|
      fixture_set.table_rows.each do |table_name, rows|
        rows.each { |row| connection.insert_fixture(row, table_name) }
      end
    end
  end

  def reset_fixture_sequences(connection, fixture_sets)
    return unless connection.respond_to?(:reset_pk_sequence!)

    fixture_sets.each { |fixture_set| connection.reset_pk_sequence!(fixture_set.table_name) }
  end
end

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: 1)

    # Setup all fixtures while retaining Rails fixture accessors and transactions.
    fixtures :users, :categories, :products, :carts, :cart_items, :orders, :order_items
    prepend ForeignKeySafeFixtureLoading

    # Add more helper methods to be used by all tests here...
  end
end
