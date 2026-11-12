# Integration test data

This dataset is separate from the normal development seeds. It is intended only for the local
`eclectary_integration` PostgreSQL database and contains fictional accounts and checkout details.

First provision and verify the separate local PostgreSQL instance as described in
the [root README](../README.md#isolated-integration-database). From `BackEnd/`,
export **all** of the documented `DATABASE_*` settings and `INTEGRATION_CONFIRM`
in the same terminal. Set `RAILS_ENV=development` and export `DATABASE_URL` and
`PRIMARY_DATABASE_URL` as empty so `.env` cannot supply URL overrides. Confirmed
integration boot validates the settings after dotenv loads and removes the empty
overrides before Rails parses them; nonempty overrides are rejected.
The role needs write access to the
pre-existing database and its current schema. Then run:

```sh
bundle exec ruby bin/rails runner script/setup_integration_data.rb
```

The setup refuses to write outside Rails development, with a nonempty
`DATABASE_URL` or `PRIMARY_DATABASE_URL`, without explicit loopback host, nonstandard port, role, password
setting and `INTEGRATION_CONFIRM`, or when Rails configuration and the connected
PostgreSQL database, address, port, and role differ. The operator must still
ensure that the confirmed instance is disposable and independent of normal
development data. Managed records are updated in one transaction.

## Test accounts

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer.one@integration.eclectary.test` | `EclectaryCustomer1!` |
| Customer | `customer.two@integration.eclectary.test` | `EclectaryCustomer2!` |
| Seller | `seller.one@integration.eclectary.test` | `EclectarySeller1!` |
| Seller | `seller.two@integration.eclectary.test` | `EclectarySeller2!` |

All addresses use the reserved `.test` domain, and all profile, phone, and shipping data is fictional.
No payment details are stored.

## Repeatable scenarios

- Customer one has a cart containing active products from both sellers.
- Customer two has a pending order containing an unfulfilled line item for each seller. Each seller can
  see and advance only their own line item through the seller fulfillment API.
- Both sellers own additional active products that can be used to assemble new mixed-seller carts and
  checkout requests.
- Seller one owns `Integration Retired Planter`, an inactive product for unavailable-product checks.
- Rerunning the setup restores the managed cart, pending order, product state, account credentials, and
  fulfillment statuses. Orders and carts created separately during integration testing are left alone.
- The live suite separately creates a customer, cart, merge record, two orders, and a seller product;
  it updates/deactivates that product and changes fulfillment on its new order. It does not clean up
  these records. Recreate the disposable instance when a completely clean dataset is needed.
