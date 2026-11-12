require "openssl"

module IntegrationDatabase
  DATABASE = "eclectary_integration"
  HOST = "127.0.0.1"
  IDENTITY_SQL = <<~SQL.freeze
    SELECT concat_ws('|', current_database(), host(inet_server_addr()),
      inet_server_port()::text, current_user,
      extract(epoch from pg_postmaster_start_time())::numeric(20,6)::text)
  SQL

  class VerificationError < StandardError; end

  def self.validate_environment!(env)
    port = env["DATABASE_PORT"].to_s
    unless env["DATABASE_HOST"] == HOST && port.match?(/\A[0-9]+\z/) &&
        port.to_i.between?(1024, 65_535) && port.to_i != 5432 &&
        env["DATABASE_NAME"] == DATABASE && !env["DATABASE_USERNAME"].to_s.empty? &&
        env.key?("DATABASE_PASSWORD") && env["DATABASE_URL"].to_s.empty? &&
        env["PRIMARY_DATABASE_URL"].to_s.empty? &&
        env["INTEGRATION_CONFIRM"] == "#{HOST}:#{port}/#{DATABASE}"
      raise VerificationError, "explicit local integration database settings and confirmation are required"
    end
  end

  def self.prepare_rails_environment!(env)
    validate_environment!(env)
    # Dotenv must load first; Rails treats even an empty URL as an override.
    %w[DATABASE_URL PRIMARY_DATABASE_URL].each { |key| env.delete(key) }
  end

  def self.validate_identity!(identity, env)
    validate_environment!(env)
    fields = identity.to_s.split("|", -1)
    expected = [ DATABASE, HOST, env.fetch("DATABASE_PORT"), env.fetch("DATABASE_USERNAME") ]
    unless fields.length == 5 && fields.first(4) == expected && fields.last.match?(/\A\d+\.\d{6}\z/)
      raise VerificationError, "connected PostgreSQL instance does not match the confirmed integration instance"
    end
    identity
  end

  def self.validate_connection!(connection, env)
    validate_environment!(env)
    config = connection.pool.db_config.configuration_hash
    unless config[:adapter] == "postgresql" && config[:database] == DATABASE &&
        config[:host] == HOST && config[:port].to_s == env["DATABASE_PORT"] &&
        config[:username] == env["DATABASE_USERNAME"]
      raise VerificationError, "Rails database configuration does not match the confirmed integration instance"
    end
    validate_identity!(connection.select_value(IDENTITY_SQL), env)
  end

  def self.validate_secret!(secret)
    raise VerificationError, "INTEGRATION_PROOF_SECRET must be 64 lowercase hexadecimal characters" unless
      secret.to_s.match?(/\A[0-9a-f]{64}\z/)
  end

  def self.proof(secret, challenge, identity, pid)
    OpenSSL::HMAC.hexdigest("SHA256", secret, [ challenge, identity, pid.to_s ].join("\n"))
  end
end
