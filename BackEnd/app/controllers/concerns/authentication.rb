module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_user
  end

  private

  def authenticate_user
    token = request.headers["Authorization"].to_s.match(/\ABearer +(\S+)\z/i)&.captures&.first
    decoded_token = JsonWebToken.decode(token)

    if decoded_token
      @current_user = User.find_by(id: decoded_token["user_id"])
    end

    render json: { error: "Unauthorized" }, status: :unauthorized unless @current_user
  end

  def current_user
    @current_user
  end
end
