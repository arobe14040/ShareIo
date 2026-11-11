# ShareIo

Simple, self-hosted file sharing for Home Assistant.

Drag files in, get a link, send it. Or create an upload link so others can send
files to you. ShareIo lives in the Home Assistant sidebar and logs you in with
your Home Assistant account, so there is nothing to set up.

![Supports aarch64 Architecture][aarch64-shield]
![Supports amd64 Architecture][amd64-shield]

## Install

1. Install and start the [MariaDB add-on][addon-mariadb].
2. In Home Assistant, go to **Settings → Add-ons → Add-on Store**, open the
   **⋮** menu, choose **Repositories** and add
   `https://github.com/arobe14040/ShareIo`.
3. Install **ShareIo**, start it and open it from the sidebar.

See the [documentation](shareio/DOCS.md) for features, public sharing and
advanced options.

## Highlights

- Sidebar panel with automatic Home Assistant login
- Drag and drop or paste files, QR codes and phone share sheet for links
- Upload progress with speed and time left, completion alerts
- Interrupted uploads resume where they stopped
- Light and dark theme, installable as an app
- Optional public links through your own domain

## Credits

A fork of [addon-sharry][upstream-addon] by Mike Degatano, which is no longer
maintained. The file sharing server is the open-source
[Sharry](https://github.com/eikek/sharry) project by eikek. MIT License, see
[LICENSE](LICENSE).

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[addon-mariadb]: https://github.com/home-assistant/addons/tree/master/mariadb
[upstream-addon]: https://github.com/mdegat01/addon-sharry
