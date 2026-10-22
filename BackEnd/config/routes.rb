Rails.application.routes.draw do
  namespace :admin do
    post "login", to: "sessions#create"
  end

  delete "/admin/logout", to: "admin/sessions#destroy", as: :logout
  get "/admin/auth/login", to: "admin/sessions#new"

  mount RailsAdminNext::Engine => "/admin", as: "rails_admin_next"

  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      get "health", to: "base#health"
      resources :users, only: %i[create index]
      get "users/me", to: "users#me"
      resources :products, only: %i[index show]
      resources :categories, only: %i[index show]
      resources :sellers, only: %i[index show]
      resources :orders, only: %i[index show create]
      post "login", to: "sessions#create"
    end
  end
end
