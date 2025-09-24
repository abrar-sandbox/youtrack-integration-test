# youtrack-integration-test

CI workflow integrates YouTrack with GitHub via Claude:

- `discover-repos` job extracts referenced repositories from a YouTrack ticket and outputs a JSON array.
- `aggregate-plan` job clones all target repos into `repos/`, runs a single Claude session with real code access, then creates per-repo issues and comments back on the YouTrack ticket with links.

Trigger via `repository_dispatch` with type `youtrack-tag-dev-bot` and payload including `issueId`, `title`, and `description`.
