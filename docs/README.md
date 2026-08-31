# Mosaic documentation

This directory is the source of truth for the first Mosaic release. Mosaic is a self-hostable agency analytics control plane built with Next.js. It manages agencies, users, account access, connector orchestration, embedded dashboards, and scheduled reports from one application.

## Read in this order

1. [Product definition](./PRODUCT.md)
2. [Architecture and stack](./ARCHITECTURE.md)
3. [Interface contract](./UI-SPEC.md)
4. [Requirements](./REQUIREMENTS.md)
5. [Delivery roadmap](./ROADMAP.md)

## Decisions already made

- Next.js remains the single interface through which people manage Mosaic.
- Mosaic application, infrastructure helper, and test code is written in TypeScript. JavaScript is accepted only when an upstream tool requires a JavaScript configuration file.
- Airbyte is an internal ingestion engine. Users never visit or receive access to its UI.
- Apache Superset is an internal dashboard engine. Client dashboards are embedded in Mosaic.
- PostgreSQL is the warehouse and application database platform, with separate databases or schemas and credentials for each responsibility.
- The first release includes GA4, Google Ads, Meta Ads, Google Search Console, and Google Business Profile.
- Google Business Profile requires a custom Airbyte connector unless a maintained self-managed connector becomes available and passes evaluation.
- Provider authorization belongs to the platform operator. Client users authenticate only with Mosaic.
- The implementation is library-first. Authentication, forms, validation, tables, accessible primitives, email templates, and testing infrastructure will use maintained packages instead of custom replacements.
- AI features, rank tracking, anomaly detection, task management, billing, and speculative future products are out of scope.

## Documentation rules

- A requirement is not complete until implementation, automated verification, and manual acceptance all pass.
- Every v1 requirement maps to exactly one roadmap phase.
- Architecture changes require updating these documents in the same commit as the change.
- Dependencies are selected by capability and maintenance quality. Exact versions are pinned only when the implementation phase begins.
- TypeScript runs in strict mode. New domain code cannot use untyped JavaScript or `any` as an escape hatch.
- Each coherent phase or corrective batch receives a Conventional Commit.
