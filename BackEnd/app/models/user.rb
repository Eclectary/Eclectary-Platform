class User < ApplicationRecord
  has_secure_password

  before_validation :normalize_email

  has_many :products, foreign_key: :seller_id, dependent: :destroy
  has_many :orders, dependent: :destroy
  has_many :sold_order_items, class_name: "OrderItem", foreign_key: :seller_id, inverse_of: :seller
  has_one :cart, dependent: :destroy, inverse_of: :user

  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :password, length: { minimum: 8 }, allow_nil: true
  validates :role, presence: true, inclusion: { in: %w[customer seller administrator] }
  validates :public_name, :specialty, length: { maximum: 255 }
  validates :bio, length: { maximum: 2000 }
  validates :image_url, format: { with: /\Ahttps?:\/\/[^\s]+\z/ }, allow_blank: true

  def self.normalize_email(value)
    value.to_s.strip.downcase
  end

  # Defense-in-depth: never let password_digest leak through serialization,
  # even if a controller accidentally renders a raw user object.
  def as_json(options = {})
    super(options.merge(except: Array(options[:except]) + [ :password_digest ]))
  end

  def customer?
    role == "customer"
  end

  def seller?
    role == "seller"
  end

  def administrator?
    role == "administrator"
  end

  private

  def normalize_email
    self.email = self.class.normalize_email(email)
  end
end
