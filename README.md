# Dark Theme Image View
![](./images/icon.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A focused Visual Studio Code image viewer for PNG and SVG files, with sensible defaults for dark themes and a small, dependency-free runtime.

## 👀 preview
<p align="center">
    <img src="./images/before.jpg" width="45%" alt="Dark theme without extension" />
    &nbsp;&nbsp;&nbsp;&nbsp;
    <img src="./images/after.jpg" width="45%" alt="Dark theme with extension" />
</p>
<p align="center">
    <em>Left: Dark theme without extension</em> | <em>Right: Dark theme with extension enabled</em>
</p>

## ✨ Features

- 🎨 **Transparent Background Handling**: Automatically converts transparent backgrounds to white in dark theme mode
- 🖱️ **Interactive Viewing**:
  - 🔍 Zoom in/out using Ctrl/Cmd + Mouse Wheel (the cursor stays over the same image point)
  - ↕️ Scroll long images vertically with the mouse wheel
  - ↔️ Hold Shift while scrolling to move horizontally
  - 🎯 Pan image by dragging with the mouse
- 📋 **Clipboard Support**: Copy the rendered image as PNG with the Copy button or Ctrl/Cmd+C
- 🌓 **Background Modes**: Cycle between white, checkerboard, and editor backgrounds with B
- 📂 **Supported Formats**: 
  - PNG files
  - SVG files

## 🚀 Usage

1. Open any PNG or SVG file in VS Code. The image will automatically open in the custom viewer, and In dark theme, transparent backgrounds will be rendered as white.
2. You may use mouse controls to interact with the image:
   - 👆 Hold and drag to pan
   - ⚡ Ctrl/Cmd + scroll to zoom
   - ↕️ Scroll normally for vertical movement, or hold Shift for horizontal movement
   - 📋 Press Ctrl/Cmd+C or click Copy to put a PNG on the system clipboard
   - 🌓 Press B or click Background to cycle the background
3. To switch to a different editor, right-click the file in the Explorer and select "Open With..." from the context menu.

## 📋 Requirements

- VS Code 1.90.0 or higher

## 💻 Installation

1. Install through VS Code Marketplace
2. Reload VS Code
3. Open any PNG/SVG file to start using

## ⚙️ Configuration

The following settings are available under **Dark Theme Image View**:

- `darkThemeImageView.defaultBackground`: `auto` (white in dark themes and checkerboard in light themes), `white`, `checkerboard`, or `editor`.
- `darkThemeImageView.defaultZoom`: `fitWidth` (the default, which keeps tall images scrollable), `fit`, or `actualSize`.

The toolbar and Command Palette also expose Copy Image, Toggle Background, zoom, and fit commands.

## 🛠️ Development

```bash
npm install
npm run check     # typecheck, lint, and unit tests
npm run compile   # build dist/extension.js and dist/webview.js
```

The published extension has no runtime npm dependencies. The viewer uses a nonce-based Content Security Policy and only grants the webview access to the active image and its bundled assets.

## 🤝 Contributing

Found a bug or have a feature request? Please open an issue on the GitHub repository.

## 📄 License

[MIT License](LICENSE)

## 🙏 Credits

README and icon are generated with the assistance of [Claude AI](https://claude.ai/).

## 🔗 Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Daucloud.dark-theme-image-view)
- [GitHub Repository](https://github.com/Daucloud/vscode-plugin-png)
- [Report an Issue](https://github.com/daucloud/vscode-plugin-png/issues)
- [Changelog](CHANGELOG.md)
