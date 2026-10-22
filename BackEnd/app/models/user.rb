class User < ApplicationRecord
  has_secure_password

  has_many :products, foreign_key: :seller_id, dependent: :destroy

  validates :email, presence: true, uniqueness: true
  validates :role, presence: true, inclusion: { in: %w[customer seller administrator] }
  validates :public_name, :specialty, length: { maximum: 255 }
  validates :bio, length: { maximum: 2000 }
  validates :image_url, format: { with: /\Ahttps?:\/\/[^\s]+\z/ }, allow_blank: true

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
end
