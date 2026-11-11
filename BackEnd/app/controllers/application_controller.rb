require "openssl"

class ApplicationController < ActionController::API
  AUTHENTICATION_RATE_LIMIT_STORE = if Rails.env.test?
    ActiveSupport::Cache::MemoryStore.new
  else
    Rails.cache
  end

  private

  def authentication_rate_limit_key
    OpenSSL::HMAC.hexdigest(
      "SHA256",
      Rails.application.secret_key_base,
      request.remote_ip.to_s
    )
  end

  def render_authentication_rate_limit
    render json: { error: "Too many requests. Please try again later." }, status: :too_many_requests
  end
end
