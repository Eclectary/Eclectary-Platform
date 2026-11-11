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
      get "cart", to: "carts#show"
      post "cart/merge", to: "cart_merges#create"
      post "cart/items", to: "cart_items#create"
      patch "cart/items/:id", to: "cart_items#update"
      delete "cart/items/:id", to: "cart_items#destroy"
      delete "cart/items", to: "cart_items#clear"
      resources :products, only: %i[index show]
      namespace :seller do
        resources :products, only: %i[index show create update] do
          patch :deactivate, on: :member
        end
        resources :orders, only: %i[index show]
        patch "orders/:order_id/items/:item_id/fulfillment", to: "orders#update_fulfillment"
      end
      resources :categories, only: %i[index show]
      resources :sellers, only: %i[index show]
      resources :orders, only: %i[index show create]
      post "login", to: "sessions#create"
    end
  end
end
