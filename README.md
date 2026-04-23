# Todo Trail

An [Obsidian](https://obsidian.md) plugin that automatically moves checked tasks into a dedicated "completed" section of the same note, while preserving the parent/child hierarchy they lived in.

## What it does

When you tick off a task (`- [x]`) anywhere in a note, Todo Trail:

1. Detects the newly-checked task as you check it.
2. Removes it — along with any nested sub-items — from its current location.
3. Inserts it under a configurable completed-section heading further down in the same note.
4. Rebuilds the parent chain above it so you can still see the context the task came from.
5. Cleans up any parent list items in the source that are left with no remaining children.

The result: your "working" list stays focused on open work, and your completed section grows into a readable trail of what was finished and where it sat in your outline.

## Example

Before (you just ticked the child):

```markdown
## Now
- Project Apollo
  - Research
    - [x] Read the design doc
    - [ ] Interview the team
- [ ] Unrelated todo

## Done
```

After:

```markdown
## Now
- Project Apollo
  - Research
    - [ ] Interview the team
- [ ] Unrelated todo

## Done
- Project Apollo
  - Research
    - [x] Read the design doc
```

If you later check `Interview the team`, it joins the existing `Project Apollo › Research` block under **Done** instead of creating a duplicate branch, and the now-empty `Research` and `Project Apollo` parents are removed from the "Now" section.

## Behavior details

- **Sub-items come along.** Nested list items under a checked task are moved with it, checked or not.
- **Parent chain is preserved.** Ancestors that are plain list items (not themselves tasks) are recreated above the moved task in the completed section so hierarchy is kept intact.
- **Parents are reused.** If a matching parent path already exists under the completed heading, the task is merged into it rather than duplicated.
- **Empty parents are pruned.** A parent in the source is removed only if moving the task leaves it with no remaining children.
- **Tasks already past the completed heading are left alone** — no re-shuffling of previously-archived items.
- **No completed heading, no move.** If the configured heading doesn't exist in the note, the task stays where it is.

## Settings

- **Completed section heading** — the exact markdown heading (e.g. `## Done`, `### Completed`) that marks where checked tasks should be collected. Defaults to `## Done`. The match is literal, so `## Done` and `### Done` are different targets.

## Installation

Until the plugin is published in the community directory, install manually:

1. Build the plugin: `bun install && bun run build`.
2. Copy `main.js`, `manifest.json`, and (optionally) `styles.css` into your vault at `<vault>/.obsidian/plugins/obsidian-todo-trail/`.
3. Enable **Todo Trail** under *Settings → Community plugins*.

## Development

- `bun run dev` — build `main.js` in watch mode.
- `bun run build` — one-shot build.
- `bun test` — run the Vitest suite covering the task-movement logic.

The implementation lives in `src/main.ts`. It hooks into CodeMirror 6 via a `transactionFilter` so moves happen atomically in a single editor transaction — the check and the relocation land as one undo step.
