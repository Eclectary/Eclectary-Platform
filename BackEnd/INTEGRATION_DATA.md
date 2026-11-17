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
- Intentional demonstration seeds and managed integration products are approved explicitly; ordinary
  seller submissions still default to pending review. The retired planter remains inactive.
- Rerunning the setup restores the managed cart, pending order, product state (including approved
  status), account credentials, and fulfillment statuses. Orders and carts created separately during
  integration testing are left alone.
- The live suite separately creates a customer, cart, merge record, two orders, and a seller product;
  it updates/deactivates that product and changes fulfillment on its new order. It does not clean up
  these records. Recreate the disposable instance when a completely clean dataset is needed.

## One-time demo image attachment refresh

`script/refresh_demo_product_images.rb` prepares a narrowly scoped replacement of the 12 seeded demo
product image attachments. It does not run seeds and does not update products, sellers, categories, or
the protected `testcustomer@example.com` account. The stable target is the combination of a reserved
`seed-…@eclectary.test` seller email and the existing attachment filename; titles are checked only as an
additional refusal guard and are never used for broad lookup.

The procedure defaults to plan mode. Plan mode validates all files and reads the database and storage
service, but performs no database or storage writes. In addition to the integration settings documented
in the root README, it requires exactly port `55432`, `INTEGRATION_PROOF=1`, the existing proof secret,
the current schema, and the `local` Active Storage disk rooted at `BackEnd/storage`.
The refresh validates the integration settings, exact port, proof flag, and secret before acquiring
its database connection; missing settings or port `5432` are refused before that connection is requested.

Before planning, independently verify the running integration server and proof secret over its Unix
socket:

```bash
bundle exec ruby script/test_live_integration.rb --verify-only
```

Then generate and review the complete plan:

```bash
DEMO_IMAGE_REFRESH_MODE=plan \
  bundle exec ruby bin/rails runner script/refresh_demo_product_images.rb
```

The plan prints all 12 product IDs, attachment IDs, old blob IDs and keys, replacement MD5 checksums,
SHA-256 digests, byte sizes, and whether each attachment needs replacement. It also prints a plan
fingerprint and a keyed apply proof. The proof is bound to the approved files, current attachment state,
connected PostgreSQL server identity, and `INTEGRATION_PROOF_SECRET`; any change requires a new plan and
review.

After explicit approval, set the exact proof printed by the reviewed plan and select a new absolute
audit path. Do not use a pre-existing path. The apply command is:

```bash
export DEMO_IMAGE_REFRESH_MODE=apply
export DEMO_IMAGE_REFRESH_CONFIRM=replace-exactly-12-demo-images
export DEMO_IMAGE_REFRESH_PROOF='<proof printed by the reviewed plan>'
export DEMO_IMAGE_REFRESH_AUDIT_PATH="$PWD/tmp/demo-image-refresh-audit.json"
bundle exec ruby bin/rails runner script/refresh_demo_product_images.rb
```

Apply mode repeats every validation immediately before writing. It uploads a new verified blob for each
changed PNG and updates only the existing target attachment's `blob_id`, preserving attachment IDs,
ordering, other images, and every product attribute. Already-matching attachments are skipped, making
the database operation idempotent. The old blob rows and storage objects are deliberately retained.

The audit JSON records the attachment ID and complete old/new blob identity needed for rollback. A
rollback must use that attachment ID—not a product title—and must first repeat the same database,
secret, service, seller-email, filename, current-new-blob, and old-object-existence checks. It can then
transactionally restore the attachment's old `blob_id`. Do not purge either side until the result and
rollback window have been accepted. A dedicated rollback write command is intentionally not included
in this phase; it should be generated and reviewed from the actual audit file if rollback is needed.

### Storage and rollback risks

- Development uses one local `BackEnd/storage` directory. Different local databases can therefore
  share the filesystem even though their blob rows are isolated. The procedure verifies the configured
  root and only creates new random keys; it never scans or deletes unrelated objects.
- PostgreSQL transactions cannot make disk uploads atomic. If a transaction fails, the procedure makes
  a best-effort deletion of newly uploaded keys. A process or filesystem failure can still leave an
  unreferenced storage object, which must be assessed by exact key rather than broad cleanup.
- If the database commit succeeds but the audit file cannot be written, the procedure prints the audit
  JSON as a critical recovery message and fails. Preserve that output before taking further action.
- An unattached-blob purge could remove the retained old blobs and eliminate the simple rollback path.
- Existing variants remain associated with the old blobs; variants for replacement blobs are generated
  normally when first requested.
