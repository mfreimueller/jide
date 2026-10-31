# Deployment

J;DE's server side (API and teacher app) runs on one Uberspace account, next to other projects. Nothing about the deployment is hard-coded: domain, sender address and server are configuration, and `<placeholders>` below stand for your values. The repository is public, so never put real values into commits, issues or pull requests.

| Placeholder | Meaning | Where it is configured |
|---|---|---|
| `<user>@<host>` | SSH login of the Uberspace server | `DEPLOY_TARGET` |
| `<domain>` | Public (sub)domain for the API (`/api`) and the teacher app, e.g. `jide.example.org` | `DEPLOY_DOMAIN`, `PUBLIC_TEACHER_URL`, `ALLOWED_ORIGINS` |
| `<sender>` | Address sign-in mails come from | `SMTP_FROM` and `SMTP_USER` |

| Part | Where | How it gets there |
|---|---|---|
| API (`backend/`) | `<domain>/api`, service `jide-backend`, **port 3001** | `scripts/deploy-backend.sh` |
| Teacher app (`teacher/`) | document root of `<domain>` | `scripts/deploy-teacher.sh` |
| Student app (`app/`) | GitHub Releases, installed on the students' laptops | see [release.md](release.md) |

Port 3001 is used because another service on the same account already listens on 3000. The backend reads its port from the `PORT` variable.

## Keeping the server out of the repo

The scripts read the SSH login and the domain from outside:

```bash
cp .deploy.env.example .deploy.env          # gitignored; edit DEPLOY_TARGET and DEPLOY_DOMAIN
# or export DEPLOY_TARGET=user@host DEPLOY_DOMAIN=jide.example.org in your shell
./scripts/deploy-backend.sh                 # the target may also be passed as the first argument
```

Secrets (the server's `.env`) are never committed either.

## One-time server setup

Run these over SSH on the server. Nothing here is done by the scripts.

### 1. Node version

```bash
uberspace tools version use node 22
```

### 2. Domain

```bash
uberspace web domain add <domain>
uberspace web domain list        # shows the IP addresses to point DNS at
```

Create the DNS records for `<domain>` (A and AAAA, or a CNAME to the host name) at your DNS provider, then wait until `https://<domain>` answers.

### 3. API route

The API keeps its `/api` prefix, so the backend is registered for that path without stripping it:

```bash
uberspace web backend set <domain>/api --http --port 3001
uberspace web backend list
```

### 4. Database

```bash
mysql -e "CREATE DATABASE ${USER}_jide CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

The MariaDB login is in `~/.my.cnf`. Tables are created by the migrations when the backend starts.

### 5. Mailbox

Sign-in links are sent from `<sender>` (`SMTP_FROM`; the SMTP login must be allowed to send as it). If the sender's domain is not yet an Uberspace mail domain, add it and set the SPF/DKIM records Uberspace shows you.

```bash
uberspace mail domain add <sender domain>        # skip if it already exists
uberspace mail user add <local part of sender>   # asks for a password
```

### 6. Backend directory and `.env`

```bash
mkdir -p ~/jide-backend
nano ~/jide-backend/.env
chmod 600 ~/jide-backend/.env
```

```ini
PORT=3001
DATABASE_URL=mysql://<user>:<mysql password>@localhost:3306/<user>_jide
PUBLIC_TEACHER_URL=https://<domain>
ALLOWED_ORIGINS=https://<domain>
SMTP_HOST=<mail host name of your Uberspace server>
SMTP_PORT=587
SMTP_USER=<sender>
SMTP_PASS=<mailbox password>
SMTP_FROM=<sender>
```

- `PUBLIC_TEACHER_URL` is where the sign-in link points to (the teacher app at the domain root).
- `ALLOWED_ORIGINS` is a comma-separated list of browser origins that may call the API (CORS). The teacher app is served from the same origin as the API, so `https://<domain>` is enough for it. Restart the service after changing it.
- `SMTP_HOST` is the host name of the Uberspace server (the one you SSH into). Leaving it empty makes the backend print mails to its log instead of sending them: development only.
- `TEST_DATABASE_ADMIN_URL` is only for the tests and is not set on the server.

### 7. Service

Create `~/etc/services.d/jide-backend.ini`:

```ini
[program:jide-backend]
directory=%(ENV_HOME)s/jide-backend
command=node --env-file=.env dist/index.js
autostart=yes
autorestart=yes
startsecs=5
```

Do not start it yet: `dist/` does not exist until the first deploy. Register it with:

```bash
supervisorctl reread && supervisorctl update
```

`update` will try to start it and fail until the first backend deploy has run. That is expected; the deploy script restarts it.

### 8. GitHub repository variable

The student app has to know the server. In the GitHub repository, under **Settings, Secrets and variables, Actions, Variables**, add `JIDE_API_URL` = `https://<domain>`. It must match the domain configured above. (As of this writing the release workflow does not read it yet; it is wired up together with the app's online mode, see TASKS.md.)

## Deploying

From the repo root, on a machine that has SSH access:

```bash
./scripts/deploy-backend.sh      # typecheck + tests, esbuild bundle, rsync dist/, restart service, health check
./scripts/deploy-teacher.sh      # typecheck + tests, vite build, rsync build/ into the domain's document root
```

Both scripts stop at the first failing check. The backend tests need the local MariaDB (`docker compose up -d`). The backend bundle is self-contained (`dist/index.js`, `dist/add_teacher.js`), so the server needs no `node_modules`. Migrations run when the service starts.

Add the first teacher after the first backend deploy (accounts are created by hand, there is no sign-up):

```bash
ssh <user>@<host>
cd ~/jide-backend
node --env-file=.env dist/add_teacher.js you@example.org "Your Name"
```

## Verifying a deployment

1. `curl https://<domain>/api/health` returns `{"status":"ok","db":"ok",...}`.
2. `https://<domain>` shows the teacher login; reloading a deep link still works (the `.htaccess` rewrite).
3. Request a sign-in link for the teacher you added. The mail arrives from `<sender>` and the link signs you in.
4. If something fails: `supervisorctl status jide-backend` and `supervisorctl tail jide-backend`, or `tail ~/logs/supervisord.log`.

## Update

Pull the new commit and run the deploy script(s) again. They replace files in place; to go back, check out the previous commit and deploy again. Migrations only add, so an older backend keeps working against a newer schema (check the migration folder before relying on that).

## Backup

The database contains the hand-ins and the exercise zips, so it is the only thing worth backing up (the code is in git, `.env` is small and can be kept in your password manager):

```bash
ssh <user>@<host> 'mysqldump --single-transaction ${USER}_jide' | gzip > jide-$(date +%F).sql.gz
```

Restore into an empty database with `gunzip -c jide-<date>.sql.gz | mysql ${USER}_jide`. The dump contains student data: keep it private and delete old copies.

## Troubleshooting

- **Browser shows a CORS error:** `ALLOWED_ORIGINS` must contain the origin exactly (scheme and host, no path, no trailing slash). Restart the service afterwards.
- **Health check fails right after a deploy:** the service needs a few seconds to start and run migrations; look at `supervisorctl tail jide-backend`.
- **Mail does not arrive:** check spam, then the service log for SMTP errors. The mailbox user and `SMTP_FROM` must be the same address.
