require "test_helper"

class ProductTest < ActiveSupport::TestCase
  test "accepts supported image types" do
    product = products(:one)
    product.images.attach(
      io: StringIO.new("valid image bytes"),
      filename: "listing.webp",
      content_type: "image/webp"
    )

    assert product.valid?
  end

  test "rejects unsupported image types" do
    product = products(:one)
    product.images.attach(
      io: StringIO.new("not an image"),
      filename: "listing.txt",
      content_type: "text/plain"
    )

    assert_not product.valid?
    assert_includes product.errors[:images], "must be JPEG, PNG, or WebP files"
  end

  test "rejects images larger than five megabytes" do
    product = products(:one)
    product.images.attach(
      io: StringIO.new("x" * (5.megabytes + 1)),
      filename: "large.png",
      content_type: "image/png"
    )

    assert_not product.valid?
    assert_includes product.errors[:images], "must each be 5 MB or smaller"
  end
end
