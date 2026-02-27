## Baseline (without skill)
- Scenario 1 (SSRF script): assistant invented a new script instead of using `script/*.yak`.
- Scenario 2 (command injection report): assistant assumed report already existed and fixed unrelated typo.
- Scenario 3 (file read framework): assistant created new framework files without referencing local examples.

## With skill (expected compliance)
- Always reference `script/*.yak` for structure and reuse patterns.
- Use `risktype.txt` to pick a valid `risk.type`.
- Avoid unrelated changes; only add requested report fields.
- Use `yaklang-completion.json` as the syntax source and search for symbols.
