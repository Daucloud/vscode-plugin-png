# Changelog

All notable changes to the "Dark Theme Image View" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-28

### Added

- Added vertical scrolling for long images and Shift + mouse wheel horizontal scrolling.
- Added white, checkerboard, and editor background modes with the `B` shortcut and Command Palette command.
- Added PNG clipboard copy through the Copy button, Ctrl/Cmd+C, editor title action, and webview context menu.
- Added configurable initial background and zoom preferences.

### Changed

- Rebuilt the viewer around an image surface instead of a full-size canvas, avoiding an unnecessary pixel scan and reducing memory use for large images.
- Added cursor-anchored zoom, persisted view state, file change refreshes, theme refreshes, keyboard navigation, and accessible toolbar controls.
- Replaced the inconsistent TypeScript/esbuild setup with a single production bundle under `dist/` and a CSP-protected webview bundle.
- Removed the unused `sharp` runtime dependency and VS Code download-based test runner.
- Added fast Node unit tests for viewer math, manifest contributions, and webview security policy.
- Added continuous integration for type checking, linting, tests, and production builds.

### Fixed

- Fixed long images being clipped because the viewer always hid overflow.
- Fixed the lack of an image clipboard path when using the custom preview.

## [1.0.2] - 2025-06-24

### Fixed

- Resolved image display issue when reopening tabs - images now properly reload and render when switching between tabs or reopening previously viewed image files

## [1.0.1] - 2025-02-18

### Changed

- Optimized extension bundle size using esbuild
- Updated dependencies for better stability
- Improved build process and performance

## [1.0.0] - 2025-02-18

### Added

- Initial release of Dark Theme Image View
- Support for PNG and SVG file viewing
- Automatic white background in dark theme
- Image zoom and pan controls
