require_relative "boot"

require "rails"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_view/railtie"
require "action_mailer/railtie"
require "action_mailbox/engine"
require "action_text/engine"
require "action_cable/engine"
require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module BackEnd
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    config.x.api.base_url = ENV.fetch("API_BASE_URL", "")
    config.x.api.version = ENV.fetch("API_VERSION", "")
    config.x.frontend_url = ENV.fetch("FRONTEND_URL", "")
    config.x.stripe.publishable_key = ENV.fetch("STRIPE_PUBLISHABLE_KEY", "")
    config.x.stripe.secret_key = ENV.fetch("STRIPE_SECRET_KEY", "")
    config.x.stripe.webhook_secret = ENV.fetch("STRIPE_WEBHOOK_SECRET", "")

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = false
  end

  if ENV.key?("INTEGRATION_CONFIRM") || ENV["INTEGRATION_PROOF"] == "1"
    require_relative "../lib/integration_database"
    raise IntegrationDatabase::VerificationError, "Integration mode requires development" unless Rails.env.development?
    IntegrationDatabase.prepare_rails_environment!(ENV)
  end
end
