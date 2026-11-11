class Api::V1::SessionsController < Api::V1::BaseController
  LOGIN_RATE_LIMIT = 10
  LOGIN_RATE_LIMIT_WINDOW = 5.minutes

  rate_limit to: LOGIN_RATE_LIMIT,
    within: LOGIN_RATE_LIMIT_WINDOW,
    by: :authentication_rate_limit_key,
    with: :render_authentication_rate_limit,
    store: AUTHENTICATION_RATE_LIMIT_STORE,
    name: "login",
    only: :create

  def create
    user = User.find_by(email: User.normalize_email(params[:email]))

    if user&.authenticate(params[:password])
      token = JsonWebToken.encode(user_id: user.id)

      render json: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        token: token
      }, status: :ok
    else
      render json: {
        error: "Invalid email or password"
      }, status: :unauthorized
    end
  end
end