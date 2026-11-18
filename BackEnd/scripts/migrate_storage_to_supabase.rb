require "aws-sdk-s3"

client = Aws::S3::Client.new(
  region: ENV.fetch("SUPABASE_S3_REGION"),
  endpoint: ENV.fetch("SUPABASE_S3_ENDPOINT"),
  access_key_id: ENV.fetch("SUPABASE_S3_ACCESS_KEY_ID"),
  secret_access_key: ENV.fetch("SUPABASE_S3_SECRET_ACCESS_KEY"),
  force_path_style: true
)

bucket = ENV.fetch("SUPABASE_S3_BUCKET")
local_service = ActiveStorage::Blob.service

unless local_service.is_a?(ActiveStorage::Service::DiskService)
  abort "Expected local disk storage. No files transferred."
end

uploaded = 0
skipped = 0
missing = 0

ActiveStorage::Blob.find_each do |blob|
  begin
    client.head_object(bucket: bucket, key: blob.key)
    skipped += 1
    next
  rescue Aws::S3::Errors::NotFound
    # Object is not yet in Supabase.
  end

  unless local_service.exist?(blob.key)
    warn "Missing local file: #{blob.key}"
    missing += 1
    next
  end

  local_service.open(blob.key, verify: false) do |file|
    client.put_object(
      bucket: bucket,
      key: blob.key,
      body: file,
      content_type: blob.content_type || "application/octet-stream"
    )
  end

  uploaded += 1
  puts "Uploaded: #{blob.key}"
end

puts "Uploaded: #{uploaded}"
puts "Already present: #{skipped}"
puts "Missing: #{missing}"

abort "Some files are missing. Do not switch storage yet." if missing > 0
