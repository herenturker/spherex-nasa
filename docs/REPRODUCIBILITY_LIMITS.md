# Scope of this archive

The production app is built and hosted by Floot, which injects runtime providers and manages compiled assets, endpoint routing, PostgreSQL credentials and cloud storage. A source export of the virtual files is **not** a full distribution of the proprietary Floot runtime. Credentials are intentionally not exported.

A database backup may include processed PNG previews and compressed scientific grids but need not contain all original NASA FITS binaries. Their exact published source URLs are retained in the PostgreSQL rows. External NASA availability can change.

The live site and GitHub source serve different review purposes: the former demonstrates the functioning deployed app; the latter provides project code, reproducible scientific algorithms, data schema and provenance. Distinguish documented internal software self-tests from independent astrophysical confirmation.
