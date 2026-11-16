module Api
  module V1
    module Seller
      class RegistrationsController < Api::V1::BaseController
        include Authentication

        def create
          current_user.with_lock do
            return render_api_error("Seller registration already exists.", status: :conflict) if current_user.seller?
            return render_api_error("Administrators cannot register as sellers.", status: :forbidden) unless current_user.customer?

            attributes = registration_params
            required_errors = []
            required_errors << "Shop name can't be blank" if attributes[:public_name].blank?
            required_errors << "Specialty can't be blank" if attributes[:specialty].blank?
            return render_api_error(required_errors, status: :unprocessable_entity) if required_errors.any?

            current_user.assign_attributes(attributes.merge(role: "seller"))

            if current_user.save
              render json: UserSerializer.new(current_user).as_json, status: :created
            else
              render_api_error(current_user.errors.full_messages, status: :unprocessable_entity)
            end
          end
        end

        private

        def registration_params
          require_object_parameter(:seller).permit(:public_name, :specialty, :bio, :image_url)
        end
      end
    end
  end
end
