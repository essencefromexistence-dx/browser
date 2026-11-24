# Dx Browser

**Dx Browser** is a Ladybird-based browser with the aim of pushing your
productivity to a new level. It is built on a browser engine written from
scratch — not a fork of Blink, WebKit or Gecko.

[Download](https://github.com/essencefromexistence-dx/browser/releases) • [Website](https://ladybird.org) • [Documentation](Documentation/README.md) • [Release Notes](https://github.com/essencefromexistence-dx/browser/releases)

## About the engine

[Ladybird](https://ladybird.org) is a genuinely independent web browser engine.
It is built from the ground up around web standards, with no code borrowed from
existing browser engines, and is developed by the Ladybird Browser Initiative,
a 501(c)(3) non-profit funded by donations rather than search revenue
([announcement](https://ladybird.org/posts/announcement),
[W3C report](https://www.w3.org/2024/09/25-ladybird-minutes.html)).

Recent upstream milestones, from the
[October 2026 newsletter](https://ladybird.org/newsletter/2026-10-31):

- passed Safari Technology Preview on Web Platform Tests on 26 October 2026
  (2,184,722 passing subtests at month end);
- built a LibJS JIT, replaced the WebAssembly engine, and moved style and
  layout off the main thread;
- redesigned the browser UI and continued Rust migration of the style and
  layout systems.

## Status

Ladybird is **pre-alpha**, built from source, with a first alpha targeted for
2026 on macOS and Linux and aimed at developers and early adopters
([ladybird.org](https://ladybird.org),
[contributing guide](https://github.com/LadybirdBrowser/ladybird/blob/master/Documentation/GettingStartedContributing.md)).

**Windows is already released and will be launching soon.** Linux and macOS
builds will come after that.
([build instructions](https://github.com/LadybirdBrowser/ladybird/blob/master/Documentation/BuildInstructionsLadybird.md)).
This repository is an experimental Dx fork built on top of that fresh engine.
It is not a shipping release.

## Contributing

If you'd like to report a bug, please do so on our
[GitHub Issues](https://github.com/essencefromexistence-dx/browser/issues) page and for feature requests, you can use
[GitHub Discussions](https://github.com/essencefromexistence-dx/browser/discussions).

Dx Browser is an open-source project, and we welcome contributions from the
community! Please take a look at the [contribution guidelines](CONTRIBUTING.md)
before getting started!

Licensed under BSD-2-Clause, following upstream Ladybird; see [LICENSE](LICENSE).
