class UserSerializer
  def initialize(user)
    @user = user
  end

  def as_json
    user_data = {
      id: @user.id,
      email: @user.email,
      role: @user.role,
      created_at: @user.created_at,
      updated_at: @user.updated_at
    }

    return user_data unless @user.seller?

    user_data.merge(
      public_name: @user.public_name,
      specialty: @user.specialty,
      bio: @user.bio,
      image_url: @user.image_url
    )
  end
end