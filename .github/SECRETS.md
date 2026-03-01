# Required GitHub Secrets for CI/CD

Add these in: Repository Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Value |
|-------------|-------|
| `SSH_PRIVATE_KEY` | Content of `~/.ssh/id_ed25519_agent` (the full private key file) |
| `SERVER_IP` | `157.230.23.158` |

## How to get the SSH key content:
```bash
cat ~/.ssh/id_ed25519_agent
```
Copy the entire output (from -----BEGIN to -----END) and paste as the secret value.
