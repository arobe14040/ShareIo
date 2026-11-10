# Home Assistant Add-on: ShareIo

ShareIo is simple, self-hosted file sharing for Home Assistant. Upload files,
get a link, send it to anyone.

## Features

- **Sidebar panel** in Home Assistant with automatic login
- **Modern design** with the ShareIo look, light and dark themes. It follows
  your system theme until you pick one in the menu.
- **Paste to upload:** press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>V</kbd> on a
  share or alias page to add files from the clipboard (for example
  screenshots).
- **Drop anywhere:** drag files onto the window, not just the drop box.
- **Share links:** a QR code, a native **Share…** button on phones and tablets,
  and **Save QR** to download the QR code as an image.
- **Keyboard shortcuts:** <kbd>N</kbd> new share, <kbd>A</kbd> new alias,
  <kbd>/</kbd> search.
- **Installable app:** add ShareIo to your home screen or desktop from the
  browser.

## Install

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**, open the
   **⋮** menu and choose **Repositories**.
2. Add `https://github.com/arobe14040/ShareIo`.
3. Find **ShareIo** in the store and click **Install**. The add-on is built on
   your Home Assistant machine the first time, which can take a few minutes.

## Access & Login

### Sidebar panel (ingress)

ShareIo adds a **ShareIo** entry to the Home Assistant sidebar, like Frigate.
It works wherever you can reach Home Assistant, including remotely, with no extra
reverse proxy or Cloudflare configuration. You are logged in automatically as
the Home Assistant user who opened it.

Links you create in the panel point to your Home Assistant address, so **only
people who can log in to your Home Assistant can open them**. To send files to
anyone else, use direct access below.

The panel relies on small adjustments to the web app so it can run under Home
Assistant's ingress path. If something in the panel misbehaves after an
update, direct access keeps working.

### Direct access and public share links

The web UI is also served on port `9090` (`http://<home-assistant-ip>:9090`).
Here users log in with their Home Assistant username and password. To share
files with people outside your household, expose this port publicly (for
example through a reverse proxy or a Cloudflare tunnel) and set `base_url` to
that public address. You can remove the port mapping in the add-on's Network
settings if you only use the panel.

Each HA user has their own account in ShareIo and their own shares, whichever
way they log in.

The addon has disabled all other login methods and new user registration by default.
If you want to allow users to have accounts just with ShareIo you can enable user
registration and other login methods using the `conf_overrides` option shown below.
You will need to configure one of the other login methods under `sharry.restserver.backend.auth`
and set `sharry.restserver.backend.signup.mode` to either `open` or `invite`. See
[server configuration reference][sharry-docs-configure] for more information.

## Database Setup

ShareIo requires a Postgres or MariaDB database to store its data. By
default it will store its data in the [MariaDB addon][addon-mariadb]. That add-on
must be installed and running prior to start-up. You don't need any additional
configuration for this, as long as the MariaDB add-on is running this one can
use it.

[![Open your Home Assistant instance and show the dashboard of a Supervisor add-on.][add-addon-shield]][add-addon-mariadb]

If you prefer you can use a remote database by filling in all the `remote_db_*`
options below. You must create the database and operator for ShareIo in advance
and ShareIo will need full read/write access on the specified database so it can
set up the schema and manage the data.

Please note that there is no easy upgrade path between these two options.

## ⚠ Backing up ShareIo

Since ShareIo does not store its own data, snapshots of this add-on will only
include its configuration. You will need to separately back up the data in order
to restore. If you are using the MariaDB add-on then make sure to include that
add-on in your snapshot as well. If you are using a different database then you
will need to set up your own backup process.

## Configuration

Example add-on configuration:

```yaml
domain: homeassistant.local
use_ssl: false
default_language: us
share_max_size_gb: 1.5
share_max_valid_days: 365
server_secret: changeme
log_level: info
conf_overrides:
  - property: sharry.restserver.webapp.welcome-message
    value: Happy sharing!
```

**Note**: _This is just an example, don't copy and paste it! Create your own!_

### Option: `base_url`

The full public address users will reach ShareIo at, for example
`https://share.example.com`. Use this when ShareIo sits behind a reverse proxy or a
Cloudflare tunnel. When set, it is used exactly as given and `domain`, `use_ssl`
and the published port are ignored, so the port is never added to share links.
Do not include a trailing slash or a path.

### Option: `domain`

Only used when `base_url` is not set. The domain users will access ShareIo at. ShareIo is given a base URL that it uses
for generating URLs and configuring cookies. That will be created from this option,
the `use_ssl` option, and the port you list for `9090`. If the port isn't listed
then the addon assumes users do not include a port in the URL when accessing ShareIo.

### Option: `use_ssl`

If users will use SSL to access ShareIo. Defaults to `false`.

