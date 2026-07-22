# Security Review

This document provides a security audit, risk assessment, and production improvement plan for the Money Muling Detection System.

---

## 🔒 Current Security Implementations

### 1. Cryptography & Hashing
*   **Password Hashing**: Implemented using `passlib[bcrypt]`. Hashing is executed via the `Verify` and `Hash` interfaces of `CryptContext`. No raw text passwords are saved to the database.
*   **JWT Handlers**: Implemented using the `python-jose` library, employing the `HS256` symmetric algorithm for access tokens.

### 2. Audit Trails
*   **Log Coverage**: The `audit_logs` table records authentication attempts, registry actions, profile views, and file uploads.
*   **Log Context**: Tracks caller IP (extracting `X-Forwarded-For` proxy headers), User-Agent header string, target endpoint, execution duration, and serialized error context payloads.

---

## ⚠️ Identified Risks & Limitations

### 1. Secrets Management
*   **Risk**: Critical.
*   **Findings**: The environment file `.env` (containing Supabase production database credentials and active JWT signing keys) was committed directly to the git repository history.
*   **Exposure**: If the project repository is made public, database credentials will be exposed.

### 2. Client Token Leakage
*   **Risk**: High.
*   **Findings**: The React frontend stores the authentication JWT in `localStorage` and loads it into requests.
*   **Exposure**: In the event of a Cross-Site Scripting (XSS) exploit, an attacker can extract and steal the access token.

### 3. File Upload Vector
*   **Risk**: High.
*   **Findings**: The `/analyze` file upload handler reads files into memory without verifying limits or restricting mime-type headers.
*   **Exposure**: An attacker can upload large files (denial of service via memory exhaustion) or inject macro formulas into CSV outputs.

### 4. Brute-Force Vulnerability
*   **Risk**: Medium.
*   **Findings**: Endpoints `/auth/login` and `/auth/register` are not protected by rate limiters.
*   **Exposure**: Attackers can execute automated dictionary search scripts to compromise user profiles.

---

## 🛡️ Production Security Checklist

### 1. Immediate Actions
*   **Rotate Credentials**: Immediately rotate Supabase passwords and generate a new random 256-bit JWT secret.
*   **Clean Repository**: Run `git-filter-repo` to erase history entries of the `.env` file. Add `.env` to `.gitignore`.

### 2. Code Enhancements
*   **Cookie Authentication**: Transition from `localStorage` token storage to secure, HttpOnly, SameSite=Strict cookies. This mitigates XSS-based token theft.
*   **File Upload Validation**: Enforce maximum file upload sizes (e.g., 10MB limit) and restrict content types.
*   **Rate Limiting**: Integrate the `slowapi` library into FastAPI routes to limit requests to `/auth` routes.
