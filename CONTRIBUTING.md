# Contributing

Loudara is being refactored in small, verifiable phases.

Before sending changes:

- Keep the frontend on SolidJS, TypeScript, CSS and Vite.
- Keep platform-specific code out of visual components.
- Do not add private keys or secrets to `VITE_*` variables.
- Run `pnpm exec tsc --noEmit`.
- Run `pnpm build`.

Prefer focused changes that preserve existing player, search, queue and library behavior.
