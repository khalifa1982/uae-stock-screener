# Northflank Deployment Configuration

## Current Setup (v17.2.0 — September 2, 2026)

### Build Service: `uae-builder`
- **Source:** GitHub repo `khalifa1982/uae-stock-screener`
- **Branch:** `main`
- **CI Branch Rule:** `main`
- **CI Enabled:** Yes (`disabledCI: false`)
- **Build Engine:** Kaniko
- **Dockerfile:** `/Dockerfile`
- **Build Plan:** `nf-compute-400-16`
- **Registry:** Northflank internal (`registry.northflank.com`)

### Deployment Service: `uae-app`
- **Source:** Internal build from `uae-builder`
- **Branch:** `main`
- **Build SHA:** `latest` (always deploys newest build)
- **CD Enabled:** Yes (`disabledCD: false`)
- **Region:** `europe-west`
- **Plan:** `nf-compute-20`
- **Instances:** 1

### Domains
- `uae.market` (SSL cert expires 2026-10-08)
- `www.uae.market` (SSL cert expires 2026-10-06)
- `http--uae-app--t6ps5rgzd768.code.run` (Northflank default)

### How Auto-Deploy Works
1. Push code to `main` branch on GitHub
2. Northflank `uae-builder` automatically builds Docker image from Dockerfile
3. Once build succeeds, `uae-app` deployment automatically picks up the new image
4. No GitHub Actions or Docker Hub needed

### API Access
- **Token:** Stored in `NORTHFLANK_API_TOKEN` secret
- **Endpoints:**
  - List builds: `GET /v1/projects/uae-stock-screener/services/uae-builder/build`
  - Trigger build: `POST /v1/projects/uae-stock-screener/services/uae-builder/build` with `{"branch": "main"}`
  - Check deployment: `GET /v1/projects/uae-stock-screener/services/uae-app`
  - Update deployment: `POST /v1/projects/uae-stock-screener/services/uae-app/deployment`

### Environment Variables (on Northflank)
- `NODE_ENV=production`
- `DATABASE_URL=mysql://...@primary.uae-mysql--t6ps5rgzd768.addon.code.run:3306/3b165d0d8b8d`
- `JWT_SECRET=uae-stock-screener-jwt-secret-northflank-2024-secure`
- `VITE_APP_ID=uae-stock-screener`
- `GEMINI_API_KEY=AIzaSyAuhvNw_daBIdchwP1VOVDwIVyu0FX40Wg`
- `TWELVEDATA_API_KEY=7cac0079cc194e968bba29b488fcceb2`
- `SCRAPFLY_API_KEY=scp-live-f1a59e65c6d143d794c3b81e28266b08`
- `OWNER_OPEN_ID=owner-khalifa`
- `OWNER_NAME=khalifa`

### Note
The old Docker Hub workflow (`khalifa1982/uae-market` + GitHub Actions) is no longer used.
Northflank builds and stores images in its own registry, which is simpler and faster.

On September 2, 2026, the build service was patched through the Northflank API to explicitly monitor the `main` branch. The deployment service remains linked to the builder's `latest` successful image with continuous delivery enabled.

Northflank's repository-access API confirmed that no GitHub account named `khalifa1982` is linked to the Northflank team. Manual API-triggered builds and automatic deployments work, but GitHub push webhooks require linking the GitHub account in **Team Settings → Integrations → Git**. The existing Northflank token can manage services but does not have the account-level `Git > General > Read` permission needed to create or inspect that link through the API.

Refreshing the Northflank Git integrations page redirected to the Northflank login screen, confirming that an interactive account sign-in is required before the GitHub integration can be linked.

The user completed the Northflank sign-in successfully on September 2, 2026. The authenticated team navigation and Git integrations route are accessible; the integration panel must finish loading before the GitHub account-link action can be completed.

After explicit confirmation, the automated browser selected **Link GitHub**, but Northflank remained on the integrations page and still showed no linked GitHub accounts. The authorization appears to use a popup or interaction that the automation session did not surface, so the link must be completed through direct browser interaction if the authorization URL cannot be recovered.

Console inspection found no browser error, and the rendered **Link GitHub** control is a React button without a direct URL or form target. This confirms the OAuth route is generated inside Northflank's client-side handler rather than exposed in static markup.

The client-side popup URL was captured after user confirmation and opened directly. Northflank accepted the linking request and displayed **Preparing version control link**, beginning the GitHub authorization flow.

After the user completed GitHub sign-in, the authorization window closed to a blank page and the integrations route began reconnecting. The link state should therefore be verified through the Northflank service/API before changing the builder configuration.

Northflank's API still reported no linked `khalifa1982` GitHub account after sign-in, and the integrations page continued to show **No GitHub accounts linked**. The GitHub app installation/authorization step must be resumed after authentication rather than treating sign-in alone as completion.

A fresh Northflank authorization state was generated and opened, but the active browser window again displayed GitHub's sign-in form. Authentication must be completed in this exact active window so GitHub can continue to the Northflank app installation target-selection page.

On September 4, 2026, the GitHub authorization was completed successfully. **Northflank Cloud – Build & Run** was installed on the `khalifa1982` account with least-privilege access restricted to the single repository `khalifa1982/uae-stock-screener`. GitHub redirected to Northflank integration ID `6a9a9dda327671b9c4bbe501` for finalization.

Northflank finalized the integration, and `uae-builder` was rebound to the linked `khalifa1982` account with `disabledCI: false` and `branchRestrictions: ["main"]`. Pushing checkpoint `c41c6857389cc460ae6f2e25abe022f7733ccf2c` to GitHub automatically created build `nimble-passion-8941` without an API build request. The build completed successfully, and continuous delivery automatically rolled `uae-app` to the same commit SHA with deployment status `COMPLETED`.
