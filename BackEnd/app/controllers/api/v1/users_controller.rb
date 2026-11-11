class Api::V1::UsersController < Api::V1::BaseController
  REGISTRATION_RATE_LIMIT = 5
  REGISTRATION_RATE_LIMIT_WINDOW = 1.hour

  include Authentication
  include Authorization

  skip_before_action :authenticate_user, only: :create
  require_role :administrator, only: [ :index ]
  require_role :seller, only: [ :update ]

  rate_limit to: REGISTRATION_RATE_LIMIT,
    within: REGISTRATION_RATE_LIMIT_WINDOW,
    by: :authentication_rate_limit_key,
    with: :render_authentication_rate_limit,
    store: AUTHENTICATION_RATE_LIMIT_STORE,
    name: "registration",
    only: :create

  def index
    render json: {
  data: User.all.map { |user| UserSerializer.new(user).as_json }
}
    end

  def create
    user = User.new(user_params)

    if user.save
      render json: UserSerializer.new(user).as_json.merge(
        token: JsonWebToken.encode(user_id: user.id)
      ), status: :created
    else
      render_api_error(user.errors.full_messages, status: :unprocessable_entity)
    end
  end

  def me
    render json: UserSerializer.new(current_user).as_json
  end

  def update
    if current_user.update(profile_params)
      render json: UserSerializer.new(current_user).as_json
    else
      render_api_error(current_user.errors.full_messages, status: :unprocessable_entity)
    end
  end

  private

  # Public self-registration must never allow escalation to administrator.
  def user_params
    permitted = require_object_parameter(:user).permit(
      :email,
      :password,
      :password_confirmation,
      :public_name,
      :image_url,
      :specialty,
      :bio,
      :role
    )
    permitted[:role] = "customer" if permitted[:role] == "administrator"
    permitted
  end

  def profile_params
    require_object_parameter(:user).permit(:public_name, :specialty, :bio, :image_url)
  end
end
