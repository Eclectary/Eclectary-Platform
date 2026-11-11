module Api
  module V1
    class BaseController < ApplicationController
      rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
      rescue_from ActionController::ParameterMissing, with: :render_parameter_missing
      rescue_from ActionDispatch::Http::Parameters::ParseError, with: :render_malformed_json

      def health
        render json: { status: "ok", api_version: "v1" }
      end

      private

      def render_api_error(messages, status:)
        render json: { errors: Array(messages) }, status: status
      end

      def require_object_parameter(name)
        value = params.require(name)
        raise ActionController::ParameterMissing, name unless value.is_a?(ActionController::Parameters)

        value
      end

      def render_not_found
        render_api_error("Record not found.", status: :not_found)
      end

      def render_parameter_missing(error)
        render_api_error("Missing or invalid parameter: #{error.param}.", status: :bad_request)
      end

      def render_malformed_json
        render_api_error("Malformed JSON request body.", status: :bad_request)
      end

      def render_authentication_rate_limit
        render_api_error("Too many requests. Please try again later.", status: :too_many_requests)
      end
    end
  end
end
