require "minitest/autorun"
require "logger"
require "tmpdir"
require_relative "../../lib/integration_database_proof"
require_relative "../../script/test_live_integration"

class IntegrationDatabaseUnitTest < Minitest::Test
  ENVIRONMENT = {
    "DATABASE_HOST" => "127.0.0.1",
    "DATABASE_PORT" => "55432",
    "DATABASE_NAME" => "eclectary_integration",
    "DATABASE_USERNAME" => "integration",
    "DATABASE_PASSWORD" => "",
    "INTEGRATION_CONFIRM" => "127.0.0.1:55432/eclectary_integration",
    "INTEGRATION_PROOF_SECRET" => "a" * 64
  }.freeze
  IDENTITY = "eclectary_integration|127.0.0.1|55432|integration|1234.000001"

  Config = Struct.new(:configuration_hash)
  Pool = Struct.new(:db_config)
  Connection = Struct.new(:pool, :identity) do
    def select_value(sql)
      raise "unexpected query" unless sql == IntegrationDatabase::IDENTITY_SQL
      identity
    end
  end

  class FakeHTTP
    attr_reader :requests
    attr_accessor :proof_pid, :include_proof

    def initialize
      @requests = []
      @proof_pid = 42
      @include_proof = true
    end

    def peer_pid
      42
    end

    def request(request)
      @requests << request
      response = Net::HTTPOK.new("1.1", "200", "OK")
      if request["X-Integration-Challenge"] && @include_proof
        response["x-integration-proof"] = IntegrationDatabase.proof(
          ENV.fetch("INTEGRATION_PROOF_SECRET"), request["X-Integration-Challenge"], IDENTITY, @proof_pid
        )
      end
      response
    end
  end

  class PumaConfig
    attr_reader :ports, :bindings

    def initialize
      @ports = []
      @bindings = []
    end

    def threads(*); end
    def plugin(*); end
    def pidfile(*); end

    def port(*args)
      @ports << args
    end

    def bind(value)
      @bindings << value
    end
  end

  def setup
    @old_env = ENV.to_h
    ENVIRONMENT.each { |key, value| ENV[key] = value }
    ENV.delete("DATABASE_URL")
    ENV.delete("PRIMARY_DATABASE_URL")
    config = {
      adapter: "postgresql", database: "eclectary_integration", host: "127.0.0.1",
      port: 55432, username: "integration"
    }
    @connection = Connection.new(Pool.new(Config.new(config)), IDENTITY)
  end

  def teardown
    ENV.replace(@old_env)
  end

  def test_confirms_configuration_and_actual_instance
    assert_equal IDENTITY, IntegrationDatabase.validate_connection!(@connection, ENV)
  end

  def test_rejects_missing_or_inconsistent_confirmation_and_database_url
    [
      [ "INTEGRATION_CONFIRM", nil ],
      [ "INTEGRATION_CONFIRM", "127.0.0.1:5432/eclectary_integration" ],
      [ "DATABASE_PORT", "5432" ],
      [ "DATABASE_HOST", "localhost" ],
      [ "DATABASE_NAME", "back_end_development" ],
      [ "DATABASE_URL", "postgresql://localhost/other" ],
      [ "PRIMARY_DATABASE_URL", "postgresql://localhost/other" ],
      [ "DATABASE_PASSWORD", nil ]
    ].each do |key, value|
      original = ENV[key]
      value.nil? ? ENV.delete(key) : ENV[key] = value
      assert_raises(IntegrationDatabase::VerificationError, key) { IntegrationDatabase.validate_environment!(ENV) }
      original.nil? ? ENV.delete(key) : ENV[key] = original
    end
  end

  def test_prepares_empty_url_overrides_only_after_validating_integration_settings
    env = ENVIRONMENT.merge("DATABASE_URL" => "", "PRIMARY_DATABASE_URL" => "")
    IntegrationDatabase.prepare_rails_environment!(env)
    refute env.key?("DATABASE_URL")
    refute env.key?("PRIMARY_DATABASE_URL")
    assert_equal "55432", env.fetch("DATABASE_PORT")

    %w[DATABASE_URL PRIMARY_DATABASE_URL].each do |key|
      invalid = ENVIRONMENT.merge(key => "postgresql://localhost/other")
      original = invalid.dup
      assert_raises(IntegrationDatabase::VerificationError) do
        IntegrationDatabase.prepare_rails_environment!(invalid)
      end
      assert_equal original, invalid
    end
  end

  def test_middleware_refuses_to_start_with_a_mismatched_database
    @connection.identity = IDENTITY.sub("55432", "5432")
    assert_raises(IntegrationDatabase::VerificationError) do
      IntegrationDatabaseProof.new(->(_env) { raise "not reached" }, connection: -> { @connection })
    end
  end

  def test_verification_only_does_not_run_functional_workflows
    suite = LiveIntegrationTest.new
    checked = false
    suite.define_singleton_method(:verify_database_safety!) { checked = true }
    %i[verify_environment verify_public_catalog verify_customer_workflows verify_seller_workflows].each do |method|
      suite.define_singleton_method(method) { raise "Functional workflow must not run" }
    end
    suite.run(verify_only: true)
    assert checked
  end

  def test_rejects_actual_or_configured_database_mismatches
    connection = @connection
    connection.identity = IDENTITY.sub("55432", "55433")
    assert_raises(IntegrationDatabase::VerificationError) { IntegrationDatabase.validate_connection!(connection, ENV) }
    connection.identity = IDENTITY
    connection.pool.db_config.configuration_hash[:database] = "back_end_development"
    assert_raises(IntegrationDatabase::VerificationError) { IntegrationDatabase.validate_connection!(connection, ENV) }
  end

  def test_proof_depends_on_challenge_instance_and_process
    secret = ENV.fetch("INTEGRATION_PROOF_SECRET")
    proof = IntegrationDatabase.proof(secret, "challenge", IDENTITY, 123)
    refute_equal proof, IntegrationDatabase.proof(secret, "other", IDENTITY, 123)
    refute_equal proof, IntegrationDatabase.proof(secret, "challenge", IDENTITY.sub("1234", "1235"), 123)
    refute_equal proof, IntegrationDatabase.proof(secret, "challenge", IDENTITY, 124)
    assert_raises(IntegrationDatabase::VerificationError) { IntegrationDatabase.validate_secret!("short") }
  end

  def test_puma_integration_binding_is_single_process_and_development_only
    config_path = File.expand_path("../../config/puma.rb", __dir__)
    source = File.read(config_path)
    ENV["INTEGRATION_PROOF"] = "1"
    ENV["INTEGRATION_API_SOCKET"] = "/tmp/example-integration.sock"
    ENV["WEB_CONCURRENCY"] = "0"
    ENV["RAILS_ENV"] = "development"
    config = PumaConfig.new
    config.instance_eval(source, config_path)
    assert_equal [ [ 3000, "127.0.0.1" ] ], config.ports
    assert_equal [ "unix:///tmp/example-integration.sock?umask=0077" ], config.bindings

    ENV["WEB_CONCURRENCY"] = "2"
    assert_raises(RuntimeError) { PumaConfig.new.instance_eval(source, config_path) }
    ENV["RAILS_ENV"] = "production"
    config = PumaConfig.new
    config.instance_eval(source, config_path)
    assert_empty config.bindings
  end

  def test_middleware_only_attests_local_health_challenges_without_exposing_identity
    app = ->(_env) { [ 200, { "content-type" => "application/json" }, [ "{}" ] ] }
    middleware = IntegrationDatabaseProof.new(app, connection: -> { @connection }, logger: -> { Logger.new(File::NULL) })
    env = { "REQUEST_METHOD" => "GET", "PATH_INFO" => "/api/v1/health", "REMOTE_ADDR" => "127.0.0.1" }
    assert_nil middleware.call(env)[1]["x-integration-proof"]

    env["HTTP_X_INTEGRATION_CHALLENGE"] = "b" * 64
    status, headers, body = middleware.call(env)
    assert_equal 200, status
    assert_equal IntegrationDatabase.proof(ENV.fetch("INTEGRATION_PROOF_SECRET"), "b" * 64, IDENTITY, Process.pid),
      headers.fetch("x-integration-proof")
    refute_includes headers.to_s, IDENTITY
    refute_includes body.join, IDENTITY
    assert_equal 403, middleware.call(env.merge("REMOTE_ADDR" => "192.0.2.1"))[0]
    assert_equal 403, middleware.call(env.merge("PATH_INFO" => "/api/v1/orders"))[0]
    guarded = env.reject { |key, _| key == "HTTP_X_INTEGRATION_CHALLENGE" }
    guarded["HTTP_X_INTEGRATION_GUARD_CHALLENGE"] = "b" * 64
    guarded["HTTP_X_INTEGRATION_GUARD_PROOF"] = headers.fetch("x-integration-proof")
    assert_equal 200, middleware.call(guarded)[0]
    assert_equal 403, middleware.call(guarded.merge("REMOTE_ADDR" => "192.0.2.1"))[0]
    assert_equal 503, middleware.call(guarded.merge("HTTP_X_INTEGRATION_GUARD_PROOF" => "c" * 64))[0]
    @connection.identity = IDENTITY.sub("1234", "1235")
    assert_equal 503, middleware.call(guarded)[0]
    @connection.identity = IDENTITY.sub("55432", "55433")
    assert_equal 503, middleware.call(env)[0]
    assert_equal 503, middleware.call(guarded)[0]
  end

  def test_api_write_requires_matching_proof_from_the_socket_peer
    suite = LiveIntegrationTest.new
    suite.define_singleton_method(:database_scalar) { |_sql| IDENTITY }
    http = FakeHTTP.new
    suite.instance_variable_set(:@api_http, http)

    http.include_proof = false
    assert_raises(IntegrationFailure) { suite.send(:api_request, :post, "/users", body: {}) }
    assert_equal [ "GET" ], http.requests.map(&:method)

    http.include_proof = true
    http.proof_pid = 43
    assert_raises(IntegrationFailure) { suite.send(:api_request, :post, "/users", body: {}) }
    assert_equal [ "GET", "GET" ], http.requests.map(&:method)

    http.proof_pid = 42
    suite.send(:api_request, :post, "/users", body: {})
    assert_equal [ "GET", "GET", "GET", "POST" ], http.requests.map(&:method)
  end

  def test_pinned_connection_never_reconnects_after_server_closes
    Dir.mktmpdir do |dir|
      path = File.join(dir, "server.sock")
      server = UNIXServer.new(path)
      thread = Thread.new do
        client = server.accept
        while (line = client.gets) && line != "\r\n"
        end
        client.write("HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
        client.close
      end
      http = PinnedIntegrationHTTP.new(path, nil, nil)
      http.start
      assert_equal Process.pid, http.peer_pid
      assert_equal "200", http.request(Net::HTTP::Get.new("/")).code
      assert_raises(IntegrationFailure) { http.request(Net::HTTP::Get.new("/")) }
      http.finish
      thread.join
      server.close
    end
  end

  def test_mock_api_proof_and_guard_on_same_unix_connection
    Dir.mktmpdir do |dir|
      path = File.join(dir, "server.sock")
      server = UNIXServer.new(path)
      dispatched = []
      app = ->(env) { dispatched << env["REQUEST_METHOD"]; [ 200, {}, [ "ok" ] ] }
      middleware = IntegrationDatabaseProof.new(app, connection: -> { @connection }, logger: -> { Logger.new(File::NULL) })
      thread = Thread.new do
        client = server.accept
        2.times do
          method, request_path, = client.gets.split
          headers = {}
          while (line = client.gets) && line != "\r\n"
            name, value = line.split(":", 2)
            headers[name.downcase] = value.strip
          end
          client.read(headers["content-length"].to_i) if headers["content-length"]
          env = {
            "REQUEST_METHOD" => method, "PATH_INFO" => request_path, "REMOTE_ADDR" => "127.0.0.1",
            "HTTP_X_INTEGRATION_CHALLENGE" => headers["x-integration-challenge"],
            "HTTP_X_INTEGRATION_GUARD_CHALLENGE" => headers["x-integration-guard-challenge"],
            "HTTP_X_INTEGRATION_GUARD_PROOF" => headers["x-integration-guard-proof"]
          }
          status, response_headers, body = middleware.call(env)
          payload = body.join
          client.write("HTTP/1.1 #{status} OK\r\nContent-Length: #{payload.bytesize}\r\n")
          response_headers.each { |name, value| client.write("#{name}: #{value}\r\n") }
          client.write("\r\n#{payload}")
        end
        client.close
      end

      http = PinnedIntegrationHTTP.new(path, nil, nil)
      http.start
      suite = LiveIntegrationTest.new
      suite.define_singleton_method(:database_scalar) { |_sql| IDENTITY }
      suite.instance_variable_set(:@api_http, http)
      assert_equal "200", suite.send(:api_request, :post, "/users", body: {}).code
      assert_equal [ "GET", "POST" ], dispatched
      http.finish
      thread.join
      server.close
    end
  end
end
