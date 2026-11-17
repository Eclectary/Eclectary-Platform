require "minitest/autorun"
require "tempfile"

require_relative "../../lib/demo_product_image_refresh"

class DemoProductImageRefreshUnitTest < Minitest::Test
  def test_invalid_runtime_settings_are_rejected_before_accessing_active_record
    environment = Object.new
    environment.define_singleton_method(:development?) { true }
    rails = Module.new
    rails.define_singleton_method(:env) { environment }
    Object.const_set(:Rails, rails)

    valid_env = {
      "INTEGRATION_PROOF" => "1",
      "DATABASE_HOST" => "127.0.0.1",
      "DATABASE_PORT" => "55432",
      "DATABASE_NAME" => "eclectary_integration",
      "DATABASE_USERNAME" => "integration",
      "DATABASE_PASSWORD" => "",
      "INTEGRATION_CONFIRM" => "127.0.0.1:55432/eclectary_integration",
      "INTEGRATION_PROOF_SECRET" => "a" * 64
    }
    [
      {},
      valid_env.merge("INTEGRATION_PROOF" => nil),
      valid_env.merge("DATABASE_PORT" => "5432", "INTEGRATION_CONFIRM" => "127.0.0.1:5432/eclectary_integration"),
      valid_env.merge("DATABASE_PORT" => "55433", "INTEGRATION_CONFIRM" => "127.0.0.1:55433/eclectary_integration"),
      valid_env.merge("DATABASE_URL" => "postgresql://localhost:5432/other"),
      valid_env.merge("PRIMARY_DATABASE_URL" => "postgresql://localhost:5432/other"),
      valid_env.merge("INTEGRATION_PROOF_SECRET" => "invalid")
    ].each do |env|
      assert_raises(DemoProductImageRefresh::SafetyError, IntegrationDatabase::VerificationError) do
        DemoProductImageRefresh.new(env:, output: nil).run!
      end
    end
  ensure
    Object.send(:remove_const, :Rails) if Object.const_defined?(:Rails, false) && Object.const_get(:Rails).equal?(rails)
  end

  def test_manifest_has_twelve_unique_reserved_targets
    manifest = DemoProductImageRefresh.validate_manifest!

    assert_equal 12, manifest.size
    assert_equal 12, manifest.map { |entry| entry.fetch(:key) }.uniq.size
    refute_includes manifest.map { |entry| entry.fetch(:seller_email) }, DemoProductImageRefresh::PROTECTED_EMAIL
  end

  def test_manifest_rejects_protected_or_ambiguous_targets
    protected_manifest = DemoProductImageRefresh::MANIFEST.map(&:dup)
    protected_manifest.first[:seller_email] = DemoProductImageRefresh::PROTECTED_EMAIL
    assert_raises(DemoProductImageRefresh::SafetyError) do
      DemoProductImageRefresh.validate_manifest!(protected_manifest)
    end

    duplicate_manifest = DemoProductImageRefresh::MANIFEST.map(&:dup)
    duplicate_manifest.last[:key] = duplicate_manifest.first.fetch(:key)
    assert_raises(DemoProductImageRefresh::SafetyError) do
      DemoProductImageRefresh.validate_manifest!(duplicate_manifest)
    end
  end

  def test_png_metadata_reads_dimensions_and_active_storage_checksum
    Tempfile.create([ "approved", ".png" ]) do |file|
      header = "\x89PNG\r\n\x1a\n".b + [ 13 ].pack("N") + "IHDR" + [ 640, 640 ].pack("N2")
      file.binmode
      file.write(header)
      file.flush

      metadata = DemoProductImageRefresh.png_metadata(file.path)
      assert_equal 640, metadata.fetch(:width)
      assert_equal 640, metadata.fetch(:height)
      assert_equal File.size(file.path), metadata.fetch(:byte_size)
      assert_match(/\A[A-Za-z0-9+\/]{22}==\z/, metadata.fetch(:checksum))
      assert_match(/\A[0-9a-f]{64}\z/, metadata.fetch(:sha256))
    end
  end

  def test_operation_proof_is_bound_to_secret_identity_and_plan
    secret = "a" * 64
    identity = "eclectary_integration|127.0.0.1|55432|integration|1234.000001"
    fingerprint = DemoProductImageRefresh.plan_fingerprint({ version: 1, items: [] })
    proof = DemoProductImageRefresh.operation_proof(secret, identity, fingerprint)

    assert DemoProductImageRefresh.secure_compare(proof, proof)
    refute DemoProductImageRefresh.secure_compare(proof, "b" * 64)
    refute_equal proof, DemoProductImageRefresh.operation_proof(secret, identity.sub("55432", "55433"), fingerprint)
    refute_equal proof, DemoProductImageRefresh.operation_proof(secret, identity, "f" * 64)
  end
end
