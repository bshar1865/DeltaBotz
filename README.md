# DeltaBotz

An open-source Discord bot providing moderation, logging, emoji copying, bot status, honeypot, and other features with per-server configuration.

**Terms of Service:** [TOS.md](TOS.md)  
**Privacy Policy:** [PRIVACY.md](PRIVACY.md)

## Features

- **Moderation Commands** - Ban, kick, mute, warn, purge, and more
- **Honeypot System** - Auto-ban trap channels to catch rule-breakers
- **Auto Embed** - Automatically converts Instagram links to embeddable format (enabled by default and soon others will be embeddable too)
- **Invite Blocking** - Automatically deletes Discord invite links (mods are exempt, this is disabled by default. can be enabled through /setup) 
- **FAQ** - Server-specific FAQ management
- **Welcome/Goodbye Messages** - Customizable member join/leave messages
- **Role Restore** - Automatically restores roles when members rejoin using Quick.DB (this is disabled by default, which can be enabled through /setup)

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   rename example.env to .env
   Edit `.env` and set your `DISCORD_TOKEN`

3. **Run the bot**
   ```bash
   bunx ts-node index.ts (if you have bun installed)

   or
   
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

**Note:** For best experience, use Discord desktop app; some buttons may not display on mobile.

## Data Layout

```
configs/
  └── <guildId>/
      ├── config.json      # Server configuration
      └── json.sqlite      # Per-guild database
```

## Key Features

**Honeypot System** - Designate a channel as a "honeypot". Users who post are automatically banned. Optional auto-unban after 10 seconds. Moderators are exempt.

**Auto Embed** - Automatically detects Instagram links and converts them to embeddable format. Enabled by default.

**Invite Blocking** - Automatically deletes messages containing Discord invite links. Blocks `discord.gg/` and `discord.com/invite` formats. Moderators are exempt.

**Role Restore** - Automatically stores user roles when they leave and restores them when they rejoin.

## Permissions

- Commands in the `Moderators` folder require moderator roles
- Moderator roles are set in `/setup` → Mod Roles
- Moderator commands can be globally disabled

## Development

**Project Structure:**
```
DeltaBotz/
├── index.ts                 # Main file
├── events/                  # Event handlers
├── prefix-commands/         # Text-based commands
│   ├── General/            # Public commands
│   └── Moderators/         # Mod-only commands
├── slash-commands/          # Discord slash commands
├── loaders/                 # Command/event loaders
├── utils/                   # Utility modules
└── configs/                 # Per-server data
```
## License

MIT License

## Support

- Discord: @bshar1865
- GitHub: [Issues](https://github.com/bshar1865/DeltaBotz/issues)

---

**Disclaimer:** This bot is provided "as is" with no guarantees of uptime or feature permanence. Use at your own risk.
