# Scientific methods and limitations

## FITS extraction

Source: NASA/IPAC IRSA SPHEREx Data Release 1, Level 2 spectral images. The project reads FITS IMAGE, FLAGS, VARIANCE, and ZODI layers and an auxiliary wavelength look-up / ePSF when present. Scientific grids are nominally 96×96, aligned through TAN-SIP WCS onto a common target-centered sky field. Resampling uses the nearest source sample; no scientifically independent new spatial resolution is created. Flux-like display values are `IMAGE - ZODI` in MJy/sr. The original IMAGE/ZODI separation and uncertainties remain approximate.

## Data-quality screening

Bad FLAGS and missing or non-positive VARIANCE are excluded. A field-level valid-fraction and flagged-fraction are shown separately. A low valid fraction or high flag fraction should not be interpreted as complete scientific measurements. `SOURCE` pixels must not be blindly masked as artifacts.

## Wavelength and time matching

Approximate pixelwise wavelength overlap is defined in code by `|lambda_a - lambda_b| <= 0.5*(bandwidth_a + bandwidth_b)`. At least 300 matching pixels and a 14-day baseline are prioritized for long-epoch comparisons. Those criteria do not by themselves control all inter-band systematics. Comparisons with zero overlap are not usable for physical variability claims.

## ePSF

The local effective point-spread function is read from calibrated SPHEREx FITS ePSF data as a spatially sampled kernel. The estimated per-axis second-moment sigma in native detector pixels uses 5× ePSF oversampling, and the interface quotes a Gaussian-equivalent width:

`FWHM_arcsec ≈ 2.35482 × sigma_native_pix × 6.15`.

This quantity is **not** the fitted celestial source diameter. The local ePSF method and Gaussian equalization are not equivalent to a spatially varying full forward-model PSF convolution. Six older Barnard records were normalized from a legacy 10× oversampling assumption to 5×; their results require extra scrutiny if independently reproducing raw FITS processing.

## Preliminary pixel statistics

Two grid-aligned frames are compared with paired finite flux and variance. Reported field statistics include `median(B − A)` and robust median absolute deviation, plus rough uncertainty-aware screening. A row of adjacent high-score pixels is a **review candidate** and not a statistical detection or calibrated p-value. Fields can contain background sources and instrumental artifacts.

## Central aperture

A centered circular aperture (grid radius 2.5 px) is background-corrected with an annulus (5–8 px). The algorithm requires at least three valid central pixels, ten aperture samples and twenty-five annulus samples. It refuses to infer source flux when these requirements fail. Its unit `MJy/sr × grid pixel` is a preliminary sum, NOT absolute µJy source photometry. The star's variability period and amplitude have not been measured by this preview.

### Known target caveats

- **R Draconis:** all eight saved frames lack valid central pixels in the aperture. Their ready-FITS counts and image medians are **not** measurements of its stellar light curve.
- **WISE 0855−0714:** extremely faint brown dwarf; sky-field frames do not identify a confirmed source or motion.
- **Epsilon Indi B:** expected proper motion is smaller than the saved grid pixel scale over the sampled baseline; field differences cannot establish motion.
- **RW Aurigae:** field and possible components must not be confused with individually resolved component photometry.
- **Barnard's Star:** pixelwise difference charts are not independently calibrated astrometric proper-motion measurements.

## Integrity check

The five primary targets encompass 44 archived science frames with valid ePSF metadata and FWHM formula consistency. This is **internal consistency**, not an independent re-extraction of every original FITS file. The user's live app passed 8 Jasmine spec files and 15 synthetic self-tests at the last recorded build. Test counts are software tests, not probabilities of scientific validity.
