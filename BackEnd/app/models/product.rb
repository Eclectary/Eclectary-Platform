class Product < ApplicationRecord
  SUPPORTED_IMAGE_CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze
  MAX_IMAGE_SIZE = 5.megabytes

  belongs_to :seller, class_name: "User"
  belongs_to :category
  has_many_attached :images
  has_many :cart_items, dependent: :restrict_with_error
  has_many :order_items, dependent: :restrict_with_error
  has_many :orders, through: :order_items

  scope :active, -> { where(active: true) }

  validates :title, presence: true
  validates :price, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validate :images_are_supported

  private

  def images_are_supported
    images.each do |image|
      unless SUPPORTED_IMAGE_CONTENT_TYPES.include?(image.blob.content_type)
        errors.add(:images, "must be JPEG, PNG, or WebP files")
      end

      if image.blob.byte_size > MAX_IMAGE_SIZE
        errors.add(:images, "must each be 5 MB or smaller")
      end
    end
  end
end
