# SPHEREx Sky Explorer — Men in Hack

**Çemberlitaş Anadolu Lisesi / Cemberlitas Anatolian High School**  
NASA Space Apps Challenge 2026 — *Planet X and SPHEREx*  
Public demo: https://www.cemberlitasmeninhack.com/

> An independent student science exploration prototype. This application is **not** a NASA-operated or NASA-endorsed product. Its real NASA/IPAC astronomical imagery and preliminary pixel-level diagnostics **do not constitute confirmed detection of stellar proper motion, astrophysical variability, or a new celestial object**.

## What it does

This browser-based sky explorer uses NASA/IPAC SPHEREx DR1 Level 2 astronomical FITS image cutouts. Users can select targets or supply RA/Dec sky coordinates, inspect chronologically arranged infrared observations, compare approximately compatible wavelengths, review variance/mask-aware image differences, inspect local effective PSF (ePSF) estimates, and download explanatory reports and provenance metadata.

**Suggested challenge test fields:** Barnard's Star, Epsilon Indi B, WISE 0855−0714, RW Aurigae, and R Draconis.

### Scientific limits — please read before judging

- Every target is a **sky region**. A point in an image is not automatically a verified detection of the named astronomical object.
- The comparison uses approximate wavelength overlap; SPHEREx WCS-WAVE/approximate bandwidth is not a substitute for full CWAVE/CBAND-based calibration.
- Local ePSF second moments are converted to an approximately Gaussian FWHM; this is not the official position-dependent ePSF fit.
- Variance and FLAGS are screened, but regridding produces correlated uncertainty. Candidate screening statistics are *heuristics*, not calibrated p-values.
- Aperture sums in MJy/sr × grid pixel are not calibrated µJy source flux. Missing or masked central pixels are reported as insufficient data, not filled with invented measurements.
- R Draconis' archived dataset has no sufficiently valid central aperture in all eight saved frames. Its observed-field median is **not a measured light curve or period**.
- Epsilon Indi B and WISE 0855 are very faint objects and sky-field image differences do not establish their proper motions.

## Project layout

- `floot_project/` — exported virtual Floot pages, components, helpers, endpoint source and public static files. The project is **Floot-native**, not an independently reconstructed Vite/Next.js app.
- `database/` — JSONL backup of the four actual PostgreSQL tables, plus schema and instructions when available.
- `docs/` — provenance, methods, team submission checklist, and reproduction limitations.
- `assets/` — project-owned public UI assets (excluding fonts, API tokens and user secrets).
- `scripts/` — database restoration script and backup verification helpers.
- `MANIFEST.json` — content counts, SHA-256 sums and provenance.

## Reproducibility and deployment

The public production application is built with Floot's framework and managed services (`@floot/*`). The virtual source files are faithfully provided for **review and version control**; simply running `npm install` on these item files alone is **not a supported standalone local deployment**. The actual runtime also depends on a configured PostgreSQL database, Floot's endpoint/runtime conventions and hosted assets.

For a working copy:

1. Obtain access to a Floot workspace/project with compatible runtime and PostgreSQL support.
2. Import/recreate the source items under `floot_project/` using Floot's code import or project editor. Preserve the folder structure.
3. Provision/configure the PostgreSQL resource and apply `database/schema.sql` to an **empty** database.
4. Restore JSONL records following `database/RESTORE.md` and confirm all image previews and science gzip strings are present.
5. Upload the bundled assets to the project's public storage and replace their CDN references only when necessary.
6. Reconcile external environment variables through the editor UI; **secrets are intentionally not included** in this archive.
7. Execute TypeScript and Jasmine tests, then publish the app to your own domain.

**Fastest way to reproduce the published app:** Use the exact Floot Version History source download associated with the recorded release ID and restore the database snapshot separately. The source and database are two distinct components.

## NASA sources

- NASA/IPAC IRSA SPHEREx mission archive: https://irsa.ipac.caltech.edu/Missions/spherex.html
- SPHEREx DR1 overview: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_dr1.html
- SPHEREx products and caveats: https://irsa.ipac.caltech.edu/spherex-archive-documentation/spherex-data-products/
- NASA Space Apps Challenge: https://www.spaceappschallenge.org/
- Product DOI referenced in the project: `10.26131/IRSA678`

All remotely sourced FITS files retain their `source_url` or `source_fits_cutout_url` references in the backup. This archive does **not** claim ownership of NASA data and may contain processed previews derived from NASA/IPAC data.

## Intellectual property and licensing

Team authors should review and select a code license before publicly releasing this repository. No license for NASA, school, contest or third-party branding is granted by distributing project code. See `docs/LICENSING.md`.

## Disclosure

Development included educational support, human programming, ChatGPT and Floot-assisted coding. Scientific claims must be independently checked and cannot be inferred from generated code or synthetic tests alone. Team members should accurately disclose their actual roles and development chronology in the official submission.
