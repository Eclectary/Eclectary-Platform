require Rails.root.join("lib/frontend_origins")

allowed_origins = FrontendOrigins.resolve(
  environment: Rails.env,
  configured_origin: ENV["FRONTEND_URL"]
)

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  if allowed_origins.any?
    allow do
      origins(*allowed_origins)

      resource "*",
        headers: :any,
        methods: %i[get post put patch delete options head]
    end
  end
end
