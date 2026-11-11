require "uri"

module FrontendOrigins
  LOCAL_DEVELOPMENT_ORIGIN = "http://localhost:5173"

  module_function

  def resolve(environment:, configured_origin:)
    origins = []
    origins << LOCAL_DEVELOPMENT_ORIGIN if environment.development? || environment.test?

    configured_origin = configured_origin.to_s.strip
    origins << normalize(configured_origin) unless configured_origin.empty?
    origins.uniq.freeze
  end

  def normalize(origin)
    uri = URI.parse(origin)

    unless %w[http https].include?(uri.scheme) &&
        uri.host.present? &&
        uri.userinfo.nil? &&
        (uri.path.empty? || uri.path == "/") &&
        uri.query.nil? &&
        uri.fragment.nil?
      raise ArgumentError, invalid_origin_message
    end

    uri.origin
  rescue URI::InvalidURIError
    raise ArgumentError, invalid_origin_message
  end

  def invalid_origin_message
    "FRONTEND_URL must be an HTTP(S) origin without credentials, a path, query parameters, or a fragment"
  end
end
