# DeltaBotz

An open-source Discord bot focused on moderation, logging, emoji copying, honeypot protection, and per-server configuration.

**Terms of Service:** [TOS.md](TOS.md)  
**Privacy Policy:** [PRIVACY.md](PRIVACY.md)

## Features

- **Moderation Commands** - Ban, kick, mute, warn, purge, and more
- **Honeypot System** - Auto-ban trap channels to catch rule-breakers
- **Auto Embed** - Converts Instagram links to embeddable format (enabled by default)
- **Invite Blocking** - Deletes Discord invite links (mods are exempt, disabled by default)
- **FAQ** - Server-specific FAQ management
- **Welcome/Goodbye Messages** - Customizable member join/leave messages
- **Role Restore** - Restores roles when members rejoin using Quick.DB (disabled by default)

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   Rename `example.env` to `.env` and set your `DISCORD_TOKEN`.

3. **Run the bot**
   ```bash
   bunx ts-node index.ts
   ```
   or
   ```bash
   npx ts-node index.ts
   ```

## Setup

Use `/setup` in Discord to configure the bot with an interactive menu:

- **Prefix** - Set custom bot prefix (default: `.`)
- **Mod Roles** - Select roles that can use moderator commands
- **Mod Commands** - Enable/disable all moderator commands globally
- **Logging** - Configure log channels for events
- **Honeypot** - Set up trap channels with auto-ban/delete options
- **Welcome & Role restoration** - Welcome, Goodbye, and Role Restore
- **Others** - Auto Embed and Invite Block

Note: For best experience, use the Discord desktop app; some buttons may not display on mobile.

## Data Layout

```
configs/
  <guildId>/
    config.json      # Server configuration
    json.sqlite      # Per-guild database
```

## Key Features

**Honeypot System** - Designate a channel as a honeypot. Users who post are automatically banned. Optional auto-unban after 10 seconds. Moderators are exempt.

**Auto Embed** - Detects Instagram links and converts them to embeddable format. Enabled by default.

**Invite Blocking** - Deletes messages containing Discord invite links. Blocks `discord.gg/` and `discord.com/invite` formats. Moderators are exempt.

**Role Restore** - Stores user roles when they leave and restores them when they rejoin.

## Permissions

- Commands in the `Moderators` folder require moderator roles
- Moderator roles are set in `/setup` -> Mod Roles
- Moderator commands can be globally disabled

## Development

**Project Structure:**
```
DeltaBotz/
  index.ts                 # Main file
  events/                  # Event handlers
  prefix-commands/         # Text-based commands
    General/               # Public commands
    Moderators/            # Mod-only commands
  slash-commands/          # Discord slash commands
  loaders/                 # Command/event loaders
  utils/                   # Utility modules
  configs/                 # Per-server data
```

## License

MIT License

## Support

- Discord: @bshar1865
- GitHub: [Issues](https://github.com/bshar1865/DeltaBotz/issues)

---

**Disclaimer:** This bot is provided "as is" with no guarantees of uptime or feature permanence. Use at your own risk.
