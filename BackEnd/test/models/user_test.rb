require "test_helper"

class UserTest < ActiveSupport::TestCase
  def valid_attributes
    { email: "new_user@example.com", password: "password123", role: "customer" }
  end

  test "valid user is valid" do
    user = User.new(valid_attributes)
    assert user.valid?
  end

  test "requires email" do
    user = User.new(valid_attributes.merge(email: nil))
    assert_not user.valid?
    assert_includes user.errors[:email], "can't be blank"
  end

  test "requires unique email" do
    User.create!(valid_attributes)
    duplicate = User.new(valid_attributes)
    assert_not duplicate.valid?
    assert_includes duplicate.errors[:email], "has already been taken"
  end

  test "requires role to be one of the allowed values" do
    user = User.new(valid_attributes.merge(role: "superadmin"))
    assert_not user.valid?
    assert_includes user.errors[:role], "is not included in the list"
  end

  test "role helper methods reflect the role" do
    assert users(:one).customer?
    assert users(:two).seller?
    assert users(:administrator).administrator?
  end

  test "password is never exposed as an attribute in JSON" do
    json = users(:one).as_json
    assert_not json.key?("password_digest")
    assert_not json.key?("password")
  end

  test "public profiles allow blank fields and reject unsafe image URLs" do
    user = User.new(valid_attributes.merge(public_name: "Clay Studio", image_url: "https://example.com/clay.jpg"))
    assert user.valid?
    user.image_url = "javascript:alert(1)"
    assert_not user.valid?
    assert_includes user.errors[:image_url], "is invalid"
    user.image_url = nil
    assert user.valid?
  end

  test "public profile copy has bounded lengths" do
    user = User.new(valid_attributes.merge(public_name: "a" * 256, specialty: "a" * 256, bio: "a" * 2001))
    assert_not user.valid?
    assert user.errors[:public_name].any?
    assert user.errors[:specialty].any?
    assert user.errors[:bio].any?
  end
end
