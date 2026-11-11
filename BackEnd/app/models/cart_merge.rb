class CartMerge < ApplicationRecord
  MAX_IDENTIFIER_LENGTH = 128

  belongs_to :cart, inverse_of: :cart_merges

  validates :merge_identifier, presence: true,
    length: { maximum: MAX_IDENTIFIER_LENGTH },
    uniqueness: { scope: :cart_id }
end
