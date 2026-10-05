# HOA Website

A static HTML/CSS/JS site with a small serverless API for announcements, downloadable documents, and an email list.

## How it fits together

```
Browser ──> CloudFront ──> S3 (site/ folder: HTML, CSS, JS)
   │
   └──> API Gateway (HTTP API) ──> Lambda (api/) ──> RDS PostgreSQL
                                     │  ├──> S3 documents bucket (signed upload/download links)
                                     │  └──> SES (confirmation + announcement emails)
   Board sign-in: Cognito Hosted UI ──> JWT checked by API Gateway on admin routes
```

The browser never talks to PostgreSQL directly; that would expose your database password to every visitor. The Lambda holds the credentials.

## Project layout

```
site/            Upload this folder to the website S3 bucket
  index.html, announcements.html, documents.html,
  subscribe.html, unsubscribe.html, admin.html, 404.html
  css/styles.css
  js/config.js   <-- edit this with your API URL and Cognito values
  js/*.js        page scripts (ES modules, no build step)
api/             Lambda function (Node.js 20)
db/schema.sql    Tables: announcements, documents, subscribers
db/seed.sql      Optional sample announcements
```

## API routes

| Method | Path | Who |
|---|---|---|
| GET | /announcements | Public |
| POST | /announcements | Admin (optionally emails subscribers) |
| PUT / DELETE | /announcements/{id} | Admin |
| GET | /documents | Public |
| GET | /documents/{id}/download | Public (returns a 5‑minute signed S3 link) |
| POST | /documents | Admin (returns a signed upload link) |
| POST | /documents/{id}/complete | Admin |
| DELETE | /documents/{id} | Admin |
| POST | /subscribe, /subscribe/confirm | Public (double opt-in) |
| POST | /unsubscribe, /unsubscribe/one-click | Public (token-based) |
| GET | /subscribers | Admin |

## Setup, step by step

### 1. Database (RDS PostgreSQL)
1. Create an RDS PostgreSQL instance (db.t4g.micro is plenty). Put it in private subnets.
2. Run `psql "$DATABASE_URL" -f db/schema.sql` (and `db/seed.sql` if you want sample data).

### 2. Documents bucket (S3)
1. Create a **private** bucket, e.g. `mapleridge-hoa-docs`. Keep Block Public Access on.
2. Add this CORS config so the admin page can upload directly:
   ```json
   [{ "AllowedOrigins": ["https://yourhoa.org"], "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000 }]
   ```

### 3. Email (SES)
1. Verify your domain in SES and add the DKIM records it gives you.
2. Request production access (new accounts can only email verified addresses).
3. Add SPF and DMARC records for your domain so mail doesn't land in spam.

### 4. Board sign-in (Cognito)
1. Create a user pool. Turn **off** self-registration so only people you invite can sign in.
2. Add an app client: public client (no secret), authorization code grant, scopes `openid email`.
   - Callback URL: `https://yourhoa.org/admin.html`
   - Sign-out URL: `https://yourhoa.org/`
3. Set up a Hosted UI / managed login domain.
4. Create a group named `admin` and add each board member's user to it.

### 5. Lambda
1. `cd api && npm install && npm run package` → produces `hoa-api.zip`.
2. Create a Node.js 20 Lambda, handler `src/index.handler`, upload the zip.
3. Put it in the same VPC as RDS. Because it's in a VPC, add **VPC endpoints** for S3 (gateway) and SES (interface), or a NAT gateway, so it can reach those services.
4. Environment variables:
   | Name | Example |
   |---|---|
   | DATABASE_URL | `postgres://hoa_app:PASSWORD@your-db.xxxx.rds.amazonaws.com:5432/hoa` |
   | DOCS_BUCKET | `mapleridge-hoa-docs` |
   | SES_FROM | `Maple Ridge HOA <board@yourhoa.org>` |
   | SITE_URL | `https://yourhoa.org` |
   | API_URL | `https://abc123.execute-api.us-east-1.amazonaws.com` |
   | ALLOWED_ORIGIN | `https://yourhoa.org` |
   For production, store the DB password in Secrets Manager rather than a plain env var.
5. IAM permissions for the Lambda role: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::mapleridge-hoa-docs/*`; `ses:SendEmail`; and the standard VPC execution role.

### 6. API Gateway (HTTP API)
1. Create an HTTP API with a Lambda integration and a `$default` stage.
2. Add a **JWT authorizer**: issuer `https://cognito-idp.<region>.amazonaws.com/<userPoolId>`, audience = your app client ID.
3. Create each route in the table above. Attach the JWT authorizer to the Admin routes only.
4. Configure CORS: origin `https://yourhoa.org`, methods GET/POST/PUT/DELETE, headers `content-type, authorization`.

### 7. Website (S3 + CloudFront)
1. Edit `site/js/config.js` with your HOA name, API URL, and Cognito values.
2. Create a private bucket for the site and upload the contents of `site/`.
3. Create a CloudFront distribution with that bucket as origin (Origin Access Control), default root object `index.html`, custom error page 404 → `/404.html`.
4. Attach an ACM certificate (must be in us-east-1) and point your domain at CloudFront with Route 53.
5. After updates: `aws s3 sync site/ s3://your-site-bucket --delete && aws cloudfront create-invalidation --distribution-id XXX --paths "/*"`

## Local preview
`cd site && python3 -m http.server 8080`, then open http://localhost:8080. Pages will show "Couldn't reach the server" until `config.js` points at a deployed API.

## Things you may want next
- **Members-only documents.** Downloads are public right now. To restrict them, add homeowner accounts to Cognito (a separate `member` group) and put the JWT authorizer on `/documents` routes too.
- **Larger email lists.** Announcement emails send in a loop inside the Lambda, which is fine for a few hundred homes. For more, push each send onto an SQS queue.
- **Infrastructure as code.** Steps 1–7 can be captured in AWS SAM, CDK, or Terraform so the setup is repeatable.
