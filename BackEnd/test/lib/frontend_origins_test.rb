require "test_helper"
require Rails.root.join("lib/frontend_origins")

class FrontendOriginsTest < ActiveSupport::TestCase
  test "allows localhost during development" do
    origins = FrontendOrigins.resolve(
      environment: ActiveSupport::EnvironmentInquirer.new("development"),
      configured_origin: nil
    )

    assert_equal [ "http://localhost:5173" ], origins
  end

  test "allows an explicitly configured production frontend origin" do
    origins = FrontendOrigins.resolve(
      environment: ActiveSupport::EnvironmentInquirer.new("production"),
      configured_origin: " https://eclectary-preview.example/ "
    )

    assert_equal [ "https://eclectary-preview.example" ], origins
  end

  test "allows no cross-origin frontend when production configuration is missing" do
    origins = FrontendOrigins.resolve(
      environment: ActiveSupport::EnvironmentInquirer.new("production"),
      configured_origin: nil
    )

    assert_empty origins
  end

  test "rejects invalid configured origins" do
    invalid_origins = [
      "*.example.com",
      "https://example.com/path",
      "https://example.com?query=value",
      "https://example.com#fragment",
      "https://user:password@example.com",
      "javascript:alert(1)"
    ]

    invalid_origins.each do |origin|
      assert_raises(ArgumentError, origin) do
        FrontendOrigins.resolve(
          environment: ActiveSupport::EnvironmentInquirer.new("production"),
          configured_origin: origin
        )
      end
    end
  end
end
