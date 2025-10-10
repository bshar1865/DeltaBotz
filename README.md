DeltaBotz
=========

Simple moderation + honeypot. Per‑server config.

Quick start
-----------
1) Install deps
   npm install

2) Env
   cp example.env .env
   # set DISCORD_TOKEN

3) Run
   bunx ts-node index.ts

Setup (in Discord)
------------------
- /setup → pick a section
  - Roles: select Mod roles
  - Logging: select log channel
  - Honeypot: select channel, toggle auto‑ban/delete
  - Features: toggle Welcome/Goodbye/Role Restore + set channels

Data layout
-----------
- configs/<guildId>/config.json (settings)
- configs/<guildId>/json.sqlite (per‑guild DB)

Notes
-----
- Errors log only to the owner error channel.
- Commands use the Mod roles you set in /setup.


