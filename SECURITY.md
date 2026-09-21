# Security policy

## Supported versions

Only the latest commit on `main` receives security fixes. Easel has no
releases.

## What Easel does

- The agent can call only the seven canvas tools. It has no shell, no file
  tools, and no network tools.
- Each engine process receives an explicit environment. Easel does not forward
  its complete environment.
- The renderer runs in a sandbox with context isolation and a strict Content
  Security Policy.
- Text on a board is sent to the engine as untrusted content.

Read the Safety section of the [README](README.md#safety) for the details.

## What Easel does not do

Easel does not provide operating-system sandboxing for the engine process. The
engine command-line tool runs with the permissions of your user account.

## The control port

Easel has a control port for its verification scripts. The control port runs
JavaScript in the window. It is off in a normal launch. Read
[Development](README.md#development) before you turn it on.

## Report a vulnerability

Report a vulnerability privately through the
[GitHub security advisory flow](https://github.com/serhiitroinin/easel/security/advisories/new).
Do not open a public issue.

Include the commit, the reproduction steps, and the impact that you observed.
