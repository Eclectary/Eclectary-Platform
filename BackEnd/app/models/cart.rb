class Cart < ApplicationRecord
  belongs_to :user, inverse_of: :cart

  has_many :cart_items, dependent: :destroy, inverse_of: :cart
  has_many :cart_merges, dependent: :destroy, inverse_of: :cart

  validates :user, presence: true
  validates :user_id, uniqueness: true
end
