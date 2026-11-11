# ShareIo

Simple, self-hosted file sharing for Home Assistant. Upload files, get a link,
send it. Or create an upload link so others can send files to you.

## Getting started

1. Install the **MariaDB** add-on and start it (ShareIo stores its data there).
2. Start **ShareIo**.
3. Click **ShareIo** in the Home Assistant sidebar. You are logged in
   automatically with your Home Assistant account.

There is nothing else to set up. Everything below is optional.

## Using ShareIo

- **Share files:** click **Create Share**, add files and press **Submit**. Open
  the share and choose **Share Link** to copy the link, show a QR code, save
  the QR code as an image, or use your phone's share sheet.
- **Receive files:** **Create Alias** makes an upload link that others can use
  to send you files.
- **Add files quickly:** drag files anywhere onto the window, or paste them
  with <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>V</kbd> (for example screenshots).
- **Keyboard shortcuts:** <kbd>N</kbd> new share, <kbd>A</kbd> new alias,
  <kbd>/</kbd> search.
- **Upload progress:** a status card shows files done, speed and time left,
  and the browser tab shows the percentage. You get a message when everything
  is uploaded (plus a notification and a chime when the tab is in the
  background).
- **Interrupted uploads:** uploads pause when the connection drops and continue
  when it returns. If the page was closed mid-upload, ShareIo shows an
  **Unfinished upload** banner: open the share, choose **Add files** and pick
  the same files to continue where they stopped.
- **Install as an app:** your browser can add ShareIo to the home screen or
  desktop.

Desktop notifications and keeping the screen awake during uploads only work
when Home Assistant is opened over `https://`.

## Sharing with people outside Home Assistant

Links created in the sidebar point to your Home Assistant address, so only
people who can log in to Home Assistant can open them. To send files to anyone
else, ShareIo needs to be reachable on its own:

1. On the add-on's **Configuration** tab, under **Network**, set a port for
   **Direct access** (for example `9090`) and save.
2. Make that port reachable from the internet, usually through a reverse proxy
   or a Cloudflare tunnel. For a Cloudflare tunnel, add a public hostname (for
   example `share.example.com`) pointing to the add-on's hostname from the
   **Info** tab, followed by `:9090` (for example `http://xxxxxxxx-shareio:9090`).
3. Under **Show unused optional configuration options**, set **Public URL** to
   that address, for example `https://share.example.com`, and restart.

On direct access, users log in with their Home Assistant username and password.

## Configuration

The Configuration tab only shows what most people may want to change:

| Option | Default | Meaning |
| --- | --- | --- |
| Maximum share size (GB) | 20 | Largest total size of one share. |
| Longest link lifetime (days) | 30 | The longest time a share link can stay valid. |

### Advanced options

Turn on **Show unused optional configuration options** to see these. All of
them work automatically when left empty.

| Option | When empty |
| --- | --- |
| Public URL | Links use the address ShareIo is opened with. Set it only for public sharing (see above). |
| Default language | British English. Two-letter code such as `us`, `de`, `fr`. Everyone can change it in the menu. |
| Default theme | Follows each device's light/dark setting. |
| Log level | `info`. |
| Server secret | Generated on first start and kept in the add-on's data. Set it only to replace it; this logs everyone out. |
| External database | The MariaDB add-on is used. Fill in type, host, port, username, password and database name to use your own MariaDB or PostgreSQL server. The database and user must exist already. |
| Reset database on next start | Off. When switched on, deletes all ShareIo shares and accounts in the MariaDB add-on on the next start, then switches itself off. Cannot be undone. |
| Server setting overrides | Nothing. Expert option, see below. |

### Server setting overrides

ShareIo runs the [Sharry][sharry] file sharing server. Any of its
[settings][sharry-docs-configure] can be changed with one entry per setting,
written as `property=value`, for example:

```text
sharry.restserver.webapp.welcome-message=Welcome to our family file share!
sharry.restserver.backend.signup.mode=invite
```

Settings for the Home Assistant login, file storage and the listen address are
protected and stop the add-on with an explanation if overridden.

## Backups

Shares and accounts are stored in the MariaDB add-on (or your external
database), not in ShareIo itself. Include the **MariaDB** add-on in your
backups. Uninstalling MariaDB also removes ShareIo's data.

## Troubleshooting

- **The add-on does not start:** check the **Log** tab. The most common cause
  is that the MariaDB add-on is not installed or not running.
- **Uploads fail through a proxy:** ShareIo uploads in 10 MB pieces, so request
  size limits of 16 MB or more are fine.
- **A share link does not open for others:** links made in the sidebar only
  work for Home Assistant users. See
  [Sharing with people outside Home Assistant](#sharing-with-people-outside-home-assistant).
- **Coming from addon-sharry:** ShareIo uses its own database (`shareio`), so
  shares from the old add-on are not carried over.

## Support

Found a bug or have an idea? [Open an issue][issue] on GitHub.

## Credits

ShareIo is a fork of [addon-sharry][upstream-addon] by
[Mike Degatano][mdegat01], which is no longer maintained. The file sharing
server is [Sharry][sharry] by eikek.

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

[issue]: https://github.com/arobe14040/ShareIo/issues
[mdegat01]: https://github.com/mdegat01
[sharry]: https://eikek.github.io/sharry/
[sharry-docs-configure]: https://eikek.github.io/sharry/doc/configure
[upstream-addon]: https://github.com/mdegat01/addon-sharry
