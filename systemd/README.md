# Systemd

Example persistent services for MediaPlayer.

The recommended path is:

```bash
sudo bin/install-daemon.sh
```

This directory is kept as editable examples for custom deployments.

Before installing, edit the `.service` files and adjust:

- `User`
- `Group`
- `WorkingDirectory`
- `ExecStart`
- media paths in `Environment`

```bash
sudo install -m 0644 systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-media-qbt openclaw-media-center openclaw-media-auth-proxy openclaw-media-cloudflared
```

Check status:

```bash
systemctl status openclaw-media-qbt openclaw-media-center openclaw-media-auth-proxy openclaw-media-cloudflared
journalctl -u openclaw-media-cloudflared -n 80 --no-pager
```
