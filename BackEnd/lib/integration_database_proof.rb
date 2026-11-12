require_relative "integration_database"

class IntegrationDatabaseProof
  def initialize(app, environment: ENV, connection: -> { ActiveRecord::Base.connection },
    pid: -> { Process.pid }, logger: -> { Rails.logger })
    @app = app
    @environment = environment
    @connection = connection
    @pid = pid
    @logger = logger
    IntegrationDatabase.validate_environment!(@environment)
    IntegrationDatabase.validate_secret!(@environment["INTEGRATION_PROOF_SECRET"])
    IntegrationDatabase.validate_connection!(@connection.call, @environment)
  end

  def call(env)
    challenge = env["HTTP_X_INTEGRATION_CHALLENGE"]
    unless challenge
      guard = env["HTTP_X_INTEGRATION_GUARD_CHALLENGE"]
      if guard || env["HTTP_X_INTEGRATION_GUARD_PROOF"]
        proof = env["HTTP_X_INTEGRATION_GUARD_PROOF"].to_s
        unless guard.to_s.match?(/\A[0-9a-f]{64}\z/) && proof.match?(/\A[0-9a-f]{64}\z/) &&
            env["REMOTE_ADDR"] == "127.0.0.1"
          return [ 403, { "content-type" => "text/plain" }, [ "Integration verification refused" ] ]
        end
        identity = IntegrationDatabase.validate_connection!(@connection.call, @environment)
        expected = IntegrationDatabase.proof(@environment.fetch("INTEGRATION_PROOF_SECRET"), guard, identity, @pid.call)
        unless OpenSSL.fixed_length_secure_compare(proof, expected)
          raise IntegrationDatabase::VerificationError, "API database identity changed after verification"
        end
      end
      return @app.call(env)
    end

    unless env["REQUEST_METHOD"] == "GET" && env["PATH_INFO"] == "/api/v1/health" &&
        env["REMOTE_ADDR"] == "127.0.0.1" && challenge.match?(/\A[0-9a-f]{64}\z/)
      return [ 403, { "content-type" => "text/plain" }, [ "Integration verification refused" ] ]
    end

    identity = IntegrationDatabase.validate_connection!(@connection.call, @environment)
    status, headers, body = @app.call(env)
    headers["x-integration-proof"] = IntegrationDatabase.proof(
      @environment.fetch("INTEGRATION_PROOF_SECRET"), challenge, identity, @pid.call
    )
    [ status, headers, body ]
  rescue IntegrationDatabase::VerificationError => error
    @logger.call.error("Integration verification failed: #{error.message}")
    [ 503, { "content-type" => "text/plain" }, [ "Integration verification failed" ] ]
  end
end
