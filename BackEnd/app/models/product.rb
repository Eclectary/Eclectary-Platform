class Product < ApplicationRecord
  APPROVAL_STATUSES = %w[pending approved rejected].freeze
  MATERIAL_REVIEW_ATTRIBUTES = %w[title description price category_id subcategory].freeze
  SUPPORTED_IMAGE_CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze
  MAX_IMAGE_SIZE = 5.megabytes

  belongs_to :seller, class_name: "User"
  belongs_to :category
  has_many_attached :images
  has_many :cart_items, dependent: :restrict_with_error
  has_many :order_items, dependent: :restrict_with_error
  has_many :orders, through: :order_items

  scope :active, -> { where(active: true) }
  scope :approved, -> { where(approval_status: "approved") }
  scope :publicly_available, -> { active.approved }

  validates :title, presence: true
  validates :price, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :approval_status, presence: true, inclusion: { in: APPROVAL_STATUSES }
  validate :images_are_supported

  def approved?
    approval_status == "approved"
  end

  def publicly_available?
    active? && approved?
  end

  def assign_seller_listing_changes(attributes, images_changed: false)
    assign_attributes(attributes)

    material_attributes_changed = MATERIAL_REVIEW_ATTRIBUTES.any? do |attribute|
      will_save_change_to_attribute?(attribute)
    end

    if approval_status != "pending" && (material_attributes_changed || images_changed)
      self.approval_status = "pending"
    end
  end

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
