module Authorization
  extend ActiveSupport::Concern

  class_methods do
    # Restricts the given actions (via before_action options) to users whose
    # role is included in `roles`. Requires Authentication to run first so
    # that `current_user` is set.
    def require_role(*roles, **options)
      before_action(options) { authorize_role!(*roles) }
    end
  end

  private

  def authorize_role!(*roles)
    allowed_roles = roles.map(&:to_s)
    return if current_user && allowed_roles.include?(current_user.role)

    render_api_error("Forbidden", status: :forbidden)
  end
end
