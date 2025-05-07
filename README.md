# Baidu Netdisk Upload Action

A cross-platform (Linux/macOS/Windows) reusable GitHub Action that downloads a fixed version (v3.9.6) of BaiduPCS-Go, extracts it using the `unzipper` package, logs in, and uploads one or more files matching a glob pattern to Baidu Netdisk.

## Usage Example

```yaml
steps:
  - name: Upload artifacts to Baidu Netdisk
    uses: openblockcc/baidu-netdisk-upload-action@v1
    with:
      bduss: ${{ secrets.BDUSS }}
      stoken: ${{ secrets.STOKEN }}
      target: "./build/**/*.zip"  # Supports glob patterns
      remote-dir: "/Apps/Release/"
```
