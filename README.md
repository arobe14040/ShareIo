# ShareIo

Simple, self-hosted file sharing for Home Assistant, powered by [Sharry][sharry].

Drag files in, get a link, send it to anyone. You can also create upload links
so other people can send files to you. Home Assistant users log in with their
normal Home Assistant account.

![Supports aarch64 Architecture][aarch64-shield]
![Supports amd64 Architecture][amd64-shield]

## Install

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**, open the
   **⋮** menu and choose **Repositories**.
2. Add `https://github.com/arobe14040/ShareIo`.
3. Find **ShareIo** in the store and click **Install**.

ShareIo stores its data in the [MariaDB add-on][addon-mariadb], which must be
installed and running first. See the [documentation](shareio/DOCS.md) for all
options, including `base_url` for use behind a reverse proxy or Cloudflare tunnel.

## What's different from addon-sharry

ShareIo is a fork of [addon-sharry][upstream-addon] by Mike Degatano, which has
not been updated since 2022.

- Sharry 1.17 (was 1.11) on Java 17 and a current add-on base image
- New `base_url` option, so share links work behind a tunnel or reverse proxy
- `conf_overrides` now actually override the add-on's own settings
- A minimal Sharry config that follows upstream defaults

## License

MIT License. See [LICENSE](LICENSE). Sharry itself is developed by eikek at
<https://github.com/eikek/sharry>.

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[addon-mariadb]: https://github.com/home-assistant/addons/tree/master/mariadb
[sharry]: https://eikek.github.io/sharry/
[upstream-addon]: https://github.com/mdegat01/addon-sharry
