# Security policy

Do not report vulnerabilities in public issues. Contact the repository owner privately with reproduction steps and potential impact.

Production requires an explicit, strong `JWT_SECRET`; the application configuration intentionally has no usable default. Keep `.env`, customer data, database exports and SMTP credentials outside Git.

Expose the application through a TLS reverse proxy. Keep databases and internal services bound to private interfaces, and verify backups through periodic restore tests.
