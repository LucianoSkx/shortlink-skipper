# Security Policy

## Supported Versions

We currently support the following versions of Shortlink Skipper with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 8.x.x   | :white_check_mark: |
| 7.x.x   | :x:                |
| < 7.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Shortlink Skipper, please follow these steps:

1. **Do not** create a public issue on GitHub
2. **Do not** disclose the vulnerability publicly
3. Open a private security advisory at: https://github.com/LucianoSkx/shortlink-skipper/security/advisories/new

Please include the following information in your report:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact of the vulnerability
- Any possible mitigations you've identified

## Security Considerations

Shortlink Skipper is a userscript that runs in your browser with elevated privileges. As such, there are important security considerations:

### Permissions
- Shortlink Skipper requires broad permissions to function across many different websites
- These permissions are necessary to bypass ads and redirects on various sites
- We follow the principle of least privilege where possible

### Code Review
- All code contributions are reviewed by maintainers before merging
- We encourage security-focused code reviews from the community
- Automated security scanning is performed on dependencies

### Updates
- Users should keep their Shortlink Skipper installation up to date
- Security updates will be released as needed
- Major security issues will be communicated through our announcement channels

## Security Best Practices

For users:
- Only install Shortlink Skipper from official sources
- Keep your userscript manager (Tampermonkey, Violentmonkey, etc.) updated
- Review the permissions granted to Shortlink Skipper periodically
- Report any suspicious behavior immediately

For developers:
- Follow secure coding practices
- Validate and sanitize all inputs
- Minimize the use of unsafe evaluation functions
- Keep dependencies updated

## Acknowledgements

We appreciate the security research community and welcome responsible disclosure of security vulnerabilities. We will acknowledge reporters of verified security issues (with their permission) in our release notes.
