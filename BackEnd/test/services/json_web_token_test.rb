require "test_helper"

class JsonWebTokenTest < ActiveSupport::TestCase
  test "encodes and decodes a payload" do
    token = JsonWebToken.encode(user_id: 42)
    decoded = JsonWebToken.decode(token)

    assert_equal 42, decoded["user_id"]
  end

  test "decode returns nil for an expired token" do
    token = JsonWebToken.encode({ user_id: 42 }, 1.hour.ago)

    assert_nil JsonWebToken.decode(token)
  end

  test "decode returns nil for a garbage token" do
    assert_nil JsonWebToken.decode("not-a-real-token")
  end

  test "decode returns nil for a token with an invalid signature" do
    token = JWT.encode({ user_id: 42 }, "incorrect-signing-key", "HS256")

    assert_nil JsonWebToken.decode(token)
  end

  test "decode returns nil for a token using an unsupported algorithm" do
    token = JWT.encode({ user_id: 42 }, JsonWebToken::SECRET_KEY, "HS384")

    assert_nil JsonWebToken.decode(token)
  end

  test "decode returns nil for a nil token" do
    assert_nil JsonWebToken.decode(nil)
  end
end
