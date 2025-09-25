# youtrack-integration-test

CI workflow integrates YouTrack with GitHub via Claude:

- `discover-repos` job extracts referenced repositories from a YouTrack ticket and outputs a JSON array.
- `aggregate-plan` job clones all target repos into `repos/`, then runs a single Claude session from `repos/` with real code access. Within that session, Claude uses `gh` to create per-repo issues and the YouTrack MCP tool to post a comment with links back to the ticket.

Trigger via `repository_dispatch` with type `youtrack-tag-dev-bot` and payload including `issueId`, `title`, and `description`.

Notes
- We intentionally avoid shell scripting to create issues or post comments; Claude performs these actions using `gh` and the `youtrack` MCP server.
- Ensure `GH_PAT` (or `GITHUB_TOKEN`) has repo:issues scope for targets; `YOUTRACK_API_TOKEN` must allow commenting on the ticket.
