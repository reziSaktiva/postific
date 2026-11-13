# Integration PR

The body of the integration PR into `staging` (squash). Three sections.

## Summary

What changed and why, in a few bullets. Point to tickets, specs, and ADRs by ID; do not copy their content.

## Evidence

- Before and after (behavior, or screenshots for UI).
- Results of `typecheck`, `lint`, unit tests, and the local golden-path E2E (ADR-149).
- Results of the two-axis review (Standards and Spec): findings, labels, and the commits that fixed them.

## Merge Danger

- **Direction:** a one-way door (migration, data change) or two-way (can be reverted).
- **Blast radius:** the areas, domains, and users affected.
- **Migration:** the migration name, and whether it has already been applied to the shared DB (ADR-081), together with King Rezi's direct permission.
- **Not yet proven** (the "Not yet proven" line in the ticket): items that can only be verified on staging, which live in the wave's verification ticket (ADR-161).
