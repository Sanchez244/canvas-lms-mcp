# Review calibration

<!-- Instructions for any code review pass (/code-review, review subagents, PR review).
     Purpose: catch real bugs without inventing findings (review theater). -->

## Report as Important ONLY
Issues that can break stated requirements, corrupt or leak data, create a security vulnerability, cause a production regression, or make rollback unsafe.

## Review focus
- Check the implementation against the plan/spec's acceptance criteria — gaps, not preferences.
- Check authorization, validation, error handling, concurrency, and data boundaries.
- Check that tests exercise behavior, not implementation details.
- Check for unrelated scope expansion.
- Do NOT report formatting or style that lint/format tools already enforce.

## Signal quality
- Every finding needs evidence: the affected path and a reachable execution path to the failure. No hypothetical failures.
- Verify suspected issues against the actual code before reporting.
- Cap non-blocking suggestions at five.
- If no material issues remain, say so explicitly and list what was checked.
