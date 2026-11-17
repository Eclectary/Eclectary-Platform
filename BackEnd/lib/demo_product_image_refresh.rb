require "base64"
require "digest"
require "json"
require "openssl"
require "pathname"
require "time"

require_relative "integration_database"

class DemoProductImageRefresh
  VERSION = 1
  REQUIRED_PORT = "55432"
  PROTECTED_EMAIL = "testcustomer@example.com"
  IMAGE_DIRECTORY = Pathname("public/product-images")
  CONTENT_TYPE = "image/png"
  APPLY_CONFIRMATION = "replace-exactly-12-demo-images"

  MANIFEST = [
    { key: "moonlit-clay-mug", seller_email: "seed-moss-atelier@eclectary.test", title: "Moonlit Clay Mug" },
    { key: "botanical-candle-set", seller_email: "seed-hearth-thread@eclectary.test", title: "Botanical Candle Set" },
    { key: "celestial-journal", seller_email: "seed-petal-foundry@eclectary.test", title: "Celestial Journal" },
    { key: "pressed-herb-bundle", seller_email: "seed-petal-foundry@eclectary.test", title: "Pressed Herb Bundle" },
    { key: "amber-glass-tumbler", seller_email: "seed-moss-atelier@eclectary.test", title: "Amber Glass Tumbler" },
    { key: "sage-linen-throw", seller_email: "seed-hearth-thread@eclectary.test", title: "Sage Linen Throw" },
    { key: "wildflower-press-set", seller_email: "seed-petal-foundry@eclectary.test", title: "Wildflower Press Set" },
    { key: "oracle-card-deck", seller_email: "seed-moonwell-studio@eclectary.test", title: "Oracle Card Deck" },
    { key: "lavender-bath-ritual", seller_email: "seed-quiet-bloom@eclectary.test", title: "Lavender Bath Ritual" },
    { key: "hanging-herb-drying-kit", seller_email: "seed-rooted-co@eclectary.test", title: "Hanging Herb Drying Kit" },
    { key: "whispering-journal", seller_email: "seed-ink-and-orbit@eclectary.test", title: "Whispering Journal" },
    { key: "terracotta-candle-trio", seller_email: "seed-solstice-scent@eclectary.test", title: "Terracotta Candle Trio" }
  ].freeze

  class SafetyError < StandardError; end

  def self.run!(env: ENV, output: $stdout)
    new(env:, output:).run!
  rescue IntegrationDatabase::VerificationError, SafetyError => error
    abort "Refusing demo image refresh: #{error.message}"
  end

  def self.validate_manifest!(manifest = MANIFEST)
    raise SafetyError, "manifest must contain exactly 12 entries" unless manifest.size == 12

    keys = manifest.map { |entry| entry.fetch(:key) }
    emails = manifest.map { |entry| entry.fetch(:seller_email) }
    filenames = keys.map { |key| "#{key}.png" }
    raise SafetyError, "manifest keys must be unique" unless keys.uniq.size == keys.size
    raise SafetyError, "manifest filenames must be unique" unless filenames.uniq.size == filenames.size
    unless keys.all? { |key| key.match?(/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/) }
      raise SafetyError, "manifest contains an invalid stable key"
    end
    unless emails.all? { |email| email.match?(/\Aseed-[a-z0-9-]+@eclectary\.test\z/) }
      raise SafetyError, "manifest sellers must use reserved seed accounts"
    end
    raise SafetyError, "protected test account appears in manifest" if emails.include?(PROTECTED_EMAIL)

    manifest
  end

  def self.png_metadata(path)
    File.open(path, "rb") do |file|
      header = file.read(24)
      unless header&.byteslice(0, 8) == "\x89PNG\r\n\x1a\n".b && header.byteslice(12, 4) == "IHDR"
        raise SafetyError, "#{path} is not a PNG with an IHDR header"
      end

      width, height = header.byteslice(16, 8).unpack("N2")
      {
        byte_size: File.size(path),
        checksum: Base64.strict_encode64(Digest::MD5.file(path).digest),
        sha256: Digest::SHA256.file(path).hexdigest,
        width:,
        height:
      }
    end
  end

  def self.plan_fingerprint(plan)
    Digest::SHA256.hexdigest(JSON.generate(plan))
  end

  def self.operation_proof(secret, identity, fingerprint)
    IntegrationDatabase.proof(secret, "demo-image-refresh-v#{VERSION}:#{fingerprint}", identity, 0)
  end

  def self.secure_compare(left, right)
    left = left.to_s
    right = right.to_s
    return false unless left.bytesize == right.bytesize && left.bytesize.positive?

    OpenSSL.fixed_length_secure_compare(left, right)
  end

  def initialize(env:, output:)
    @env = env
    @output = output
    @created_storage_objects = []
  end

  def run!
    self.class.validate_manifest!
    mode = @env.fetch("DEMO_IMAGE_REFRESH_MODE", "plan")
    raise SafetyError, "mode must be plan or apply" unless %w[plan apply].include?(mode)

    identity = validate_runtime!
    files = load_files!
    targets = resolve_targets!(files)
    plan = build_plan(targets)
    fingerprint = self.class.plan_fingerprint(canonical_plan(plan))
    proof = self.class.operation_proof(@env.fetch("INTEGRATION_PROOF_SECRET"), identity, fingerprint)

    print_plan(plan, fingerprint, proof)
    return plan if mode == "plan"

    authorize_apply!(identity, fingerprint, proof)
    apply!(plan, fingerprint)
  end

  private

  def validate_runtime!
    raise SafetyError, "Rails development environment is required" unless Rails.env.development?
    raise SafetyError, "INTEGRATION_PROOF=1 is required" unless @env["INTEGRATION_PROOF"] == "1"

    IntegrationDatabase.validate_environment!(@env)
    unless @env["DATABASE_PORT"] == REQUIRED_PORT &&
        @env["INTEGRATION_CONFIRM"] == "127.0.0.1:#{REQUIRED_PORT}/eclectary_integration"
      raise SafetyError, "only 127.0.0.1:55432/eclectary_integration is allowed"
    end
    IntegrationDatabase.validate_secret!(@env["INTEGRATION_PROOF_SECRET"])
    @connection = ActiveRecord::Base.connection
    identity = IntegrationDatabase.validate_connection!(@connection, @env)
    raise SafetyError, "database has pending migrations" if @connection.pool.migration_context.needs_migration?

    service = ActiveStorage::Blob.service
    unless service.name.to_s == "local" && service.is_a?(ActiveStorage::Service::DiskService)
      raise SafetyError, "Active Storage must use the local disk service"
    end
    unless service.respond_to?(:root) && Pathname(service.root).expand_path == Rails.root.join("storage").expand_path
      raise SafetyError, "local Active Storage root does not match Rails.root/storage"
    end

    identity
  end

  def load_files!
    directory = Rails.root.join(IMAGE_DIRECTORY)
    MANIFEST.to_h do |entry|
      filename = "#{entry.fetch(:key)}.png"
      path = directory.join(filename)
      raise SafetyError, "missing approved image #{path}" unless path.file?

      metadata = self.class.png_metadata(path)
      unless metadata.fetch(:width) == 640 && metadata.fetch(:height) == 640
        raise SafetyError, "#{filename} must be exactly 640x640"
      end
      if metadata.fetch(:byte_size) > Product::MAX_IMAGE_SIZE
        raise SafetyError, "#{filename} exceeds the Product image size limit"
      end

      [ entry.fetch(:key), entry.merge(filename:, path:, replacement: metadata) ]
    end
  end

  def resolve_targets!(files)
    targets = MANIFEST.map do |entry|
      file = files.fetch(entry.fetch(:key))
      sellers = User.where(email: entry.fetch(:seller_email)).to_a
      unless sellers.one? && sellers.first.seller?
        raise SafetyError, "expected exactly one reserved seller #{entry.fetch(:seller_email)}"
      end
      seller = sellers.first
      raise SafetyError, "protected test account cannot own a target" if seller.email == PROTECTED_EMAIL

      product_ids = Product.where(seller_id: seller.id).pluck(:id)
      attachments = ActiveStorage::Attachment.includes(:blob)
        .joins(:blob)
        .where(record_type: Product.polymorphic_name, record_id: product_ids, name: "images")
        .where(active_storage_blobs: { filename: file.fetch(:filename) })
        .to_a
      unless attachments.one?
        raise SafetyError,
          "expected exactly one #{file.fetch(:filename)} attachment owned by #{seller.email}; found #{attachments.size}"
      end

      attachment = attachments.first
      product = Product.find(attachment.record_id)
      unless product.seller_id == seller.id && product.title == entry.fetch(:title)
        raise SafetyError, "stable target guard failed for #{entry.fetch(:key)}"
      end

      {
        manifest: file,
        product:,
        attachment:,
        product_attributes: product.attributes,
        other_attachments: attachment_signature(product, excluding: attachment.id)
      }
    end

    unless targets.map { |target| target.fetch(:product).id }.uniq.size == 12 &&
        targets.map { |target| target.fetch(:attachment).id }.uniq.size == 12
      raise SafetyError, "targets must resolve to 12 distinct products and attachments"
    end

    targets
  end

  def build_plan(targets)
    {
      version: VERSION,
      storage_service: ActiveStorage::Blob.service.name.to_s,
      items: targets.map do |target|
        attachment = target.fetch(:attachment)
        blob = attachment.blob
        replacement = target.fetch(:manifest).fetch(:replacement)
        current = {
          blob_id: blob.id,
          key: blob.key,
          filename: blob.filename.to_s,
          content_type: blob.content_type,
          byte_size: blob.byte_size,
          checksum: blob.checksum,
          service_name: blob.service_name,
          stored: blob.service.exist?(blob.key)
        }
        already_current = current.fetch(:stored) && current.fetch(:filename) == target.fetch(:manifest).fetch(:filename) &&
          current.fetch(:content_type) == CONTENT_TYPE && current.fetch(:byte_size) == replacement.fetch(:byte_size) &&
          current.fetch(:checksum) == replacement.fetch(:checksum)

        {
          key: target.fetch(:manifest).fetch(:key),
          seller_email: target.fetch(:manifest).fetch(:seller_email),
          product_id: target.fetch(:product).id,
          attachment_id: attachment.id,
          filename: target.fetch(:manifest).fetch(:filename),
          path: target.fetch(:manifest).fetch(:path).to_s,
          current:,
          replacement: replacement,
          action: already_current ? "skip" : "replace",
          runtime: target
        }
      end
    }
  end

  def canonical_plan(plan)
    {
      version: plan.fetch(:version),
      storage_service: plan.fetch(:storage_service),
      items: plan.fetch(:items).map { |item| item.reject { |key, _value| key == :runtime } }
    }
  end

  def print_plan(plan, fingerprint, proof)
    canonical = canonical_plan(plan)
    @output.puts JSON.pretty_generate(canonical)
    @output.puts "Plan fingerprint: #{fingerprint}"
    @output.puts "Apply proof: #{proof}"
    @output.puts "No database or storage writes were performed." if @env.fetch("DEMO_IMAGE_REFRESH_MODE", "plan") == "plan"
  end

  def authorize_apply!(identity, fingerprint, expected_proof)
    unless @env["DEMO_IMAGE_REFRESH_CONFIRM"] == APPLY_CONFIRMATION
      raise SafetyError, "DEMO_IMAGE_REFRESH_CONFIRM must equal #{APPLY_CONFIRMATION.inspect}"
    end
    unless self.class.secure_compare(@env["DEMO_IMAGE_REFRESH_PROOF"], expected_proof)
      raise SafetyError, "apply proof does not match the current files, attachments, database instance, and proof secret"
    end

    IntegrationDatabase.validate_secret!(@env["INTEGRATION_PROOF_SECRET"])
    current_identity = IntegrationDatabase.validate_connection!(@connection, @env)
    raise SafetyError, "database identity changed after planning" unless current_identity == identity
    current_proof = self.class.operation_proof(@env.fetch("INTEGRATION_PROOF_SECRET"), current_identity, fingerprint)
    raise SafetyError, "proof changed immediately before writes" unless self.class.secure_compare(current_proof, expected_proof)
  end

  def apply!(plan, fingerprint)
    replacements = plan.fetch(:items).select { |item| item.fetch(:action) == "replace" }
    if replacements.empty?
      @output.puts "All 12 attachments already match the approved PNGs; no writes performed."
      return plan
    end

    audit_path = audit_path!
    audit = nil
    committed = false
    ApplicationRecord.transaction(requires_new: true) do
      audit_items = replacements.map { |item| replace_one!(item) }
      verify_preserved_state!(plan)
      audit = {
        version: VERSION,
        completed_at: Time.now.utc.iso8601,
        plan_fingerprint: fingerprint,
        items: audit_items
      }
    end
    committed = true
    write_audit!(audit_path, audit)
    @output.puts "Replaced #{replacements.size} attachment(s). Rollback data: #{audit_path}"
    audit
  rescue StandardError
    cleanup_uncommitted_storage! unless committed
    raise
  end

  def replace_one!(item)
    runtime = item.fetch(:runtime)
    attachment = ActiveStorage::Attachment.lock.find(item.fetch(:attachment_id))
    unless attachment.blob_id == item.dig(:current, :blob_id) && attachment.record_id == item.fetch(:product_id) &&
        attachment.record_type == Product.polymorphic_name && attachment.name == "images"
      raise SafetyError, "attachment changed after planning for #{item.fetch(:key)}"
    end

    blob = File.open(item.fetch(:path), "rb") do |io|
      ActiveStorage::Blob.create_and_upload!(
        io:,
        filename: item.fetch(:filename),
        content_type: CONTENT_TYPE,
        service_name: "local",
        identify: false
      )
    end
    @created_storage_objects << [ blob.service, blob.key ]
    verify_new_blob!(blob, item)
    attachment.update!(blob:)

    {
      key: item.fetch(:key),
      product_id: item.fetch(:product_id),
      attachment_id: attachment.id,
      old_blob: item.fetch(:current),
      new_blob: {
        blob_id: blob.id,
        key: blob.key,
        filename: blob.filename.to_s,
        content_type: blob.content_type,
        byte_size: blob.byte_size,
        checksum: blob.checksum,
        service_name: blob.service_name
      }
    }
  end

  def verify_new_blob!(blob, item)
    replacement = item.fetch(:replacement)
    unless blob.filename.to_s == item.fetch(:filename) && blob.content_type == CONTENT_TYPE &&
        blob.byte_size == replacement.fetch(:byte_size) && blob.checksum == replacement.fetch(:checksum) &&
        blob.key.present? && blob.key != item.dig(:current, :key) && blob.service.exist?(blob.key)
      raise SafetyError, "uploaded blob verification failed for #{item.fetch(:key)}"
    end
  end

  def verify_preserved_state!(plan)
    plan.fetch(:items).each do |item|
      runtime = item.fetch(:runtime)
      product = runtime.fetch(:product).reload
      unless product.attributes == runtime.fetch(:product_attributes)
        raise SafetyError, "non-image product data changed for #{item.fetch(:key)}"
      end
      unless attachment_signature(product, excluding: item.fetch(:attachment_id)) == runtime.fetch(:other_attachments)
        raise SafetyError, "a non-target attachment changed for #{item.fetch(:key)}"
      end
    end
  end

  def attachment_signature(product, excluding:)
    product.images_attachments.where.not(id: excluding).order(:id).pluck(:id, :blob_id, :name, :record_type, :record_id)
  end

  def audit_path!
    value = @env["DEMO_IMAGE_REFRESH_AUDIT_PATH"].to_s
    raise SafetyError, "DEMO_IMAGE_REFRESH_AUDIT_PATH is required for apply mode" if value.empty?

    path = Pathname(value)
    raise SafetyError, "audit path must be absolute" unless path.absolute?
    raise SafetyError, "audit file already exists: #{path}" if path.exist?
    raise SafetyError, "audit directory does not exist: #{path.dirname}" unless path.dirname.directory?
    path
  end

  def write_audit!(path, audit)
    File.open(path, File::WRONLY | File::CREAT | File::EXCL, 0o600) do |file|
      file.write(JSON.pretty_generate(audit))
      file.write("\n")
      file.flush
      file.fsync
    end
  rescue SystemCallError => error
    @output.puts "CRITICAL: database changes committed, but rollback audit could not be written: #{error.message}"
    @output.puts JSON.pretty_generate(audit)
    raise
  end

  def cleanup_uncommitted_storage!
    @created_storage_objects.each do |service, key|
      service.delete(key)
    rescue StandardError => error
      @output.puts "WARNING: could not remove uncommitted storage object #{key}: #{error.message}"
    end
  end
end
