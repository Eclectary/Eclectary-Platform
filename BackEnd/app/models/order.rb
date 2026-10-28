class Order < ApplicationRecord
  belongs_to :user
  has_many :order_items, dependent: :destroy

  validates :customer_name, :customer_email, :customer_phone,
            :shipping_address, :shipping_city, :shipping_state,
            :shipping_postal_code, :status, presence: true
  validates :customer_email, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :shipping_amount, numericality: { greater_than_or_equal_to: 0 }

  def total
    order_items.sum { |item| item.quantity * item.price }
  end

  def final_total
    total + shipping_amount
  end
end
