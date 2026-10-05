class Api::V1::UsersController < Api::V1::BaseController
  include Authentication
  include Authorization

  before_action :authenticate_user, only: %i[me index]
  require_role :administrator, only: [ :index ]

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
      render json: {
        errors: user.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  def me
    render json: UserSerializer.new(current_user).as_json
  end

  private

  # Public self-registration must never allow escalation to administrator.
  def user_params
    permitted = params.require(:user).permit(
      :email,
      :password,
      :password_confirmation,
      :role
    )
    permitted[:role] = "customer" if permitted[:role] == "administrator"
    permitted
  end
end
