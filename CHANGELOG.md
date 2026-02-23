# Changelog

## [3.27.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.4...gridfinity-layout-tool-v3.27.5) (2026-02-23)


### Bug Fixes

* **bin-designer:** use Override in 3MF content types for slicer compatibility ([#868](https://github.com/andymai/gridfinity-layout-tool/issues/868)) ([4d69971](https://github.com/andymai/gridfinity-layout-tool/commit/4d699713eb25cf250c7a13ba712f5a1f49a83566))

## [3.27.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.3...gridfinity-layout-tool-v3.27.4) (2026-02-23)


### Bug Fixes

* **sw:** exclude wwwMigration chunk from service worker precache ([#866](https://github.com/andymai/gridfinity-layout-tool/issues/866)) ([7081a81](https://github.com/andymai/gridfinity-layout-tool/commit/7081a81060e8e8058265c71fc1219d35089cd246))

## [3.27.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.2...gridfinity-layout-tool-v3.27.3) (2026-02-23)


### Bug Fixes

* **www-migration:** handle blank iframe onload before bridge navigates ([#864](https://github.com/andymai/gridfinity-layout-tool/issues/864)) ([98ff871](https://github.com/andymai/gridfinity-layout-tool/commit/98ff871989fca2ae2f10dfbc0a3bbe281ef4e4cb))

## [3.27.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.1...gridfinity-layout-tool-v3.27.2) (2026-02-23)


### Bug Fixes

* **www-migration:** fix empty-layout bug and add canonical IDB integrity verification ([#862](https://github.com/andymai/gridfinity-layout-tool/issues/862)) ([fa72d5c](https://github.com/andymai/gridfinity-layout-tool/commit/fa72d5c95bdad9933e0cadd390fe2cebc1f48cc3))

## [3.27.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.0...gridfinity-layout-tool-v3.27.1) (2026-02-23)

### Bug Fixes

- **bin-designer:** fix Open in Slicer 400 error and clean up test warnings ([#859](https://github.com/andymai/gridfinity-layout-tool/issues/859)) ([f0f4398](https://github.com/andymai/gridfinity-layout-tool/commit/f0f4398e68d7c1b846d7f470a7c36a92b1e339ea))
- **storage:** fix www→canonical migration library merge and edge cases ([#860](https://github.com/andymai/gridfinity-layout-tool/issues/860)) ([a391b6c](https://github.com/andymai/gridfinity-layout-tool/commit/a391b6cc3d06ae69a7d4d7165a784c71bdbb9c6b))

## [3.27.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.26.3...gridfinity-layout-tool-v3.27.0) (2026-02-23)

### Features

- **storage:** www → canonical domain storage migration ([#856](https://github.com/andymai/gridfinity-layout-tool/issues/856)) ([582f3e3](https://github.com/andymai/gridfinity-layout-tool/commit/582f3e309cc7c3ccf6ffdd4d34192ff066494412))

## [3.26.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.26.2...gridfinity-layout-tool-v3.26.3) (2026-02-23)

### Bug Fixes

- **bin-designer:** fix Open in Slicer 403 by checking all Vercel URL env vars ([#854](https://github.com/andymai/gridfinity-layout-tool/issues/854)) ([13dea6a](https://github.com/andymai/gridfinity-layout-tool/commit/13dea6af95a7e7eeaa60bede353007032150742b))

## [3.26.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.26.1...gridfinity-layout-tool-v3.26.2) (2026-02-22)

### Bug Fixes

- **bin-designer:** fix Open in Slicer firing download instead of opening app ([#852](https://github.com/andymai/gridfinity-layout-tool/issues/852)) ([9654a00](https://github.com/andymai/gridfinity-layout-tool/commit/9654a003c965bf82ab912bbb1b7f76e4c2fb4dd5))

## [3.26.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.26.0...gridfinity-layout-tool-v3.26.1) (2026-02-22)

### Bug Fixes

- **bin-designer:** fix export dialog bugs and UX issues ([#850](https://github.com/andymai/gridfinity-layout-tool/issues/850)) ([9b1ba6b](https://github.com/andymai/gridfinity-layout-tool/commit/9b1ba6ba87ba3a29fd0cc32f40a9931b76b990d6))

## [3.26.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.25.0...gridfinity-layout-tool-v3.26.0) (2026-02-22)

### Features

- **api:** add hourly cron to clean up expired slicer-temp blobs ([#848](https://github.com/andymai/gridfinity-layout-tool/issues/848)) ([4bac1f8](https://github.com/andymai/gridfinity-layout-tool/commit/4bac1f86a3c1c10eb4524b6d20e6d9af3cd4c294))

## [3.25.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.24.0...gridfinity-layout-tool-v3.25.0) (2026-02-22)

### Features

- **bin-designer:** add Open in Slicer deep-link export ([#846](https://github.com/andymai/gridfinity-layout-tool/issues/846)) ([39d70df](https://github.com/andymai/gridfinity-layout-tool/commit/39d70df3ca6e33b5e7684389e3bba8763f8bd08f))

## [3.24.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.23.1...gridfinity-layout-tool-v3.24.0) (2026-02-22)

### Features

- **i18n:** consolidate redundant keys and remove 152 orphaned translations ([#843](https://github.com/andymai/gridfinity-layout-tool/issues/843)) ([aec5e9a](https://github.com/andymai/gridfinity-layout-tool/commit/aec5e9a949b1c97ace78a0a5cf1aa2081fa5c071))

## [3.23.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.23.0...gridfinity-layout-tool-v3.23.1) (2026-02-22)

### Bug Fixes

- **icons:** eliminate transparent corners in favicon and PWA icons ([#840](https://github.com/andymai/gridfinity-layout-tool/issues/840)) ([3c7c03c](https://github.com/andymai/gridfinity-layout-tool/commit/3c7c03cfb371a2f7009fe003acb62563de3d42da))

## [3.23.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.22.1...gridfinity-layout-tool-v3.23.0) (2026-02-22)

### Features

- **ux:** communicate grid interaction failures and surface the stash to new users ([5cd6b46](https://github.com/andymai/gridfinity-layout-tool/commit/5cd6b465ecca9f498b3746a20fd4d957b01d2022))

## [3.22.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.22.0...gridfinity-layout-tool-v3.22.1) (2026-02-21)

### Bug Fixes

- stash rotate button clipping and move-to-grid context menu ([#837](https://github.com/andymai/gridfinity-layout-tool/issues/837)) ([f14cc84](https://github.com/andymai/gridfinity-layout-tool/commit/f14cc841d4a579d46e12b8be6776ea1185fe2e79))

## [3.22.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.21.0...gridfinity-layout-tool-v3.22.0) (2026-02-21)

### Features

- remove delete bin drop zone ([#835](https://github.com/andymai/gridfinity-layout-tool/issues/835)) ([c6bcb69](https://github.com/andymai/gridfinity-layout-tool/commit/c6bcb6931077ba92140f565d39ac958a92a36991))

## [3.21.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.20.0...gridfinity-layout-tool-v3.21.0) (2026-02-21)

### Features

- smart snap placement for bins near collisions ([#832](https://github.com/andymai/gridfinity-layout-tool/issues/832)) ([7e4fdbb](https://github.com/andymai/gridfinity-layout-tool/commit/7e4fdbb5f641078e4a9477ad08366bf63bdf1b89))

## [3.20.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.19.0...gridfinity-layout-tool-v3.20.0) (2026-02-21)

### Features

- **print:** unify filament estimates with analytical volume model, add nozzle size setting ([#829](https://github.com/andymai/gridfinity-layout-tool/issues/829)) ([284548c](https://github.com/andymai/gridfinity-layout-tool/commit/284548ca6b529a5d40d6d1909a0eb05293cd79fd))

## [3.19.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.18.4...gridfinity-layout-tool-v3.19.0) (2026-02-21)

### Features

- **layers:** layer height UX overhaul ([#816](https://github.com/andymai/gridfinity-layout-tool/issues/816)) ([af597c0](https://github.com/andymai/gridfinity-layout-tool/commit/af597c088fbb0115ee1aa262481f4bb38d462374))

### Bug Fixes

- **print-export:** fix multiple bugs and i18n issues in print modal ([#827](https://github.com/andymai/gridfinity-layout-tool/issues/827)) ([89117a1](https://github.com/andymai/gridfinity-layout-tool/commit/89117a1bcd4960612b65ae82b898c46974a485fa))

## [3.18.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.18.3...gridfinity-layout-tool-v3.18.4) (2026-02-20)

### Bug Fixes

- **design-linking:** reconcile design→grid sync on navigation return ([#821](https://github.com/andymai/gridfinity-layout-tool/issues/821)) ([4405181](https://github.com/andymai/gridfinity-layout-tool/commit/440518123e7d0c5ffa3a5ada21f3f4fc6fc00e58))

## [3.18.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.18.2...gridfinity-layout-tool-v3.18.3) (2026-02-20)

### Bug Fixes

- **storage:** salvage layouts with bin collisions instead of rejecting ([#819](https://github.com/andymai/gridfinity-layout-tool/issues/819)) ([fb65d19](https://github.com/andymai/gridfinity-layout-tool/commit/fb65d19ab417512a373e18e2a656f12dd2805886))

## [3.18.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.18.1...gridfinity-layout-tool-v3.18.2) (2026-02-20)

### Performance

- reduce main bundle size by 27% via lazy loading ([#817](https://github.com/andymai/gridfinity-layout-tool/issues/817)) ([5c0696b](https://github.com/andymai/gridfinity-layout-tool/commit/5c0696b68786872fb5214db948759d65588e22b9))

## [3.18.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.18.0...gridfinity-layout-tool-v3.18.1) (2026-02-20)

### Bug Fixes

- **design-linking:** sync inspector dimension changes to linked designs ([#814](https://github.com/andymai/gridfinity-layout-tool/issues/814)) ([9b94f53](https://github.com/andymai/gridfinity-layout-tool/commit/9b94f53146a8e0de7f41fdb1f3ef46c3b8c8a5f5))

## [3.18.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.17.1...gridfinity-layout-tool-v3.18.0) (2026-02-20)

### Features

- **design-linking:** auto-sync linked bin design dimensions ([#812](https://github.com/andymai/gridfinity-layout-tool/issues/812)) ([e31a86c](https://github.com/andymai/gridfinity-layout-tool/commit/e31a86c826c85aa87253ad034199d7f424090104))

## [3.17.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.17.0...gridfinity-layout-tool-v3.17.1) (2026-02-20)

### Bug Fixes

- resolve TypeScript errors in Vercel API build ([#808](https://github.com/andymai/gridfinity-layout-tool/issues/808)) ([1a39d8b](https://github.com/andymai/gridfinity-layout-tool/commit/1a39d8b6649063eccb73b6af131c01f048062c29))

## [3.17.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.16.1...gridfinity-layout-tool-v3.17.0) (2026-02-19)

### Features

- optimize localStorage with key consolidation and IDB migration ([#806](https://github.com/andymai/gridfinity-layout-tool/issues/806)) ([41f954d](https://github.com/andymai/gridfinity-layout-tool/commit/41f954dcc22483fe56e2b2cbe575b9f5115cc70f))

## [3.16.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.16.0...gridfinity-layout-tool-v3.16.1) (2026-02-19)

### Bug Fixes

- update tests for post-merge API changes ([1e0debc](https://github.com/andymai/gridfinity-layout-tool/commit/1e0debc6988f7850dc2978afee35cb6881b1a65a))

## [3.16.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.15.0...gridfinity-layout-tool-v3.16.0) (2026-02-19)

### Features

- add bulk export/import for all layouts ([#802](https://github.com/andymai/gridfinity-layout-tool/issues/802)) ([a6c5bc7](https://github.com/andymai/gridfinity-layout-tool/commit/a6c5bc75aeed22e68fba71751bf9982c2f085afc))
- add Storage dashboard tab in Settings ([#801](https://github.com/andymai/gridfinity-layout-tool/issues/801)) ([60447b7](https://github.com/andymai/gridfinity-layout-tool/commit/60447b7d5382b76d35165645842102a6df66c112))
- auto-clean localStorage layout backups ([#800](https://github.com/andymai/gridfinity-layout-tool/issues/800)) ([6391445](https://github.com/andymai/gridfinity-layout-tool/commit/6391445e4d37feea3aa1be6a72cdbfc749e4ed58))

## [3.15.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.14.0...gridfinity-layout-tool-v3.15.0) (2026-02-19)

### Features

- migrate library index from localStorage to IndexedDB ([#799](https://github.com/andymai/gridfinity-layout-tool/issues/799)) ([e1068bd](https://github.com/andymai/gridfinity-layout-tool/commit/e1068bda1f034e13e725b75e9b0dd346ca5f7696))

## [3.14.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.13.9...gridfinity-layout-tool-v3.14.0) (2026-02-19)

### Features

- snapshot history with auto-save, restore, and IndexedDB recovery ([#797](https://github.com/andymai/gridfinity-layout-tool/issues/797)) ([f2bf4ec](https://github.com/andymai/gridfinity-layout-tool/commit/f2bf4ec0596682897403ab02b6082cd94829835a))

## [3.13.9](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.13.8...gridfinity-layout-tool-v3.13.9) (2026-02-19)

### Bug Fixes

- **bin-designer:** use scrollbar-thin style in saved designs dialog ([#794](https://github.com/andymai/gridfinity-layout-tool/issues/794)) ([f1b8551](https://github.com/andymai/gridfinity-layout-tool/commit/f1b85512e36322314ab33071f74d8a387cb8745e))

## [3.13.8](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.13.7...gridfinity-layout-tool-v3.13.8) (2026-02-19)

### Bug Fixes

- **bin-designer:** enable scrolling in saved designs dialog with 9+ designs ([#792](https://github.com/andymai/gridfinity-layout-tool/issues/792)) ([872de41](https://github.com/andymai/gridfinity-layout-tool/commit/872de417d9712533f9743033d077bc5862289d6f))

## [3.13.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.13.6...gridfinity-layout-tool-v3.13.7) (2026-02-19)

### Bug Fixes

- **bin-designer:** enable scrolling in saved designs dialog with 9+ designs ([#790](https://github.com/andymai/gridfinity-layout-tool/issues/790)) ([c31fc6b](https://github.com/andymai/gridfinity-layout-tool/commit/c31fc6bc87ab13fd9e4541fe82ca09160b681b9b))

## [3.13.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.13.5...gridfinity-layout-tool-v3.13.6) (2026-02-19)

### Bug Fixes

- **bin-designer:** use dimension-based tessellation with tight lip tolerance ([#787](https://github.com/andymai/gridfinity-layout-tool/issues/787)) ([54aab1a](https://github.com/andymai/gridfinity-layout-tool/commit/54aab1ab501a5eb2d8fcd73c1834b06fec59fcee))

## [3.13.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.13.4...gridfinity-layout-tool-v3.13.5) (2026-02-18)

### Bug Fixes

- **bin-designer:** optimize 3D preview for mobile web ([#780](https://github.com/andymai/gridfinity-layout-tool/issues/780)) ([611f257](https://github.com/andymai/gridfinity-layout-tool/commit/611f2570074ae064571a94515047d7c3e0734ece))
- **bin-designer:** preserve stacking lip wall in preview tessellation ([#782](https://github.com/andymai/gridfinity-layout-tool/issues/782)) ([c813a61](https://github.com/andymai/gridfinity-layout-tool/commit/c813a61c1e98c4d7174cd9b080433fe1b79d0980))

## [3.13.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.13.3...gridfinity-layout-tool-v3.13.4) (2026-02-17)

### Bug Fixes

- **bin-designer:** mobile UI fixes for touch targets, layout, and UX ([#774](https://github.com/andymai/gridfinity-layout-tool/issues/774)) ([19e8dfb](https://github.com/andymai/gridfinity-layout-tool/commit/19e8dfb805d7814c04d80f7b370a19f54e4d3d53))

## [3.13.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.13.2...gridfinity-layout-tool-v3.13.3) (2026-02-17)

### Bug Fixes

- **ci:** update PostHog source map upload inputs for v2 ([#772](https://github.com/andymai/gridfinity-layout-tool/issues/772)) ([aee03ee](https://github.com/andymai/gridfinity-layout-tool/commit/aee03eeadc22272004cdf8ae5baca74f922587ee))

## [3.13.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.13.1...gridfinity-layout-tool-v3.13.2) (2026-02-17)

### Bug Fixes

- 4 bugs found via systematic codebase audit (round 2) ([#767](https://github.com/andymai/gridfinity-layout-tool/issues/767)) ([6b538f3](https://github.com/andymai/gridfinity-layout-tool/commit/6b538f3ad4906c423495290037f33382a002ece1))
- widen return types to include LayoutLibraryLimitError ([#770](https://github.com/andymai/gridfinity-layout-tool/issues/770)) ([063c570](https://github.com/andymai/gridfinity-layout-tool/commit/063c5700b9839a8cc81d17e365382b5ef5c1ad7a))

## [3.13.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.13.0...gridfinity-layout-tool-v3.13.1) (2026-02-17)

### Bug Fixes

- 5 bugs found via systematic codebase audit with TDD ([#765](https://github.com/andymai/gridfinity-layout-tool/issues/765)) ([2458e69](https://github.com/andymai/gridfinity-layout-tool/commit/2458e69df0df642455439c9475c7e3587045a4a1))

## [3.13.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.12.5...gridfinity-layout-tool-v3.13.0) (2026-02-17)

### Features

- add face origin provenance pipeline (brepjs 8.3.0) ([#763](https://github.com/andymai/gridfinity-layout-tool/issues/763)) ([7fbc59a](https://github.com/andymai/gridfinity-layout-tool/commit/7fbc59ad171446dcbfa41e4f36b7091786a58fb5))

## [3.12.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.12.4...gridfinity-layout-tool-v3.12.5) (2026-02-17)

### Bug Fixes

- **lint:** resolve all 10 ESLint no-unnecessary-condition warnings ([#761](https://github.com/andymai/gridfinity-layout-tool/issues/761)) ([7b831f3](https://github.com/andymai/gridfinity-layout-tool/commit/7b831f3002c1fd4fbb8b4fa5e63db42e2607d16f))

## [3.12.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.12.3...gridfinity-layout-tool-v3.12.4) (2026-02-16)

### Bug Fixes

- **categories:** widen color picker popup to prevent squished layout ([#756](https://github.com/andymai/gridfinity-layout-tool/issues/756)) ([e3faa80](https://github.com/andymai/gridfinity-layout-tool/commit/e3faa80e20c88fbe9b81758bb3dadb72789d24e6))

## [3.12.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.12.2...gridfinity-layout-tool-v3.12.3) (2026-02-14)

### Bug Fixes

- **settings:** remove grid visuals settings and use defaults ([#753](https://github.com/andymai/gridfinity-layout-tool/issues/753)) ([ad1108c](https://github.com/andymai/gridfinity-layout-tool/commit/ad1108ce426b4bc5364f4a78913f9169a6f9a55a))

## [3.12.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.12.1...gridfinity-layout-tool-v3.12.2) (2026-02-14)

### Bug Fixes

- **settings:** stabilize modal height and add mobile fullscreen ([#751](https://github.com/andymai/gridfinity-layout-tool/issues/751)) ([221a463](https://github.com/andymai/gridfinity-layout-tool/commit/221a4634db52207face06f76073217b1555f6e73))

## [3.12.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.12.0...gridfinity-layout-tool-v3.12.1) (2026-02-14)

### Bug Fixes

- **build:** export formatDimension from shared utils ([e0fa499](https://github.com/andymai/gridfinity-layout-tool/commit/e0fa499d946bcd8f9eb4d86edba6d4a32cc54178))
- **mobile:** improve touch grid usability and polish mobile UX ([3066246](https://github.com/andymai/gridfinity-layout-tool/commit/3066246a58bb19d1dac29e38de2e48ee640d0969))

## [3.12.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.11.6...gridfinity-layout-tool-v3.12.0) (2026-02-14)

### Features

- **settings:** add Appearance tab with theme, accent, density, and grid controls ([#748](https://github.com/andymai/gridfinity-layout-tool/issues/748)) ([5cbce12](https://github.com/andymai/gridfinity-layout-tool/commit/5cbce12abd7917da9411ae6e760f7a02ee0f5450))

## [3.11.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.11.5...gridfinity-layout-tool-v3.11.6) (2026-02-13)

### Bug Fixes

- **types:** accept nullable activeLayoutId in resolveLayout ([#746](https://github.com/andymai/gridfinity-layout-tool/issues/746)) ([a6e462b](https://github.com/andymai/gridfinity-layout-tool/commit/a6e462be5ecec75f3ae4f35fe45d3d3cf94735d4))

## [3.11.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.11.4...gridfinity-layout-tool-v3.11.5) (2026-02-13)

### Bug Fixes

- **validation:** reject zero/negative dimensions in type guards ([#743](https://github.com/andymai/gridfinity-layout-tool/issues/743)) ([7124558](https://github.com/andymai/gridfinity-layout-tool/commit/7124558dd8a1e3f5cbb9a5288b9d2f340a9781dc))

## [3.11.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.11.3...gridfinity-layout-tool-v3.11.4) (2026-02-13)

### Bug Fixes

- **analytics:** prevent Infinity binsPerMinute in ML confidence scoring ([#741](https://github.com/andymai/gridfinity-layout-tool/issues/741)) ([203d768](https://github.com/andymai/gridfinity-layout-tool/commit/203d7688fa26b624729ce35d978db059ce4da1f8))

## [3.11.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.11.2...gridfinity-layout-tool-v3.11.3) (2026-02-13)

### Bug Fixes

- **api:** add missing allowOverwrite to report endpoint blob put ([#739](https://github.com/andymai/gridfinity-layout-tool/issues/739)) ([162b18e](https://github.com/andymai/gridfinity-layout-tool/commit/162b18e8e6d6e3fab4900fdb3e4f0c455b3232d0))

## [3.11.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.11.1...gridfinity-layout-tool-v3.11.2) (2026-02-13)

### Bug Fixes

- **grid-editor:** clamp fractional row/column coords to valid half-bin positions ([#737](https://github.com/andymai/gridfinity-layout-tool/issues/737)) ([f7fb02c](https://github.com/andymai/gridfinity-layout-tool/commit/f7fb02c43c479a196aef49c1ad250cc9b01756b1))

## [3.11.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.11.0...gridfinity-layout-tool-v3.11.1) (2026-02-13)

### Bug Fixes

- **feedback:** address review comments on sanitization and formatting ([#733](https://github.com/andymai/gridfinity-layout-tool/issues/733)) ([e35bf3c](https://github.com/andymai/gridfinity-layout-tool/commit/e35bf3c8451c6c3ae5ff745e188f4f1a03146e9d))

## [3.11.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.10.0...gridfinity-layout-tool-v3.11.0) (2026-02-13)

### Features

- **feedback:** llm-enriched issue creation with priority and duplicate detection ([#731](https://github.com/andymai/gridfinity-layout-tool/issues/731)) ([cd4ea84](https://github.com/andymai/gridfinity-layout-tool/commit/cd4ea847ec07988a59d57b991b6aa9b484317301))

## [3.10.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.9.2...gridfinity-layout-tool-v3.10.0) (2026-02-13)

### Features

- add feedback UI with GitHub Issue creation ([#722](https://github.com/andymai/gridfinity-layout-tool/issues/722)) ([707580d](https://github.com/andymai/gridfinity-layout-tool/commit/707580d0f748adc2d1f81d6cc4ceaec89cd7a6a4))

## [3.9.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.9.1...gridfinity-layout-tool-v3.9.2) (2026-02-13)

### Bug Fixes

- snap staging drag to nearest valid position to prevent flickering ([#719](https://github.com/andymai/gridfinity-layout-tool/issues/719)) ([5bb4bb0](https://github.com/andymai/gridfinity-layout-tool/commit/5bb4bb0df8afc164b514b8ccc3628e8ea8d8d0df))

## [3.9.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.9.0...gridfinity-layout-tool-v3.9.1) (2026-02-13)

### Bug Fixes

- hide SEO fallback content flash on page load ([#714](https://github.com/andymai/gridfinity-layout-tool/issues/714)) ([b278ded](https://github.com/andymai/gridfinity-layout-tool/commit/b278ded69e84ebec1d455c15a8b102c6509c63c9))

## [3.9.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.8.0...gridfinity-layout-tool-v3.9.0) (2026-02-12)

### Features

- add scoop and funnel wall cutout shapes ([523439e](https://github.com/andymai/gridfinity-layout-tool/commit/523439e651483dba11153a326ec167e25b7c0196))
- add wall cutout feature to bin designer ([#707](https://github.com/andymai/gridfinity-layout-tool/issues/707)) ([8675067](https://github.com/andymai/gridfinity-layout-tool/commit/86750678196951e561d02a4d615c49fccc727ae0))

## [3.8.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.7.1...gridfinity-layout-tool-v3.8.0) (2026-02-12)

### Features

- add ruler measurement tool to cutout editor ([#706](https://github.com/andymai/gridfinity-layout-tool/issues/706)) ([31e9d0d](https://github.com/andymai/gridfinity-layout-tool/commit/31e9d0d9bef8c4da04c70f4c8688409416fea559))

## [3.7.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.7.0...gridfinity-layout-tool-v3.7.1) (2026-02-12)

### Bug Fixes

- prevent WASM memory access crashes from degenerate geometry ([#703](https://github.com/andymai/gridfinity-layout-tool/issues/703)) ([0e93d1e](https://github.com/andymai/gridfinity-layout-tool/commit/0e93d1ef1150feec935c9927c5ad3f9442d2139f))

### Performance

- use brepjs composeTransforms for wall pattern generation ([#702](https://github.com/andymai/gridfinity-layout-tool/issues/702)) ([dbaa95c](https://github.com/andymai/gridfinity-layout-tool/commit/dbaa95c7a0be75c6cfcfb2150551648b2f7eacf6))

## [3.7.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.6.2...gridfinity-layout-tool-v3.7.0) (2026-02-12)

### Features

- add pen tool for freeform path cutouts ([#685](https://github.com/andymai/gridfinity-layout-tool/issues/685)) ([ca16505](https://github.com/andymai/gridfinity-layout-tool/commit/ca165058dc21634cad4e1358388f2500be97020f))

## [3.6.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.6.1...gridfinity-layout-tool-v3.6.2) (2026-02-12)

### Bug Fixes

- prevent interior controls from being overwritten by event bubbling ([#698](https://github.com/andymai/gridfinity-layout-tool/issues/698)) ([d3b3e81](https://github.com/andymai/gridfinity-layout-tool/commit/d3b3e81aeef327d6e8977e495c949bd3ff1df58e))

## [3.6.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.6.0...gridfinity-layout-tool-v3.6.1) (2026-02-11)

### Bug Fixes

- resolve all test failures after ESLint lint fix PR ([#695](https://github.com/andymai/gridfinity-layout-tool/issues/695)) ([#696](https://github.com/andymai/gridfinity-layout-tool/issues/696)) ([524994a](https://github.com/andymai/gridfinity-layout-tool/commit/524994a6f36a907f2439b63505493e476631e650))

## [3.6.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.5.3...gridfinity-layout-tool-v3.6.0) (2026-02-11)

### Features

- add constraint resolution engine for bin designer ([#693](https://github.com/andymai/gridfinity-layout-tool/issues/693)) ([053273e](https://github.com/andymai/gridfinity-layout-tool/commit/053273e59fc27ef4a93737bd7073447d49fcf1d0))

## [3.5.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.5.2...gridfinity-layout-tool-v3.5.3) (2026-02-11)

### Bug Fixes

- reset floating inspector position lock on hide/selection change ([#691](https://github.com/andymai/gridfinity-layout-tool/issues/691)) ([da46a36](https://github.com/andymai/gridfinity-layout-tool/commit/da46a36fdb6c15dfe7f62a9e06f103c694eb39a4))

## [3.5.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.5.1...gridfinity-layout-tool-v3.5.2) (2026-02-11)

### Bug Fixes

- prevent floating inspector panel jitter during slider interaction ([#689](https://github.com/andymai/gridfinity-layout-tool/issues/689)) ([6d7d711](https://github.com/andymai/gridfinity-layout-tool/commit/6d7d7111f799471736b4a43b68eaf6833ea02a15))

## [3.5.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.5.0...gridfinity-layout-tool-v3.5.1) (2026-02-11)

### Performance

- optimize bin designer generation pipeline ([#686](https://github.com/andymai/gridfinity-layout-tool/issues/686)) ([fc3bfb8](https://github.com/andymai/gridfinity-layout-tool/commit/fc3bfb85513e640cac9117d339e1e5c4e093afe1))

## [3.5.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.4.1...gridfinity-layout-tool-v3.5.0) (2026-02-11)

### Features

- add multi-format export (STL / STEP / 3MF) to bin designer ([#683](https://github.com/andymai/gridfinity-layout-tool/issues/683)) ([7f62eae](https://github.com/andymai/gridfinity-layout-tool/commit/7f62eae34f85311bc6f84955b4020344e6596c16))

## [3.4.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.4.0...gridfinity-layout-tool-v3.4.1) (2026-02-11)

### Bug Fixes

- resolve pinched scoop at merged cutout junctions ([#681](https://github.com/andymai/gridfinity-layout-tool/issues/681)) ([792fbf3](https://github.com/andymai/gridfinity-layout-tool/commit/792fbf3a229eb4ce73b40e6ab61356536ffd4a3f))

## [3.4.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.3.0...gridfinity-layout-tool-v3.4.0) (2026-02-11)

### Features

- improve auto scoop radius with height-aware formula and resolved display ([#671](https://github.com/andymai/gridfinity-layout-tool/issues/671)) ([7ba7847](https://github.com/andymai/gridfinity-layout-tool/commit/7ba78477bfc60d099c0bcfacd77ac241e51fa887))

## [3.3.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.2.3...gridfinity-layout-tool-v3.3.0) (2026-02-11)

### Features

- finger scoop with stacking lip alignment ([#668](https://github.com/andymai/gridfinity-layout-tool/issues/668)) ([cf4cdcc](https://github.com/andymai/gridfinity-layout-tool/commit/cf4cdcc5ae8010546862a9ef53e7d4ad2f18da43))

## [3.2.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.2.2...gridfinity-layout-tool-v3.2.3) (2026-02-10)

### Bug Fixes

- align Select, Stepper, Toast sizing to match production and add visual regression tests ([#666](https://github.com/andymai/gridfinity-layout-tool/issues/666)) ([2ceddbe](https://github.com/andymai/gridfinity-layout-tool/commit/2ceddbe712b2dd124d2f3e4c4df6e06313efb064))

## [3.2.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.2.1...gridfinity-layout-tool-v3.2.2) (2026-02-10)

### Bug Fixes

- align Button, Input, Checkbox, Toast, Dialog sizing to match production ([#664](https://github.com/andymai/gridfinity-layout-tool/issues/664)) ([807b70c](https://github.com/andymai/gridfinity-layout-tool/commit/807b70ce91ae86d99fcc4a18994f7bd59400e78c))

## [3.2.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.2.0...gridfinity-layout-tool-v3.2.1) (2026-02-10)

### Bug Fixes

- align design system sizing to match production components ([#662](https://github.com/andymai/gridfinity-layout-tool/issues/662)) ([a1aa1d5](https://github.com/andymai/gridfinity-layout-tool/commit/a1aa1d59e12d2864f330ed83ad47ec8dd24ca6d0))

## [3.2.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.1.0...gridfinity-layout-tool-v3.2.0) (2026-02-09)

### Features

- add half sockets option for bins ([#659](https://github.com/andymai/gridfinity-layout-tool/issues/659)) ([1973458](https://github.com/andymai/gridfinity-layout-tool/commit/19734585b9e6e12f46a0d97b09da83ad3f3ca105))

## [3.1.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.0.2...gridfinity-layout-tool-v3.1.0) (2026-02-09)

### Features

- remove vercel speed insights ([#652](https://github.com/andymai/gridfinity-layout-tool/issues/652)) ([3a02938](https://github.com/andymai/gridfinity-layout-tool/commit/3a0293853dadaabfeb115169f4ad211ebbe2b5a6))

## [3.0.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.0.1...gridfinity-layout-tool-v3.0.2) (2026-02-09)

### Bug Fixes

- handle legacy bin designer designs missing compartments field ([#650](https://github.com/andymai/gridfinity-layout-tool/issues/650)) ([392dacd](https://github.com/andymai/gridfinity-layout-tool/commit/392dacd8a32c8748334d9a9f5afd22bf7680c738))

## [3.0.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.0.0...gridfinity-layout-tool-v3.0.1) (2026-02-08)

### Bug Fixes

- adjust coverage thresholds to realistic achievable levels ([#648](https://github.com/andymai/gridfinity-layout-tool/issues/648)) ([49d0d13](https://github.com/andymai/gridfinity-layout-tool/commit/49d0d1318105142c6fd7f2b8805818fb0ab556b2))

## [3.0.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.30.0...gridfinity-layout-tool-v3.0.0) (2026-02-08)

### ⚠ BREAKING CHANGES

- topOffset is now a global setting in cutoutConfig, not per-cutout

### Features

- add shape cutouts for solid bins in bin designer ([#629](https://github.com/andymai/gridfinity-layout-tool/issues/629)) ([f5fb107](https://github.com/andymai/gridfinity-layout-tool/commit/f5fb107a0f9a8e888f6dee004dfe8b5bd1c378f2))

## [2.30.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.29.0...gridfinity-layout-tool-v2.30.0) (2026-02-06)

### Features

- add AbortSignal cancellation for mid-operation generation abort ([#640](https://github.com/andymai/gridfinity-layout-tool/issues/640)) ([ac1cb55](https://github.com/andymai/gridfinity-layout-tool/commit/ac1cb550102caf3855985848a286fa7f40e0f242))

## [2.29.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.28.0...gridfinity-layout-tool-v2.29.0) (2026-02-06)

### Features

- indexed mesh wire format ([#639](https://github.com/andymai/gridfinity-layout-tool/issues/639)) ([17de936](https://github.com/andymai/gridfinity-layout-tool/commit/17de9363f10b44ce9516ef2ea9739be867a1b780))

## [2.28.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.27.1...gridfinity-layout-tool-v2.28.0) (2026-02-05)

### Features

- auto-enable half-bin mode on fractional grid input ([#634](https://github.com/andymai/gridfinity-layout-tool/issues/634)) ([908cc5b](https://github.com/andymai/gridfinity-layout-tool/commit/908cc5bee1649ebb9f6f86769c158808284b58ac))

### Bug Fixes

- widen onRemediate prop type to accept sync callbacks ([#637](https://github.com/andymai/gridfinity-layout-tool/issues/637)) ([df0ece3](https://github.com/andymai/gridfinity-layout-tool/commit/df0ece38a421326c5515ce67c2314f424a754d29))

## [2.27.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.27.0...gridfinity-layout-tool-v2.27.1) (2026-02-05)

### Bug Fixes

- allow clicking export file name to edit it directly ([#632](https://github.com/andymai/gridfinity-layout-tool/issues/632)) ([4d99a1b](https://github.com/andymai/gridfinity-layout-tool/commit/4d99a1b16673337abd28b45535ddc314fc5d42c3))

## [2.27.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.26.0...gridfinity-layout-tool-v2.27.0) (2026-02-05)

### Features

- increase max bin dimensions from 8x8 to 16x16 ([#630](https://github.com/andymai/gridfinity-layout-tool/issues/630)) ([06b4a1a](https://github.com/andymai/gridfinity-layout-tool/commit/06b4a1ac55d9943c64ff6d9d5977c934c8715058))

## [2.26.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.25.0...gridfinity-layout-tool-v2.26.0) (2026-02-05)

### Features

- remove expanded bin list modal feature ([bfa0c08](https://github.com/andymai/gridfinity-layout-tool/commit/bfa0c0859b8fbff573e7ec1f17d53e3c537b7f92))
- remove expanded bin list modal feature ([#626](https://github.com/andymai/gridfinity-layout-tool/issues/626)) ([1c1a321](https://github.com/andymai/gridfinity-layout-tool/commit/1c1a321158b543e40435c386407525a73f83f375))

### Bug Fixes

- pass gridUnitMm and categories to mobile TSV export ([6d86076](https://github.com/andymai/gridfinity-layout-tool/commit/6d86076a26ce58bc42cd7b4b33cd6c11caa68baa))

## [2.25.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.24.0...gridfinity-layout-tool-v2.25.0) (2026-02-05)

### Features

- add solid parameter to BaseConfig for future cutouts support ([#624](https://github.com/andymai/gridfinity-layout-tool/issues/624)) ([9a9ecad](https://github.com/andymai/gridfinity-layout-tool/commit/9a9ecade822cf58ff8087c93898bc2b89a02d77a))

## [2.24.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.23.0...gridfinity-layout-tool-v2.24.0) (2026-02-05)

### Features

- add flat floor (no socket) base option to bin designer ([#621](https://github.com/andymai/gridfinity-layout-tool/issues/621)) ([f3bdaa6](https://github.com/andymai/gridfinity-layout-tool/commit/f3bdaa6e80d5e4a4ef3640109e4a31e7f8add50e))

## [2.23.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.22.1...gridfinity-layout-tool-v2.23.0) (2026-02-04)

### Features

- add design system with CVA-based component architecture ([#618](https://github.com/andymai/gridfinity-layout-tool/issues/618)) ([91ae9a3](https://github.com/andymai/gridfinity-layout-tool/commit/91ae9a3c2619dab3bf178686eefbb43772e66668))

## [2.22.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.22.0...gridfinity-layout-tool-v2.22.1) (2026-02-04)

### Bug Fixes

- inset focus rings, pattern registry fallback, and honeycomb icon ([#616](https://github.com/andymai/gridfinity-layout-tool/issues/616)) ([01bcd00](https://github.com/andymai/gridfinity-layout-tool/commit/01bcd0049799c16d613c0e7e04901f43f75f9b13))

## [2.22.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.21.2...gridfinity-layout-tool-v2.22.0) (2026-02-04)

### Features

- **bin-designer:** pattern registry architecture and dropdown UI ([#614](https://github.com/andymai/gridfinity-layout-tool/issues/614)) ([d68158b](https://github.com/andymai/gridfinity-layout-tool/commit/d68158b1f37aed1e858418f0fa9ac5ae6b7e11e5))

## [2.21.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.21.1...gridfinity-layout-tool-v2.21.2) (2026-02-04)

### Performance

- optimize 3D preview rendering and grid computations ([#612](https://github.com/andymai/gridfinity-layout-tool/issues/612)) ([f1c0e63](https://github.com/andymai/gridfinity-layout-tool/commit/f1c0e63dd7d10e644283b094a8af915d08d0c4ea))

## [2.21.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.21.0...gridfinity-layout-tool-v2.21.1) (2026-02-04)

### Bug Fixes

- **build:** resolve npm vulnerabilities and build warnings ([#608](https://github.com/andymai/gridfinity-layout-tool/issues/608)) ([e01c9b5](https://github.com/andymai/gridfinity-layout-tool/commit/e01c9b589699d4ae8aefbb9e162273ed0992f067))

## [2.21.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.20.1...gridfinity-layout-tool-v2.21.0) (2026-02-04)

### Features

- **generation:** rotate honeycomb hex cutouts to pointy-top orientation ([#606](https://github.com/andymai/gridfinity-layout-tool/issues/606)) ([de4a067](https://github.com/andymai/gridfinity-layout-tool/commit/de4a067183884f9ab1a8df674759668d660fa740))

## [2.20.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.20.0...gridfinity-layout-tool-v2.20.1) (2026-02-04)

### Bug Fixes

- **generation:** add mainScriptUrlOrBlob for threaded WASM module resolution ([#604](https://github.com/andymai/gridfinity-layout-tool/issues/604)) ([cc29444](https://github.com/andymai/gridfinity-layout-tool/commit/cc294444ef52a795a982a6ae02f607a306a244a6))

## [2.20.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.19.0...gridfinity-layout-tool-v2.20.0) (2026-02-04)

### Features

- **generation:** upgrade to brepjs 4.0.3 with minification-safe isShape3D ([7b540d8](https://github.com/andymai/gridfinity-layout-tool/commit/7b540d8389a5aee713596ddd1fcd12b4da199572))

## [2.19.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.18.4...gridfinity-layout-tool-v2.19.0) (2026-02-03)

### Features

- **generation:** add multi-threaded WASM support for OpenCascade ([#600](https://github.com/andymai/gridfinity-layout-tool/issues/600)) ([0a3487b](https://github.com/andymai/gridfinity-layout-tool/commit/0a3487bb9acbd65a7967c164b78041a368780354))

## [2.18.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.18.3...gridfinity-layout-tool-v2.18.4) (2026-02-03)

### Bug Fixes

- patch undici security vulnerabilities in @vercel/node ([#598](https://github.com/andymai/gridfinity-layout-tool/issues/598)) ([f254646](https://github.com/andymai/gridfinity-layout-tool/commit/f2546466675e6b36fae3eb334b7a80be13033055))

## [2.18.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.18.2...gridfinity-layout-tool-v2.18.3) (2026-02-03)

### Bug Fixes

- honeycomb wall pattern for 3u bins ([#595](https://github.com/andymai/gridfinity-layout-tool/issues/595)) ([0c80a95](https://github.com/andymai/gridfinity-layout-tool/commit/0c80a958f62922d886059c0bbeeb35f4fcfc8aae))

## [2.18.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.18.1...gridfinity-layout-tool-v2.18.2) (2026-02-03)

### Bug Fixes

- **deps:** update brepjs to v2 and fix undici peer dependency ([89fd031](https://github.com/andymai/gridfinity-layout-tool/commit/89fd031541f32eacc1a0a55a9c7ee74f41078578))

## [2.18.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.18.0...gridfinity-layout-tool-v2.18.1) (2026-02-03)

### Bug Fixes

- code review cleanup - memory leaks and error handling ([#592](https://github.com/andymai/gridfinity-layout-tool/issues/592)) ([d9ecfd4](https://github.com/andymai/gridfinity-layout-tool/commit/d9ecfd4227f2ecc5fee2a70ce6e9e86bc82f4d66))

## [2.18.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.17.0...gridfinity-layout-tool-v2.18.0) (2026-02-03)

### Features

- add honeycomb wall cutouts to bin designer ([#589](https://github.com/andymai/gridfinity-layout-tool/issues/589)) ([b5fe8a2](https://github.com/andymai/gridfinity-layout-tool/commit/b5fe8a2a2144eb60e3716b080c9c3759b6ec23c6))
- split export for oversized bins in Bin Designer ([#582](https://github.com/andymai/gridfinity-layout-tool/issues/582)) ([0283639](https://github.com/andymai/gridfinity-layout-tool/commit/028363925ff3e93581a7e5eb3e7f9633ca3de0cc))

### Performance

- cache assembled shell (base + box + lip) across generation calls ([#581](https://github.com/andymai/gridfinity-layout-tool/issues/581)) ([966d6b2](https://github.com/andymai/gridfinity-layout-tool/commit/966d6b2cb9f6aec0465ae604f5c11271d0bc0e5b))
- cache intermediate shapes across generation calls ([#580](https://github.com/andymai/gridfinity-layout-tool/issues/580)) ([ac6bdfb](https://github.com/andymai/gridfinity-layout-tool/commit/ac6bdfb52df256ff6a34aff42e130f1b2069e276))

## [2.17.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.16.0...gridfinity-layout-tool-v2.17.0) (2026-02-01)

### Features

- improve print time/filament estimates with enhanced volume calc and user settings ([#573](https://github.com/andymai/gridfinity-layout-tool/issues/573)) ([6ed6c13](https://github.com/andymai/gridfinity-layout-tool/commit/6ed6c13eb5c139644188afedc134269374058143))

## [2.16.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.15.1...gridfinity-layout-tool-v2.16.0) (2026-02-01)

### Features

- add i18n untranslated values check and translate ~1,200 locale strings ([#571](https://github.com/andymai/gridfinity-layout-tool/issues/571)) ([78407b4](https://github.com/andymai/gridfinity-layout-tool/commit/78407b4de0ff9eaef4b55d97c67369891b20f2bb))

## [2.15.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.15.0...gridfinity-layout-tool-v2.15.1) (2026-01-31)

### Bug Fixes

- shorten divider length to prevent bowing and align lip with gridfinity spec ([e55dc1c](https://github.com/andymai/gridfinity-layout-tool/commit/e55dc1c4666c5e4b0dd3da2cf0a7c612cd6bbba5))
- shorten divider length to prevent bowing, align lip with gridfinity spec ([#569](https://github.com/andymai/gridfinity-layout-tool/issues/569)) ([002d1c5](https://github.com/andymai/gridfinity-layout-tool/commit/002d1c5dd563d5a4ba1b1f47d7dfdadf8590e936))

## [2.15.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.14.1...gridfinity-layout-tool-v2.15.0) (2026-01-31)

### Features

- add branded ID types for compile-time type safety ([7918752](https://github.com/andymai/gridfinity-layout-tool/commit/791875291220fefb0301caa6ab953a8356dc0dcf))
- branded ID types for compile-time type safety ([#567](https://github.com/andymai/gridfinity-layout-tool/issues/567)) ([cee698c](https://github.com/andymai/gridfinity-layout-tool/commit/cee698ca3ba0e6020b6c2e6d64f0e3b879a3932f))

## [2.14.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.14.0...gridfinity-layout-tool-v2.14.1) (2026-01-31)

### Bug Fixes

- resolve ESLint errors and add missing tests ([#563](https://github.com/andymai/gridfinity-layout-tool/issues/563)) ([485f776](https://github.com/andymai/gridfinity-layout-tool/commit/485f776c0e2cd4ffc7ae20189e8d51c9c267f472))

## [2.14.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.13.1...gridfinity-layout-tool-v2.14.0) (2026-01-31)

### Features

- **seo:** dynamic meta tags + server-side bot OG injection ([#559](https://github.com/andymai/gridfinity-layout-tool/issues/559)) ([f765bdb](https://github.com/andymai/gridfinity-layout-tool/commit/f765bdb5f6e59b41472df350ebb8ec59a25b6cd1))

## [2.13.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.13.0...gridfinity-layout-tool-v2.13.1) (2026-01-31)

### Bug Fixes

- **seo:** shorten meta descriptions to 100-130 characters ([#556](https://github.com/andymai/gridfinity-layout-tool/issues/556)) ([8cba243](https://github.com/andymai/gridfinity-layout-tool/commit/8cba2432429538042cb7822a82431db57f970033))

## [2.13.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.12.0...gridfinity-layout-tool-v2.13.0) (2026-01-31)

### Features

- prefetch lazy-loaded chunks during browser idle time ([#553](https://github.com/andymai/gridfinity-layout-tool/issues/553)) ([fcf2790](https://github.com/andymai/gridfinity-layout-tool/commit/fcf279085bd877e8e1b265fc22dc4fd7c8869342))

## [2.12.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.11.1...gridfinity-layout-tool-v2.12.0) (2026-01-31)

### Features

- **i18n:** localize bin designer loading messages ([#551](https://github.com/andymai/gridfinity-layout-tool/issues/551)) ([83364ea](https://github.com/andymai/gridfinity-layout-tool/commit/83364ea05e860b7e4f9a3636295e73fd9b2cba88))

## [2.11.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.11.0...gridfinity-layout-tool-v2.11.1) (2026-01-31)

### Bug Fixes

- bin designer UI fixes and remove JSON export from export modal ([#548](https://github.com/andymai/gridfinity-layout-tool/issues/548)) ([9bf5a89](https://github.com/andymai/gridfinity-layout-tool/commit/9bf5a8986f74dedf06198b610fc0aebc8a09dee4))

## [2.11.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.10.1...gridfinity-layout-tool-v2.11.0) (2026-01-31)

### Features

- improve divider export with descriptive filenames ([fd78b59](https://github.com/andymai/gridfinity-layout-tool/commit/fd78b5931edc64e8b3ac1790b12b72a5db1399df))
- show disabled label tabs with explanation instead of hiding ([72b3779](https://github.com/andymai/gridfinity-layout-tool/commit/72b3779048b3da4cc7829111a71fd212e5ade6cb))
- slotted bin style with removable dividers and reference preview ([52fa740](https://github.com/andymai/gridfinity-layout-tool/commit/52fa740c708817c0a8116810835032daa7bd36be))

### Bug Fixes

- address PR review comments ([ef7e21b](https://github.com/andymai/gridfinity-layout-tool/commit/ef7e21b288d863559085f70e7aa08f64c58911e2))
- divider height stepper stuck after decreasing from auto ([36815f9](https://github.com/andymai/gridfinity-layout-tool/commit/36815f922bfff88e0e4250411b9ff5c928eaa717))
- make direction toggle compact and inline ([2f4cc14](https://github.com/andymai/gridfinity-layout-tool/commit/2f4cc14c245f54067ee0b2e643e56cb3e69467f2))
- orient divider STL flat for FDM printing ([7cfb643](https://github.com/andymai/gridfinity-layout-tool/commit/7cfb643f8a44475eb48aa6aad2050096d62fad6b))
- rename slot spacing to compartment width for clarity ([1cf2b3b](https://github.com/andymai/gridfinity-layout-tool/commit/1cf2b3b328cb9b014b776682b1d2149b95913178))
- start wall slot cuts at floor surface, not socket interface ([d006f59](https://github.com/andymai/gridfinity-layout-tool/commit/d006f59c8a1ec28c66e397a2f851987040110bff))

## [2.10.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.10.0...gridfinity-layout-tool-v2.10.1) (2026-01-31)

### Bug Fixes

- add explicit permissions to release workflow ([#544](https://github.com/andymai/gridfinity-layout-tool/issues/544)) ([b62ed09](https://github.com/andymai/gridfinity-layout-tool/commit/b62ed0911f232520619056f0fec7d6a9e8470b00))

## [2.10.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.9.0...gridfinity-layout-tool-v2.10.0) (2026-01-31)

### Features

- add unused i18n key detection script ([#541](https://github.com/andymai/gridfinity-layout-tool/issues/541)) ([94a706b](https://github.com/andymai/gridfinity-layout-tool/commit/94a706ba74e6a55610297c37e7a78349dad7fe92))

## [2.9.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.8.0...gridfinity-layout-tool-v2.9.0) (2026-01-31)

### Features

- rename Grid Editor to Grid Planner and localize help modal ([#538](https://github.com/andymai/gridfinity-layout-tool/issues/538)) ([34e8484](https://github.com/andymai/gridfinity-layout-tool/commit/34e848446af3e3e2a655458df6b699c959f80e04))

## [2.8.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.7.1...gridfinity-layout-tool-v2.8.0) (2026-01-31)

### Features

- label tab support style and ghost previews ([#534](https://github.com/andymai/gridfinity-layout-tool/issues/534)) ([9a42fbe](https://github.com/andymai/gridfinity-layout-tool/commit/9a42fbe88bedc8dea567abb87a7f43beb44bd2a3))

## [2.7.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.7.0...gridfinity-layout-tool-v2.7.1) (2026-01-31)

### Bug Fixes

- tighten component structure hook regex and folder rule ([#529](https://github.com/andymai/gridfinity-layout-tool/issues/529)) ([6073aa8](https://github.com/andymai/gridfinity-layout-tool/commit/6073aa834f3cc044e39174afc65b9236627d3fc6))

## [2.7.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.6.0...gridfinity-layout-tool-v2.7.0) (2026-01-31)

### Features

- redesign Settings Modal with tabbed navigation ([#530](https://github.com/andymai/gridfinity-layout-tool/issues/530)) ([2a98a33](https://github.com/andymai/gridfinity-layout-tool/commit/2a98a333ec7bee54ab2193078bfc8830673ba911))

## [2.6.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.5.0...gridfinity-layout-tool-v2.6.0) (2026-01-31)

### Features

- add label tab style choice (bracket/solid) and redesign panel ([#531](https://github.com/andymai/gridfinity-layout-tool/issues/531)) ([2d8aa6d](https://github.com/andymai/gridfinity-layout-tool/commit/2d8aa6d09b5a86fab594fa290d59c231ecc50475))

## [2.5.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.4.0...gridfinity-layout-tool-v2.5.0) (2026-01-30)

### Features

- add Norwegian Bokmål (nb) localization ([#525](https://github.com/andymai/gridfinity-layout-tool/issues/525)) ([13c45c3](https://github.com/andymai/gridfinity-layout-tool/commit/13c45c3f2b2baf5bb533e02191a264df59b5d2c0))

## [2.4.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.3.1...gridfinity-layout-tool-v2.4.0) (2026-01-30)

### Features

- add GitHub star link to header, sidebar, and mobile views ([#523](https://github.com/andymai/gridfinity-layout-tool/issues/523)) ([6372be5](https://github.com/andymai/gridfinity-layout-tool/commit/6372be52f630e2c0fc5abaf3b164062946968bdb))

## [2.3.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.3.0...gridfinity-layout-tool-v2.3.1) (2026-01-30)

### Bug Fixes

- remove mobile ToolSwitcher and prevent 3D toggle zoom reset ([#521](https://github.com/andymai/gridfinity-layout-tool/issues/521)) ([04ef45b](https://github.com/andymai/gridfinity-layout-tool/commit/04ef45b60731af2be9726aae7bec65160e3e7988))

## [2.3.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.2.0...gridfinity-layout-tool-v2.3.0) (2026-01-30)

### Features

- enrich PostHog tracking with context, failure, and discovery events ([#517](https://github.com/andymai/gridfinity-layout-tool/issues/517)) ([d617109](https://github.com/andymai/gridfinity-layout-tool/commit/d61710977054fc8ea77f3d87bd0fc5305a50367c))

## [2.2.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.1.0...gridfinity-layout-tool-v2.2.0) (2026-01-30)

### Features

- add first-visit onboarding welcome flow ([#516](https://github.com/andymai/gridfinity-layout-tool/issues/516)) ([ce8307f](https://github.com/andymai/gridfinity-layout-tool/commit/ce8307f70e76f3412b5249e9ee5fd995c286bd56))

## [2.1.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.0.4...gridfinity-layout-tool-v2.1.0) (2026-01-30)

### Features

- support single-click bin placement in paint mode ([#512](https://github.com/andymai/gridfinity-layout-tool/issues/512)) ([e6de3b4](https://github.com/andymai/gridfinity-layout-tool/commit/e6de3b4a7db9b82e03f8eff6a799f00acf7baf8a))

### Bug Fixes

- **ci:** use GITHUB_TOKEN for release PR auto-approve ([#515](https://github.com/andymai/gridfinity-layout-tool/issues/515)) ([feb2bf5](https://github.com/andymai/gridfinity-layout-tool/commit/feb2bf5da5fbee14ce32b0f3526b248d23307b0a))
- enforce minimum 2u bin height in inspector ([#513](https://github.com/andymai/gridfinity-layout-tool/issues/513)) ([fe47b23](https://github.com/andymai/gridfinity-layout-tool/commit/fe47b232f1b5b987b3209b537f087c181c7bf00b))
- use app token for release-please to trigger CI on release PRs ([#506](https://github.com/andymai/gridfinity-layout-tool/issues/506)) ([61c0de2](https://github.com/andymai/gridfinity-layout-tool/commit/61c0de2853002d7379ffd98edcb600ef3d732c22))

## [2.0.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.0.3...gridfinity-layout-tool-v2.0.4) (2026-01-30)

### Bug Fixes

- use app token and squash merge for release-please auto-merge ([#504](https://github.com/andymai/gridfinity-layout-tool/issues/504)) ([6c93d67](https://github.com/andymai/gridfinity-layout-tool/commit/6c93d675d41b6c95ff7b0436e7df58e631b2d634))

## [2.0.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.0.2...gridfinity-layout-tool-v2.0.3) (2026-01-30)

### Bug Fixes

- expand component structure hook to all components/ dirs ([#499](https://github.com/andymai/gridfinity-layout-tool/issues/499)) ([c9dc1fc](https://github.com/andymai/gridfinity-layout-tool/commit/c9dc1fc9bee2280d3938a8a056f674f786920f51))

## [2.0.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.0.1...gridfinity-layout-tool-v2.0.2) (2026-01-29)

### Bug Fixes

- auto-approve release-please PRs via GitHub App token ([#493](https://github.com/andymai/gridfinity-layout-tool/issues/493)) ([f5e404b](https://github.com/andymai/gridfinity-layout-tool/commit/f5e404b19b76c4e92e332b5b38b28aae15556155))

## [2.0.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v2.0.0...gridfinity-layout-tool-v2.0.1) (2026-01-29)

### Bug Fixes

- resolve code scanning alerts ([#492](https://github.com/andymai/gridfinity-layout-tool/issues/492)) ([e2d0441](https://github.com/andymai/gridfinity-layout-tool/commit/e2d0441d4f4f59294236accb32bfcad9a4bcc129))

## [2.0.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v1.21.0...gridfinity-layout-tool-v2.0.0) (2026-01-29)

### ⚠ BREAKING CHANGES

- All store mutations now return Result<T, E>

### Features

- add adaptive label system to staging bins ([81e79bf](https://github.com/andymai/gridfinity-layout-tool/commit/81e79bfa5bad1a96a1202ac8c0b50d0ed2d834be))
- add adaptive label system to staging bins ([895be4a](https://github.com/andymai/gridfinity-layout-tool/commit/895be4a201a4b660d12203a84f11b999c6d6a267))
- add Alt+drag to duplicate bins ([838901d](https://github.com/andymai/gridfinity-layout-tool/commit/838901db6ebc9bfbaf8922d28e92bb1b2f4cc86f))
- add Alt+drag to duplicate bins ([00939c1](https://github.com/andymai/gridfinity-layout-tool/commit/00939c19ef1e1472e2d6708dac28a2dafbee86bd))
- add banana for scale in 3D preview ([#476](https://github.com/andymai/gridfinity-layout-tool/issues/476)) ([ec08c32](https://github.com/andymai/gridfinity-layout-tool/commit/ec08c32635f58170e00df35944722bfeba8e610f))
- add bin design JSON import/export and layout design embedding ([#465](https://github.com/andymai/gridfinity-layout-tool/issues/465)) ([d3ed843](https://github.com/andymai/gridfinity-layout-tool/commit/d3ed84334a671588220db9744822d4a2de6ff5a9))
- add centralized test utilities for improved isolation ([fdb0657](https://github.com/andymai/gridfinity-layout-tool/commit/fdb0657cf8ff00692d663f3575ec77ee9627bc45))
- add Claude Code configuration with code-simplifier agent ([#455](https://github.com/andymai/gridfinity-layout-tool/issues/455)) ([92d28a4](https://github.com/andymai/gridfinity-layout-tool/commit/92d28a49e7a40fab74ebf70cfba85ea2c60531be))
- add Claude Code hooks for pre-PR quality checks ([#226](https://github.com/andymai/gridfinity-layout-tool/issues/226)) ([2d080b0](https://github.com/andymai/gridfinity-layout-tool/commit/2d080b0ec795145bbcf994e2764ddf25476b60ff))
- add cloud sharing to mobile and improve share UX ([9607eff](https://github.com/andymai/gridfinity-layout-tool/commit/9607efffba6864f3ace2d771322be2d950106695))
- add cloud sharing to mobile and improve share UX ([e4e743e](https://github.com/andymai/gridfinity-layout-tool/commit/e4e743ee98d8de790538f91604a10f61304c160a))
- add code quality hooks and fix detected issues ([#412](https://github.com/andymai/gridfinity-layout-tool/issues/412)) ([f71b33e](https://github.com/andymai/gridfinity-layout-tool/commit/f71b33ee451096564d4e6f87386828d0586110e7))
- add collapsible panels and compact inspector controls ([5a5580f](https://github.com/andymai/gridfinity-layout-tool/commit/5a5580f9203610daa3fe6c1b8a300182ccda1fc3))
- add command palette for action discovery (⌘K / Ctrl+K) ([#385](https://github.com/andymai/gridfinity-layout-tool/issues/385)) ([0dea030](https://github.com/andymai/gridfinity-layout-tool/commit/0dea030216098786223c3bdd687c8702930602f5))
- add configurable fractional edge positions ([01a3d6d](https://github.com/andymai/gridfinity-layout-tool/commit/01a3d6dc91912904b4634012536c05a6c40640a7))
- add default layer height user preference ([2538fa1](https://github.com/andymai/gridfinity-layout-tool/commit/2538fa1ede1ccd303b4559696cdd6fd09dd289bf))
- add default layer height user preference ([a66aee4](https://github.com/andymai/gridfinity-layout-tool/commit/a66aee45c6111f0f5991572c877be1a2487e0d6c))
- add design-linking feature for bin-designer integration ([#456](https://github.com/andymai/gridfinity-layout-tool/issues/456)) ([df13d04](https://github.com/andymai/gridfinity-layout-tool/commit/df13d04b84f4395cd8c610c7118b760137888a3f))
- add e2e test utilities for improved isolation ([61ae65b](https://github.com/andymai/gridfinity-layout-tool/commit/61ae65b53c7aabb721a881f706ccd6d743325daf))
- add event listeners for command palette actions ([#404](https://github.com/andymai/gridfinity-layout-tool/issues/404)) ([295e69e](https://github.com/andymai/gridfinity-layout-tool/commit/295e69ead462eafc01d7e539365990c856d0cc4c))
- add expand/collapse functionality to stash ([#221](https://github.com/andymai/gridfinity-layout-tool/issues/221)) ([2f43daf](https://github.com/andymai/gridfinity-layout-tool/commit/2f43daf018414fe476bbcda90258ca59759b0099))
- add expanded bin list modal with dashboard and bulk operations ([32696ad](https://github.com/andymai/gridfinity-layout-tool/commit/32696ad8e80f6f3f09f2b45cd87984583a6795a9))
- add feature parity to mobile bin list ([2635af0](https://github.com/andymai/gridfinity-layout-tool/commit/2635af043892e2767e56c5c5f670fe52725d5bf1))
- add i18n localization system with 5 language translations ([#362](https://github.com/andymai/gridfinity-layout-tool/issues/362)) ([2da9584](https://github.com/andymai/gridfinity-layout-tool/commit/2da95840d6981f795345f8ce3053124f8d454016))
- add Inspiration Gallery with pre-made layouts ([#236](https://github.com/andymai/gridfinity-layout-tool/issues/236)) ([0ead9e4](https://github.com/andymai/gridfinity-layout-tool/commit/0ead9e469e46fd13ceb29311e883c4eadd832b73))
- add intelligent name suggestions for layouts ([#394](https://github.com/andymai/gridfinity-layout-tool/issues/394)) ([0f91c26](https://github.com/andymai/gridfinity-layout-tool/commit/0f91c26cc087d18731c75ee0933bfb71534ca9d2))
- add Labs feature flags system ([#129](https://github.com/andymai/gridfinity-layout-tool/issues/129)) ([4fa3538](https://github.com/andymai/gridfinity-layout-tool/commit/4fa3538e45025992466e5f8c6527d59177f8e1a5))
- add layout pattern detection for ML telemetry (PR 2) ([#243](https://github.com/andymai/gridfinity-layout-tool/issues/243)) ([c1a1ad8](https://github.com/andymai/gridfinity-layout-tool/commit/c1a1ad877597ee02d1bc3136d082189a9b9e6384))
- add ML telemetry for drawer resize, fill, layer move, rotation ([#227](https://github.com/andymai/gridfinity-layout-tool/issues/227)) ([3b18c44](https://github.com/andymai/gridfinity-layout-tool/commit/3b18c44d946d2b0b2106d88bc69e049d7d217411))
- add ML telemetry tracking for category changes and bin resizes ([#224](https://github.com/andymai/gridfinity-layout-tool/issues/224)) ([ab05983](https://github.com/andymai/gridfinity-layout-tool/commit/ab059835a0409318efb8e112d2f1886e6dbc0a8f))
- add mobile-optimized bin list with card layout ([ae19eba](https://github.com/andymai/gridfinity-layout-tool/commit/ae19eba64a0ab2f056573445777fda9d8236fec3))
- add print modal with configurable print view settings ([#81](https://github.com/andymai/gridfinity-layout-tool/issues/81)) ([f54535f](https://github.com/andymai/gridfinity-layout-tool/commit/f54535fb9ccc3eab49e48dbd21c97de9e09a1a2e))
- add Privacy Policy and Terms of Service pages ([#422](https://github.com/andymai/gridfinity-layout-tool/issues/422)) ([10dbb74](https://github.com/andymai/gridfinity-layout-tool/commit/10dbb74f0fa02ca5c12bfdb91f510a0adeeed70b))
- add quality feedback signals with confidence breakdown (ML PR 5) ([#246](https://github.com/andymai/gridfinity-layout-tool/issues/246)) ([7a2f44f](https://github.com/andymai/gridfinity-layout-tool/commit/7a2f44f38370e7488905d189f8db203f66b714d7))
- add Result-based import functions to ShareService ([#113](https://github.com/andymai/gridfinity-layout-tool/issues/113)) ([6f7d3cf](https://github.com/andymai/gridfinity-layout-tool/commit/6f7d3cfad3eaba482c7a1c62ea2838a39084c491))
- add Result-returning functions to storage migration layer ([#122](https://github.com/andymai/gridfinity-layout-tool/issues/122)) ([d38c661](https://github.com/andymai/gridfinity-layout-tool/commit/d38c66138a78e1b36adc71efcde3e10679558696))
- add Result-returning functions to useLayoutSwitcher hook ([#121](https://github.com/andymai/gridfinity-layout-tool/issues/121)) ([42be78e](https://github.com/andymai/gridfinity-layout-tool/commit/42be78ee4c7e372f7f2fc731931024eda522c12d))
- add Result-returning import/export functions ([#119](https://github.com/andymai/gridfinity-layout-tool/issues/119)) ([cd2ca17](https://github.com/andymai/gridfinity-layout-tool/commit/cd2ca17910c0500eca89d6b9369286fcbbe6b952))
- add Result-returning layout store operations ([#117](https://github.com/andymai/gridfinity-layout-tool/issues/117)) ([bb4f4a8](https://github.com/andymai/gridfinity-layout-tool/commit/bb4f4a8183743ab66d22b069928bd5e4a2ec8761))
- add Result-returning operations to remaining stores ([#120](https://github.com/andymai/gridfinity-layout-tool/issues/120)) ([752977c](https://github.com/andymai/gridfinity-layout-tool/commit/752977c66cd65f615dde0bab39b0c9bb0e31f02e))
- add Result-returning validation functions ([#118](https://github.com/andymai/gridfinity-layout-tool/issues/118)) ([cfd37c2](https://github.com/andymai/gridfinity-layout-tool/commit/cfd37c2cae63b015b51b9a484720eaf40e51394c))
- add Result&lt;T, E&gt; type system foundation ([#111](https://github.com/andymai/gridfinity-layout-tool/issues/111)) ([ce2d69d](https://github.com/andymai/gridfinity-layout-tool/commit/ce2d69d165944f65fb0a4f626446d0c3ebae6c00))
- add right-click context menu support to staging area ([70d64e3](https://github.com/andymai/gridfinity-layout-tool/commit/70d64e3fbdfea35c2f85a822c87b718a755c986c))
- add right-click context menu support to staging area ([1ab9cd4](https://github.com/andymai/gridfinity-layout-tool/commit/1ab9cd498ceeac8f386e593f8060dd6e31be845c))
- add save indicator, scroll shadows, and dual help shortcut ([8c2df70](https://github.com/andymai/gridfinity-layout-tool/commit/8c2df708ec3d4e85e8373fbae8db872af42c0dbc))
- add save indicator, scroll shadows, and dual help shortcut ([fcf57c9](https://github.com/andymai/gridfinity-layout-tool/commit/fcf57c92906a998888c6d96492a3df694043739f))
- add semantic data attributes for robust e2e testing ([577baef](https://github.com/andymai/gridfinity-layout-tool/commit/577baef9eba9442f4f0598df294b30bd515acda5))
- add semantic data attributes for robust e2e testing ([e9e8a31](https://github.com/andymai/gridfinity-layout-tool/commit/e9e8a313b4f1ccdc6a5a0438749a9b3c9b742313))
- Add Shared Collections for real-time collaboration ([#83](https://github.com/andymai/gridfinity-layout-tool/issues/83)) ([7429834](https://github.com/andymai/gridfinity-layout-tool/commit/74298343fcc66ca044523298da97573e97574379))
- add static content pages for SEO ([#232](https://github.com/andymai/gridfinity-layout-tool/issues/232)) ([0b51d4e](https://github.com/andymai/gridfinity-layout-tool/commit/0b51d4e303f6f8981ac8e3239f1e8c2deaf07c54))
- add STL search quick links for external websites ([#162](https://github.com/andymai/gridfinity-layout-tool/issues/162)) ([747e666](https://github.com/andymai/gridfinity-layout-tool/commit/747e66637e284ab99a27a6de9afc5a5305f1261a))
- add temporary Reddit feedback link to headers ([f4a2ca6](https://github.com/andymai/gridfinity-layout-tool/commit/f4a2ca6d0ed1d15d0a69430dde70711d09f0b3d9))
- add temporary Reddit feedback link to headers ([287f7aa](https://github.com/andymai/gridfinity-layout-tool/commit/287f7aa5c36bf3bb31ae28f8c0c9a6c2931ddad3))
- add test isolation audit script ([17539a4](https://github.com/andymai/gridfinity-layout-tool/commit/17539a4b01129e2958ce9e9305fd0e211ec2c797))
- add Vercel heartbeat for accurate online user tracking ([#177](https://github.com/andymai/gridfinity-layout-tool/issues/177)) ([6b8dbb3](https://github.com/andymai/gridfinity-layout-tool/commit/6b8dbb305c92e99cb89b452cfa1c7bb4e42d1702))
- add visual rotate button to stashed bins ([3d6241a](https://github.com/andymai/gridfinity-layout-tool/commit/3d6241a23f495df20a76da77849ca2f0ec9108f0))
- add visual rotate button to stashed bins ([d9f319e](https://github.com/andymai/gridfinity-layout-tool/commit/d9f319e11c342c302f06774336b86d83ace212e7))
- allow stash bins to have any height and remove auto-adjustment ([#152](https://github.com/andymai/gridfinity-layout-tool/issues/152)) ([8d287de](https://github.com/andymai/gridfinity-layout-tool/commit/8d287dee281d0d1867ff74ce74a76ad28871037f))
- **analytics:** add app_loaded event for DAU tracking ([#72](https://github.com/andymai/gridfinity-layout-tool/issues/72)) ([1e4f1ec](https://github.com/andymai/gridfinity-layout-tool/commit/1e4f1ec4576db8ca61ed4531d56b44ffe52c1982))
- **analytics:** add drawer purpose inference and cross-layout learning (PR 4) ([#245](https://github.com/andymai/gridfinity-layout-tool/issues/245)) ([c509405](https://github.com/andymai/gridfinity-layout-tool/commit/c50940582426181138bd71196e948975d863e97c))
- **analytics:** add label embedding buckets for ML training (PR 3) ([#244](https://github.com/andymai/gridfinity-layout-tool/issues/244)) ([dd71d43](https://github.com/andymai/gridfinity-layout-tool/commit/dd71d43b01b93235efcf7c07625b8d1246473cfa))
- **analytics:** add tracking for gallery, share modal, and collab sessions ([#293](https://github.com/andymai/gridfinity-layout-tool/issues/293)) ([9382d50](https://github.com/andymai/gridfinity-layout-tool/commit/9382d5028b2d30911142a7362d4b111b0b557e73))
- **analytics:** comprehensive PostHog tracking improvements ([#295](https://github.com/andymai/gridfinity-layout-tool/issues/295)) ([36ba91c](https://github.com/andymai/gridfinity-layout-tool/commit/36ba91cfbe5d1ec96a961d363b26c844b3420bc7))
- **analytics:** enable PostHog pageview and pageleave tracking ([#73](https://github.com/andymai/gridfinity-layout-tool/issues/73)) ([0cfaa35](https://github.com/andymai/gridfinity-layout-tool/commit/0cfaa3556250179763e01c599360bd3f5c4a6a85))
- **analytics:** enhance PostHog integration with error tracking and AI foundations ([#291](https://github.com/andymai/gridfinity-layout-tool/issues/291)) ([3d32f34](https://github.com/andymai/gridfinity-layout-tool/commit/3d32f344a13a004c825a11cd6f1fc84cd3061e37))
- **analytics:** integrate PostHog feature tracking and error capture ([#292](https://github.com/andymai/gridfinity-layout-tool/issues/292)) ([13bae51](https://github.com/andymai/gridfinity-layout-tool/commit/13bae513cb484cb2e49ff3d57aaff5c5cde10d36))
- **analytics:** setup PostHog Vercel reverse proxy ([bdd8eab](https://github.com/andymai/gridfinity-layout-tool/commit/bdd8eab80a80ce9e16bcf4a3a4bca235e7b8c8af))
- **bin-designer:** add 3D preview canvas with orbit controls ([#307](https://github.com/andymai/gridfinity-layout-tool/issues/307)) ([f3c5f66](https://github.com/andymai/gridfinity-layout-tool/commit/f3c5f667e5c97f127f6fb5233dc4dae9911744dd))
- **bin-designer:** add bin styles, dividers, scoops, and label geometry ([#308](https://github.com/andymai/gridfinity-layout-tool/issues/308)) ([6dff1fd](https://github.com/andymai/gridfinity-layout-tool/commit/6dff1fd833ed039a37e8833382961139301a45b8))
- **bin-designer:** add compartment grid editor and discrete wall thickness ([#338](https://github.com/andymai/gridfinity-layout-tool/issues/338)) ([bcd4a79](https://github.com/andymai/gridfinity-layout-tool/commit/bcd4a79191cea8eb01fd9b6f7b4a467834a827d9))
- **bin-designer:** add configurable wall/magnet/screw parameters ([#336](https://github.com/andymai/gridfinity-layout-tool/issues/336)) ([17a9f69](https://github.com/andymai/gridfinity-layout-tool/commit/17a9f69da141f860666230cfbb8a237efa5cee1f))
- **bin-designer:** add finger scoops UI and wall cutout geometry ([#359](https://github.com/andymai/gridfinity-layout-tool/issues/359)) ([36b26dc](https://github.com/andymai/gridfinity-layout-tool/commit/36b26dc903cfddec3cc4f0f8d12cee1462527694))
- **bin-designer:** add foundation types, store, storage, and route shell ([#304](https://github.com/andymai/gridfinity-layout-tool/issues/304)) ([6a0fe57](https://github.com/andymai/gridfinity-layout-tool/commit/6a0fe57d54fd060da4dd2f11e7f1596331fc8add))
- **bin-designer:** add generation engine with web worker bridge ([#305](https://github.com/andymai/gridfinity-layout-tool/issues/305)) ([173d62d](https://github.com/andymai/gridfinity-layout-tool/commit/173d62d799ea2fccd51132f823ecb86139e1c9d1))
- **bin-designer:** add half-bin socket support with per-cell segmented loft ([#342](https://github.com/andymai/gridfinity-layout-tool/issues/342)) ([0d171d4](https://github.com/andymai/gridfinity-layout-tool/commit/0d171d43781650fd2148e6b248928335079e2271))
- **bin-designer:** add parameter panel UI with all bin controls ([#306](https://github.com/andymai/gridfinity-layout-tool/issues/306)) ([2a39bf0](https://github.com/andymai/gridfinity-layout-tool/commit/2a39bf0a88acda663c056bb3ac32cee5d6953bf1))
- **bin-designer:** add revert button for mesh generation errors ([#369](https://github.com/andymai/gridfinity-layout-tool/issues/369)) ([cbff468](https://github.com/andymai/gridfinity-layout-tool/commit/cbff46809d67b182d3fc3dddaa1006c97cbbf6f8))
- **bin-designer:** add STL export, print estimates, and UX polish ([#309](https://github.com/andymai/gridfinity-layout-tool/issues/309)) ([f29edc9](https://github.com/andymai/gridfinity-layout-tool/commit/f29edc9726dd35ef686a75fef89fa9d3b0edc88e))
- **bin-designer:** add tool switcher segmented control in header ([#339](https://github.com/andymai/gridfinity-layout-tool/issues/339)) ([2d5806a](https://github.com/andymai/gridfinity-layout-tool/commit/2d5806a05a8b9e6df39539be1f991142c8b79acb))
- **bin-designer:** auto-save designs without explicit first save ([#453](https://github.com/andymai/gridfinity-layout-tool/issues/453)) ([4e933a4](https://github.com/andymai/gridfinity-layout-tool/commit/4e933a4d156434780d9331248f877984ff1d547d))
- **bin-designer:** editable export filenames with per-design persistence ([#352](https://github.com/andymai/gridfinity-layout-tool/issues/352)) ([3e6c898](https://github.com/andymai/gridfinity-layout-tool/commit/3e6c898aff203178b2aa1b5f71182301009f9e92))
- **bin-designer:** expand parametric model capabilities ([#331](https://github.com/andymai/gridfinity-layout-tool/issues/331)) ([941ba08](https://github.com/andymai/gridfinity-layout-tool/commit/941ba089b45aea38f945f6b66c3427a0f527c4d5))
- **bin-designer:** improve compartment editor UI and add 3D ghost preview ([#451](https://github.com/andymai/gridfinity-layout-tool/issues/451)) ([e8db40e](https://github.com/andymai/gridfinity-layout-tool/commit/e8db40e2ac56cc98154ca96e47637879b55b1685))
- **bin-designer:** improve My Designs modal with isometric thumbnails ([#454](https://github.com/andymai/gridfinity-layout-tool/issues/454)) ([f83c1eb](https://github.com/andymai/gridfinity-layout-tool/commit/f83c1eb883c5fcb458d3c5fb4047ecb0e9beab2e))
- **bin-designer:** improve rendering performance with mesh caching and on-demand rendering ([#346](https://github.com/andymai/gridfinity-layout-tool/issues/346)) ([2098701](https://github.com/andymai/gridfinity-layout-tool/commit/209870157ff8c307201dff07e5092f8787594f9d))
- **bin-designer:** improve wall thickness UI with snapping slider ([#450](https://github.com/andymai/gridfinity-layout-tool/issues/450)) ([c08c277](https://github.com/andymai/gridfinity-layout-tool/commit/c08c27714d8997aa5ca87e9ed0684d7ae8f609cd))
- **bin-designer:** inserts, sharing, batch export, layout integration & template library ([3b4459c](https://github.com/andymai/gridfinity-layout-tool/commit/3b4459c19eff60d538c3dcf72ca45fe203081b70))
- **bin-designer:** inserts, sharing, batch export, layout integration & template library ([#313](https://github.com/andymai/gridfinity-layout-tool/issues/313)) ([3b4459c](https://github.com/andymai/gridfinity-layout-tool/commit/3b4459c19eff60d538c3dcf72ca45fe203081b70))
- **bin-designer:** overhaul 3D preview to match layout tool style ([#333](https://github.com/andymai/gridfinity-layout-tool/issues/333)) ([a94c507](https://github.com/andymai/gridfinity-layout-tool/commit/a94c507f4aac6fd04bf6a4249727dbdbed694c4d))
- **bin-designer:** overhaul My Designs modal with grid/list view and search ([c2575ff](https://github.com/andymai/gridfinity-layout-tool/commit/c2575ff6d42be7957e0dfa5e0f425c7cf65d2940))
- **bin-designer:** redesign compartment editor UX and visuals ([#348](https://github.com/andymai/gridfinity-layout-tool/issues/348)) ([ab72238](https://github.com/andymai/gridfinity-layout-tool/commit/ab7223814304cdd09cc6131dffb83d1bd0477910))
- **bin-designer:** redesign parameter panel and enhance 3D preview ([#344](https://github.com/andymai/gridfinity-layout-tool/issues/344)) ([973d0e1](https://github.com/andymai/gridfinity-layout-tool/commit/973d0e1d4beb53cdc2969c9bde75131603d29012))
- **categories:** streamline edit UI with auto-save and quick actions ([#376](https://github.com/andymai/gridfinity-layout-tool/issues/376)) ([67a344f](https://github.com/andymai/gridfinity-layout-tool/commit/67a344f645b77c3cf09b06713838393dd606c35f))
- **collab:** add presence awareness with cursor labels and operation ghosts ([#135](https://github.com/andymai/gridfinity-layout-tool/issues/135)) ([4d71d57](https://github.com/andymai/gridfinity-layout-tool/commit/4d71d57fba4a9d56e925661025232beea6387542))
- **collab:** add selection rings, activity labels, and polished ghost previews ([#137](https://github.com/andymai/gridfinity-layout-tool/issues/137)) ([4aeb489](https://github.com/andymai/gridfinity-layout-tool/commit/4aeb489a55578fe0f9c6a6d226327888d5cc2b20))
- **collab:** smooth pixel-perfect cursor movement ([#136](https://github.com/andymai/gridfinity-layout-tool/issues/136)) ([38fe2ac](https://github.com/andymai/gridfinity-layout-tool/commit/38fe2ac69865c98794f6003dd74b0a77d07638e6))
- collapsible panels, compact inspector, and bin rotate command ([9547e36](https://github.com/andymai/gridfinity-layout-tool/commit/9547e36f8f603886a417b97b033284c353bbcad1))
- **command-palette:** add 10 new commands for common operations ([#392](https://github.com/andymai/gridfinity-layout-tool/issues/392)) ([3725675](https://github.com/andymai/gridfinity-layout-tool/commit/3725675abbbd41b8fc86ad094065881fd8252153))
- default bin designer on, Shift+D toggle, shared overlays, UX fixes ([#466](https://github.com/andymai/gridfinity-layout-tool/issues/466)) ([7507d2c](https://github.com/andymai/gridfinity-layout-tool/commit/7507d2c35535472f96007daf053da15a5178df4d))
- **design-linking:** polish UI with search, indicators, and compact layouts ([#458](https://github.com/andymai/gridfinity-layout-tool/issues/458)) ([6cf3378](https://github.com/andymai/gridfinity-layout-tool/commit/6cf3378c832eb0a9bee3994fed2fa8aa2a6e6982))
- enable stash bin selection, rotation, and editing ([e3f8424](https://github.com/andymai/gridfinity-layout-tool/commit/e3f84242f8ea3892a429599bee8e4c2e26b0931d))
- Enable stash bin selection, rotation, and editing ([7a70ffa](https://github.com/andymai/gridfinity-layout-tool/commit/7a70ffae75c2e7c17d9983d9279ff8b218a89f1c))
- enforce share permissions in Liveblocks auth endpoint ([#303](https://github.com/andymai/gridfinity-layout-tool/issues/303)) ([50d6088](https://github.com/andymai/gridfinity-layout-tool/commit/50d6088b68692c818593d5491e6fdc75c5d09bce))
- enhance command palette with frecency ranking and footer hints ([#387](https://github.com/andymai/gridfinity-layout-tool/issues/387)) ([94268ee](https://github.com/andymai/gridfinity-layout-tool/commit/94268ee7d7a7c11b8cf6f47cf424b6684b4377a4))
- expand physical units by default on desktop ([35cf45d](https://github.com/andymai/gridfinity-layout-tool/commit/35cf45dcb2fd049e5eef287b92a61c061a4df494))
- expand physical units by default on desktop ([ac4f727](https://github.com/andymai/gridfinity-layout-tool/commit/ac4f727dfc01cfa190dcc57f7d1de38ca0866cbc))
- **export:** add layout name and grid size columns to TSV/CSV exports ([#153](https://github.com/andymai/gridfinity-layout-tool/issues/153)) ([1d4cfcc](https://github.com/andymai/gridfinity-layout-tool/commit/1d4cfcc66716d5111d807aa2c8955655594c9439))
- highlight bins on row/column label hover ([5a05a15](https://github.com/andymai/gridfinity-layout-tool/commit/5a05a15613218de560b15ef68d87ebaba4e1f9f6))
- highlight bins on row/column label hover ([b092b0f](https://github.com/andymai/gridfinity-layout-tool/commit/b092b0fb5e2e177ce35f4ae0da32e373af0ee582))
- **i18n:** add interpolation mismatch checker and fix all issues ([#405](https://github.com/andymai/gridfinity-layout-tool/issues/405)) ([157228e](https://github.com/andymai/gridfinity-layout-tool/commit/157228e7232b08fb154cb56d560b454f34c73917))
- **i18n:** add SEO meta tag localization ([#372](https://github.com/andymai/gridfinity-layout-tool/issues/372)) ([7a62303](https://github.com/andymai/gridfinity-layout-tool/commit/7a6230372e0a18b3d9d17ebe3c3236e129b4623d))
- improve collection UX with invite prompt and always-visible tab ([#86](https://github.com/andymai/gridfinity-layout-tool/issues/86)) ([6b38b28](https://github.com/andymai/gridfinity-layout-tool/commit/6b38b28f025403d1cdd44d7fd554cab5b1b046ec))
- improve Layout Manager Modal design consistency ([d4b1b20](https://github.com/andymai/gridfinity-layout-tool/commit/d4b1b20fe15c32df82d2a797a479726f9ed60b36))
- improve Layout Manager Modal design consistency ([60b5344](https://github.com/andymai/gridfinity-layout-tool/commit/60b5344f2e1dfeec79060e2fd3660851920fdbd4))
- improve print feature with dynamic grid sizing and header controls ([#107](https://github.com/andymai/gridfinity-layout-tool/issues/107)) ([8f9384a](https://github.com/andymai/gridfinity-layout-tool/commit/8f9384a13012784b8dce54cd171e3c3bcd2aa9ba))
- improve SEO ranking with enhanced structured data and meta tags ([#230](https://github.com/andymai/gridfinity-layout-tool/issues/230)) ([800e2b0](https://github.com/andymai/gridfinity-layout-tool/commit/800e2b0788028dcc68135bfad5d8e00cc5659176))
- improve service worker with idle-aware updates and offline support ([fa5fb2c](https://github.com/andymai/gridfinity-layout-tool/commit/fa5fb2c88fafd88dc414693ccbff97ed871f60d2))
- increase undo history limit from 50 to 100 states ([#383](https://github.com/andymai/gridfinity-layout-tool/issues/383)) ([39cbbe1](https://github.com/andymai/gridfinity-layout-tool/commit/39cbbe172b8d81fd1650f26ae905f77d2eb34777))
- **labs:** enable collaborative editing as toggleable experiment ([#130](https://github.com/andymai/gridfinity-layout-tool/issues/130)) ([2936098](https://github.com/andymai/gridfinity-layout-tool/commit/29360980446064d6bb6652f28a03012bfd1eee77))
- **layers:** auto-expand layer height when adding new layer ([#416](https://github.com/andymai/gridfinity-layout-tool/issues/416)) ([e8bb393](https://github.com/andymai/gridfinity-layout-tool/commit/e8bb3932f9a02c1a91e0034eed39385d12ef1fed))
- **layout-manager:** add grid view with thumbnail labels ([#395](https://github.com/andymai/gridfinity-layout-tool/issues/395)) ([829d7ac](https://github.com/andymai/gridfinity-layout-tool/commit/829d7ac56302abc8486bce5865c139d96b6a3011))
- migrate API layer to Result type system ([#114](https://github.com/andymai/gridfinity-layout-tool/issues/114)) ([84e386d](https://github.com/andymai/gridfinity-layout-tool/commit/84e386daa45712103d35e9f8704f9489066f23a8))
- migrate storage layer to Result-based error handling ([#112](https://github.com/andymai/gridfinity-layout-tool/issues/112)) ([7bd2552](https://github.com/andymai/gridfinity-layout-tool/commit/7bd25529a75ced40f3bea84db7a4363ff39048b1))
- ML negative signal tracking for bin prediction training ([#228](https://github.com/andymai/gridfinity-layout-tool/issues/228)) ([47b11e9](https://github.com/andymai/gridfinity-layout-tool/commit/47b11e956780863444cbca10253b9b230827cd84))
- ML telemetry for bin deletion and move events ([#225](https://github.com/andymai/gridfinity-layout-tool/issues/225)) ([5195383](https://github.com/andymai/gridfinity-layout-tool/commit/51953839e562fce7c5e312979a3338f5e1053fba))
- ML telemetry system for bin prediction training ([#220](https://github.com/andymai/gridfinity-layout-tool/issues/220)) ([a619d87](https://github.com/andymai/gridfinity-layout-tool/commit/a619d87b4c8bc7b3650a36ceb8c662fd32b2aaf8))
- **ml:** add session workflow metrics for ML training ([#242](https://github.com/andymai/gridfinity-layout-tool/issues/242)) ([2e766bc](https://github.com/andymai/gridfinity-layout-tool/commit/2e766bc8b3f18a8d44b1de5205c163fb091824c2))
- **ml:** add temporal patterns and structure clustering (PR 6) ([#247](https://github.com/andymai/gridfinity-layout-tool/issues/247)) ([4b72074](https://github.com/andymai/gridfinity-layout-tool/commit/4b720741350d3f90c6b3fff4dafd6d84619f8c9d))
- mobile-optimized bin list with card layout ([6b449b3](https://github.com/andymai/gridfinity-layout-tool/commit/6b449b37f4c585a76d48adbbd4b7486aac8f2762))
- **mobile:** add stepper controls for grid width/depth dimensions ([ee1238a](https://github.com/andymai/gridfinity-layout-tool/commit/ee1238a184f2dd74b06556725a36a070318db569))
- **mobile:** add stepper UI to bin Width/Depth and darken drawer inputs ([#156](https://github.com/andymai/gridfinity-layout-tool/issues/156)) ([51ae566](https://github.com/andymai/gridfinity-layout-tool/commit/51ae566da18a080ce29ddade7052e8dcf0840183))
- overhaul layout manager modal UX ([e67d974](https://github.com/andymai/gridfinity-layout-tool/commit/e67d9746d28dd719c75b37885a7322999804de9a))
- preserve UI state across PWA updates ([#102](https://github.com/andymai/gridfinity-layout-tool/issues/102)) ([0f61dfd](https://github.com/andymai/gridfinity-layout-tool/commit/0f61dfdad83b7fed4a01090f2092c0945a6ab4c2))
- **preview:** add ghost wireframe for bin dimension changes ([#439](https://github.com/andymai/gridfinity-layout-tool/issues/439)) ([a1d9764](https://github.com/andymai/gridfinity-layout-tool/commit/a1d97644e384d0103e7ec4f475066e94084fd9e3))
- **print-export:** consolidate bins with same dimensions and labels in TSV/CSV export ([#413](https://github.com/andymai/gridfinity-layout-tool/issues/413)) ([51746c2](https://github.com/andymai/gridfinity-layout-tool/commit/51746c2453b3c6752992c74fb90cf08d9b5c8fe8))
- **print:** redesign print list footer with improved hierarchy ([#410](https://github.com/andymai/gridfinity-layout-tool/issues/410)) ([1881ef2](https://github.com/andymai/gridfinity-layout-tool/commit/1881ef24580679cc817c7c1144233e3220d49213))
- redesign mobile layers panel with tabbed UI ([635090b](https://github.com/andymai/gridfinity-layout-tool/commit/635090bd993cf484580154326c3631155f47f789))
- redesign mobile layers panel with tabbed UI ([2af83e0](https://github.com/andymai/gridfinity-layout-tool/commit/2af83e000e824bf789c05f88521c35ae24def03c))
- remove collection feature and PartyKit integration ([#105](https://github.com/andymai/gridfinity-layout-tool/issues/105)) ([e8f4a1a](https://github.com/andymai/gridfinity-layout-tool/commit/e8f4a1a2ce0f3a68571dd7e2a9b87a81e0574703))
- **result:** complete Phase 2 Result type audit and documentation ([#290](https://github.com/andymai/gridfinity-layout-tool/issues/290)) ([41a32bf](https://github.com/andymai/gridfinity-layout-tool/commit/41a32bf73faee4a1e29f7540316c7ed88765d134))
- **settings:** add option to save categories as default for new layouts ([#415](https://github.com/andymai/gridfinity-layout-tool/issues/415)) ([4e43d95](https://github.com/andymai/gridfinity-layout-tool/commit/4e43d95284f48869b996ee08d548503bf80fb4d5))
- show 3D preview thumbnails in design cards ([#461](https://github.com/andymai/gridfinity-layout-tool/issues/461)) ([11aed9b](https://github.com/andymai/gridfinity-layout-tool/commit/11aed9bfbbbc8cc50748dc3679b5818860f90353))
- smart rotation and bin swap UX improvements ([#384](https://github.com/andymai/gridfinity-layout-tool/issues/384)) ([9133b00](https://github.com/andymai/gridfinity-layout-tool/commit/9133b0003310e9e49b34aacadeb1f193806e182c))
- **staging:** resizable stash panel with max-height constraint ([#379](https://github.com/andymai/gridfinity-layout-tool/issues/379)) ([a121285](https://github.com/andymai/gridfinity-layout-tool/commit/a12128500b07cef62cf3a8ca5abd51ed9e9089bc))
- **staging:** smart bin clustering and responsive stash width ([#381](https://github.com/andymai/gridfinity-layout-tool/issues/381)) ([fa2435a](https://github.com/andymai/gridfinity-layout-tool/commit/fa2435a241d95dfe067b1522ea1f9a65c88207f4))
- **storage:** atomic storage API for layout operations ([#151](https://github.com/andymai/gridfinity-layout-tool/issues/151)) ([8a9f9da](https://github.com/andymai/gridfinity-layout-tool/commit/8a9f9da71f8cec730fcc919d5222c5f0e6cb7299))
- support fractional drawer dimensions and improve bin handles ([a1b9919](https://github.com/andymai/gridfinity-layout-tool/commit/a1b9919d9386bbb9e09e5e7aaa249c1e898c965a))
- support fractional drawer dimensions and improve bin handles ([3fd8536](https://github.com/andymai/gridfinity-layout-tool/commit/3fd853635f59319c3c7d691f87b6c258611cc6ae))
- **telemetry:** enhance ML telemetry with context and negative signals ([#266](https://github.com/andymai/gridfinity-layout-tool/issues/266)) ([3e06603](https://github.com/andymai/gridfinity-layout-tool/commit/3e06603500dcbf0cf76f35b778b594be178a0451))
- **ui:** add hover-revealed edit icon to category rows ([#140](https://github.com/andymai/gridfinity-layout-tool/issues/140)) ([6d6f3fd](https://github.com/andymai/gridfinity-layout-tool/commit/6d6f3fdd420fd4990393f452f4c5e37acd0b90b3))
- **ux:** improve blocked zone feedback during bin placement ([#411](https://github.com/andymai/gridfinity-layout-tool/issues/411)) ([afb3ec4](https://github.com/andymai/gridfinity-layout-tool/commit/afb3ec4d12b1e24f6197c8f470e8a058ecc9dbe2))

### Bug Fixes

- **a11y:** add focus-visible rings to collapsible toggle buttons ([#330](https://github.com/andymai/gridfinity-layout-tool/issues/330)) ([2649979](https://github.com/andymai/gridfinity-layout-tool/commit/2649979ec0fdcf317f2a0337d72a8bd4c25b129f))
- **a11y:** respect prefers-reduced-motion across all animations ([#327](https://github.com/andymai/gridfinity-layout-tool/issues/327)) ([393590c](https://github.com/andymai/gridfinity-layout-tool/commit/393590c9691a34a5ee6c1b45e7bcdcb221c2aebf))
- add afterEach cleanup to all e2e tests ([e88ac73](https://github.com/andymai/gridfinity-layout-tool/commit/e88ac7348a989f52ee552022d4415119d8289fea))
- add defensive null checks for row.labels/categoryIds access ([#104](https://github.com/andymai/gridfinity-layout-tool/issues/104)) ([ec453f4](https://github.com/andymai/gridfinity-layout-tool/commit/ec453f481446de4d4cbac058dd559aa181d81158))
- add fractionalEdgeX/Y support to updateDrawer ([7e58160](https://github.com/andymai/gridfinity-layout-tool/commit/7e581605d79ad3d5760d62ec6a3dc488b7919864))
- add missing afterEach cleanup to component tests ([b05860b](https://github.com/andymai/gridfinity-layout-tool/commit/b05860be93ba031db61571b1f8ae2fef66cf7aea))
- add missing ML telemetry tracking for label updates and exports ([#223](https://github.com/andymai/gridfinity-layout-tool/issues/223)) ([f863884](https://github.com/andymai/gridfinity-layout-tool/commit/f86388462c38a5bc516c832650aac8c47df1815b))
- add missing party name to PartySocket connection ([#98](https://github.com/andymai/gridfinity-layout-tool/issues/98)) ([0d943d4](https://github.com/andymai/gridfinity-layout-tool/commit/0d943d4542b33f7120c0503ea227b06329fb8551))
- add missing quick correction tracking for resize and delete ([#250](https://github.com/andymai/gridfinity-layout-tool/issues/250)) ([a0a9597](https://github.com/andymai/gridfinity-layout-tool/commit/a0a9597f344360b663b0fd87fdecc69a481065ee))
- add PNG favicon for Google search results ([#69](https://github.com/andymai/gridfinity-layout-tool/issues/69)) ([0127169](https://github.com/andymai/gridfinity-layout-tool/commit/01271696cbc69a64a86a4c28f87967c7a9203e28))
- add privacy and terms routes to Vercel config ([#423](https://github.com/andymai/gridfinity-layout-tool/issues/423)) ([9e6d08e](https://github.com/andymai/gridfinity-layout-tool/commit/9e6d08e934a1d469997743a78ec992de9b776a3b))
- add privacy/terms to service worker denylist ([#424](https://github.com/andymai/gridfinity-layout-tool/issues/424)) ([c02d447](https://github.com/andymai/gridfinity-layout-tool/commit/c02d4473c4f1490074a15c306fdd611970b93664))
- address e2e test failures and Copilot review comments ([2e4cf70](https://github.com/andymai/gridfinity-layout-tool/commit/2e4cf70751df1297e420c2564b7637222f58c958))
- address e2e test failures and Copilot review comments ([16acfa6](https://github.com/andymai/gridfinity-layout-tool/commit/16acfa6d561a8f2c6d86d25fcfbb12c408b6eb88))
- address ML systems review recommendations ([#248](https://github.com/andymai/gridfinity-layout-tool/issues/248)) ([e536875](https://github.com/andymai/gridfinity-layout-tool/commit/e536875923dcc0548641c3148dcba655dcbc9a71))
- address PR [#40](https://github.com/andymai/gridfinity-layout-tool/issues/40) review comments ([071a8f9](https://github.com/andymai/gridfinity-layout-tool/commit/071a8f9efe3b1b6eed6fe9106cb23267c33c7ac0))
- address PR [#40](https://github.com/andymai/gridfinity-layout-tool/issues/40) review comments ([19dd0ee](https://github.com/andymai/gridfinity-layout-tool/commit/19dd0eea99096a821d5742c343ce4facd9a0ffaf))
- address PR review comments for mobile cloud share ([c842841](https://github.com/andymai/gridfinity-layout-tool/commit/c842841e8d1a1e39addae29c64f79870d1e255b9))
- address PR review comments for MobileBinList ([216421c](https://github.com/andymai/gridfinity-layout-tool/commit/216421c7c20f40a676eca9bc53e7e94f30edbd33))
- address PR review comments for modal overhaul ([0852610](https://github.com/andymai/gridfinity-layout-tool/commit/08526105e69785c2135d574ed3d9095fdd546317))
- address security, validation, and robustness issues from code review ([#355](https://github.com/andymai/gridfinity-layout-tool/issues/355)) ([45c02d4](https://github.com/andymai/gridfinity-layout-tool/commit/45c02d457dfc0c33ee648e44630ded62d876ae5b))
- adjust banana Z position to align with grid floor ([#481](https://github.com/andymai/gridfinity-layout-tool/issues/481)) ([80fc0d7](https://github.com/andymai/gridfinity-layout-tool/commit/80fc0d75ef8da72029c4d74eef2d3ee145a4bf47))
- adjust mobile bin list styling to match app aesthetic ([fd5c692](https://github.com/andymai/gridfinity-layout-tool/commit/fd5c692e4c2e9fc8fc9bebf1856389d68f2ef403))
- **analytics:** disable automatic pageview capture to fix 1000% spike ([#311](https://github.com/andymai/gridfinity-layout-tool/issues/311)) ([a3df6b6](https://github.com/andymai/gridfinity-layout-tool/commit/a3df6b6c7530f774efe4f03158fce1028b3ad347))
- **bin-designer:** add ARIA progressbar to batch export progress ([#324](https://github.com/andymai/gridfinity-layout-tool/issues/324)) ([ac9308f](https://github.com/andymai/gridfinity-layout-tool/commit/ac9308fa1ddf0883e5948343d9413af19c40d212))
- **bin-designer:** address PR [#344](https://github.com/andymai/gridfinity-layout-tool/issues/344) review comments ([#345](https://github.com/andymai/gridfinity-layout-tool/issues/345)) ([8697547](https://github.com/andymai/gridfinity-layout-tool/commit/8697547a4cc6f797344b5e204aee1a96c05295f8))
- **bin-designer:** close mobile menu on Escape with focus restoration ([#322](https://github.com/andymai/gridfinity-layout-tool/issues/322)) ([5607c3a](https://github.com/andymai/gridfinity-layout-tool/commit/5607c3aac673131280617150a9e2cd5e6d714288))
- **bin-designer:** correct finger scoop geometry orientation ([#377](https://github.com/andymai/gridfinity-layout-tool/issues/377)) ([8b853c8](https://github.com/andymai/gridfinity-layout-tool/commit/8b853c880a25ea1437e71641a9f44645ae647d82))
- **bin-designer:** correct stacking lip and magnet/screw hole geometry ([#335](https://github.com/andymai/gridfinity-layout-tool/issues/335)) ([aecb5ed](https://github.com/andymai/gridfinity-layout-tool/commit/aecb5edf357490bfea9a4968cbb96e10369adf20))
- **bin-designer:** correct stacking lip height and improve dimension controls ([#449](https://github.com/andymai/gridfinity-layout-tool/issues/449)) ([386d15d](https://github.com/andymai/gridfinity-layout-tool/commit/386d15d219d2e7c5edfcf28b16c91cc27f48a09a))
- **bin-designer:** correct wall cutout geometry positioning ([#371](https://github.com/andymai/gridfinity-layout-tool/issues/371)) ([4c939a7](https://github.com/andymai/gridfinity-layout-tool/commit/4c939a72ad3f94d974378d101f370b02dac94cd5))
- **bin-designer:** feedback, accessibility, and empty states (batch 2) ([#318](https://github.com/andymai/gridfinity-layout-tool/issues/318)) ([fe292dc](https://github.com/andymai/gridfinity-layout-tool/commit/fe292dcd62893d0c6f145d390018c564f051c722))
- **bin-designer:** fix color picker and improve UI ([#452](https://github.com/andymai/gridfinity-layout-tool/issues/452)) ([e88b81f](https://github.com/andymai/gridfinity-layout-tool/commit/e88b81f7aed4d210eeedfbc0315e7ebcb18b8104))
- **bin-designer:** geometry and UI polish for alpha ([#310](https://github.com/andymai/gridfinity-layout-tool/issues/310)) ([ae98605](https://github.com/andymai/gridfinity-layout-tool/commit/ae9860509ac7a542034daecc73f0af28050f3ec6))
- **bin-designer:** guard against invalid compartment mesh generation ([#351](https://github.com/andymai/gridfinity-layout-tool/issues/351)) ([7248ccb](https://github.com/andymai/gridfinity-layout-tool/commit/7248ccb66d789e0c3fbe178ed43c61e9b93aa585))
- **bin-designer:** improve ARIA attributes for toggle buttons and error displays ([#321](https://github.com/andymai/gridfinity-layout-tool/issues/321)) ([4678d7f](https://github.com/andymai/gridfinity-layout-tool/commit/4678d7f5c8b34102212e6e0a9645bc40c65699f9))
- **bin-designer:** normalize toast API and add aria-busy to design list ([#325](https://github.com/andymai/gridfinity-layout-tool/issues/325)) ([4d098a5](https://github.com/andymai/gridfinity-layout-tool/commit/4d098a54b3c95782bf8c8a5a5c75daa938b5c454))
- **bin-designer:** prevent unwanted 'Untitled Bin' entries in My Designs ([#350](https://github.com/andymai/gridfinity-layout-tool/issues/350)) ([831b498](https://github.com/andymai/gridfinity-layout-tool/commit/831b4986cb04b175a701d5298bc4aafc1d2eb884))
- **bin-designer:** remove fade transition on tool switch ([#341](https://github.com/andymai/gridfinity-layout-tool/issues/341)) ([94f2cce](https://github.com/andymai/gridfinity-layout-tool/commit/94f2cce989f7afc38b4df5d9c914e3ce91fe9d43))
- **bin-designer:** remove non-null assertion in normalizeIds ([#353](https://github.com/andymai/gridfinity-layout-tool/issues/353)) ([45ecb46](https://github.com/andymai/gridfinity-layout-tool/commit/45ecb46111e6df3df4fbe3581ac219bd556e5576))
- **bin-designer:** respect prefers-reduced-motion for animations ([#326](https://github.com/andymai/gridfinity-layout-tool/issues/326)) ([1d77150](https://github.com/andymai/gridfinity-layout-tool/commit/1d771507cd427a14475c09ec94dc9c849a358528))
- **bin-designer:** touch support, confirmations, and feedback ([#320](https://github.com/andymai/gridfinity-layout-tool/issues/320)) ([9e3726e](https://github.com/andymai/gridfinity-layout-tool/commit/9e3726e29c416b18462dbbf2dc055bdc4092f6e3))
- **bin-designer:** UX polish — accessibility, feedback, and interaction improvements ([#347](https://github.com/andymai/gridfinity-layout-tool/issues/347)) ([281aa5a](https://github.com/andymai/gridfinity-layout-tool/commit/281aa5ac243a277b6263934213e25421181774cd))
- **bin-designer:** UX polish across form behavior, accessibility, and feedback ([#317](https://github.com/andymai/gridfinity-layout-tool/issues/317)) ([c33c170](https://github.com/andymai/gridfinity-layout-tool/commit/c33c17010db608145b597344809044b51a25fc03))
- **categories:** resolve color picker overlap and empty badge spacing ([#378](https://github.com/andymai/gridfinity-layout-tool/issues/378)) ([e896209](https://github.com/andymai/gridfinity-layout-tool/commit/e896209139d336423bf4ffc2ee0663577b8ef422))
- category cycling type violation, blocked zone detection, and library recovery ([#357](https://github.com/andymai/gridfinity-layout-tool/issues/357)) ([229bdaa](https://github.com/andymai/gridfinity-layout-tool/commit/229bdaa425795eaae776f06bb705042ee0666cf3))
- **ci:** align Node.js version with .nvmrc (v24) ([#397](https://github.com/andymai/gridfinity-layout-tool/issues/397)) ([291e94f](https://github.com/andymai/gridfinity-layout-tool/commit/291e94f55b76590021e3c79cec13ad4b3f4c0271))
- **ci:** update Node.js to v22 for camera-controls compatibility ([#396](https://github.com/andymai/gridfinity-layout-tool/issues/396)) ([2955920](https://github.com/andymai/gridfinity-layout-tool/commit/295592098507de9526a4fd29d5883bf010e3aeba))
- close bottom sheet when expanding bin list modal ([2a2e615](https://github.com/andymai/gridfinity-layout-tool/commit/2a2e615eff78c456ebe4dd978e1acffec4bfaaee))
- **collab:** add fallback to local mutations when Liveblocks disconnected ([#133](https://github.com/andymai/gridfinity-layout-tool/issues/133)) ([b5e7fd4](https://github.com/andymai/gridfinity-layout-tool/commit/b5e7fd4d04b3b9a0db1610433850aa6131da93a4))
- **collab:** prevent RoomProvider missing error on shared layout refresh ([#134](https://github.com/andymai/gridfinity-layout-tool/issues/134)) ([6154cf8](https://github.com/andymai/gridfinity-layout-tool/commit/6154cf863962a12f7b03c73f8cd1d9ed43789495))
- collection sync and layout switching between modes ([#88](https://github.com/andymai/gridfinity-layout-tool/issues/88)) ([9cdcd41](https://github.com/andymai/gridfinity-layout-tool/commit/9cdcd41c0a6fcabd9311baae76b72a47c474a872))
- collection sync and layout switching issues ([#92](https://github.com/andymai/gridfinity-layout-tool/issues/92)) ([c36efa6](https://github.com/andymai/gridfinity-layout-tool/commit/c36efa699072c44c0e80d9ce6cbab9f097954999))
- configure playwright for fail-fast testing ([08c838c](https://github.com/andymai/gridfinity-layout-tool/commit/08c838cbe6c4b3c816c3e0a299635737af33951a))
- correct bin positioning for fractionalEdge='start' ([47edcbc](https://github.com/andymai/gridfinity-layout-tool/commit/47edcbcdcbfbd9f3ace6c7f7c9596805a4eb8a80))
- correct inaccurate claim in guide about bins not fitting ([#234](https://github.com/andymai/gridfinity-layout-tool/issues/234)) ([e384441](https://github.com/andymai/gridfinity-layout-tool/commit/e384441a2871b49c5ac0bd06e51d4630b29c3f39))
- correct ML telemetry validation for user_hash and edit_to_done_ratio ([#264](https://github.com/andymai/gridfinity-layout-tool/issues/264)) ([fda53ab](https://github.com/andymai/gridfinity-layout-tool/commit/fda53ab1ea60f72f6eb5ea43c889bf3aa87ee807))
- **deps:** regenerate lockfile to fix npm ci sync issue ([#388](https://github.com/andymai/gridfinity-layout-tool/issues/388)) ([3c8532f](https://github.com/andymai/gridfinity-layout-tool/commit/3c8532fe0f59bd2ee361a2c257de320cf059c89f))
- detect PartyKit host by window.location instead of env var ([dd6688a](https://github.com/andymai/gridfinity-layout-tool/commit/dd6688aa8323e3bb6878191de76e16b66a7e7c7e))
- **e2e:** fix all failing e2e tests ([#181](https://github.com/andymai/gridfinity-layout-tool/issues/181)) ([7c342f1](https://github.com/andymai/gridfinity-layout-tool/commit/7c342f10c032ff1edd765f8ca424145d1f9a5d91))
- elevate z-index on hover so resize handles aren't clipped by neighbors ([357c071](https://github.com/andymai/gridfinity-layout-tool/commit/357c07185f1ee91ea35f75fc063a2fdf9c37cad2))
- elevate z-index on hover so resize handles aren't clipped by neighbors ([8675715](https://github.com/andymai/gridfinity-layout-tool/commit/8675715874be5bf2141876e63b17e0854787dec2))
- eliminate CLS by using useLayoutEffect for zoom-to-fit ([#100](https://github.com/andymai/gridfinity-layout-tool/issues/100)) ([fd0a119](https://github.com/andymai/gridfinity-layout-tool/commit/fd0a119cb3737520805da3563bd25980bf29dad0))
- **export:** use high-quality tessellation for STL export ([#445](https://github.com/andymai/gridfinity-layout-tool/issues/445)) ([360d80b](https://github.com/andymai/gridfinity-layout-tool/commit/360d80b2e02f8ef2e0b9ad0af1abb8c06f964dc4))
- fetch and import updated layout when poll detects newer server version ([#96](https://github.com/andymai/gridfinity-layout-tool/issues/96)) ([85351e7](https://github.com/andymai/gridfinity-layout-tool/commit/85351e77c680c6563785ff850f399b3d5ec7a897))
- fix hook subscription leaks and timer coordination ([9770fc4](https://github.com/andymai/gridfinity-layout-tool/commit/9770fc4854f574d36c56a196724fcf0bba399677))
- **generation:** remove broken StageCache system ([#420](https://github.com/andymai/gridfinity-layout-tool/issues/420)) ([d527ef9](https://github.com/andymai/gridfinity-layout-tool/commit/d527ef945ac423b1fd2600764ed9780d6a2df366))
- gracefully handle missing Liveblocks API key in production ([#131](https://github.com/andymai/gridfinity-layout-tool/issues/131)) ([ecb28bc](https://github.com/andymai/gridfinity-layout-tool/commit/ecb28bcc50319168ebfd9604da1d5da479638686))
- **grid-editor:** reset row/column selection anchor on layer change ([#358](https://github.com/andymai/gridfinity-layout-tool/issues/358)) ([48aeeb0](https://github.com/andymai/gridfinity-layout-tool/commit/48aeeb0add9c386fdcf50d36659b2260415baac3))
- **i18n:** clarify bin palette instruction to avoid click confusion ([#375](https://github.com/andymai/gridfinity-layout-tool/issues/375)) ([44d2a39](https://github.com/andymai/gridfinity-layout-tool/commit/44d2a39af80c4d5de56f6393f3f8530b849a8cf6))
- **i18n:** fix missing interpolation in bin list translations ([#401](https://github.com/andymai/gridfinity-layout-tool/issues/401)) ([8820b5f](https://github.com/andymai/gridfinity-layout-tool/commit/8820b5f28805045a627347c7191b7a9d60e8e9ef))
- **i18n:** fix missing interpolation in print modal translations ([#399](https://github.com/andymai/gridfinity-layout-tool/issues/399)) ([8d2c618](https://github.com/andymai/gridfinity-layout-tool/commit/8d2c6180d5a9fc78021ad55665e3c9cf12460ee0))
- improve Labs description for better Google AI summary ([#216](https://github.com/andymai/gridfinity-layout-tool/issues/216)) ([9b9f62c](https://github.com/andymai/gridfinity-layout-tool/commit/9b9f62c97a49f3a2bd098aa0a5cb725f91274c5a))
- improve mobile resize handle usability ([#192](https://github.com/andymai/gridfinity-layout-tool/issues/192)) ([c332b7e](https://github.com/andymai/gridfinity-layout-tool/commit/c332b7eb4d0703526a4e8b7f7f796d406e6882b1))
- improve PWA update detection for near-real-time updates ([0e9b49b](https://github.com/andymai/gridfinity-layout-tool/commit/0e9b49b3736e8e741a34f3592017feefa2355dcc))
- improve PWA update detection for near-real-time updates ([7e92628](https://github.com/andymai/gridfinity-layout-tool/commit/7e926280e11c13dc9cb2859c3467d902a7d1a7a9))
- improve timer cleanup in PWA update hook ([ff31ac6](https://github.com/andymai/gridfinity-layout-tool/commit/ff31ac60509bf1e7a0e6a3d984f191af1f7446f2))
- improve UX/UI accessibility and design system compliance ([#218](https://github.com/andymai/gridfinity-layout-tool/issues/218)) ([6936680](https://github.com/andymai/gridfinity-layout-tool/commit/6936680f2caa50f4834b1b54b25ee09529fa87a5))
- **interactions:** handle pointercancel and stale selections ([#356](https://github.com/andymai/gridfinity-layout-tool/issues/356)) ([c4a4ad6](https://github.com/andymai/gridfinity-layout-tool/commit/c4a4ad67ddd0b51642ced628fcecd4a48328f69c))
- **interactions:** resolve stale closure bug in mode handler wrappers ([#149](https://github.com/andymai/gridfinity-layout-tool/issues/149)) ([381a9bb](https://github.com/andymai/gridfinity-layout-tool/commit/381a9bbbe5d80c8f3d594398f5d495edfd1cc07e))
- language selector dropdown rendering behind UI elements ([#374](https://github.com/andymai/gridfinity-layout-tool/issues/374)) ([1212d93](https://github.com/andymai/gridfinity-layout-tool/commit/1212d937092f4979aaa610f41e0cf9826148a61f))
- **layers:** improve drag-and-drop reordering UX ([#176](https://github.com/andymai/gridfinity-layout-tool/issues/176)) ([e8e8a94](https://github.com/andymai/gridfinity-layout-tool/commit/e8e8a9494874ccdcf5f450e1989d61f7ec3c9f75))
- **lint:** resolve additional ESLint errors ([#368](https://github.com/andymai/gridfinity-layout-tool/issues/368)) ([1a5fbd0](https://github.com/andymai/gridfinity-layout-tool/commit/1a5fbd0cfdf3a2d20adce1a6edd53995dd4ff335))
- **lint:** resolve ESLint errors and warnings ([#367](https://github.com/andymai/gridfinity-layout-tool/issues/367)) ([f727468](https://github.com/andymai/gridfinity-layout-tool/commit/f7274684f9adce423af0d7081c246fae87107f26))
- make sitemap.xml and robots.txt accessible ([#84](https://github.com/andymai/gridfinity-layout-tool/issues/84)) ([ce1793e](https://github.com/andymai/gridfinity-layout-tool/commit/ce1793ea37987f8edc2d4094f117bf8c8542e343))
- match layout card thumbnail bg to inspiration gallery ([958edf8](https://github.com/andymai/gridfinity-layout-tool/commit/958edf8142c79f30db8be6f05af6405bee586b3d))
- **mobile:** align bin inspector steppers with settings panel styling ([#163](https://github.com/andymai/gridfinity-layout-tool/issues/163)) ([7e67a62](https://github.com/andymai/gridfinity-layout-tool/commit/7e67a62e82e8a69be0aa7a85df76b8bd85d24daa))
- **modals:** use portals to escape parent stacking contexts ([#386](https://github.com/andymai/gridfinity-layout-tool/issues/386)) ([8afc0a5](https://github.com/andymai/gridfinity-layout-tool/commit/8afc0a59732d7e97958a8d42c7bc5645098c2fc2))
- PartyKit deployment on Vercel ([#85](https://github.com/andymai/gridfinity-layout-tool/issues/85)) ([171dda7](https://github.com/andymai/gridfinity-layout-tool/commit/171dda76e77b1d40e98e0d7973c26a24197dc0ea))
- PartyKit host detection and collection navigation ([#91](https://github.com/andymai/gridfinity-layout-tool/issues/91)) ([187e94a](https://github.com/andymai/gridfinity-layout-tool/commit/187e94aeb852412caea1391bbe0309b72f86e635))
- persist and restore active layout when rejoining collections ([#87](https://github.com/andymai/gridfinity-layout-tool/issues/87)) ([bae0c52](https://github.com/andymai/gridfinity-layout-tool/commit/bae0c52907d64b99b3862aba789ba7fda54cf3c9))
- prevent #local hash in collection URLs + add sync debug logging ([#93](https://github.com/andymai/gridfinity-layout-tool/issues/93)) ([caa1911](https://github.com/andymai/gridfinity-layout-tool/commit/caa1911df54c41261f7941cdaab2dfce227e9450))
- prevent cloud fetch for local-only layouts ([#150](https://github.com/andymai/gridfinity-layout-tool/issues/150)) ([0ac5443](https://github.com/andymai/gridfinity-layout-tool/commit/0ac5443bff3b579b7bc0a7f76ca908cce4941c1d))
- prevent CLS from categories panel on initial load ([#70](https://github.com/andymai/gridfinity-layout-tool/issues/70)) ([2bd9afc](https://github.com/andymai/gridfinity-layout-tool/commit/2bd9afcaea373f4385014887357c8e0f460ffd2e))
- prevent CLS with CSS fade-in animation and sync zoom calculation ([#101](https://github.com/andymai/gridfinity-layout-tool/issues/101)) ([eaa51dd](https://github.com/andymai/gridfinity-layout-tool/commit/eaa51dd734db8e285c769bc78156d2df2b8abfd2))
- prevent collection sync loops with edit source tracking ([#103](https://github.com/andymai/gridfinity-layout-tool/issues/103)) ([973d474](https://github.com/andymai/gridfinity-layout-tool/commit/973d4749c1a801761e78cb6ad5b246ca652cf8b2))
- prevent dropdown toggles from dismissing modal ([07c7955](https://github.com/andymai/gridfinity-layout-tool/commit/07c79555f86203c5ae0bc84e2800020b30848d8e))
- prevent half-bin mode toggle when fractional bins exist ([a37b95b](https://github.com/andymai/gridfinity-layout-tool/commit/a37b95b7c1c80d202e28921ec7bbcd6f7815d3db))
- prevent half-bin mode toggle when fractional bins exist ([c5fbae4](https://github.com/andymai/gridfinity-layout-tool/commit/c5fbae436ab67ec172399502cb20a88a346bb839))
- prevent PartyKit WebSocket reconnection loops ([#99](https://github.com/andymai/gridfinity-layout-tool/issues/99)) ([65b54df](https://github.com/andymai/gridfinity-layout-tool/commit/65b54df6ee0be1ede6e6ad7cc62463811389ee0b))
- prevent polling effect from clearing push timeout ([#95](https://github.com/andymai/gridfinity-layout-tool/issues/95)) ([bce7b5c](https://github.com/andymai/gridfinity-layout-tool/commit/bce7b5c391c59d82545a579d709aff52b4069308))
- prevent race conditions in layout switching ([d3d7619](https://github.com/andymai/gridfinity-layout-tool/commit/d3d761928c2f9c46cfbf32e0cd7def3b0f0fcc0a))
- **print:** correct bin positioning for fractional drawer dimensions ([#154](https://github.com/andymai/gridfinity-layout-tool/issues/154)) ([3cc40f2](https://github.com/andymai/gridfinity-layout-tool/commit/3cc40f28b2d10f18f8bdde270fc1e18fadd47b1a))
- redirect Claude hook output to stderr for proper visibility ([#460](https://github.com/andymai/gridfinity-layout-tool/issues/460)) ([e1ecf4c](https://github.com/andymai/gridfinity-layout-tool/commit/e1ecf4c5abb3cb36af337e4a34b87abe6263d56e))
- remove build step from pre-commit and fix failing tests ([#457](https://github.com/andymai/gridfinity-layout-tool/issues/457)) ([1f0da27](https://github.com/andymai/gridfinity-layout-tool/commit/1f0da270e3258309be1e3d9d085d40a6ea64633a))
- remove duplicate export button from bin designer header ([#462](https://github.com/andymai/gridfinity-layout-tool/issues/462)) ([177c31f](https://github.com/andymai/gridfinity-layout-tool/commit/177c31f217abe9d7147a0a2de2b9638c4e17d8ba))
- remove GitHub links from static pages and structured data ([#233](https://github.com/andymai/gridfinity-layout-tool/issues/233)) ([c190b84](https://github.com/andymai/gridfinity-layout-tool/commit/c190b842be6b09b33c0e0453e5e9fe0e12a34c47))
- remove inaccurate open source claim from static page footer ([#235](https://github.com/andymai/gridfinity-layout-tool/issues/235)) ([377f261](https://github.com/andymai/gridfinity-layout-tool/commit/377f2614223113e0710282264f0d7368575957fe))
- remove min-height from categories panel causing overflow ([#71](https://github.com/andymai/gridfinity-layout-tool/issues/71)) ([e2c2fb5](https://github.com/andymai/gridfinity-layout-tool/commit/e2c2fb5d019d9594f62bfd035ca9fa58dfffbacc))
- remove noisy toast when bookmarked layout is deleted ([#115](https://github.com/andymai/gridfinity-layout-tool/issues/115)) ([4001f7a](https://github.com/andymai/gridfinity-layout-tool/commit/4001f7a5b3d294145be69da1f8d1a1507d11c8a1))
- remove redundant STAGING_ID filter in ToolsTab ([514ae8e](https://github.com/andymai/gridfinity-layout-tool/commit/514ae8ee01073328282a76e11ad95d7f7174c813))
- rename print toggle label from "Category Colors" to "Categories" ([#82](https://github.com/andymai/gridfinity-layout-tool/issues/82)) ([7a819c0](https://github.com/andymai/gridfinity-layout-tool/commit/7a819c03a7686422cc4ae24f2784a60d0463c524))
- render CollectionBanner for live sync and add membership UI ([#89](https://github.com/andymai/gridfinity-layout-tool/issues/89)) ([f679f70](https://github.com/andymai/gridfinity-layout-tool/commit/f679f700ee1afa36dec555eb3f4ef248beadaa04))
- replace fragile selectors in e2e fixtures ([7f9ab37](https://github.com/andymai/gridfinity-layout-tool/commit/7f9ab371a7dd4d85a0aa614627cf277567ff13c7))
- resolve activeLayer reactivity issue ([c254a2e](https://github.com/andymai/gridfinity-layout-tool/commit/c254a2ee3d2ec22884db7255e4c6d3e53fd9fec3))
- resolve API TypeScript errors for Vercel build ([#299](https://github.com/andymai/gridfinity-layout-tool/issues/299)) ([a1bdced](https://github.com/andymai/gridfinity-layout-tool/commit/a1bdced3814c3ba7caf7e5632f3e658921e717bb))
- resolve circular dependency warnings in build ([#297](https://github.com/andymai/gridfinity-layout-tool/issues/297)) ([c97874b](https://github.com/andymai/gridfinity-layout-tool/commit/c97874b2b87a88ae675c5dad6699646e40d48d4b))
- resolve npm vulnerabilities and deprecation warnings ([#360](https://github.com/andymai/gridfinity-layout-tool/issues/360)) ([a7a4b94](https://github.com/andymai/gridfinity-layout-tool/commit/a7a4b94744873f3df9546fe8d9df593aa9827c65))
- resolve remaining Vercel API TypeScript errors ([#300](https://github.com/andymai/gridfinity-layout-tool/issues/300)) ([a8ea076](https://github.com/andymai/gridfinity-layout-tool/commit/a8ea0763185983c88a3dd7742244ea74cef5b03c))
- rotate drag preview labels to match static bin logic ([#178](https://github.com/andymai/gridfinity-layout-tool/issues/178)) ([13c82fe](https://github.com/andymai/gridfinity-layout-tool/commit/13c82fed8b006212153ac954a1170d4adba9e103))
- security hardening, reliability, and code quality improvements ([#312](https://github.com/andymai/gridfinity-layout-tool/issues/312)) ([d2970ff](https://github.com/andymai/gridfinity-layout-tool/commit/d2970ff223d47bcb550a3ef97053e2a5dcfb3a68))
- separate PartyKit deployment from Vercel build ([b304435](https://github.com/andymai/gridfinity-layout-tool/commit/b304435f5651678c61b0b31749ab73ce31742c1f))
- share API validation and presence UI improvements ([#132](https://github.com/andymai/gridfinity-layout-tool/issues/132)) ([4dae2ac](https://github.com/andymai/gridfinity-layout-tool/commit/4dae2ac03a21441167e5ad3435eed9441d8f449a))
- skip flaky rotation E2E tests, add unit tests ([47d5c28](https://github.com/andymai/gridfinity-layout-tool/commit/47d5c28b307b35a02ab2c4d927b49757dd5572c7))
- skip heartbeat when offline, add try/catch for safety ([0bc59f7](https://github.com/andymai/gridfinity-layout-tool/commit/0bc59f728e5b023d52720d2a3c1a2ef31ebb6770))
- skip heartbeat when offline, add try/catch for safety ([#179](https://github.com/andymai/gridfinity-layout-tool/issues/179)) ([784c7eb](https://github.com/andymai/gridfinity-layout-tool/commit/784c7ebb5746ab4c7c825d037e8853cfaa901713))
- **staging:** elevate z-index of hovered/selected bins in stash ([#380](https://github.com/andymai/gridfinity-layout-tool/issues/380)) ([560e017](https://github.com/andymai/gridfinity-layout-tool/commit/560e017cbfb789cb9bd8e2f35de29cb6399dfc5f))
- standardize store tests with resetAllStores pattern ([8a416de](https://github.com/andymai/gridfinity-layout-tool/commit/8a416de0f8bb2e9d0032f1d6ae14058f92d4829e))
- support fractional depth bins in staging area ([85c2539](https://github.com/andymai/gridfinity-layout-tool/commit/85c2539ce9a8d4d5be60362cec554b68006ac4c7))
- support fractional depth bins in staging area ([bc61deb](https://github.com/andymai/gridfinity-layout-tool/commit/bc61debe07283e3f7b55e6d6ba59f2ce3c13f7a1))
- **test:** add 60s timeout to performance test ([#400](https://github.com/andymai/gridfinity-layout-tool/issues/400)) ([ae545d2](https://github.com/andymai/gridfinity-layout-tool/commit/ae545d2ce2c844a7bd862ac3ca526c40c45e22fd))
- **test:** increase global timeout and optimize workers for CI ([#402](https://github.com/andymai/gridfinity-layout-tool/issues/402)) ([ffb957c](https://github.com/andymai/gridfinity-layout-tool/commit/ffb957c5e437f1dcd0107cf522791026c1859e3b))
- **test:** increase performance test thresholds for CI ([#398](https://github.com/andymai/gridfinity-layout-tool/issues/398)) ([b25008d](https://github.com/andymai/gridfinity-layout-tool/commit/b25008db9d5ce16eb3a54f45b94a64b1e06dfffb))
- **test:** increase test timeout and fix flaky CI tests ([#390](https://github.com/andymai/gridfinity-layout-tool/issues/390)) ([1a2564c](https://github.com/andymai/gridfinity-layout-tool/commit/1a2564caacd3a735a5935f46ae183092fb302a55))
- **test:** increase test timeout to 10s for CI stability ([#389](https://github.com/andymai/gridfinity-layout-tool/issues/389)) ([c2494c0](https://github.com/andymai/gridfinity-layout-tool/commit/c2494c09b2a67422de59c37a02b0bbc12641783c))
- **test:** increase undo/redo performance threshold for CI ([#391](https://github.com/andymai/gridfinity-layout-tool/issues/391)) ([fdb29ef](https://github.com/andymai/gridfinity-layout-tool/commit/fdb29ef32d2550e9e4cc642a1d38ea1abdabe6dc))
- **test:** lower coverage thresholds after i18n PRs ([#403](https://github.com/andymai/gridfinity-layout-tool/issues/403)) ([c31bff1](https://github.com/andymai/gridfinity-layout-tool/commit/c31bff1ce49673a16269dd459b4792883c58052f))
- **ui:** improve multi-bin custom property form layout ([#175](https://github.com/andymai/gridfinity-layout-tool/issues/175)) ([e4c13ce](https://github.com/andymai/gridfinity-layout-tool/commit/e4c13ce1af1206f52a40d2db137cf8605149ceae))
- update E2E tests for i18n-changed labels ([#373](https://github.com/andymai/gridfinity-layout-tool/issues/373)) ([cf338dd](https://github.com/andymai/gridfinity-layout-tool/commit/cf338dd1fec0deaf6f03ff55df4b13eeb5bc4c6b))
- update test mock paths for Phase 5 refactored modules ([#206](https://github.com/andymai/gridfinity-layout-tool/issues/206)) ([1166b25](https://github.com/andymai/gridfinity-layout-tool/commit/1166b2535674b0c2c71904e5fbd75866bc8825b2))
- use final bin height in layer movement validation ([81adb04](https://github.com/andymai/gridfinity-layout-tool/commit/81adb0404c15c45d1275369c264a6c618d08dd43))
- use full page width for print output instead of preview width ([#108](https://github.com/andymai/gridfinity-layout-tool/issues/108)) ([745cacb](https://github.com/andymai/gridfinity-layout-tool/commit/745cacba9a6e80e035152c8a8d630704219eb0b7))
- use official PostHog GitHub Action for source map uploads ([#296](https://github.com/andymai/gridfinity-layout-tool/issues/296)) ([84c9fd9](https://github.com/andymai/gridfinity-layout-tool/commit/84c9fd9a6da6d011af06c65fc0b981bcea53e38d))
- use opacity-50 for disabled button state ([075a756](https://github.com/andymai/gridfinity-layout-tool/commit/075a756bc6040c46154039c4463287c4e933a81d))
- use ref pattern for pushChanges in collection sync timeout ([#94](https://github.com/andymai/gridfinity-layout-tool/issues/94)) ([7e2bd4f](https://github.com/andymai/gridfinity-layout-tool/commit/7e2bd4f470fae2326442ce4e609eaa2e39bec754))
- use responsive context in InspirationGallery ([17b6709](https://github.com/andymai/gridfinity-layout-tool/commit/17b6709f6d26e0b26c9a367ad7e18bcfa380108a))
- **ux:** design system tokens, accessibility, and touch targets ([#328](https://github.com/andymai/gridfinity-layout-tool/issues/328)) ([3e374f1](https://github.com/andymai/gridfinity-layout-tool/commit/3e374f13a27f6160b3fc426ee67dfc69203585bc))
- **ux:** design system tokens, touch targets, and gallery UX ([#323](https://github.com/andymai/gridfinity-layout-tool/issues/323)) ([94cfa44](https://github.com/andymai/gridfinity-layout-tool/commit/94cfa446792e791605bfb4dde62e7aae82452e31))
- **ux:** help modal accessibility and labs design tokens ([#329](https://github.com/andymai/gridfinity-layout-tool/issues/329)) ([f958538](https://github.com/andymai/gridfinity-layout-tool/commit/f95853801d1376b8834b19145b44d6eeca98cb8c))
- **ux:** improve loading states, accessibility, and visual consistency ([#319](https://github.com/andymai/gridfinity-layout-tool/issues/319)) ([f3c9be3](https://github.com/andymai/gridfinity-layout-tool/commit/f3c9be3e9ec22547d55544c097bb796496dbbea9))
- wire up engagement milestone tracking for PostHog funnel ([#302](https://github.com/andymai/gridfinity-layout-tool/issues/302)) ([e05a518](https://github.com/andymai/gridfinity-layout-tool/commit/e05a5189524b37e03c97ebb1c1a503d96ea6bce4))

### Performance

- dynamic quality bin generation with edge lines ([#438](https://github.com/andymai/gridfinity-layout-tool/issues/438)) ([88f9814](https://github.com/andymai/gridfinity-layout-tool/commit/88f9814fa3c8d0dffe7716876b09d0ac21cc8364))
- improve INP and CLS performance ([309b4ba](https://github.com/andymai/gridfinity-layout-tool/commit/309b4ba56aa725a627f0d09a5d0a5d8e97c5a957))
- lazy load modals and memoize grid label arrays ([#217](https://github.com/andymai/gridfinity-layout-tool/issues/217)) ([31a6572](https://github.com/andymai/gridfinity-layout-tool/commit/31a657210e5c408627827bb11939759bd7818939))
- lazy-load BinListModal to reduce main bundle by 61 kB ([#301](https://github.com/andymai/gridfinity-layout-tool/issues/301)) ([b8bea96](https://github.com/andymai/gridfinity-layout-tool/commit/b8bea96b13b969eef291d71846c2918975dbf41d))
- lazy-load Liveblocks to reduce main bundle by 62KB ([#138](https://github.com/andymai/gridfinity-layout-tool/issues/138)) ([40ac748](https://github.com/andymai/gridfinity-layout-tool/commit/40ac7483b7970db6ac6c0714c074504a2ebf7c21))
- migrate hot-path components to focused Zustand stores ([#161](https://github.com/andymai/gridfinity-layout-tool/issues/161)) ([dbcae17](https://github.com/andymai/gridfinity-layout-tool/commit/dbcae173715750b3a9c713a47443754850bc2407))
- optimize O(n²) lookups in grid rendering components ([#267](https://github.com/andymai/gridfinity-layout-tool/issues/267)) ([50a0c87](https://github.com/andymai/gridfinity-layout-tool/commit/50a0c87180a9a68df7c686fb08677f7bf8650af2))
- optimize pre-commit test execution for high-core CPUs ([#298](https://github.com/andymai/gridfinity-layout-tool/issues/298)) ([c087be7](https://github.com/andymai/gridfinity-layout-tool/commit/c087be732674346860db4ae3bf959ea4332b88eb))
- optimize service worker updates on Vercel deployments ([#125](https://github.com/andymai/gridfinity-layout-tool/issues/125)) ([06359c0](https://github.com/andymai/gridfinity-layout-tool/commit/06359c0325edd9a6480631907d40079017c86557))

### Refactoring

- complete Result API migration, remove dual APIs ([#127](https://github.com/andymai/gridfinity-layout-tool/issues/127)) ([1af3276](https://github.com/andymai/gridfinity-layout-tool/commit/1af327676108851941b82c0613abb8d4217d4f43))
