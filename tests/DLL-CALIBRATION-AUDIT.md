# DLL calibration parity audit (DEV only)

## Status
The browser matrix was executed against the DEV JavaScript source. The historical fixture contains previously recorded native DLL outputs. The new Windows native runner is implemented but has not yet been executed in this environment. Do not interpret browser success as DLL parity or hardware validation. The application and Pages build have not been changed by this audit.

## Reproduce
Check out branch experimental/ptc-temperature-afe. Use Node.js and 64-bit Python 3 on Windows. The original DLLs stay in the private SSC library; no binaries are redistributed here.

    node tests/dll-calibration-matrix.cjs > browser-matrix.json
    py -3 tests/dll-calibration-native.py --dll "C:\path\v3.20\pssc_cal_lib.dll" --dll "C:\path\v3.21\pssc_cal_lib.dll" --out dll-comparison.json

Select the API/lib64 binaries and keep their original dependencies nearby. The script does not connect to a sensor. It calls pssc_cal_calibration and pssc_cal_simulation using the documented ctypes ABI. It records both SHA-256 hashes and library version integers, exact input arrays and initial configuration, native return codes, coefficient words, point errors, fit and independent verification metrics. Both the native and JavaScript coefficient images are simulated with the same original DLL, so output differences are not confounded with the JS floating-point simulator. Synthetic cfg has 65 words with VERSION 0x0020 and synthetic G01/G2OFF; use of a real chip dump is a separate verification step.

## Coverage
94 cases: pressure order 1–3, temperature order 0–3, all three sources, ±25000 and ±32000 limits, reduced TK0 mask 0x0013, full linear TK0/TKE mask 0x0033, nonlinear signals, reversed signal, low span, noisy data, rank deficiency and historical fixture. Independent verification grid is distinct from fit points. Some math cases exceed the guided UI limit of ten calibration points or request T0 with external/bridge source; these are marked. Absolute DSP_T is intentionally not compared for T0 because the app preserves existing temperature coefficients while DLL T_CONST has different semantics. The report includes acceptance disagreements and coefficient word differences; no tolerance is assumed to prove equivalence.

## Findings from executed browser math (not native)
See fixtures/dll-calibration-audit-browser.json. Current T_F normalization 1.70 (±0.85) yields 25 successful fits, 69 rejections. 36 cases reject T1 out of Q0.15; 27 reject S4; six low-span/degenerate cases reject as expected. Testing 1.98 (±0.99) in memory yields 61 successful fits and 33 rejections. This candidate is not published or natively validated. Fit success is not proof of acceptable interpolation errors. Native runs must distinguish intended range checks and modeling errors from unnecessary rejection.

Historical fixture comparison uses ±25600 DSP_S with eight original points; native pressure maximum error 0.891113, browser 0.330532 digits; max difference 0.560582 digits. Native temperature maximum error 42.441433, browser 41.690807 digits; max difference 2.364743 digits. Different coefficient words are not bit-for-bit identical.

## Not covered yet
Native execution of v3.20 and v3.21; exhaustive arbitrary pressure coefficient masks / automatic DLL order selection; analog overall output recalibration (pssc_cal_overall / output functions), experimental current calibration, hardware quantization/saturation and post-NVM verification. Source: AN0203 pages 11–13 and vendor PSSC C# wrapper. A finite suite cannot establish equivalence for all possible input data.
