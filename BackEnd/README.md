# README

## Public sellers API

Run `bundle exec ruby bin/rails db:migrate` before starting the API.
`GET /api/v1/sellers` returns `{ "data": [...] }`, ordered by user ID and
restricted to users whose existing role is `seller`.
`GET /api/v1/sellers/:id` returns `{ "data": {...} }` or a JSON 404 for a
missing/non-seller account. Neither endpoint requires authentication.

The dedicated seller serializer exposes only `id`, `name`, `image`, `specialty`,
and `bio`. It never uses the account serializer or exposes email, password data,
roles, or account timestamps. The optional public profile columns are
`public_name`, `image_url`, `specialty`, and `bio`; they can be supplied during
seller registration or maintained through the existing administrative interface.
Image URLs must use HTTP(S). Existing sellers without profiles appear as
`Maker #ID` with null optional fields, not a name inferred from an email.

The homepage fetches these profiles through the shared frontend API client,
shows up to four makers (search covers all returned makers), and uses the local
favicon when no profile image is set. Numeric shop links load real seller
profiles and products by `seller_id`; existing mock slug links elsewhere remain
unchanged.

## Product images API

Products support multiple Active Storage attachments through `Product#images`.
`GET /api/v1/products` and `GET /api/v1/products/:id` expose `image` as the
first-attached (primary) image path and `images` as the ordered list of
attachment paths; products without images return `null` and an empty list. The
paths use Rails' signed Active Storage blob routes. The frontend resolves these
paths against the origin configured by `VITE_API_URL`.

Development stores attachments on the configured local disk service. The seed
catalog attaches its included, product-specific PNG artwork only when a seeded
product has no image already, so re-running seeds does not replace an existing
image. Product image upload is not exposed as an API endpoint.

Focused backend validation:

```powershell
bundle exec ruby bin/rails test test/controllers/api/v1/sellers_controller_test.rb test/controllers/api/v1/users_controller_test.rb test/models/user_test.rb
```

This README would normally document whatever steps are necessary to get the
application up and running.

Things you may want to cover:

* Ruby version

* System dependencies

* Configuration

* Database creation

* Database initialization

* How to run the test suite

* Services (job queues, cache servers, search engines, etc.)

* Deployment instructions

* ...
