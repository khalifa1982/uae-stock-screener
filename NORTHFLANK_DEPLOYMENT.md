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
