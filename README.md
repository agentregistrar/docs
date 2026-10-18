# Agent Registrar Developer Docs

Source for the public Agent Registrar developer documentation site, built with
[Astro Starlight](https://starlight.astro.build/) and served at
<https://docs.agentregistrar.dev>.

This repository currently contains a placeholder landing page. The documentation
content and the docs-site visual design are follow-on work; this repo ships the
stock Starlight theme, unmodified.

The `agent-identity-v1` specification, JSON Schema, fixtures, conformance
validator, and implementation registry live in
[`agentregistrar/spec`](https://github.com/agentregistrar/spec).

## Local development

Requires Node.js ≥ 20 and pnpm (see `packageManager` in `package.json`).

| Command | Action |
| :--- | :--- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the dev server at `http://localhost:4321` |
| `pnpm build` | Build the production site to `./dist/` |
| `pnpm preview` | Preview the production build locally |

## Deployment

The site is deployed with **Cloudflare Pages** using its Git integration:

- **Repository:** `agentregistrar/docs`
- **Production branch:** `main` (auto-deploy on push)
- **Build command:** `pnpm build`
- **Build output directory:** `dist`

There are no deploy workflows or CI configuration in this repository — Cloudflare
Pages builds on push.

## Links

- Documentation site: <https://docs.agentregistrar.dev>
- Specification repository: <https://github.com/agentregistrar/spec>
- Broker: <https://agentregistrar.dev>