**Note**: _Enabling SSL access is out of scope for ShareIo. This option is for users
who use a reverse proxy and enable SSL there._

### Option: `access.add_port`

The port users will have to provide when accessing ShareIo. If omitted, assumes
users will not provide a port in the URL when accessing ShareIo.

### Option: `default_language`

An [ISO 3166-1][iso-3166-1] country code. Defaults to `gb` if omitted or if the
code provided is invalid or its language is unavailable to ShareIo.

### Option: `share_max_size_gb`

Max size a share can be in GB. Defaults to `1.5` if omitted.

### Option: `share_max_valid_days`

Max number of days a share can be valid for. Defaults to `365` if omitted.

### Option: `server_secret`

Secret used to sign authenticator tokens generated for clients. Prefix it with
`hex:` to use a hexadecimal value or `b64:` to use a base64 encoded value.

### Option: `remote_mysql_host`

If using an external database, the hostname/address for the MariaDB/Postgres database.

### Option: `remote_db_type`

Only applies if a remote database is used, the type of database (`mariadb` or `postgres`).

### Option: `remote_db_port`

Only applies if a remote database is used, the port that the database server is
listening on.

### Option: `remote_db_database`

Only applies if a remote database is used, the name of the database.

### Option: `remote_db_username`

Only applies if a remote database is used, the username with permissions on that
database.

### Option: `remote_db_password`

Only applies if a remote database is used, the password of the above user.

### Option: `reset_database`

Set to `true` to delete and recreate the database on startup. As the data is held
within the MariaDB addon, it is not removed on an uninstall.

**Note**: _This option **only** applies if using the MariaDB add-on, it will not
try to drop a remote MySQL database. Also once the database is reset this configuration
option will be cleared automatically for the addon._

### Option: `conf_overrides`

The server's configuration is specified in [HOCON][hocon]. This means the values in
the config value can be overridden using java properties as described [here][hocon-docs-props].
This option lets you provide an array of config overrides to customize advanced
parts of the server config which haven't been exposed as options above. You can see
the full set of available options here:

<https://eikek.github.io/sharry/doc/configure#default-config>

**Note**: _Changing these options can possibly cause issues with your instance.
USE AT YOUR OWN RISK!_

These are case sensitive and any items set by specific configuration will take
precedence. The ones which cannot be overridden are flagged with a comment in
the [default config][default-config] this addon uses.

#### Sub-option: `property`

The config property to set. Must be the full path starting from the root. Instructions
on handling arrays can be found [here][hocon-docs-arrays].

#### Sub-option: `value`

The value of the config property to set.

## Changelog & Releases

This repository keeps a change log using [GitHub's releases][releases]
functionality.

Releases are based on [Semantic Versioning][semver], and use the format
of `MAJOR.MINOR.PATCH`. In a nutshell, the version will be incremented
based on the following:

- `MAJOR`: Incompatible or major changes.
- `MINOR`: Backwards-compatible new features and enhancements.
- `PATCH`: Backwards-compatible bugfixes and package updates.

## Support

Found a bug or have an idea? [Open an issue][issue] on GitHub.

## Authors & contributors

ShareIo is a fork of [addon-sharry][upstream-addon] by [Mike Degatano][mdegat01],
which is no longer maintained. The file sharing server itself is
[Sharry][sharry] by eikek.

## License

MIT License

Copyright (c) 2021-2022 Mike Degatano
Copyright (c) 2026 ShareIo contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

[add-addon-shield]: https://my.home-assistant.io/badges/supervisor_addon.svg
[add-addon-mariadb]: https://my.home-assistant.io/redirect/supervisor_addon/?addon=core_mariadb
[addon-mariadb]: https://github.com/home-assistant/addons/tree/master/mariadb
[default-config]: https://github.com/arobe14040/ShareIo/blob/main/shareio/rootfs/etc/shareio/shareio.conf
[hocon]: https://github.com/lightbend/config/blob/master/HOCON.md#hocon-human-optimized-config-object-notation
[hocon-docs-arrays]: https://github.com/lightbend/config/blob/master/README.md#set-array-values-outside-configuration-files
[hocon-docs-props]: https://github.com/lightbend/config/blob/master/HOCON.md#java-properties-mapping
[iso-3166-1]: https://en.wikipedia.org/wiki/ISO_3166-1
[issue]: https://github.com/arobe14040/ShareIo/issues
[mdegat01]: https://github.com/mdegat01
[releases]: https://github.com/arobe14040/ShareIo/releases
[upstream-addon]: https://github.com/mdegat01/addon-sharry
[semver]: http://semver.org/spec/v2.0.0
[sharry]: https://eikek.github.io/sharry/
[sharry-docs-configure]: https://eikek.github.io/sharry/doc/configure
