class OrderItem < ApplicationRecord
  FULFILLMENT_STATUSES = %w[unfulfilled processing fulfilled].freeze
  FULFILLMENT_TRANSITIONS = {
    "unfulfilled" => "processing",
    "processing" => "fulfilled"
  }.freeze

  belongs_to :order
  belongs_to :product
  belongs_to :seller, class_name: "User"

  validates :quantity, presence: true, numericality: { greater_than: 0 }
  validates :price, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :fulfillment_status, presence: true, inclusion: { in: FULFILLMENT_STATUSES }
  validate :fulfillment_transition_is_forward_only, if: :will_save_change_to_fulfillment_status?

  def transition_fulfillment_to(next_status)
    next_status = next_status.to_s
    unless FULFILLMENT_TRANSITIONS[fulfillment_status] == next_status
      errors.add(:fulfillment_status, "cannot transition from #{fulfillment_status} to #{next_status}")
      return false
    end

    update(fulfillment_status: next_status)
  end

  private

  def fulfillment_transition_is_forward_only
    previous_status, next_status = fulfillment_status_change_to_be_saved
    valid_initial_status = new_record? && next_status == "unfulfilled"
    valid_transition = persisted? && FULFILLMENT_TRANSITIONS[previous_status] == next_status
    return if valid_initial_status || valid_transition

    errors.add(:fulfillment_status, "cannot transition from #{previous_status.inspect} to #{next_status}")
  end
end
