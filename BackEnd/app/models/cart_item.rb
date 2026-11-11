class CartItem < ApplicationRecord
  MAX_QUANTITY = 99

  belongs_to :cart, inverse_of: :cart_items
  belongs_to :product, inverse_of: :cart_items

  validates :product_id, uniqueness: { scope: :cart_id }
  validates :quantity, presence: true, numericality: {
    only_integer: true,
    greater_than: 0,
    less_than_or_equal_to: MAX_QUANTITY
  }
  validate :quantity_must_be_integer_before_type_cast

  private

  def quantity_must_be_integer_before_type_cast
    raw_quantity = quantity_before_type_cast
    return if raw_quantity.nil? || raw_quantity.is_a?(Integer)
    return if raw_quantity.is_a?(String) && raw_quantity.match?(/\A[+-]?\d+\z/)

    errors.add(:quantity, :not_an_integer)
  end
end