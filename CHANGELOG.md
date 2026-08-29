# Changelog

## [4.480.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.479.0...gridfinity-layout-tool-v4.480.0) (2026-08-29)


### Features

* **bin-designer:** fold explainers behind info dots, curate labels and Print ([#4000](https://github.com/andymai/gridfinity-layout-tool/issues/4000)) ([db4994d](https://github.com/andymai/gridfinity-layout-tool/commit/db4994d2dc3a3ead1549fa1665bb4e7c1dfe2269))
* **bin-designer:** give the Style page a section spine ([#3998](https://github.com/andymai/gridfinity-layout-tool/issues/3998)) ([b4c02b7](https://github.com/andymai/gridfinity-layout-tool/commit/b4c02b7948e6a26879726515bc502b8054088407))
* **bin-designer:** one control idiom across the Features and Shape pages ([#3999](https://github.com/andymai/gridfinity-layout-tool/issues/3999)) ([4b039b8](https://github.com/andymai/gridfinity-layout-tool/commit/4b039b82f4ffab94591fbec32eb5119cfd708172))
* **bin-designer:** redesign the Typography section ([#3997](https://github.com/andymai/gridfinity-layout-tool/issues/3997)) ([b0e2a80](https://github.com/andymai/gridfinity-layout-tool/commit/b0e2a80512da85617733d3794478d0e8b26f1006))
* **bin-designer:** selection model groundwork (B4) ([#4002](https://github.com/andymai/gridfinity-layout-tool/issues/4002)) ([5a8a0d8](https://github.com/andymai/gridfinity-layout-tool/commit/5a8a0d8d13add3b42f4044177c2d2e09356cd935))
* **bin-designer:** shared joint primitives, SegmentGrid hardening, Workshop button move ([#4001](https://github.com/andymai/gridfinity-layout-tool/issues/4001)) ([ae0e12c](https://github.com/andymai/gridfinity-layout-tool/commit/ae0e12cb677f61828fc02350be4d8722fbf9bd84))


### Bug Fixes

* **baseplate:** stop params migration dropping splitOverride, screwHoles, fractional edges ([#4004](https://github.com/andymai/gridfinity-layout-tool/issues/4004)) ([13f192a](https://github.com/andymai/gridfinity-layout-tool/commit/13f192a90b4f2c6ad83f9e34f76eebb131a1cc19)), closes [#3994](https://github.com/andymai/gridfinity-layout-tool/issues/3994)
* **bin-designer:** copy sweep for designer panel strings ([#3996](https://github.com/andymai/gridfinity-layout-tool/issues/3996)) ([d6f2cfe](https://github.com/andymai/gridfinity-layout-tool/commit/d6f2cfe1b2c9ca08590be42cfeece1c7b3a73fb6))
* **bin-designer:** panel audit bug sweep ([#3995](https://github.com/andymai/gridfinity-layout-tool/issues/3995)) ([6a1e423](https://github.com/andymai/gridfinity-layout-tool/commit/6a1e4234249cab4ac4f96a8718d4830816162a6e))
* **design-system:** pin Stepper input width so intrinsic size can't hide the + button ([#4005](https://github.com/andymai/gridfinity-layout-tool/issues/4005)) ([6bbd364](https://github.com/andymai/gridfinity-layout-tool/commit/6bbd36429030d5860f177f88261b0684171b941b)), closes [#3963](https://github.com/andymai/gridfinity-layout-tool/issues/3963)
* **print-export:** merge mismatched palettes in multi-object 3MF export ([#3992](https://github.com/andymai/gridfinity-layout-tool/issues/3992)) ([d86c8d5](https://github.com/andymai/gridfinity-layout-tool/commit/d86c8d542e99aa7ff89a4455ef413f455a6346bf))

## [4.479.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.478.4...gridfinity-layout-tool-v4.479.0) (2026-08-29)


### Features

* **bin-designer:** give the Shape, Features and Style pages their true shape ([#3984](https://github.com/andymai/gridfinity-layout-tool/issues/3984)) ([184d256](https://github.com/andymai/gridfinity-layout-tool/commit/184d25608eb9c3f5bdba2bcb9d9790de1b4854d0))
* **bin-designer:** jump-link dependencies, category dots, always-on print fit ([#3986](https://github.com/andymai/gridfinity-layout-tool/issues/3986)) ([6119413](https://github.com/andymai/gridfinity-layout-tool/commit/6119413eca248e1cf20c03a3f90108bcc5e2f44e))
* **bin-designer:** replace the accordion panel with a category rail shell ([#3983](https://github.com/andymai/gridfinity-layout-tool/issues/3983)) ([2e7a4af](https://github.com/andymai/gridfinity-layout-tool/commit/2e7a4afedfc359a8914c7e75426aaf64c2ec2e22))
* **bin-designer:** unify the panel's disclosure idioms behind MoreDisclosure ([#3985](https://github.com/andymai/gridfinity-layout-tool/issues/3985)) ([6019309](https://github.com/andymai/gridfinity-layout-tool/commit/60193099052907bc8cc2b40d9d2dd3c661ad582c))
* **design-system:** add SidePanel, iconRail tabs, and SearchInput ([#3981](https://github.com/andymai/gridfinity-layout-tool/issues/3981)) ([d1465ab](https://github.com/andymai/gridfinity-layout-tool/commit/d1465ab387c28fdee670dd7d69f5adf81f836225))
* **design-system:** add the shortcut hint pattern and motion recipes ([#3982](https://github.com/andymai/gridfinity-layout-tool/issues/3982)) ([4aa95a5](https://github.com/andymai/gridfinity-layout-tool/commit/4aa95a55981fa40ee5fef7bc2f41088bd930e067))
* **design-system:** adopt the type ramp and retire ad-hoc text sizes ([#3977](https://github.com/andymai/gridfinity-layout-tool/issues/3977)) ([409f868](https://github.com/andymai/gridfinity-layout-tool/commit/409f86853179e05f128152e53826c78c5c9109eb))
* **design-system:** promote CompactNumberInput to NumberField with expressions ([#3979](https://github.com/andymai/gridfinity-layout-tool/issues/3979)) ([bcf2374](https://github.com/andymai/gridfinity-layout-tool/commit/bcf23740053f9f6b99cb008c68ad0c484772e259))
* **design-system:** swap to Inter variable font and add role-based type ramp ([#3976](https://github.com/andymai/gridfinity-layout-tool/issues/3976)) ([94e0114](https://github.com/andymai/gridfinity-layout-tool/commit/94e01144bb2b479d1df797e5322bfa767f5e6ef5))
* **design-system:** theme-aware elevation, radius, motion, and control tokens ([#3978](https://github.com/andymai/gridfinity-layout-tool/issues/3978)) ([4e07020](https://github.com/andymai/gridfinity-layout-tool/commit/4e070204690640af1f7f8bcd4fb2413877657350))


### Bug Fixes

* **three-preview:** guard main-thread troika SDF on missing WebGL extension ([#3973](https://github.com/andymai/gridfinity-layout-tool/issues/3973)) ([edf82e0](https://github.com/andymai/gridfinity-layout-tool/commit/edf82e008ceb048b9f824bae3acc1136305db15a))

## [4.478.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.478.3...gridfinity-layout-tool-v4.478.4) (2026-08-28)


### Bug Fixes

* **three-preview:** stop WebKit troika worker failures from breaking text ([#3970](https://github.com/andymai/gridfinity-layout-tool/issues/3970)) ([50dc528](https://github.com/andymai/gridfinity-layout-tool/commit/50dc52848228bc9b8f54c7982162826dee635715))

## [4.478.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.478.2...gridfinity-layout-tool-v4.478.3) (2026-08-28)


### Bug Fixes

* **analytics:** drop Safari app-bundle extension throws from error tracking ([#3966](https://github.com/andymai/gridfinity-layout-tool/issues/3966)) ([857c514](https://github.com/andymai/gridfinity-layout-tool/commit/857c514208ea8e430a6891c5fc2f825bacc90e50))
* **bin-inspector:** feedback when bulk height edit hits an all-locked selection ([#3967](https://github.com/andymai/gridfinity-layout-tool/issues/3967)) ([d69a91e](https://github.com/andymai/gridfinity-layout-tool/commit/d69a91ec994510cd460a55b34e33b588f4c02cdf))

## [4.478.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.478.1...gridfinity-layout-tool-v4.478.2) (2026-08-28)


### Bug Fixes

* **generation:** retain slotted dividers and brace lite-base floors ([#3959](https://github.com/andymai/gridfinity-layout-tool/issues/3959)) ([ad2c8cd](https://github.com/andymai/gridfinity-layout-tool/commit/ad2c8cdada324c38c93afaf500749e933ccf283c)), closes [#3957](https://github.com/andymai/gridfinity-layout-tool/issues/3957) [#3958](https://github.com/andymai/gridfinity-layout-tool/issues/3958)

## [4.478.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.478.0...gridfinity-layout-tool-v4.478.1) (2026-08-27)


### Bug Fixes

* **sync:** stop a network push failure from escaping as an unhandled rejection ([#3953](https://github.com/andymai/gridfinity-layout-tool/issues/3953)) ([7a8766d](https://github.com/andymai/gridfinity-layout-tool/commit/7a8766dfd4e60c76248c90ad532395531012ac9a)), closes [#3952](https://github.com/andymai/gridfinity-layout-tool/issues/3952)

## [4.478.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.477.1...gridfinity-layout-tool-v4.478.0) (2026-08-27)


### Features

* **bin-designer:** rework the knife-block cutout editor ([#3950](https://github.com/andymai/gridfinity-layout-tool/issues/3950)) ([a9826ce](https://github.com/andymai/gridfinity-layout-tool/commit/a9826cec7d3967a327c418e3c5f9fcaef8548ce2))


### Bug Fixes

* **generation:** stop a slow cold init from tripping the generation timeout ([#3949](https://github.com/andymai/gridfinity-layout-tool/issues/3949)) ([3913428](https://github.com/andymai/gridfinity-layout-tool/commit/391342837c734557a4b58dd045ec5bb352c25f35))

## [4.477.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.477.0...gridfinity-layout-tool-v4.477.1) (2026-08-27)


### Bug Fixes

* **analytics:** attach the active kernel to export-failure captures ([#3947](https://github.com/andymai/gridfinity-layout-tool/issues/3947)) ([6c7dbe8](https://github.com/andymai/gridfinity-layout-tool/commit/6c7dbe88bccb497d9918201a6dbbf5ddfb48a417)), closes [#3941](https://github.com/andymai/gridfinity-layout-tool/issues/3941)
* **analytics:** pin stable fingerprints for the worker-reset error class ([#3944](https://github.com/andymai/gridfinity-layout-tool/issues/3944)) ([337b7ab](https://github.com/andymai/gridfinity-layout-tool/commit/337b7ab614d4d2d4babfbde908e3e865d391221c))
* **baseplate:** guarantee the fit-test coupon font and correct its labelling copy ([#3946](https://github.com/andymai/gridfinity-layout-tool/issues/3946)) ([907e3b7](https://github.com/andymai/gridfinity-layout-tool/commit/907e3b76960ee7a1d409ed508138f86cb62d57da))
* **bin-designer:** keep a text element's caption centered on its box ([#3917](https://github.com/andymai/gridfinity-layout-tool/issues/3917)) ([19d7bfe](https://github.com/andymai/gridfinity-layout-tool/commit/19d7bfe94017c87cdc3cc5ff6c6fe0e831f3a110))
* **bin-designer:** translate the scoop radius Auto button ([#3936](https://github.com/andymai/gridfinity-layout-tool/issues/3936)) ([5552283](https://github.com/andymai/gridfinity-layout-tool/commit/5552283fdbe41b2d1a529aa40867b925b2e84493))
* **build:** repoint the core-foundation chunk pin at the types directory ([#3919](https://github.com/andymai/gridfinity-layout-tool/issues/3919)) ([39d0488](https://github.com/andymai/gridfinity-layout-tool/commit/39d0488c75ce4c4015ce1b2c4c8501fbe1626a98))

## [4.477.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.476.1...gridfinity-layout-tool-v4.477.0) (2026-08-26)


### Features

* **bin-designer:** add a Text tool to the cutout editor ([#3914](https://github.com/andymai/gridfinity-layout-tool/issues/3914)) ([db39911](https://github.com/andymai/gridfinity-layout-tool/commit/db39911e20c330a29163f977d8eb4758f94fcc86))
* **bin-designer:** expose text relief depth in the cutout editor ([#3909](https://github.com/andymai/gridfinity-layout-tool/issues/3909)) ([67f2f38](https://github.com/andymai/gridfinity-layout-tool/commit/67f2f386c6a96a4e92219c3a7cbb5d2777d3fedc))
* **bin-designer:** make an explicit cutout label size a target, not a ceiling ([#3912](https://github.com/andymai/gridfinity-layout-tool/issues/3912)) ([838826e](https://github.com/andymai/gridfinity-layout-tool/commit/838826e0ea2343cf04a0776fa202e06996de3cdb))


### Bug Fixes

* **analytics:** cap per-session exception captures and stale-bundle retries ([#3913](https://github.com/andymai/gridfinity-layout-tool/issues/3913)) ([b8ebb26](https://github.com/andymai/gridfinity-layout-tool/commit/b8ebb260bbf46d234c64cd9b78f50116af55948d))


### Performance

* **analytics:** persist the $set dedupe across pageloads ([#3911](https://github.com/andymai/gridfinity-layout-tool/issues/3911)) ([3aef81d](https://github.com/andymai/gridfinity-layout-tool/commit/3aef81dfb90a60c00125b6c080b142e98151139b))
* **analytics:** trim web vitals, divider commits, and the render-error event ([#3915](https://github.com/andymai/gridfinity-layout-tool/issues/3915)) ([cfb0c1d](https://github.com/andymai/gridfinity-layout-tool/commit/cfb0c1d18b9357438f72e741d506fd725341e53a))

## [4.476.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.476.0...gridfinity-layout-tool-v4.476.1) (2026-08-26)


### Bug Fixes

* **analytics:** drop WebKit navigation aborts and WebView bridge noise ([#3906](https://github.com/andymai/gridfinity-layout-tool/issues/3906)) ([6572b7b](https://github.com/andymai/gridfinity-layout-tool/commit/6572b7b3ee98a2dd63c62d857a6367af063005d6))
* **analytics:** recognise Firefox's wording for the canvas teardown race ([#3905](https://github.com/andymai/gridfinity-layout-tool/issues/3905)) ([1c81039](https://github.com/andymai/gridfinity-layout-tool/commit/1c810391b6dc974de04e8204e8f70af3dee49e28))
* **generation:** tell a browser that cannot run the kernel so ([#3903](https://github.com/andymai/gridfinity-layout-tool/issues/3903)) ([56aee6d](https://github.com/andymai/gridfinity-layout-tool/commit/56aee6d1ac7270a14f7865861658064daf4a4883))

## [4.476.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.475.0...gridfinity-layout-tool-v4.476.0) (2026-08-25)


### Features

* **bin-designer:** give a label caption a second line ([#3895](https://github.com/andymai/gridfinity-layout-tool/issues/3895)) ([19e42fd](https://github.com/andymai/gridfinity-layout-tool/commit/19e42fd11b37e4c818ce5d9802c9220e9f857b35))


### Bug Fixes

* **generation:** recognise every browser's wording for a failed asset ([#3896](https://github.com/andymai/gridfinity-layout-tool/issues/3896)) ([57b68b4](https://github.com/andymai/gridfinity-layout-tool/commit/57b68b44aca356f9c4945470bd9dd8d03656ee11))
* **shell:** recover a route chunk onto the build that actually has it ([#3899](https://github.com/andymai/gridfinity-layout-tool/issues/3899)) ([1e274d2](https://github.com/andymai/gridfinity-layout-tool/commit/1e274d290a89d803c9acb8cf5b92d4409ce2b3c0))

## [4.475.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.474.0...gridfinity-layout-tool-v4.475.0) (2026-08-25)


### Features

* **bin-designer:** nest cutout groups ([#3881](https://github.com/andymai/gridfinity-layout-tool/issues/3881)) ([9d042d8](https://github.com/andymai/gridfinity-layout-tool/commit/9d042d81ea0f2067b87b36f700112d4b6a6b209a))
* **bin-designer:** variants that stay in step with the design they came from ([#3877](https://github.com/andymai/gridfinity-layout-tool/issues/3877)) ([aee1d20](https://github.com/andymai/gridfinity-layout-tool/commit/aee1d205a70c31f80a372b88370dcdad265f8a72))
* **whats-new:** rebuild the modal's information architecture ([#3876](https://github.com/andymai/gridfinity-layout-tool/issues/3876)) ([e49be61](https://github.com/andymai/gridfinity-layout-tool/commit/e49be6117bef773987b7927d55da0eb0fac38f2b))


### Bug Fixes

* **analytics:** capture each unhandled error once ([#3890](https://github.com/andymai/gridfinity-layout-tool/issues/3890)) ([ee93fc0](https://github.com/andymai/gridfinity-layout-tool/commit/ee93fc02454a7f4363591571c80aca75fabbc8f9))
* **analytics:** stop reporting the canvas teardown race as an app error ([#3888](https://github.com/andymai/gridfinity-layout-tool/issues/3888)) ([73309ff](https://github.com/andymai/gridfinity-layout-tool/commit/73309ff057dc14583c88db082d6f8819fb4dbffc))
* **bin-designer:** lock every surface a variant's params can be edited from ([#3879](https://github.com/andymai/gridfinity-layout-tool/issues/3879)) ([5815819](https://github.com/andymai/gridfinity-layout-tool/commit/58158194cb10d3569f94378a3feb6b3ba96dd723))
* **bin-designer:** span dividers across the overhang-expanded interior ([#3887](https://github.com/andymai/gridfinity-layout-tool/issues/3887)) ([4b80069](https://github.com/andymai/gridfinity-layout-tool/commit/4b80069becd39a37b7c1247deb9c73f00fc6ebc7))
* **shell:** keep a failed background mount from taking the app down ([#3889](https://github.com/andymai/gridfinity-layout-tool/issues/3889)) ([d296b19](https://github.com/andymai/gridfinity-layout-tool/commit/d296b19106a8b19e284823b47b662ae75f41ddba))

## [4.474.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.473.0...gridfinity-layout-tool-v4.474.0) (2026-08-25)


### Features

* **bin-designer:** allow wall text on solid bins ([#3860](https://github.com/andymai/gridfinity-layout-tool/issues/3860)) ([9858582](https://github.com/andymai/gridfinity-layout-tool/commit/98585822ae6707f6b8d91d5fa072698338df50da))
* **bin-designer:** branch a design from any saved version ([#3875](https://github.com/andymai/gridfinity-layout-tool/issues/3875)) ([9e0aad6](https://github.com/andymai/gridfinity-layout-tool/commit/9e0aad6a9b137720d06ef6134fb84757ab5f151d))
* **bin-designer:** repeat a boolean group, and label every copy of a repeat ([#3871](https://github.com/andymai/gridfinity-layout-tool/issues/3871)) ([6224e95](https://github.com/andymai/gridfinity-layout-tool/commit/6224e952767c4d3ea79c9e288873ccef1335c8be))
* **bin-designer:** resize a cutout about its own center when a size is typed ([#3864](https://github.com/andymai/gridfinity-layout-tool/issues/3864)) ([0874c66](https://github.com/andymai/gridfinity-layout-tool/commit/0874c66aef2c334ffcdebf19bd11b6a278c78f85))
* **bin-designer:** save named versions of a design and restore them ([#3873](https://github.com/andymai/gridfinity-layout-tool/issues/3873)) ([418c258](https://github.com/andymai/gridfinity-layout-tool/commit/418c258456ec9315de161ca409e112cf664af941))
* **sync:** sync design versions across devices ([#3874](https://github.com/andymai/gridfinity-layout-tool/issues/3874)) ([3242839](https://github.com/andymai/gridfinity-layout-tool/commit/32428398e8cc58fa22daec7205a34a4ba2bdb8be))


### Bug Fixes

* **bin-designer:** hold each shape's center when resizing a multi-selection ([#3872](https://github.com/andymai/gridfinity-layout-tool/issues/3872)) ([a298028](https://github.com/andymai/gridfinity-layout-tool/commit/a298028e1c44dbaeae0bf13e80cff886c4ef086d))
* **ci:** upload source maps from the Vercel build ([#3865](https://github.com/andymai/gridfinity-layout-tool/issues/3865)) ([0a5b04f](https://github.com/andymai/gridfinity-layout-tool/commit/0a5b04f829d0b32e6e5f970768a57ea042be81ff))
* **lid:** weld a hinged bin's knuckles to the lip so they survive export ([#3868](https://github.com/andymai/gridfinity-layout-tool/issues/3868)) ([04cd8a6](https://github.com/andymai/gridfinity-layout-tool/commit/04cd8a6437925221bdafb0583d2622724762d7c8)), closes [#3861](https://github.com/andymai/gridfinity-layout-tool/issues/3861)


### Performance

* **ci:** move the twelve costliest generator files off the PR path ([#3867](https://github.com/andymai/gridfinity-layout-tool/issues/3867)) ([3d57431](https://github.com/andymai/gridfinity-layout-tool/commit/3d57431b4572684b7ef033e45d2a1ed4f62ee1ae))
* **ci:** restore the ESLint cache in CI ([#3866](https://github.com/andymai/gridfinity-layout-tool/issues/3866)) ([75670d8](https://github.com/andymai/gridfinity-layout-tool/commit/75670d889ce2f50798e86266bda0ff3162977469))
* **ci:** shard the main-branch suite and merge coverage ([#3870](https://github.com/andymai/gridfinity-layout-tool/issues/3870)) ([282d958](https://github.com/andymai/gridfinity-layout-tool/commit/282d9585bf63694ca1494882f1d1318fab9d9f77))
* **ci:** widen core test shards from three to six ([#3869](https://github.com/andymai/gridfinity-layout-tool/issues/3869)) ([c31cf56](https://github.com/andymai/gridfinity-layout-tool/commit/c31cf562ea40e1359a9efb30cde3b7761d5c61ad))

## [4.473.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.472.0...gridfinity-layout-tool-v4.473.0) (2026-08-24)


### Features

* **bin-designer:** offer centering as a way out of the clipped-cutout warning ([#3859](https://github.com/andymai/gridfinity-layout-tool/issues/3859)) ([0b6adc7](https://github.com/andymai/gridfinity-layout-tool/commit/0b6adc7c9bbe31623824ac6b2a3960bc99deca9c))
* **whats-new:** summarize recent updates after an app update ([#3850](https://github.com/andymai/gridfinity-layout-tool/issues/3850)) ([d4467be](https://github.com/andymai/gridfinity-layout-tool/commit/d4467bec64ee49a80d4e2d0f7e5a4bce6af0c681))


### Bug Fixes

* **bin-designer:** make stashEntryMask the whole usability gate ([#3856](https://github.com/andymai/gridfinity-layout-tool/issues/3856)) ([ecd9079](https://github.com/andymai/gridfinity-layout-tool/commit/ecd9079dd86cbe7c128b924f7a678cdf591183b8))
* **bin-designer:** preserve merged bento footprints through move, clone and stash ([#3849](https://github.com/andymai/gridfinity-layout-tool/issues/3849)) ([1f0e2f5](https://github.com/andymai/gridfinity-layout-tool/commit/1f0e2f51f85230367652483618b26299614a4b3c))
* **bin-designer:** shrink oversized cutouts when bringing them back on board ([#3846](https://github.com/andymai/gridfinity-layout-tool/issues/3846)) ([3f1c89e](https://github.com/andymai/gridfinity-layout-tool/commit/3f1c89e43226eaba6ca87fe2c28e563ea1d2fbeb))
* **bin-designer:** stop CompactNumberInput no-op writes that loop the renderer ([#3858](https://github.com/andymai/gridfinity-layout-tool/issues/3858)) ([d691cce](https://github.com/andymai/gridfinity-layout-tool/commit/d691cce688452b5f09d82f6c89f993e3b0baf25c))
* **design-linking:** make unlink actually clear a bin's linked design ([#3848](https://github.com/andymai/gridfinity-layout-tool/issues/3848)) ([fa355c2](https://github.com/andymai/gridfinity-layout-tool/commit/fa355c26dcf56a80ee1855c3797d31611117d452)), closes [#3830](https://github.com/andymai/gridfinity-layout-tool/issues/3830)
* **height:** stop rewriting typed mm heights via coarse unit snapping ([#3847](https://github.com/andymai/gridfinity-layout-tool/issues/3847)) ([1d773b9](https://github.com/andymai/gridfinity-layout-tool/commit/1d773b9c4e2e8dfe82cf1b36ebb2f0b24125b492))
* **skills:** quote the json-schemas description so its frontmatter parses ([#3853](https://github.com/andymai/gridfinity-layout-tool/issues/3853)) ([955a017](https://github.com/andymai/gridfinity-layout-tool/commit/955a017610ec027a31bb1944a4544d0b816268d1))

## [4.472.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.471.7...gridfinity-layout-tool-v4.472.0) (2026-08-24)


### Features

* **design-system:** collapse overflowing segmented controls into a balanced grid ([#3826](https://github.com/andymai/gridfinity-layout-tool/issues/3826)) ([8d5ae10](https://github.com/andymai/gridfinity-layout-tool/commit/8d5ae107ea6f4c33aa831cdcc0a952abfdce8bc7))
* **workshop:** multi-select, on-canvas resize, and camera tools ([#3823](https://github.com/andymai/gridfinity-layout-tool/issues/3823)) ([5306aa4](https://github.com/andymai/gridfinity-layout-tool/commit/5306aa46938bdc18d891a9ea241edda9d602c712))


### Bug Fixes

* **labs:** correct the Workshop flag warning about layout placement ([#3824](https://github.com/andymai/gridfinity-layout-tool/issues/3824)) ([6d07382](https://github.com/andymai/gridfinity-layout-tool/commit/6d073825e6f185d27724dd8a344f6e33a34b1a5b))

## [4.471.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.471.6...gridfinity-layout-tool-v4.471.7) (2026-08-24)


### Bug Fixes

* **generation:** cut rotated mesh imprints clockwise like the editor ([#3818](https://github.com/andymai/gridfinity-layout-tool/issues/3818)) ([c849e9e](https://github.com/andymai/gridfinity-layout-tool/commit/c849e9e7819ef57c18bd8fc40e0027b86d924e44))

## [4.471.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.471.5...gridfinity-layout-tool-v4.471.6) (2026-08-24)


### Bug Fixes

* **designer:** measure multi-select transforms by visual bounds ([#3816](https://github.com/andymai/gridfinity-layout-tool/issues/3816)) ([6159113](https://github.com/andymai/gridfinity-layout-tool/commit/6159113bb09f1ab01cbce92a9614e02345aae93d)), closes [#3807](https://github.com/andymai/gridfinity-layout-tool/issues/3807)
* **designer:** rotate validation silhouettes clockwise like the renderer ([#3814](https://github.com/andymai/gridfinity-layout-tool/issues/3814)) ([b0853fc](https://github.com/andymai/gridfinity-layout-tool/commit/b0853fcc93097698f5aadfdb818315d2c138a978)), closes [#3805](https://github.com/andymai/gridfinity-layout-tool/issues/3805)

## [4.471.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.471.4...gridfinity-layout-tool-v4.471.5) (2026-08-24)


### Bug Fixes

* **designer:** sample the true ellipse in the pathfinder preview ([#3813](https://github.com/andymai/gridfinity-layout-tool/issues/3813)) ([f4351e0](https://github.com/andymai/gridfinity-layout-tool/commit/f4351e0d968ec806c4028cd7e825f5c13f95a8ad)), closes [#3806](https://github.com/andymai/gridfinity-layout-tool/issues/3806)

## [4.471.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.471.3...gridfinity-layout-tool-v4.471.4) (2026-08-24)


### Bug Fixes

* **designer:** warn when a cutout's cut depth cannot be fully generated ([#3811](https://github.com/andymai/gridfinity-layout-tool/issues/3811)) ([25f7e71](https://github.com/andymai/gridfinity-layout-tool/commit/25f7e71e19856c6788667fd7056b104d6e72ec0a))

## [4.471.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.471.2...gridfinity-layout-tool-v4.471.3) (2026-08-24)


### Bug Fixes

* **designer:** ghost outline follows the cutout's true shape and cut ([#3809](https://github.com/andymai/gridfinity-layout-tool/issues/3809)) ([ec722f1](https://github.com/andymai/gridfinity-layout-tool/commit/ec722f14a208d00d6123167e7b71f2bc2d494c25))

## [4.471.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.471.1...gridfinity-layout-tool-v4.471.2) (2026-08-24)


### Bug Fixes

* **designer:** arrange repeats by their full pattern extent ([#3803](https://github.com/andymai/gridfinity-layout-tool/issues/3803)) ([dc08ea1](https://github.com/andymai/gridfinity-layout-tool/commit/dc08ea12cab616d230a4e6cee3795224732b0f76)), closes [#3799](https://github.com/andymai/gridfinity-layout-tool/issues/3799)

## [4.471.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.471.0...gridfinity-layout-tool-v4.471.1) (2026-08-24)


### Bug Fixes

* **designer:** keep cutout canvas overlays below the context menu ([#3801](https://github.com/andymai/gridfinity-layout-tool/issues/3801)) ([e5c268b](https://github.com/andymai/gridfinity-layout-tool/commit/e5c268b254243ef0bc1fe4092b9a54d26ac7225a)), closes [#3798](https://github.com/andymai/gridfinity-layout-tool/issues/3798)

## [4.471.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.470.0...gridfinity-layout-tool-v4.471.0) (2026-08-24)


### Features

* **designer:** lean angle for custom cutouts ([#3795](https://github.com/andymai/gridfinity-layout-tool/issues/3795)) ([bb1e90c](https://github.com/andymai/gridfinity-layout-tool/commit/bb1e90c987eca28be602a9c8c3df4f9702a0bd70))

## [4.470.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.469.0...gridfinity-layout-tool-v4.470.0) (2026-08-23)


### Features

* **generation:** magnet and screw holes on half-size feet ([#3781](https://github.com/andymai/gridfinity-layout-tool/issues/3781)) ([caaa9b0](https://github.com/andymai/gridfinity-layout-tool/commit/caaa9b0003b1f3124dccf6b7933b75b08f995e59))

## [4.469.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.468.0...gridfinity-layout-tool-v4.469.0) (2026-08-23)


### Features

* **workshop:** four showcase templates on the new parts ([#3787](https://github.com/andymai/gridfinity-layout-tool/issues/3787)) ([6ddfe25](https://github.com/andymai/gridfinity-layout-tool/commit/6ddfe256bb66b51b76988f10706881f93cb5c376))

## [4.468.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.467.0...gridfinity-layout-tool-v4.468.0) (2026-08-23)


### Features

* **workshop:** embossed and engraved labels on flat-faced parts ([#3785](https://github.com/andymai/gridfinity-layout-tool/issues/3785)) ([2a8d7ed](https://github.com/andymai/gridfinity-layout-tool/commit/2a8d7ed50b389898df98d8d1e258b08f13a8128b))

## [4.467.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.466.0...gridfinity-layout-tool-v4.467.0) (2026-08-23)


### Features

* **workshop:** angled bore bank part ([#3783](https://github.com/andymai/gridfinity-layout-tool/issues/3783)) ([c79b542](https://github.com/andymai/gridfinity-layout-tool/commit/c79b542c1a47fcbdab4db06c42878eba32657bad))

## [4.466.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.465.0...gridfinity-layout-tool-v4.466.0) (2026-08-23)


### Features

* **workshop:** comb slot rack and tiered riser parts ([#3782](https://github.com/andymai/gridfinity-layout-tool/issues/3782)) ([c6cba6b](https://github.com/andymai/gridfinity-layout-tool/commit/c6cba6b7d61888cc38bf5ca3a4f7ec9f805ac9f3))

## [4.465.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.464.0...gridfinity-layout-tool-v4.465.0) (2026-08-23)


### Features

* **workshop:** wedge base with tilted deck and flat socket ([#3779](https://github.com/andymai/gridfinity-layout-tool/issues/3779)) ([55f66f3](https://github.com/andymai/gridfinity-layout-tool/commit/55f66f3efa6827e6439927ca0b53eadbaa5d463e))

## [4.464.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.463.0...gridfinity-layout-tool-v4.464.0) (2026-08-23)


### Features

* **workshop:** counterbored tapered tubes and presentation tilt ([#3776](https://github.com/andymai/gridfinity-layout-tool/issues/3776)) ([a2e1688](https://github.com/andymai/gridfinity-layout-tool/commit/a2e168830ac6338e0520177600cc1eb9b11f331f))

## [4.463.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.462.0...gridfinity-layout-tool-v4.463.0) (2026-08-23)


### Features

* **bento:** non-rectangular compartments and merged leftover space ([#3773](https://github.com/andymai/gridfinity-layout-tool/issues/3773)) ([ef5cc87](https://github.com/andymai/gridfinity-layout-tool/commit/ef5cc87aba66cc4291e29758245904b790cefc16))

## [4.462.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.461.0...gridfinity-layout-tool-v4.462.0) (2026-08-23)


### Features

* **workshop:** canvas UX — presets, snap widget, context menu, shortcuts ([#3772](https://github.com/andymai/gridfinity-layout-tool/issues/3772)) ([3e5fb04](https://github.com/andymai/gridfinity-layout-tool/commit/3e5fb048a8ecc5627c36e2f86b1b0721e62d8a20))

## [4.461.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.460.0...gridfinity-layout-tool-v4.461.0) (2026-08-23)


### Features

* **workshop:** panel refresh on the cutout editor idioms ([#3770](https://github.com/andymai/gridfinity-layout-tool/issues/3770)) ([cb2ec5a](https://github.com/andymai/gridfinity-layout-tool/commit/cb2ec5a6df9789af8bdc895afb469dee17ecebb7))

## [4.460.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.459.1...gridfinity-layout-tool-v4.460.0) (2026-08-23)


### Features

* **workshop:** give parts a designed edge language ([#3768](https://github.com/andymai/gridfinity-layout-tool/issues/3768)) ([29a5661](https://github.com/andymai/gridfinity-layout-tool/commit/29a5661f4e402f39e8fac79312d738231cf68084))

## [4.459.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.459.0...gridfinity-layout-tool-v4.459.1) (2026-08-23)


### Bug Fixes

* **generation:** clip a tapered bin's raised floor to the wall ([#3766](https://github.com/andymai/gridfinity-layout-tool/issues/3766)) ([cc9fba6](https://github.com/andymai/gridfinity-layout-tool/commit/cc9fba60d453641a0c2fad12c46298acb4ec2f98))

## [4.459.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.458.0...gridfinity-layout-tool-v4.459.0) (2026-08-23)


### Features

* **workshop:** rotation gizmo and snap alignment guides ([#3764](https://github.com/andymai/gridfinity-layout-tool/issues/3764)) ([ade63d0](https://github.com/andymai/gridfinity-layout-tool/commit/ade63d00d316315586725bab7724f3d4e61080d0))

## [4.458.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.457.0...gridfinity-layout-tool-v4.458.0) (2026-08-23)


### Features

* **community:** publish Workshop assemblies from the designer ([#3761](https://github.com/andymai/gridfinity-layout-tool/issues/3761)) ([60d2651](https://github.com/andymai/gridfinity-layout-tool/commit/60d2651fec94dfba0049e827c886621c5f983a83))


### Bug Fixes

* **bin-designer:** stop side-panel controls clipping their content ([#3752](https://github.com/andymai/gridfinity-layout-tool/issues/3752)) ([a1e6eb0](https://github.com/andymai/gridfinity-layout-tool/commit/a1e6eb0199b1ccba2c6f2d69ce438e658d78d9d5))

## [4.457.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.456.0...gridfinity-layout-tool-v4.457.0) (2026-08-23)


### Features

* **community:** render, remix, and place published assemblies ([#3760](https://github.com/andymai/gridfinity-layout-tool/issues/3760)) ([1e03c2b](https://github.com/andymai/gridfinity-layout-tool/commit/1e03c2be7f33e9902454844efed4865a0ce0aa28))

## [4.456.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.455.0...gridfinity-layout-tool-v4.456.0) (2026-08-23)


### Features

* **community:** accept Workshop assemblies server-side ([#3758](https://github.com/andymai/gridfinity-layout-tool/issues/3758)) ([a7b56df](https://github.com/andymai/gridfinity-layout-tool/commit/a7b56df640b1dcc12a707d32e1c3be460771bf34))

## [4.455.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.454.0...gridfinity-layout-tool-v4.455.0) (2026-08-23)


### Features

* **workshop:** carry assemblies in shared and archived layouts ([#3755](https://github.com/andymai/gridfinity-layout-tool/issues/3755)) ([dc32c11](https://github.com/andymai/gridfinity-layout-tool/commit/dc32c115e2bdda3e9e462f3b386ca07f90dbd618))

## [4.454.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.453.0...gridfinity-layout-tool-v4.454.0) (2026-08-23)


### Features

* **workshop:** export placed assemblies from layout ZIP and inspector ([#3754](https://github.com/andymai/gridfinity-layout-tool/issues/3754)) ([2757bd3](https://github.com/andymai/gridfinity-layout-tool/commit/2757bd33881721a28bc6666058230c039f27eacd))

## [4.453.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.452.0...gridfinity-layout-tool-v4.453.0) (2026-08-23)


### Features

* **workshop:** render real assembly meshes in the drawer preview ([#3749](https://github.com/andymai/gridfinity-layout-tool/issues/3749)) ([a327022](https://github.com/andymai/gridfinity-layout-tool/commit/a3270228f38767a62b11591741eb0c6eb1610324))

## [4.452.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.451.0...gridfinity-layout-tool-v4.452.0) (2026-08-23)


### Features

* **workshop:** place assemblies in drawer layouts ([#3747](https://github.com/andymai/gridfinity-layout-tool/issues/3747)) ([5ba594d](https://github.com/andymai/gridfinity-layout-tool/commit/5ba594d51e3bf4a070963b2c00776ab4a0948d16))

## [4.451.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.450.0...gridfinity-layout-tool-v4.451.0) (2026-08-23)


### Features

* **workshop:** polish pass from the ship review ([#3744](https://github.com/andymai/gridfinity-layout-tool/issues/3744)) ([524b87d](https://github.com/andymai/gridfinity-layout-tool/commit/524b87d4a6a0f78120ef5ee9098c533847c32ae5))

## [4.450.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.449.0...gridfinity-layout-tool-v4.450.0) (2026-08-23)


### Features

* **schema:** make the JSON format docs discoverable ([#3739](https://github.com/andymai/gridfinity-layout-tool/issues/3739)) ([00d5946](https://github.com/andymai/gridfinity-layout-tool/commit/00d59461658fc999eb5283a46df316e07730526d))

## [4.449.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.448.0...gridfinity-layout-tool-v4.449.0) (2026-08-23)


### Features

* **schema:** publish JSON Schemas for layout and bin design files ([#3735](https://github.com/andymai/gridfinity-layout-tool/issues/3735)) ([e6e6a20](https://github.com/andymai/gridfinity-layout-tool/commit/e6e6a203f79f965eeb248381778693b81666df26))

## [4.448.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.447.0...gridfinity-layout-tool-v4.448.0) (2026-08-23)


### Features

* **workshop:** tap-to-place touch adaptation ([#3737](https://github.com/andymai/gridfinity-layout-tool/issues/3737)) ([24d055b](https://github.com/andymai/gridfinity-layout-tool/commit/24d055b8c6e91fcd0dbc0439303b72f22dac18eb))

## [4.447.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.446.0...gridfinity-layout-tool-v4.447.0) (2026-08-23)


### Features

* **workshop:** migrate tool racks into Workshop and retire item_kinds ([#3734](https://github.com/andymai/gridfinity-layout-tool/issues/3734)) ([7406e4b](https://github.com/andymai/gridfinity-layout-tool/commit/7406e4b594a01e0831ca28a8e73e6e511f1b378e))

## [4.446.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.445.0...gridfinity-layout-tool-v4.446.0) (2026-08-23)


### Features

* **workshop:** advisory printability checker ([#3732](https://github.com/andymai/gridfinity-layout-tool/issues/3732)) ([310f247](https://github.com/andymai/gridfinity-layout-tool/commit/310f247f6f8d816b57c9c222085cd4c14053d40c))

## [4.445.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.444.0...gridfinity-layout-tool-v4.445.0) (2026-08-23)


### Features

* **workshop:** library autosave, cloud sync, and the server validation mirror ([#3730](https://github.com/andymai/gridfinity-layout-tool/issues/3730)) ([b9ee772](https://github.com/andymai/gridfinity-layout-tool/commit/b9ee77225f5502acb7dffcba341c72746f048c53))

## [4.444.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.443.0...gridfinity-layout-tool-v4.444.0) (2026-08-23)


### Features

* **workshop:** arrays, mirror, sibling arrange, and starter templates ([#3729](https://github.com/andymai/gridfinity-layout-tool/issues/3729)) ([25355c2](https://github.com/andymai/gridfinity-layout-tool/commit/25355c22e42349d090988a54405ea836ec5faee6))
* **workshop:** cutter profile picker and scan bridge ([#3727](https://github.com/andymai/gridfinity-layout-tool/issues/3727)) ([7806196](https://github.com/andymai/gridfinity-layout-tool/commit/7806196422ec235edc35985db43bb69ecc0bead1))

## [4.443.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.442.0...gridfinity-layout-tool-v4.443.0) (2026-08-23)


### Features

* **workshop:** sharpen swap and hologram scan-in ([#3726](https://github.com/andymai/gridfinity-layout-tool/issues/3726)) ([32b4b00](https://github.com/andymai/gridfinity-layout-tool/commit/32b4b006ee2c1343408a59f721bb76330906c6fb))
* **workshop:** worker generator, exact geometry, and STL/STEP/3MF export ([#3724](https://github.com/andymai/gridfinity-layout-tool/issues/3724)) ([94944f7](https://github.com/andymai/gridfinity-layout-tool/commit/94944f7b8489f10eedab9dfacd2a1942a7e7d8b4))

## [4.442.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.441.0...gridfinity-layout-tool-v4.442.0) (2026-08-22)


### Features

* **workshop:** 3D proxy editor with part placement, stacking, and undo ([#3722](https://github.com/andymai/gridfinity-layout-tool/issues/3722)) ([9bd4764](https://github.com/andymai/gridfinity-layout-tool/commit/9bd476415e8fc3dad303bce5e65658be2738d600))

## [4.441.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.440.4...gridfinity-layout-tool-v4.441.0) (2026-08-22)


### Features

* **workshop:** add the assembly item kind and schema behind a labs flag ([#3720](https://github.com/andymai/gridfinity-layout-tool/issues/3720)) ([779ca69](https://github.com/andymai/gridfinity-layout-tool/commit/779ca69b3c51e1c4ec3e062cb3be3a7999802ebb))

## [4.440.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.440.3...gridfinity-layout-tool-v4.440.4) (2026-08-22)


### Bug Fixes

* **baseplate:** let the plate page turn half-grid mode back off ([#3718](https://github.com/andymai/gridfinity-layout-tool/issues/3718)) ([2996b3b](https://github.com/andymai/gridfinity-layout-tool/commit/2996b3b4bc789eb4079e4b2f927bcde2d26da397))

## [4.440.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.440.2...gridfinity-layout-tool-v4.440.3) (2026-08-22)


### Bug Fixes

* **generation:** pass tessellation angular tolerance in radians ([#3716](https://github.com/andymai/gridfinity-layout-tool/issues/3716)) ([21520ef](https://github.com/andymai/gridfinity-layout-tool/commit/21520ef78ad1ef9bcc11708867f098c4b416cadd))

## [4.440.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.440.1...gridfinity-layout-tool-v4.440.2) (2026-08-22)


### Bug Fixes

* **bin-designer:** start stacking-lip color above the bin's top surface ([#3713](https://github.com/andymai/gridfinity-layout-tool/issues/3713)) ([6d05a2b](https://github.com/andymai/gridfinity-layout-tool/commit/6d05a2b90cf628cd4d0be1918df343942f441b37)), closes [#3705](https://github.com/andymai/gridfinity-layout-tool/issues/3705)

## [4.440.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.440.0...gridfinity-layout-tool-v4.440.1) (2026-08-22)


### Bug Fixes

* **generation:** give every bin the spec's 7mm dead space ([#3709](https://github.com/andymai/gridfinity-layout-tool/issues/3709)) ([5ebfdf1](https://github.com/andymai/gridfinity-layout-tool/commit/5ebfdf1a89a9eb2baf6e7a021f0ecb0e15015430))

## [4.440.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.439.0...gridfinity-layout-tool-v4.440.0) (2026-08-22)


### Features

* **bin-designer:** add a measuring tool and widen the ruler's snapping ([#3706](https://github.com/andymai/gridfinity-layout-tool/issues/3706)) ([0c2beca](https://github.com/andymai/gridfinity-layout-tool/commit/0c2beca22786937c8e52af1605f3c50e92813dab))

## [4.439.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.438.3...gridfinity-layout-tool-v4.439.0) (2026-08-22)


### Features

* **bin-designer:** make the cutout fill level reachable and floor-anchored ([#3701](https://github.com/andymai/gridfinity-layout-tool/issues/3701)) ([6cd3399](https://github.com/andymai/gridfinity-layout-tool/commit/6cd33998c55caa896dda5d59a631f2824f3791dd))

## [4.438.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.438.2...gridfinity-layout-tool-v4.438.3) (2026-08-22)


### Bug Fixes

* **baseplate:** place screw holes symmetrically about the piece centre ([#3699](https://github.com/andymai/gridfinity-layout-tool/issues/3699)) ([b7b95ff](https://github.com/andymai/gridfinity-layout-tool/commit/b7b95ff9127d5fce3c3009b652f709248906427f))

## [4.438.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.438.1...gridfinity-layout-tool-v4.438.2) (2026-08-22)


### Bug Fixes

* **bin-designer:** take the detachable floor from the spec's dead space ([#3704](https://github.com/andymai/gridfinity-layout-tool/issues/3704)) ([4a6eb01](https://github.com/andymai/gridfinity-layout-tool/commit/4a6eb01e2d0120c4c154a3a95095cdf1659ca68b))

## [4.438.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.438.0...gridfinity-layout-tool-v4.438.1) (2026-08-22)


### Bug Fixes

* **bin-designer:** make detachable feet press on by hand ([#3700](https://github.com/andymai/gridfinity-layout-tool/issues/3700)) ([c83f644](https://github.com/andymai/gridfinity-layout-tool/commit/c83f644e5fd02cbff24b9ca07454fe8b8357c99b))

## [4.438.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.437.0...gridfinity-layout-tool-v4.438.0) (2026-08-22)


### Features

* **grid-editor:** charge linked designs' real rise into stacking collision ([#3694](https://github.com/andymai/gridfinity-layout-tool/issues/3694)) ([41958dd](https://github.com/andymai/gridfinity-layout-tool/commit/41958dd0be6114646a5303186a446162e5b69821))

## [4.437.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.436.0...gridfinity-layout-tool-v4.437.0) (2026-08-22)


### Features

* **bin-designer:** place saved designs into the layout from My Designs ([#3692](https://github.com/andymai/gridfinity-layout-tool/issues/3692)) ([0ecb3f1](https://github.com/andymai/gridfinity-layout-tool/commit/0ecb3f1df472c2a9b99fe3372866a63b671dfd55))

## [4.436.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.435.5...gridfinity-layout-tool-v4.436.0) (2026-08-21)


### Features

* **bin-designer:** make diagonal dividers discoverable from the grid ([#3690](https://github.com/andymai/gridfinity-layout-tool/issues/3690)) ([ed07ce3](https://github.com/andymai/gridfinity-layout-tool/commit/ed07ce3891e08b97b63b22f156f90045f1010ffd))

## [4.435.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.435.4...gridfinity-layout-tool-v4.435.5) (2026-08-21)


### Bug Fixes

* **baseplate:** report the plate the drawer shape is cut to, and let the grid move inside it ([#3688](https://github.com/andymai/gridfinity-layout-tool/issues/3688)) ([02ccc49](https://github.com/andymai/gridfinity-layout-tool/commit/02ccc498d7fe86300a3c370e230fd6dc778bdc00))

## [4.435.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.435.3...gridfinity-layout-tool-v4.435.4) (2026-08-21)


### Bug Fixes

* **split-bin:** cut the rebuilt lip with the wall pattern ([#3686](https://github.com/andymai/gridfinity-layout-tool/issues/3686)) ([df710a3](https://github.com/andymai/gridfinity-layout-tool/commit/df710a30da41999d632962b6b3703d9f21cbea80))

## [4.435.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.435.2...gridfinity-layout-tool-v4.435.3) (2026-08-21)


### Bug Fixes

* **split-bin:** keep the split body's own lip in its dimensions ([#3684](https://github.com/andymai/gridfinity-layout-tool/issues/3684)) ([e04e98b](https://github.com/andymai/gridfinity-layout-tool/commit/e04e98b9cd63d5e03e9bb277a6d75d58fcdb5050))

## [4.435.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.435.1...gridfinity-layout-tool-v4.435.2) (2026-08-21)


### Bug Fixes

* **split-bin:** seat a cutout's shoulder round-over on the lip, not the wall top ([#3681](https://github.com/andymai/gridfinity-layout-tool/issues/3681)) ([d7cc414](https://github.com/andymai/gridfinity-layout-tool/commit/d7cc414f1520eeca658274342558f1bc9122c612)), closes [#3680](https://github.com/andymai/gridfinity-layout-tool/issues/3680)

## [4.435.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.435.0...gridfinity-layout-tool-v4.435.1) (2026-08-21)


### Bug Fixes

* **ci:** exhaustiveness check was asserting on one file, not 2,382 ([#3676](https://github.com/andymai/gridfinity-layout-tool/issues/3676)) ([cf6ea72](https://github.com/andymai/gridfinity-layout-tool/commit/cf6ea72ffb3774f6f0105360feb06305e4745f6b))

## [4.435.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.434.0...gridfinity-layout-tool-v4.435.0) (2026-08-21)


### Features

* **bin-designer:** lean compartment dividers off vertical ([#3664](https://github.com/andymai/gridfinity-layout-tool/issues/3664)) ([544fc49](https://github.com/andymai/gridfinity-layout-tool/commit/544fc49e7c4961eccd3f6bf9abf8c79554d7a9fc))

## [4.434.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.433.1...gridfinity-layout-tool-v4.434.0) (2026-08-20)


### Features

* **lid:** hinged lids with a filament pin ([#3661](https://github.com/andymai/gridfinity-layout-tool/issues/3661)) ([4111be2](https://github.com/andymai/gridfinity-layout-tool/commit/4111be2eac894bd845b256d37b2289a063337c8c))

## [4.433.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.433.0...gridfinity-layout-tool-v4.433.1) (2026-08-20)


### Bug Fixes

* **split:** cut a split bin's lip in the frame its body was built in ([#3659](https://github.com/andymai/gridfinity-layout-tool/issues/3659)) ([5729217](https://github.com/andymai/gridfinity-layout-tool/commit/57292170e172211a76605dba75853adaabcb2686)), closes [#3648](https://github.com/andymai/gridfinity-layout-tool/issues/3648)

## [4.433.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.432.0...gridfinity-layout-tool-v4.433.0) (2026-08-20)


### Features

* **cutout-editor:** fill the bin with a repeat in one click ([#3656](https://github.com/andymai/gridfinity-layout-tool/issues/3656)) ([b750851](https://github.com/andymai/gridfinity-layout-tool/commit/b750851e18ced60902f55bb4e2b04852c0c40a9f)), closes [#3641](https://github.com/andymai/gridfinity-layout-tool/issues/3641)

## [4.432.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.431.0...gridfinity-layout-tool-v4.432.0) (2026-08-20)


### Features

* **cutout-editor:** make the canvas viewport hold still ([#3652](https://github.com/andymai/gridfinity-layout-tool/issues/3652)) ([8243e1b](https://github.com/andymai/gridfinity-layout-tool/commit/8243e1b4458a86e4ab49490e36cc868f39c76e55))

## [4.431.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.430.0...gridfinity-layout-tool-v4.431.0) (2026-08-20)


### Features

* **cutout-editor:** let repeats nest and overlap ([#3650](https://github.com/andymai/gridfinity-layout-tool/issues/3650)) ([5872f86](https://github.com/andymai/gridfinity-layout-tool/commit/5872f86fb9237f05541eb1d3d15cd1991c682e90))

## [4.430.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.429.0...gridfinity-layout-tool-v4.430.0) (2026-08-20)


### Features

* **cutout-editor:** center a selection on one axis at a time ([#3647](https://github.com/andymai/gridfinity-layout-tool/issues/3647)) ([4a6c5d6](https://github.com/andymai/gridfinity-layout-tool/commit/4a6c5d6edbe1f98643c745b647b055515c3e2cb5))

## [4.429.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.428.2...gridfinity-layout-tool-v4.429.0) (2026-08-20)


### Features

* **bin-designer:** offer the design JSON from the export dialog ([#3649](https://github.com/andymai/gridfinity-layout-tool/issues/3649)) ([867a761](https://github.com/andymai/gridfinity-layout-tool/commit/867a76196bee3c6b1866c99dc133700ddd63312d)), closes [#3640](https://github.com/andymai/gridfinity-layout-tool/issues/3640)

## [4.428.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.428.1...gridfinity-layout-tool-v4.428.2) (2026-08-20)


### Bug Fixes

* **bin-designer:** resolve the interior card against the style it claims ([#3644](https://github.com/andymai/gridfinity-layout-tool/issues/3644)) ([344b673](https://github.com/andymai/gridfinity-layout-tool/commit/344b6738f35c86d29dd2523b77dae6d00e8a9f8d))

## [4.428.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.428.0...gridfinity-layout-tool-v4.428.1) (2026-08-20)


### Bug Fixes

* **drawer-shape:** release the grid floor an axis's measurement already holds ([#3643](https://github.com/andymai/gridfinity-layout-tool/issues/3643)) ([434cba1](https://github.com/andymai/gridfinity-layout-tool/commit/434cba1fded2abcb507be1cc67c5f996fe8e4421)), closes [#3635](https://github.com/andymai/gridfinity-layout-tool/issues/3635)

## [4.428.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.427.1...gridfinity-layout-tool-v4.428.0) (2026-08-19)


### Features

* **bin-designer:** give the multi-color accent bands adjustable heights ([#3631](https://github.com/andymai/gridfinity-layout-tool/issues/3631)) ([8775b53](https://github.com/andymai/gridfinity-layout-tool/commit/8775b53c46d545fe84ef9078b12a17275be82507))

## [4.427.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.427.0...gridfinity-layout-tool-v4.427.1) (2026-08-19)


### Bug Fixes

* **api:** accept a lid-lip colour grid on share and sync ([#3629](https://github.com/andymai/gridfinity-layout-tool/issues/3629)) ([60dbd03](https://github.com/andymai/gridfinity-layout-tool/commit/60dbd03a1d09cfa33b26ee3de367a4711bfa1b68))

## [4.427.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.426.6...gridfinity-layout-tool-v4.427.0) (2026-08-19)


### Features

* **bin-designer:** carry a design's overhang on its registry entry ([#3626](https://github.com/andymai/gridfinity-layout-tool/issues/3626)) ([f7b7fde](https://github.com/andymai/gridfinity-layout-tool/commit/f7b7fde4c01bde8fc5887b556f370316ebc87504))

## [4.426.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.426.5...gridfinity-layout-tool-v4.426.6) (2026-08-19)


### Bug Fixes

* **print-export:** list the pieces the exporter actually cuts ([#3624](https://github.com/andymai/gridfinity-layout-tool/issues/3624)) ([998a783](https://github.com/andymai/gridfinity-layout-tool/commit/998a7839d556149203822828b6d5849436acd53e))

## [4.426.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.426.4...gridfinity-layout-tool-v4.426.5) (2026-08-19)


### Bug Fixes

* **drawer-shape:** bound a custom perimeter by the drawer, not by the grid ([#3622](https://github.com/andymai/gridfinity-layout-tool/issues/3622)) ([392e2e4](https://github.com/andymai/gridfinity-layout-tool/commit/392e2e43f3158274363faa72fcb61b2c087d8ee0))

## [4.426.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.426.3...gridfinity-layout-tool-v4.426.4) (2026-08-19)


### Bug Fixes

* **baseplate:** draw the split mini-map in millimetres, on one shared box ([#3619](https://github.com/andymai/gridfinity-layout-tool/issues/3619)) ([ae3d51f](https://github.com/andymai/gridfinity-layout-tool/commit/ae3d51f67985a9b1bdac726af88e265860ecbba9)), closes [#3613](https://github.com/andymai/gridfinity-layout-tool/issues/3613)

## [4.426.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.426.2...gridfinity-layout-tool-v4.426.3) (2026-08-19)


### Bug Fixes

* **bin-designer:** charge a bin's overhang against the print bed when planning a split ([#3618](https://github.com/andymai/gridfinity-layout-tool/issues/3618)) ([be48b26](https://github.com/andymai/gridfinity-layout-tool/commit/be48b268246ae425d8a7c66d0d2ee070e831bd4a))

## [4.426.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.426.1...gridfinity-layout-tool-v4.426.2) (2026-08-19)


### Bug Fixes

* **generation:** place a split bin's stacking lip on the collar-raised rim ([#3616](https://github.com/andymai/gridfinity-layout-tool/issues/3616)) ([7348d79](https://github.com/andymai/gridfinity-layout-tool/commit/7348d791fbafeca04271386aefeaed1d145e03f3)), closes [#3615](https://github.com/andymai/gridfinity-layout-tool/issues/3615)

## [4.426.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.426.0...gridfinity-layout-tool-v4.426.1) (2026-08-18)


### Bug Fixes

* **generation:** key slot cuts on the divider they accept ([#3610](https://github.com/andymai/gridfinity-layout-tool/issues/3610)) ([ea53364](https://github.com/andymai/gridfinity-layout-tool/commit/ea53364449b924bb62e24452f816d3362b7a3b84))

## [4.426.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.425.0...gridfinity-layout-tool-v4.426.0) (2026-08-18)


### Features

* **bin-designer:** a type system for engraved text ([#3608](https://github.com/andymai/gridfinity-layout-tool/issues/3608)) ([ddc4c9a](https://github.com/andymai/gridfinity-layout-tool/commit/ddc4c9a827468cf16a804b1bc6e96b60e76eeb9c))

## [4.425.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.12...gridfinity-layout-tool-v4.425.0) (2026-08-18)


### Features

* **bin-designer:** knife blocks with blade slots and handle rests ([#3606](https://github.com/andymai/gridfinity-layout-tool/issues/3606)) ([7c1babc](https://github.com/andymai/gridfinity-layout-tool/commit/7c1babca54d6ef111693477da10c1b40b641d3d7))

## [4.424.12](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.11...gridfinity-layout-tool-v4.424.12) (2026-08-18)


### Bug Fixes

* **generation:** key every cache on what its builder actually reads ([#3603](https://github.com/andymai/gridfinity-layout-tool/issues/3603)) ([5522916](https://github.com/andymai/gridfinity-layout-tool/commit/552291630e813d93fd282ff56ca5131a7a98e7c4))

## [4.424.11](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.10...gridfinity-layout-tool-v4.424.11) (2026-08-18)


### Bug Fixes

* **bin-designer:** close the cross-feature seams the iteration-3 probes surfaced ([#3601](https://github.com/andymai/gridfinity-layout-tool/issues/3601)) ([8ae2a7b](https://github.com/andymai/gridfinity-layout-tool/commit/8ae2a7be5c615acdd552c9241c93bb5f057a475b))

## [4.424.10](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.9...gridfinity-layout-tool-v4.424.10) (2026-08-18)


### Bug Fixes

* **bin-designer:** reactive export readiness, resilient sample exports, live label refits ([#3599](https://github.com/andymai/gridfinity-layout-tool/issues/3599)) ([67faa17](https://github.com/andymai/gridfinity-layout-tool/commit/67faa173ec53d28f8f97c114100258042d464a79))

## [4.424.9](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.8...gridfinity-layout-tool-v4.424.9) (2026-08-18)


### Bug Fixes

* **bin-designer:** reach the screw corners, follow the feet plan in estimates, guard socket merges ([#3597](https://github.com/andymai/gridfinity-layout-tool/issues/3597)) ([5e0be21](https://github.com/andymai/gridfinity-layout-tool/commit/5e0be212c1cc1f470bdcfb9132bc7f2718522f43))

## [4.424.8](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.7...gridfinity-layout-tool-v4.424.8) (2026-08-18)


### Bug Fixes

* **bin-designer:** keep Bento colours honest through clears, duplicates and shifted walls ([#3595](https://github.com/andymai/gridfinity-layout-tool/issues/3595)) ([07c19c4](https://github.com/andymai/gridfinity-layout-tool/commit/07c19c471728ba9b400957c655e5f5af0faaaa6a))

## [4.424.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.6...gridfinity-layout-tool-v4.424.7) (2026-08-18)


### Bug Fixes

* **bin-designer:** keep the relief escape hatch reachable and stop silent batch drops ([#3593](https://github.com/andymai/gridfinity-layout-tool/issues/3593)) ([a77a48e](https://github.com/andymai/gridfinity-layout-tool/commit/a77a48e7bc3d480813d21d575e3a0097afab1758))

## [4.424.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.5...gridfinity-layout-tool-v4.424.6) (2026-08-18)


### Bug Fixes

* **bin-designer:** honest lid-cutout window corners, hidden ghosts, and the colour gate ([#3590](https://github.com/andymai/gridfinity-layout-tool/issues/3590)) ([fac59e0](https://github.com/andymai/gridfinity-layout-tool/commit/fac59e0b11ea3da131444bf97cdd0e4b78284565))

## [4.424.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.4...gridfinity-layout-tool-v4.424.5) (2026-08-18)


### Bug Fixes

* **bin-designer:** measure the fit-test card the way the builder cuts it ([#3589](https://github.com/andymai/gridfinity-layout-tool/issues/3589)) ([6f13895](https://github.com/andymai/gridfinity-layout-tool/commit/6f138956f52485cf9ca96b9e718a9fa237d5c62e))

## [4.424.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.3...gridfinity-layout-tool-v4.424.4) (2026-08-18)


### Bug Fixes

* **bin-designer:** align label-socket planning frames and unblock the socket editor ([#3587](https://github.com/andymai/gridfinity-layout-tool/issues/3587)) ([f830ba9](https://github.com/andymai/gridfinity-layout-tool/commit/f830ba9668408137c2a44742125f52fac6f14a80))

## [4.424.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.2...gridfinity-layout-tool-v4.424.3) (2026-08-18)


### Bug Fixes

* **bin-designer:** make detachable feet honest about placement, preview frame and stale caches ([#3585](https://github.com/andymai/gridfinity-layout-tool/issues/3585)) ([9582069](https://github.com/andymai/gridfinity-layout-tool/commit/95820699d68de54973f900f5222927180ca94537))

## [4.424.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.1...gridfinity-layout-tool-v4.424.2) (2026-08-18)


### Bug Fixes

* **generation:** harden the sliding lid against corners, crowns, cutouts and phantom relief ([#3583](https://github.com/andymai/gridfinity-layout-tool/issues/3583)) ([1cd0812](https://github.com/andymai/gridfinity-layout-tool/commit/1cd08122454e55fae4db7ff22918f58627e67b63))

## [4.424.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.424.0...gridfinity-layout-tool-v4.424.1) (2026-08-18)


### Bug Fixes

* **layout:** correct the drawer-ceiling model for slide lids, plates and lipless stacks ([#3581](https://github.com/andymai/gridfinity-layout-tool/issues/3581)) ([d3872ff](https://github.com/andymai/gridfinity-layout-tool/commit/d3872ffa44670a312828221500fbc4dcae6de199))

## [4.424.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.423.0...gridfinity-layout-tool-v4.424.0) (2026-08-18)


### Features

* **layout:** check the printed layout against the measured drawer height ([#3579](https://github.com/andymai/gridfinity-layout-tool/issues/3579)) ([1cbff48](https://github.com/andymai/gridfinity-layout-tool/commit/1cbff48a2e98582c5cb0eaf67d19789521dbf3aa))

## [4.423.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.422.0...gridfinity-layout-tool-v4.423.0) (2026-08-18)


### Features

* **bin-designer:** swappable label sockets for cutout bins ([#3577](https://github.com/andymai/gridfinity-layout-tool/issues/3577)) ([a6114b7](https://github.com/andymai/gridfinity-layout-tool/commit/a6114b78fee4a90c48bec07ee5d1bca36ad103ab))

## [4.422.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.421.0...gridfinity-layout-tool-v4.422.0) (2026-08-18)


### Features

* **bin-designer:** add sliding lids ([#3575](https://github.com/andymai/gridfinity-layout-tool/issues/3575)) ([b38310a](https://github.com/andymai/gridfinity-layout-tool/commit/b38310a50d84bb561c9d8682f900b54374a5d2c3))

## [4.421.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.420.0...gridfinity-layout-tool-v4.421.0) (2026-08-17)


### Features

* **bin-designer:** print a fit test for cutouts ([#3572](https://github.com/andymai/gridfinity-layout-tool/issues/3572)) ([95c610f](https://github.com/andymai/gridfinity-layout-tool/commit/95c610f94be492ceba0004456dbe4d0ace8be067)), closes [#3541](https://github.com/andymai/gridfinity-layout-tool/issues/3541)

## [4.420.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.419.1...gridfinity-layout-tool-v4.420.0) (2026-08-17)


### Features

* **bin-designer:** show lid cutout keep-outs instead of clipping silently ([#3570](https://github.com/andymai/gridfinity-layout-tool/issues/3570)) ([ed720c1](https://github.com/andymai/gridfinity-layout-tool/commit/ed720c10059df55cc8fc580602ed9fef7c7cf5f9)), closes [#3563](https://github.com/andymai/gridfinity-layout-tool/issues/3563)

## [4.419.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.419.0...gridfinity-layout-tool-v4.419.1) (2026-08-17)


### Bug Fixes

* **bin-designer:** finish the detachable feet's remaining surfaces ([#3565](https://github.com/andymai/gridfinity-layout-tool/issues/3565)) ([9ff7678](https://github.com/andymai/gridfinity-layout-tool/commit/9ff76784b5bde901e66e21317e0fea2d539f216e))
* **generation:** honour hidden cutouts in the bin's cavity builder ([#3568](https://github.com/andymai/gridfinity-layout-tool/issues/3568)) ([00d9812](https://github.com/andymai/gridfinity-layout-tool/commit/00d9812838a64291099d515e0056c5addeb756d3)), closes [#3561](https://github.com/andymai/gridfinity-layout-tool/issues/3561)

## [4.419.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.418.2...gridfinity-layout-tool-v4.419.0) (2026-08-17)


### Features

* **bin-designer:** cut holes in a generated lid ([#3544](https://github.com/andymai/gridfinity-layout-tool/issues/3544)) ([7b5ae40](https://github.com/andymai/gridfinity-layout-tool/commit/7b5ae40b80f067d7b60c222e729409b51244cba3))

## [4.418.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.418.1...gridfinity-layout-tool-v4.418.2) (2026-08-17)


### Bug Fixes

* **generation:** one answer to whether a bin has detachable feet ([#3558](https://github.com/andymai/gridfinity-layout-tool/issues/3558)) ([8ea9b79](https://github.com/andymai/gridfinity-layout-tool/commit/8ea9b79e0a838688081872ab1f6edcf5512ea0a7))

## [4.418.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.418.0...gridfinity-layout-tool-v4.418.1) (2026-08-17)


### Bug Fixes

* **bin-designer:** finish detachable feet ([#3556](https://github.com/andymai/gridfinity-layout-tool/issues/3556)) ([9464cb6](https://github.com/andymai/gridfinity-layout-tool/commit/9464cb6e0e3b609c62ca84a0edd66ceb29842715))

## [4.418.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.417.0...gridfinity-layout-tool-v4.418.0) (2026-08-17)


### Features

* **bin-designer:** detachable feet ([#3543](https://github.com/andymai/gridfinity-layout-tool/issues/3543)) ([9752e2d](https://github.com/andymai/gridfinity-layout-tool/commit/9752e2de496ad0ec51277c1e5c507af9f23ea296))

## [4.417.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.416.0...gridfinity-layout-tool-v4.417.0) (2026-08-16)


### Features

* **bin-designer:** surface the cutout tile feature as Repeat, and detect hand-built patterns ([#3539](https://github.com/andymai/gridfinity-layout-tool/issues/3539)) ([3bbfa62](https://github.com/andymai/gridfinity-layout-tool/commit/3bbfa627fade53c4990f65aaf52fd28341cdd062))

## [4.416.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.415.0...gridfinity-layout-tool-v4.416.0) (2026-08-16)


### Features

* **bin-designer:** round the shoulders where a wall cutout meets the rim ([#3535](https://github.com/andymai/gridfinity-layout-tool/issues/3535)) ([4031882](https://github.com/andymai/gridfinity-layout-tool/commit/4031882102d0373d23885da48f732a5bea75a6d8))

## [4.415.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.414.2...gridfinity-layout-tool-v4.415.0) (2026-08-16)


### Features

* **bin-designer:** add an underside lightweight floor mode ([#3531](https://github.com/andymai/gridfinity-layout-tool/issues/3531)) ([47cd4db](https://github.com/andymai/gridfinity-layout-tool/commit/47cd4db4408f23bd09cbfc953789116f1de164a6))

## [4.414.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.414.1...gridfinity-layout-tool-v4.414.2) (2026-08-16)


### Bug Fixes

* **bin-inspector:** measure the stacking junction instead of assuming the lip ([#3529](https://github.com/andymai/gridfinity-layout-tool/issues/3529)) ([b3ceaff](https://github.com/andymai/gridfinity-layout-tool/commit/b3ceaff64cf1d7a49ecff0cd6fd2cfcf51363e32))

## [4.414.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.414.0...gridfinity-layout-tool-v4.414.1) (2026-08-16)


### Bug Fixes

* **print-export:** recalibrate the bin base volume against measured solids ([#3528](https://github.com/andymai/gridfinity-layout-tool/issues/3528)) ([091c53b](https://github.com/andymai/gridfinity-layout-tool/commit/091c53b04506efaf66b2f3641089fe8d87893b65))

## [4.414.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.413.0...gridfinity-layout-tool-v4.414.0) (2026-08-16)


### Features

* **bin-designer:** raise the bin height cap to 50 units ([#3518](https://github.com/andymai/gridfinity-layout-tool/issues/3518)) ([7acd50e](https://github.com/andymai/gridfinity-layout-tool/commit/7acd50e1414ed119bbf53d964a3ea0d83a1cbd46))

## [4.413.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.412.1...gridfinity-layout-tool-v4.413.0) (2026-08-16)


### Features

* **analytics:** key the upper milestones on designer depth ([#3517](https://github.com/andymai/gridfinity-layout-tool/issues/3517)) ([a3702cc](https://github.com/andymai/gridfinity-layout-tool/commit/a3702cc7bb97d1d9fe828d3bd7c4c91a020227d0))

## [4.412.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.412.0...gridfinity-layout-tool-v4.412.1) (2026-08-15)


### Bug Fixes

* **ux:** stop losing the geometry engine and the export button ([#3512](https://github.com/andymai/gridfinity-layout-tool/issues/3512)) ([5738f77](https://github.com/andymai/gridfinity-layout-tool/commit/5738f77ec34a14bc6b62d397d23e8ee91d3554c4))

## [4.412.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.411.1...gridfinity-layout-tool-v4.412.0) (2026-08-15)


### Features

* **bento:** merge only the bins you select ([#3510](https://github.com/andymai/gridfinity-layout-tool/issues/3510)) ([b222bec](https://github.com/andymai/gridfinity-layout-tool/commit/b222bec0eb7274a5185f38b74bb93ae3a035e230))

## [4.411.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.411.0...gridfinity-layout-tool-v4.411.1) (2026-08-15)


### Performance

* stop re-paying for work already done ([#3508](https://github.com/andymai/gridfinity-layout-tool/issues/3508)) ([0ac2582](https://github.com/andymai/gridfinity-layout-tool/commit/0ac25823ef2a3515e56179e38c664c4d60566d85))

## [4.411.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.410.0...gridfinity-layout-tool-v4.411.0) (2026-08-15)


### Features

* **supporters:** recognize Ko-fi supporters in the app ([#3506](https://github.com/andymai/gridfinity-layout-tool/issues/3506)) ([beeafdf](https://github.com/andymai/gridfinity-layout-tool/commit/beeafdfded3c115a97bf171f340e3a84d146c9e5))

## [4.410.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.409.2...gridfinity-layout-tool-v4.410.0) (2026-08-14)


### Features

* **export:** split oversized bins into pieces for STEP ([#3501](https://github.com/andymai/gridfinity-layout-tool/issues/3501)) ([#3504](https://github.com/andymai/gridfinity-layout-tool/issues/3504)) ([c55bdc5](https://github.com/andymai/gridfinity-layout-tool/commit/c55bdc5a4f21ca44c1cc7818d780a55052128f19))

## [4.409.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.409.1...gridfinity-layout-tool-v4.409.2) (2026-08-14)


### Bug Fixes

* **preview:** fit the floor name label to its band ([#3502](https://github.com/andymai/gridfinity-layout-tool/issues/3502)) ([43c98b6](https://github.com/andymai/gridfinity-layout-tool/commit/43c98b63a5199b81c792ecec9625cb4a0d3480d9))

## [4.409.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.409.0...gridfinity-layout-tool-v4.409.1) (2026-08-14)


### Bug Fixes

* **lid:** clip custom-shape click rails around cutouts and handles ([#3482](https://github.com/andymai/gridfinity-layout-tool/issues/3482)) ([#3499](https://github.com/andymai/gridfinity-layout-tool/issues/3499)) ([de6158c](https://github.com/andymai/gridfinity-layout-tool/commit/de6158cd1505f3ad94aa6a0a89d94aabd671f8b8))

## [4.409.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.408.2...gridfinity-layout-tool-v4.409.0) (2026-08-14)


### Features

* **lid:** relieve the interior of custom-shape bins ([#3497](https://github.com/andymai/gridfinity-layout-tool/issues/3497)) ([77b2ba6](https://github.com/andymai/gridfinity-layout-tool/commit/77b2ba61258b99aa10576ac545c29efcd1c23c5b))

## [4.408.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.408.1...gridfinity-layout-tool-v4.408.2) (2026-08-14)


### Bug Fixes

* **lid:** segment click rails around cutouts and handles ([#3495](https://github.com/andymai/gridfinity-layout-tool/issues/3495)) ([17da70b](https://github.com/andymai/gridfinity-layout-tool/commit/17da70b47e981806f6a8293aa813f8cb5741e14f))

## [4.408.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.408.0...gridfinity-layout-tool-v4.408.1) (2026-08-14)


### Bug Fixes

* **bento:** unify the Experimental badge on the info tone ([#3493](https://github.com/andymai/gridfinity-layout-tool/issues/3493)) ([9da910f](https://github.com/andymai/gridfinity-layout-tool/commit/9da910f2a8bee5609857bfbcdb32e5217186d080))

## [4.408.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.407.0...gridfinity-layout-tool-v4.408.0) (2026-08-14)


### Features

* **bento:** per-compartment shadow-box colours ([#3491](https://github.com/andymai/gridfinity-layout-tool/issues/3491)) ([511aa65](https://github.com/andymai/gridfinity-layout-tool/commit/511aa654d1e511ed2c637e51f4f7d7aed5a9ac75))

## [4.407.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.406.1...gridfinity-layout-tool-v4.407.0) (2026-08-14)


### Features

* **bento:** graduate the Bento designer out of Labs ([#3489](https://github.com/andymai/gridfinity-layout-tool/issues/3489)) ([441f8e8](https://github.com/andymai/gridfinity-layout-tool/commit/441f8e807f02cfa730f0cb7afeec0c24f7e175cf))

## [4.406.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.406.0...gridfinity-layout-tool-v4.406.1) (2026-08-14)


### Bug Fixes

* resolve code-scanning alert [#81](https://github.com/andymai/gridfinity-layout-tool/issues/81) by flooring nanoid to 3.3.18 ([#3485](https://github.com/andymai/gridfinity-layout-tool/issues/3485)) ([9fd6e50](https://github.com/andymai/gridfinity-layout-tool/commit/9fd6e50fa7991581e1a880298a03a9767f035c40))

## [4.406.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.405.1...gridfinity-layout-tool-v4.406.0) (2026-08-14)


### Features

* **lid:** carve the seating envelope out of the interior ([#3477](https://github.com/andymai/gridfinity-layout-tool/issues/3477)) ([#3484](https://github.com/andymai/gridfinity-layout-tool/issues/3484)) ([404910d](https://github.com/andymai/gridfinity-layout-tool/commit/404910d4c1f9c696f3cfe9cbd989d478532e0e3c))

## [4.405.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.405.0...gridfinity-layout-tool-v4.405.1) (2026-08-14)


### Bug Fixes

* **lid:** notch click rails around compartment dividers ([#3477](https://github.com/andymai/gridfinity-layout-tool/issues/3477)) ([#3479](https://github.com/andymai/gridfinity-layout-tool/issues/3479)) ([e259230](https://github.com/andymai/gridfinity-layout-tool/commit/e259230c4191307da73100e8199a2de976cc219e))

## [4.405.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.404.3...gridfinity-layout-tool-v4.405.0) (2026-08-13)


### Features

* **bin-designer:** per-axis foot lattice for half-offset bins ([#3473](https://github.com/andymai/gridfinity-layout-tool/issues/3473)) ([ac3310a](https://github.com/andymai/gridfinity-layout-tool/commit/ac3310a92396d98adbfed3447dacc442dde0e650))

## [4.404.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.404.2...gridfinity-layout-tool-v4.404.3) (2026-08-13)


### Bug Fixes

* **bin-designer:** arrange cutout groups as one body ([#3470](https://github.com/andymai/gridfinity-layout-tool/issues/3470)) ([0eb57e7](https://github.com/andymai/gridfinity-layout-tool/commit/0eb57e7c7d48cdd79042b3f41e15f1dd707045f8)), closes [#3468](https://github.com/andymai/gridfinity-layout-tool/issues/3468)

## [4.404.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.404.1...gridfinity-layout-tool-v4.404.2) (2026-08-13)


### Bug Fixes

* **community:** detail modal and print reporting polish ([#3469](https://github.com/andymai/gridfinity-layout-tool/issues/3469)) ([aed3517](https://github.com/andymai/gridfinity-layout-tool/commit/aed3517b152773301bc67b63f600e9ec616c641e))

## [4.404.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.404.0...gridfinity-layout-tool-v4.404.1) (2026-08-12)


### Bug Fixes

* **baseplate:** take the half unit that fits when typing plate dimensions ([#3464](https://github.com/andymai/gridfinity-layout-tool/issues/3464)) ([a3a15b4](https://github.com/andymai/gridfinity-layout-tool/commit/a3a15b4ea5e39701d6398123bb692af99a679740))

## [4.404.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.403.0...gridfinity-layout-tool-v4.404.0) (2026-08-12)


### Features

* **bin-designer:** Bentobox workspace usability and polish pass ([#3461](https://github.com/andymai/gridfinity-layout-tool/issues/3461)) ([ea3d038](https://github.com/andymai/gridfinity-layout-tool/commit/ea3d0387989c942dc9a6d77638ec87535c0fce08))

## [4.403.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.402.5...gridfinity-layout-tool-v4.403.0) (2026-08-12)


### Features

* **bin-designer:** draw-to-create Bentobox workspace with stash ([#3459](https://github.com/andymai/gridfinity-layout-tool/issues/3459)) ([b191c24](https://github.com/andymai/gridfinity-layout-tool/commit/b191c2416b0fcf7c1de69f3e390e68e78578f7a4))

## [4.402.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.402.4...gridfinity-layout-tool-v4.402.5) (2026-08-12)


### Bug Fixes

* **baseplate:** cross-cut screw cells into boss pads instead of full floors ([#3457](https://github.com/andymai/gridfinity-layout-tool/issues/3457)) ([bfa924a](https://github.com/andymai/gridfinity-layout-tool/commit/bfa924adfb5a7f128ea1d4aec30fe125e33a34c1))

## [4.402.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.402.3...gridfinity-layout-tool-v4.402.4) (2026-08-12)


### Bug Fixes

* **baseplate:** regenerate the preview when screw, fit-offset or lightweight params change ([#3455](https://github.com/andymai/gridfinity-layout-tool/issues/3455)) ([8fda713](https://github.com/andymai/gridfinity-layout-tool/commit/8fda713cb2fe39f1b7b5733b2c0b1643bfd09974))

## [4.402.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.402.2...gridfinity-layout-tool-v4.402.3) (2026-08-12)


### Bug Fixes

* **lid:** seat the magnet pads under the mating skirt ([#3450](https://github.com/andymai/gridfinity-layout-tool/issues/3450)) ([#3451](https://github.com/andymai/gridfinity-layout-tool/issues/3451)) ([48c740b](https://github.com/andymai/gridfinity-layout-tool/commit/48c740be4a3a5020fb995c90731222f71398621c))

## [4.402.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.402.1...gridfinity-layout-tool-v4.402.2) (2026-08-12)


### Bug Fixes

* **export:** disable STEP for designs with mesh imprint cutouts ([#3449](https://github.com/andymai/gridfinity-layout-tool/issues/3449)) ([#3452](https://github.com/andymai/gridfinity-layout-tool/issues/3452)) ([5b36496](https://github.com/andymai/gridfinity-layout-tool/commit/5b36496c384173e835481663420610e4f652454e))

## [4.402.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.402.0...gridfinity-layout-tool-v4.402.1) (2026-08-12)


### Bug Fixes

* **generation:** namespace the persisted mesh cache by kernel ([#3447](https://github.com/andymai/gridfinity-layout-tool/issues/3447)) ([6969be3](https://github.com/andymai/gridfinity-layout-tool/commit/6969be351b58bcb7462db3da2442cdb59992d201))

## [4.402.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.401.0...gridfinity-layout-tool-v4.402.0) (2026-08-12)


### Features

* **labs:** graduate the baseplate screw holes flag ([#3442](https://github.com/andymai/gridfinity-layout-tool/issues/3442)) ([e8383b8](https://github.com/andymai/gridfinity-layout-tool/commit/e8383b805083a4cc939feea3b242d8f7ba08143e))

## [4.401.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.400.3...gridfinity-layout-tool-v4.401.0) (2026-08-11)


### Features

* rebrand the merge-bins lab as Bento and rebuild its UX ([#3430](https://github.com/andymai/gridfinity-layout-tool/issues/3430)) ([4b79b06](https://github.com/andymai/gridfinity-layout-tool/commit/4b79b06acb2665723fc2041e43a55e8d97e56627))

## [4.400.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.400.2...gridfinity-layout-tool-v4.400.3) (2026-08-11)


### Bug Fixes

* **scoop:** keep the auto ramp out of the click rail's band ([#3434](https://github.com/andymai/gridfinity-layout-tool/issues/3434)) ([#3436](https://github.com/andymai/gridfinity-layout-tool/issues/3436)) ([3217cf9](https://github.com/andymai/gridfinity-layout-tool/commit/3217cf9582167f68648bf4aa6e49725118ef34f5))

## [4.400.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.400.1...gridfinity-layout-tool-v4.400.2) (2026-08-11)


### Bug Fixes

* **lid:** seat magnet posts on the lip, not a socket above it ([#3431](https://github.com/andymai/gridfinity-layout-tool/issues/3431)) ([#3435](https://github.com/andymai/gridfinity-layout-tool/issues/3435)) ([60190fe](https://github.com/andymai/gridfinity-layout-tool/commit/60190fefeb4f033808807b1b648fe4377811b2af))

## [4.400.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.400.0...gridfinity-layout-tool-v4.400.1) (2026-08-11)


### Bug Fixes

* **lid:** skip the click rail on a scooped wall ([#3426](https://github.com/andymai/gridfinity-layout-tool/issues/3426)) ([#3432](https://github.com/andymai/gridfinity-layout-tool/issues/3432)) ([9e9fdea](https://github.com/andymai/gridfinity-layout-tool/commit/9e9fdeabdefb660c14a566a8ad7fce28c6631c7c))

## [4.400.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.399.2...gridfinity-layout-tool-v4.400.0) (2026-08-11)


### Features

* **baseplate:** parametric mount-down screw holes ([#3428](https://github.com/andymai/gridfinity-layout-tool/issues/3428)) ([decbbf6](https://github.com/andymai/gridfinity-layout-tool/commit/decbbf6c33dddff73af6dd652759d737fb235ba1))

## [4.399.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.399.1...gridfinity-layout-tool-v4.399.2) (2026-08-11)


### Bug Fixes

* **scripts:** stop recommending &lt;Input&gt; for file, range and colour inputs ([#3421](https://github.com/andymai/gridfinity-layout-tool/issues/3421)) ([531cb56](https://github.com/andymai/gridfinity-layout-tool/commit/531cb56a26465d52dcb1f462ade11f2adb21cd02))

## [4.399.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.399.0...gridfinity-layout-tool-v4.399.1) (2026-08-11)


### Bug Fixes

* **scripts:** parse JSX in the design-system check instead of grepping lines ([#3418](https://github.com/andymai/gridfinity-layout-tool/issues/3418)) ([548dc91](https://github.com/andymai/gridfinity-layout-tool/commit/548dc91054c139dfaa7979d37b4d5f452a383498))

## [4.399.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.398.2...gridfinity-layout-tool-v4.399.0) (2026-08-11)


### Features

* **design-linking:** merge layout bins into one divided insert ([#3416](https://github.com/andymai/gridfinity-layout-tool/issues/3416)) ([5794a7d](https://github.com/andymai/gridfinity-layout-tool/commit/5794a7da05bb86fe4764b90c0fd51c5b79aad784))

## [4.398.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.398.1...gridfinity-layout-tool-v4.398.2) (2026-08-11)


### Bug Fixes

* **generation:** clip divider pattern under insetted and front-anchored tabs ([#3414](https://github.com/andymai/gridfinity-layout-tool/issues/3414)) ([7484ce1](https://github.com/andymai/gridfinity-layout-tool/commit/7484ce18387b2391aad17c0f03aa675b7cb276b8))

## [4.398.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.398.0...gridfinity-layout-tool-v4.398.1) (2026-08-11)


### Bug Fixes

* **lid:** correct the rail readout, the collar band, and the socket alignment control ([#3412](https://github.com/andymai/gridfinity-layout-tool/issues/3412)) ([9fe47f0](https://github.com/andymai/gridfinity-layout-tool/commit/9fe47f03c7dcafe4adac7920a44afcd411e988d2))

## [4.398.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.397.0...gridfinity-layout-tool-v4.398.0) (2026-08-10)


### Features

* **lid:** keep back rails in the gaps label tabs leave ([#3401](https://github.com/andymai/gridfinity-layout-tool/issues/3401)) ([#3408](https://github.com/andymai/gridfinity-layout-tool/issues/3408)) ([b7a7ff1](https://github.com/andymai/gridfinity-layout-tool/commit/b7a7ff19e833add6e73f24149563d4443290484c))

## [4.397.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.396.0...gridfinity-layout-tool-v4.397.0) (2026-08-10)


### Features

* **labels:** apply tab width in socket mode ([#3402](https://github.com/andymai/gridfinity-layout-tool/issues/3402)) ([#3407](https://github.com/andymai/gridfinity-layout-tool/issues/3407)) ([299716e](https://github.com/andymai/gridfinity-layout-tool/commit/299716eed03f8f015e745bb71f727a80a6edaac6))

## [4.396.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.395.1...gridfinity-layout-tool-v4.396.0) (2026-08-10)


### Features

* **lid:** finer click-rail coverage steps ([#3401](https://github.com/andymai/gridfinity-layout-tool/issues/3401)) ([#3406](https://github.com/andymai/gridfinity-layout-tool/issues/3406)) ([40432f6](https://github.com/andymai/gridfinity-layout-tool/commit/40432f618fbf89a3533819f29887acac24389bd3))

## [4.395.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.395.0...gridfinity-layout-tool-v4.395.1) (2026-08-10)


### Bug Fixes

* **lid:** stop click rails running into label tabs ([#3401](https://github.com/andymai/gridfinity-layout-tool/issues/3401)) ([#3404](https://github.com/andymai/gridfinity-layout-tool/issues/3404)) ([824eec1](https://github.com/andymai/gridfinity-layout-tool/commit/824eec194c01c3299b4e70e5db1786aa4cf4cf58))

## [4.395.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.394.7...gridfinity-layout-tool-v4.395.0) (2026-08-10)


### Features

* **scan:** size scans from a calibration lattice, not one card ([#3038](https://github.com/andymai/gridfinity-layout-tool/issues/3038)) ([#3399](https://github.com/andymai/gridfinity-layout-tool/issues/3399)) ([c1cf715](https://github.com/andymai/gridfinity-layout-tool/commit/c1cf71591bb1d6a79d05196a3780647df80c3092))

## [4.394.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.394.6...gridfinity-layout-tool-v4.394.7) (2026-08-10)


### Performance

* **baseplate:** let the first split plate use the worker pool ([#3395](https://github.com/andymai/gridfinity-layout-tool/issues/3395)) ([671b73a](https://github.com/andymai/gridfinity-layout-tool/commit/671b73a2405cc30845c49bba97329ca88a75969d))

## [4.394.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.394.5...gridfinity-layout-tool-v4.394.6) (2026-08-10)


### Performance

* **baseplate:** paint the instant draft before the Manifold one ([#3393](https://github.com/andymai/gridfinity-layout-tool/issues/3393)) ([3755bbe](https://github.com/andymai/gridfinity-layout-tool/commit/3755bbed4e0b80f55a76a3f71d8b858134887e5a))

## [4.394.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.394.4...gridfinity-layout-tool-v4.394.5) (2026-08-10)


### Performance

* **baseplate:** drop the mesh-result cache that never hits ([#3385](https://github.com/andymai/gridfinity-layout-tool/issues/3385)) ([bf94740](https://github.com/andymai/gridfinity-layout-tool/commit/bf947407dbe239a140838e70b6ed2f680da26dab))

## [4.394.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.394.3...gridfinity-layout-tool-v4.394.4) (2026-08-10)


### Performance

* **generation:** let wall-patterned bins resume the booleaned body ([#3382](https://github.com/andymai/gridfinity-layout-tool/issues/3382)) ([5dc43c9](https://github.com/andymai/gridfinity-layout-tool/commit/5dc43c9b50198e0c4998c076ab4495eecd529dd6))

## [4.394.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.394.2...gridfinity-layout-tool-v4.394.3) (2026-08-10)


### Performance

* **analytics:** cut ingested event volume by ~75% ([#3380](https://github.com/andymai/gridfinity-layout-tool/issues/3380)) ([2b26647](https://github.com/andymai/gridfinity-layout-tool/commit/2b26647202207b13b40b8cee3a49d436ef71f185))

## [4.394.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.394.1...gridfinity-layout-tool-v4.394.2) (2026-08-10)


### Performance

* **bundle:** stop preloading the 3D stack and Liveblocks on first paint ([#3378](https://github.com/andymai/gridfinity-layout-tool/issues/3378)) ([ef81499](https://github.com/andymai/gridfinity-layout-tool/commit/ef814997c8cbfe72d7b95b16b292bce957ed07f5))

## [4.394.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.394.0...gridfinity-layout-tool-v4.394.1) (2026-08-10)


### Performance

* cut Vercel edge requests and build minutes ([#3376](https://github.com/andymai/gridfinity-layout-tool/issues/3376)) ([51de39e](https://github.com/andymai/gridfinity-layout-tool/commit/51de39ec9fa37ae6920eafc0568b2ccd27d71635))

## [4.394.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.393.2...gridfinity-layout-tool-v4.394.0) (2026-08-09)


### Features

* **seo:** add a Gridfinity cutout generator page ([#3373](https://github.com/andymai/gridfinity-layout-tool/issues/3373)) ([fa83f67](https://github.com/andymai/gridfinity-layout-tool/commit/fa83f67c2c30592927de3c0895901ec87a40bff1))

## [4.393.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.393.1...gridfinity-layout-tool-v4.393.2) (2026-08-09)


### Bug Fixes

* **seo:** stop the locale reference pages answering in the SERP ([#3370](https://github.com/andymai/gridfinity-layout-tool/issues/3370)) ([72a432f](https://github.com/andymai/gridfinity-layout-tool/commit/72a432f1376e9296a034a00864d54fc41c9789a3))

## [4.393.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.393.0...gridfinity-layout-tool-v4.393.1) (2026-08-09)


### Bug Fixes

* **seo:** link the two worked-drawer pages from where readers already are ([#3369](https://github.com/andymai/gridfinity-layout-tool/issues/3369)) ([a50424d](https://github.com/andymai/gridfinity-layout-tool/commit/a50424dd84b79b49d5c92f6f5121ed46d59a3b14))

## [4.393.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.392.2...gridfinity-layout-tool-v4.393.0) (2026-08-09)


### Features

* **seo:** give community design pages their own crawlable content ([#3367](https://github.com/andymai/gridfinity-layout-tool/issues/3367)) ([f062b33](https://github.com/andymai/gridfinity-layout-tool/commit/f062b3397155587fab93e282fb04045f6015b5a2))

## [4.392.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.392.1...gridfinity-layout-tool-v4.392.2) (2026-08-09)


### Bug Fixes

* **ui:** size the context menu to its widest item ([#3365](https://github.com/andymai/gridfinity-layout-tool/issues/3365)) ([c7d240a](https://github.com/andymai/gridfinity-layout-tool/commit/c7d240ae1d03218db2c4ed5f6206ea537dee50b2))

## [4.392.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.392.0...gridfinity-layout-tool-v4.392.1) (2026-08-09)


### Bug Fixes

* **seo:** open reference pages with the promise, not the answer ([#3363](https://github.com/andymai/gridfinity-layout-tool/issues/3363)) ([c1a06e6](https://github.com/andymai/gridfinity-layout-tool/commit/c1a06e6e0ff6f328a39a1b877429953654597d76))

## [4.392.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.391.2...gridfinity-layout-tool-v4.392.0) (2026-08-09)


### Features

* **shell:** surface layout ZIP export as a header button ([#3361](https://github.com/andymai/gridfinity-layout-tool/issues/3361)) ([498ef19](https://github.com/andymai/gridfinity-layout-tool/commit/498ef19795dfa046f01527e7129af0de81198ee3))

## [4.391.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.391.1...gridfinity-layout-tool-v4.391.2) (2026-08-09)


### Bug Fixes

* **seo:** bring every page title under the SERP pixel budget ([#3358](https://github.com/andymai/gridfinity-layout-tool/issues/3358)) ([24ee5ad](https://github.com/andymai/gridfinity-layout-tool/commit/24ee5ad56543f14c6d1b5d0b13fa90aa175c513b))

## [4.391.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.391.0...gridfinity-layout-tool-v4.391.1) (2026-08-09)


### Bug Fixes

* **seo:** bring every meta description under the SERP budget ([#3355](https://github.com/andymai/gridfinity-layout-tool/issues/3355)) ([854df86](https://github.com/andymai/gridfinity-layout-tool/commit/854df8603cc809d9d8a0cc7cc9c37fc76b42bba0))

## [4.391.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.390.0...gridfinity-layout-tool-v4.391.0) (2026-08-09)


### Features

* **seo:** make /what-is-gridfinity the canonical answer for the head term ([#3353](https://github.com/andymai/gridfinity-layout-tool/issues/3353)) ([b204589](https://github.com/andymai/gridfinity-layout-tool/commit/b2045892722e4a4edcb6c781a8847cd2b9465456))

## [4.390.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.389.2...gridfinity-layout-tool-v4.390.0) (2026-08-09)


### Features

* **seo:** fix SERP thumbnails, title truncation, and answer-giving snippets ([#3350](https://github.com/andymai/gridfinity-layout-tool/issues/3350)) ([4e2b6ff](https://github.com/andymai/gridfinity-layout-tool/commit/4e2b6ff4f5eb8a90c3e60b6cd6d16bf1e3cdce8c))

## [4.389.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.389.1...gridfinity-layout-tool-v4.389.2) (2026-08-08)


### Performance

* **community:** store a browsing-sized copy of every print photo ([#3342](https://github.com/andymai/gridfinity-layout-tool/issues/3342)) ([2b1d05c](https://github.com/andymai/gridfinity-layout-tool/commit/2b1d05ce954b0dc49ae8e98cf6e2410aad799a6c))

## [4.389.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.389.0...gridfinity-layout-tool-v4.389.1) (2026-08-08)


### Bug Fixes

* **bin-designer:** guard three stale-index faults in the path vertex editor ([#3339](https://github.com/andymai/gridfinity-layout-tool/issues/3339)) ([a135171](https://github.com/andymai/gridfinity-layout-tool/commit/a1351719eea4a417771fedaa9826e88fcddfff93))

## [4.389.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.388.4...gridfinity-layout-tool-v4.389.0) (2026-08-08)


### Features

* **community:** give shared design links their own preview ([#3336](https://github.com/andymai/gridfinity-layout-tool/issues/3336)) ([83625c1](https://github.com/andymai/gridfinity-layout-tool/commit/83625c1e873f3da03709528234e78b4f4e4619bd))

## [4.388.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.388.3...gridfinity-layout-tool-v4.388.4) (2026-08-08)


### Bug Fixes

* **deps:** scope every security override to the major line it floors ([#3327](https://github.com/andymai/gridfinity-layout-tool/issues/3327)) ([1901e51](https://github.com/andymai/gridfinity-layout-tool/commit/1901e51b1e986d4e54d4a79456324b7f53488ddb))

## [4.388.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.388.2...gridfinity-layout-tool-v4.388.3) (2026-08-08)


### Performance

* **community:** build the browse index from concurrent windows ([#3330](https://github.com/andymai/gridfinity-layout-tool/issues/3330)) ([87de862](https://github.com/andymai/gridfinity-layout-tool/commit/87de8621acf4688c935075fe16c568936faf5332))

## [4.388.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.388.1...gridfinity-layout-tool-v4.388.2) (2026-08-08)


### Bug Fixes

* **deps,security:** patch nanoid, js-yaml, and dompurify; drop committed Redis dump ([#3325](https://github.com/andymai/gridfinity-layout-tool/issues/3325)) ([2eb6681](https://github.com/andymai/gridfinity-layout-tool/commit/2eb668145c4e6e05512e4fcf8cf6c6ded67a9902))

## [4.388.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.388.0...gridfinity-layout-tool-v4.388.1) (2026-08-08)


### Bug Fixes

* **community:** correct the detail view's print stat and two contrast failures ([#3328](https://github.com/andymai/gridfinity-layout-tool/issues/3328)) ([abe5373](https://github.com/andymai/gridfinity-layout-tool/commit/abe5373e52c62ffb7cf171a981c82eb7e2bebab2))

## [4.388.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.387.1...gridfinity-layout-tool-v4.388.0) (2026-08-08)


### Features

* **community:** make a narrowed gallery shareable and reload-safe ([#3324](https://github.com/andymai/gridfinity-layout-tool/issues/3324)) ([6f709dc](https://github.com/andymai/gridfinity-layout-tool/commit/6f709dcbc5bdd6005e1b63bdae836caf5f75e602))

## [4.387.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.387.0...gridfinity-layout-tool-v4.387.1) (2026-08-08)


### Bug Fixes

* **community:** browse layout blowout, accessibility, and control polish ([#3322](https://github.com/andymai/gridfinity-layout-tool/issues/3322)) ([ccb7301](https://github.com/andymai/gridfinity-layout-tool/commit/ccb7301f32ae2eae92fcfe4cfc55088c6ae898de))

## [4.387.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.386.3...gridfinity-layout-tool-v4.387.0) (2026-08-08)


### Features

* **bin-designer:** give the lid grip relief a height knob ([#3320](https://github.com/andymai/gridfinity-layout-tool/issues/3320)) ([45dd7c7](https://github.com/andymai/gridfinity-layout-tool/commit/45dd7c7349858868e27ff018d9f1882927a087dc))

## [4.386.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.386.2...gridfinity-layout-tool-v4.386.3) (2026-08-07)


### Bug Fixes

* **auth:** make the user id unreversible ([#3318](https://github.com/andymai/gridfinity-layout-tool/issues/3318)) ([a3bef37](https://github.com/andymai/gridfinity-layout-tool/commit/a3bef37ec974600846a80f3aa2f19cbfdd3c390a))

## [4.386.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.386.1...gridfinity-layout-tool-v4.386.2) (2026-08-07)


### Bug Fixes

* **security:** resolve 14 findings from the 2026-08-07 audit ([#3315](https://github.com/andymai/gridfinity-layout-tool/issues/3315)) ([80ab258](https://github.com/andymai/gridfinity-layout-tool/commit/80ab258e9318b80fa74dd422ce20e82445d8f4d8))

## [4.386.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.386.0...gridfinity-layout-tool-v4.386.1) (2026-08-07)


### Bug Fixes

* **community:** stop the detail filmstrip collapsing, and align modal chrome ([#3314](https://github.com/andymai/gridfinity-layout-tool/issues/3314)) ([5bfe7ae](https://github.com/andymai/gridfinity-layout-tool/commit/5bfe7aeb31b0a5809c28cde667ec0b2a6958f511))

## [4.386.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.385.0...gridfinity-layout-tool-v4.386.0) (2026-08-07)


### Features

* **community:** rebuild the design detail viewing experience ([#3311](https://github.com/andymai/gridfinity-layout-tool/issues/3311)) ([a1dac50](https://github.com/andymai/gridfinity-layout-tool/commit/a1dac50316777b466ae354de04d55c3845f5c54e))

## [4.385.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.384.0...gridfinity-layout-tool-v4.385.0) (2026-08-07)


### Features

* **labs:** gate the sliding tray behind a labs flag ([#3310](https://github.com/andymai/gridfinity-layout-tool/issues/3310)) ([78d9f55](https://github.com/andymai/gridfinity-layout-tool/commit/78d9f55073f434a4a125a6c3e96732b5319e75b6))

## [4.384.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.383.0...gridfinity-layout-tool-v4.384.0) (2026-08-07)


### Features

* **bin-designer:** add the sliding-tray fit test button ([#3308](https://github.com/andymai/gridfinity-layout-tool/issues/3308)) ([0e021b6](https://github.com/andymai/gridfinity-layout-tool/commit/0e021b696277dda4c1ad7308b59b4a348d8ef647))

## [4.383.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.382.0...gridfinity-layout-tool-v4.383.0) (2026-08-07)


### Features

* **bin-designer:** add the sliding tray panel ([#3306](https://github.com/andymai/gridfinity-layout-tool/issues/3306)) ([d1ae592](https://github.com/andymai/gridfinity-layout-tool/commit/d1ae592275799c954495460ee8ca962a882eed22))

## [4.382.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.381.0...gridfinity-layout-tool-v4.382.0) (2026-08-07)


### Features

* **bin-designer:** add a grip relief so a tight lid can be opened ([#3297](https://github.com/andymai/gridfinity-layout-tool/issues/3297)) ([2cf15e6](https://github.com/andymai/gridfinity-layout-tool/commit/2cf15e68af16608078d92ccf8ff77faa577f6308))

## [4.381.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.380.0...gridfinity-layout-tool-v4.381.0) (2026-08-07)


### Features

* **bin-designer:** preview the sliding tray in place, add a fit coupon ([#3300](https://github.com/andymai/gridfinity-layout-tool/issues/3300)) ([58a6328](https://github.com/andymai/gridfinity-layout-tool/commit/58a63285e306286bbee8017b2b22ff500a208e1b))

## [4.380.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.379.4...gridfinity-layout-tool-v4.380.0) (2026-08-07)


### Features

* **generation:** ship the sliding tray as an export piece, with end stops ([#3298](https://github.com/andymai/gridfinity-layout-tool/issues/3298)) ([0339a05](https://github.com/andymai/gridfinity-layout-tool/commit/0339a05ae13d4a736142b02c7afcb527215752f8))

## [4.379.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.379.3...gridfinity-layout-tool-v4.379.4) (2026-08-07)


### Bug Fixes

* **generation:** interlock the triangle wall pattern and keep stamps off corner arcs ([#3294](https://github.com/andymai/gridfinity-layout-tool/issues/3294)) ([415d51d](https://github.com/andymai/gridfinity-layout-tool/commit/415d51d53ee3bd853c52991e63d52b64662baa1a))

## [4.379.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.379.2...gridfinity-layout-tool-v4.379.3) (2026-08-07)


### Bug Fixes

* **generation:** stop wall patterns carving away the sliding-tray rail ([#3293](https://github.com/andymai/gridfinity-layout-tool/issues/3293)) ([7802f2e](https://github.com/andymai/gridfinity-layout-tool/commit/7802f2e45d539af109c8ccd31f7717db3fc56f24))

## [4.379.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.379.1...gridfinity-layout-tool-v4.379.2) (2026-08-07)


### Bug Fixes

* **bin-designer:** halve the sliding-tray clearance to the Gridfinity value ([#3291](https://github.com/andymai/gridfinity-layout-tool/issues/3291)) ([c7a461b](https://github.com/andymai/gridfinity-layout-tool/commit/c7a461bb7660ca719a225637955308c5092353ae))

## [4.379.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.379.0...gridfinity-layout-tool-v4.379.1) (2026-08-07)


### Bug Fixes

* **generation:** make the sliding tray actually rest on its rail ([#3289](https://github.com/andymai/gridfinity-layout-tool/issues/3289)) ([341df44](https://github.com/andymai/gridfinity-layout-tool/commit/341df44f5717bfc375a22d3eb1994a182870cfc5))

## [4.379.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.378.1...gridfinity-layout-tool-v4.379.0) (2026-08-07)


### Features

* sliding-tray model and rail geometry ([#3287](https://github.com/andymai/gridfinity-layout-tool/issues/3287)) ([dbf08f2](https://github.com/andymai/gridfinity-layout-tool/commit/dbf08f208e4c5d2a692cdb7633b8181e20f056bb))

## [4.378.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.378.0...gridfinity-layout-tool-v4.378.1) (2026-08-07)


### Bug Fixes

* **bin-designer:** square wall-cutout corners where no wall remains ([#3283](https://github.com/andymai/gridfinity-layout-tool/issues/3283)) ([cb3ca38](https://github.com/andymai/gridfinity-layout-tool/commit/cb3ca3840bb52a8ed04a5062e85fef47591af5b7))

## [4.378.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.377.1...gridfinity-layout-tool-v4.378.0) (2026-08-07)


### Features

* **bin-designer:** let the cutout editor clear the stacking lip ([#3281](https://github.com/andymai/gridfinity-layout-tool/issues/3281)) ([e696f24](https://github.com/andymai/gridfinity-layout-tool/commit/e696f2498911763f503f4512b0bf853cefb4dd57))

## [4.377.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.377.0...gridfinity-layout-tool-v4.377.1) (2026-08-07)


### Bug Fixes

* **a11y:** give every role="menu" the keyboard contract it advertises ([#3279](https://github.com/andymai/gridfinity-layout-tool/issues/3279)) ([8120f04](https://github.com/andymai/gridfinity-layout-tool/commit/8120f049ffdd6f041863531c84b1a7a959fc3d8f))

## [4.377.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.376.0...gridfinity-layout-tool-v4.377.0) (2026-08-07)


### Features

* **bin-designer:** rebuild the label text information hierarchy ([#3276](https://github.com/andymai/gridfinity-layout-tool/issues/3276)) ([a063308](https://github.com/andymai/gridfinity-layout-tool/commit/a06330834548ac1841febc960649aeb6ddbb1354))

## [4.376.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.375.1...gridfinity-layout-tool-v4.376.0) (2026-08-06)


### Features

* **grid-editor:** lock a bin's size so it moves but never resizes ([#3268](https://github.com/andymai/gridfinity-layout-tool/issues/3268)) ([4b2e407](https://github.com/andymai/gridfinity-layout-tool/commit/4b2e40738dd83a1e6ea6ff52d920dd8b7866754d))

## [4.375.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.375.0...gridfinity-layout-tool-v4.375.1) (2026-08-06)


### Bug Fixes

* **community:** hide the filter rail when there is nothing to narrow ([#3266](https://github.com/andymai/gridfinity-layout-tool/issues/3266)) ([de17645](https://github.com/andymai/gridfinity-layout-tool/commit/de17645edab27fa9a453d9939af0559929e91036))

## [4.375.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.374.1...gridfinity-layout-tool-v4.375.0) (2026-08-06)


### Features

* **community:** replace the nested filter dialog with a filter rail ([#3264](https://github.com/andymai/gridfinity-layout-tool/issues/3264)) ([8de9601](https://github.com/andymai/gridfinity-layout-tool/commit/8de96015f7e24d769a485fd8e516ba439ea7b72c))

## [4.374.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.374.0...gridfinity-layout-tool-v4.374.1) (2026-08-06)


### Bug Fixes

* **deps:** bump brepjs to 18.119.9 and brepkit-wasm to 2.129.8 ([#3262](https://github.com/andymai/gridfinity-layout-tool/issues/3262)) ([70fb3f6](https://github.com/andymai/gridfinity-layout-tool/commit/70fb3f6db6ad92238eb23f620482cfa431cf217b))

## [4.374.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.373.0...gridfinity-layout-tool-v4.374.0) (2026-08-06)


### Features

* **community:** open publishing to any bin, require a description ([#3260](https://github.com/andymai/gridfinity-layout-tool/issues/3260)) ([158e471](https://github.com/andymai/gridfinity-layout-tool/commit/158e471e8e3c185f84585cdd2c3bd286ae76c00c))

## [4.373.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.372.1...gridfinity-layout-tool-v4.373.0) (2026-08-06)


### Features

* **nav:** return the tool switcher to the three editors ([#3256](https://github.com/andymai/gridfinity-layout-tool/issues/3256)) ([6677a0a](https://github.com/andymai/gridfinity-layout-tool/commit/6677a0a5585c5be0d9feddb83a074f850b98512b))

## [4.372.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.372.0...gridfinity-layout-tool-v4.372.1) (2026-08-06)


### Bug Fixes

* **designer:** keep a spacer's body above the socket it stands on ([#3255](https://github.com/andymai/gridfinity-layout-tool/issues/3255)) ([031c83b](https://github.com/andymai/gridfinity-layout-tool/commit/031c83b5187b6414c14ff90b36d7e1b68db3035b))

## [4.372.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.371.1...gridfinity-layout-tool-v4.372.0) (2026-08-06)


### Features

* **community:** mark the shelf edges that hide cards ([#3253](https://github.com/andymai/gridfinity-layout-tool/issues/3253)) ([865ab87](https://github.com/andymai/gridfinity-layout-tool/commit/865ab873f4d9de4e4408df9219cd1c284ac2c497))

## [4.371.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.371.0...gridfinity-layout-tool-v4.371.1) (2026-08-06)


### Bug Fixes

* **community:** reachable support links on mobile, and no one-card shelves ([#3251](https://github.com/andymai/gridfinity-layout-tool/issues/3251)) ([c07fcb5](https://github.com/andymai/gridfinity-layout-tool/commit/c07fcb5cf1a29ac54c02f06e2aab327c4a524325))

## [4.371.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.370.2...gridfinity-layout-tool-v4.371.0) (2026-08-06)


### Features

* **community:** collapse the gallery toolbar to one control row ([#3249](https://github.com/andymai/gridfinity-layout-tool/issues/3249)) ([f0018c4](https://github.com/andymai/gridfinity-layout-tool/commit/f0018c471d5d1d11e0f140bbb03db548916e9cf6))

## [4.370.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.370.1...gridfinity-layout-tool-v4.370.2) (2026-08-06)


### Bug Fixes

* **designer:** give the wall-less tray a floor and a seatable foot ([#3244](https://github.com/andymai/gridfinity-layout-tool/issues/3244)) ([8e6de48](https://github.com/andymai/gridfinity-layout-tool/commit/8e6de48956499a2d70c102edc73cb3716839d036))

## [4.370.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.370.0...gridfinity-layout-tool-v4.370.1) (2026-08-06)


### Bug Fixes

* **deps:** advance the undici, brace-expansion and fast-uri pins ([#3245](https://github.com/andymai/gridfinity-layout-tool/issues/3245)) ([5cfff98](https://github.com/andymai/gridfinity-layout-tool/commit/5cfff98cfa7eaa61c648beb6bb877e045d291614))

## [4.370.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.369.0...gridfinity-layout-tool-v4.370.0) (2026-08-06)


### Features

* **community:** graduate the showcase to on-by-default, marked experimental ([#3243](https://github.com/andymai/gridfinity-layout-tool/issues/3243)) ([d1d5d6e](https://github.com/andymai/gridfinity-layout-tool/commit/d1d5d6eab9ff00c14b845479197f7874eb921ceb))

## [4.369.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.368.0...gridfinity-layout-tool-v4.369.0) (2026-08-05)


### Features

* **community:** rebuild the publish dialog as a two-column review ([#3241](https://github.com/andymai/gridfinity-layout-tool/issues/3241)) ([e362947](https://github.com/andymai/gridfinity-layout-tool/commit/e3629470c24cf33ad6e37d15ffa370bcc0990ccb))

## [4.368.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.367.1...gridfinity-layout-tool-v4.368.0) (2026-08-05)


### Features

* **community:** make Community a destination in the app, not a detour ([#3239](https://github.com/andymai/gridfinity-layout-tool/issues/3239)) ([43f90b4](https://github.com/andymai/gridfinity-layout-tool/commit/43f90b42b6c2ae0260e432f1eae5c3a0636831f5))

## [4.367.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.367.0...gridfinity-layout-tool-v4.367.1) (2026-08-05)


### Bug Fixes

* **baseplate:** turn stacked plates about the axis that keeps their sockets aligned ([#3237](https://github.com/andymai/gridfinity-layout-tool/issues/3237)) ([044d3db](https://github.com/andymai/gridfinity-layout-tool/commit/044d3db52a029d9a4ee6c6ad6cf4bc1cc205613a))

## [4.367.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.366.0...gridfinity-layout-tool-v4.367.0) (2026-08-05)


### Features

* **designer:** wall-less tray base and lid top-lip colours ([#3234](https://github.com/andymai/gridfinity-layout-tool/issues/3234)) ([c8519bf](https://github.com/andymai/gridfinity-layout-tool/commit/c8519bffe079481c464f0b0a2edcaa940cb3f846))

## [4.366.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.365.0...gridfinity-layout-tool-v4.366.0) (2026-08-05)


### Features

* **designer:** lid-compatible bottom for a normal bin ([#3232](https://github.com/andymai/gridfinity-layout-tool/issues/3232)) ([73132ca](https://github.com/andymai/gridfinity-layout-tool/commit/73132ca36b11cfa2d145bb1d1eecce3eb010769e))

## [4.365.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.364.0...gridfinity-layout-tool-v4.365.0) (2026-08-05)


### Features

* **community:** rebuild the publish flow as one review screen ([#3230](https://github.com/andymai/gridfinity-layout-tool/issues/3230)) ([4c12da5](https://github.com/andymai/gridfinity-layout-tool/commit/4c12da531aad3d5170794f1b79d6739cca8e9238))

## [4.364.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.363.5...gridfinity-layout-tool-v4.364.0) (2026-08-04)


### Features

* **baseplate:** let users draw custom split lines ([#3227](https://github.com/andymai/gridfinity-layout-tool/issues/3227)) ([31d70cf](https://github.com/andymai/gridfinity-layout-tool/commit/31d70cf4f709c499df6f6936e2c7c48eed8befb7))

## [4.363.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.363.4...gridfinity-layout-tool-v4.363.5) (2026-08-04)


### Bug Fixes

* **generation:** place label tabs against shifted dividers ([#3225](https://github.com/andymai/gridfinity-layout-tool/issues/3225)) ([cb046f4](https://github.com/andymai/gridfinity-layout-tool/commit/cb046f4fc2431e370a850175b6a76c38afc7468c))

## [4.363.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.363.3...gridfinity-layout-tool-v4.363.4) (2026-08-04)


### Bug Fixes

* **generation:** diagnose an empty kernel mesh instead of reporting a number ([#3219](https://github.com/andymai/gridfinity-layout-tool/issues/3219)) ([578a3a6](https://github.com/andymai/gridfinity-layout-tool/commit/578a3a6e561a9256d7167a5131f61d4573910184))

## [4.363.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.363.2...gridfinity-layout-tool-v4.363.3) (2026-08-04)


### Bug Fixes

* **drawer-shape:** centre a perimeter drawn larger than its grid ([#3217](https://github.com/andymai/gridfinity-layout-tool/issues/3217)) ([dac389c](https://github.com/andymai/gridfinity-layout-tool/commit/dac389c48cbaa122673596fbebf65495fc84c0af))

## [4.363.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.363.1...gridfinity-layout-tool-v4.363.2) (2026-08-04)


### Bug Fixes

* **baseplate:** reserve print-bed budget for the outline overhang ([#3215](https://github.com/andymai/gridfinity-layout-tool/issues/3215)) ([0492164](https://github.com/andymai/gridfinity-layout-tool/commit/04921644e8ba23302bf57daf3b86bbbd6bcb3858))

## [4.363.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.363.0...gridfinity-layout-tool-v4.363.1) (2026-08-04)


### Bug Fixes

* **baseplate:** frame split-piece outlines on the nominal extent ([#3213](https://github.com/andymai/gridfinity-layout-tool/issues/3213)) ([7255545](https://github.com/andymai/gridfinity-layout-tool/commit/725554521181d15ccbb12ac891a7ca952938815b))

## [4.363.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.362.0...gridfinity-layout-tool-v4.363.0) (2026-08-03)


### Features

* **community:** carry the gap-fit verdict into the detail view ([#3210](https://github.com/andymai/gridfinity-layout-tool/issues/3210)) ([ce1e1fd](https://github.com/andymai/gridfinity-layout-tool/commit/ce1e1fd7fcd95f9e7f42c748f26607c115948c0e))

## [4.362.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.361.0...gridfinity-layout-tool-v4.362.0) (2026-08-03)


### Features

* **community:** make featuring state its reason ([#3208](https://github.com/andymai/gridfinity-layout-tool/issues/3208)) ([c51edd3](https://github.com/andymai/gridfinity-layout-tool/commit/c51edd3e80febd97f2825ae67dbbcf0ad97b5891))

## [4.361.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.360.0...gridfinity-layout-tool-v4.361.0) (2026-08-03)


### Features

* **community:** repo-authored editorial collections ([#3205](https://github.com/andymai/gridfinity-layout-tool/issues/3205)) ([44be071](https://github.com/andymai/gridfinity-layout-tool/commit/44be0713ba097f9ea6afb926c587bf8d5b7605bc))

## [4.360.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.359.0...gridfinity-layout-tool-v4.360.0) (2026-08-03)


### Features

* **community:** make remix ancestry a navigable strip ([#3203](https://github.com/andymai/gridfinity-layout-tool/issues/3203)) ([226e255](https://github.com/andymai/gridfinity-layout-tool/commit/226e2551b2c6ce5d7754fcbfc4441cea4017df8c))

## [4.359.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.358.0...gridfinity-layout-tool-v4.359.0) (2026-08-03)


### Features

* **community:** derived author portrait on the filtered gallery ([#3201](https://github.com/andymai/gridfinity-layout-tool/issues/3201)) ([764096a](https://github.com/andymai/gridfinity-layout-tool/commit/764096aadd7e3df9a43bf06936a497768a88ecb5))

## [4.358.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.357.0...gridfinity-layout-tool-v4.358.0) (2026-08-03)


### Features

* **community:** show what a design costs to print, and say where that came from ([#3199](https://github.com/andymai/gridfinity-layout-tool/issues/3199)) ([c1d739c](https://github.com/andymai/gridfinity-layout-tool/commit/c1d739c3f2c1679f027126ca4db01ae5ea365a87))

## [4.357.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.356.0...gridfinity-layout-tool-v4.357.0) (2026-08-03)


### Features

* **community:** surface print counts across browsing ([#3195](https://github.com/andymai/gridfinity-layout-tool/issues/3195)) ([8105a6d](https://github.com/andymai/gridfinity-layout-tool/commit/8105a6d1856630c5ff932f3cc900e3b8db6e150c))

## [4.356.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.355.1...gridfinity-layout-tool-v4.356.0) (2026-08-03)


### Features

* **community:** show a design's prints and their derived summary ([#3191](https://github.com/andymai/gridfinity-layout-tool/issues/3191)) ([8ac591f](https://github.com/andymai/gridfinity-layout-tool/commit/8ac591f3374aca01fba6e6f1e98915d78b267c29))

## [4.355.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.355.0...gridfinity-layout-tool-v4.355.1) (2026-08-03)


### Bug Fixes

* **ci:** assert snapshots instead of rewriting them ([#3181](https://github.com/andymai/gridfinity-layout-tool/issues/3181)) ([#3185](https://github.com/andymai/gridfinity-layout-tool/issues/3185)) ([7ffe8e0](https://github.com/andymai/gridfinity-layout-tool/commit/7ffe8e088c5b7ed2a4d83380e5ec8c579db37d08))

## [4.355.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.354.1...gridfinity-layout-tool-v4.355.0) (2026-08-03)


### Features

* **community:** post and edit print reports from the detail view ([#3183](https://github.com/andymai/gridfinity-layout-tool/issues/3183)) ([c273619](https://github.com/andymai/gridfinity-layout-tool/commit/c2736191ee34fccc965b7f4d1b9715e1fee45966))

## [4.354.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.354.0...gridfinity-layout-tool-v4.354.1) (2026-08-03)


### Bug Fixes

* **bin-designer:** meet the wall rim square on u-shape cutouts ([#3173](https://github.com/andymai/gridfinity-layout-tool/issues/3173)) ([#3179](https://github.com/andymai/gridfinity-layout-tool/issues/3179)) ([d080539](https://github.com/andymai/gridfinity-layout-tool/commit/d08053951e34101259b168718cf5064ad2d3d709))

## [4.354.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.353.5...gridfinity-layout-tool-v4.354.0) (2026-08-03)


### Features

* **community:** print reports backend behind COMMUNITY_PRINTS_ENABLED ([#3178](https://github.com/andymai/gridfinity-layout-tool/issues/3178)) ([880a706](https://github.com/andymai/gridfinity-layout-tool/commit/880a70656408521374b6912584052d2b3118a9d6))

## [4.353.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.353.4...gridfinity-layout-tool-v4.353.5) (2026-08-03)


### Bug Fixes

* **design-system:** remove the duplicate focus outline on wrapper-based inputs ([#3176](https://github.com/andymai/gridfinity-layout-tool/issues/3176)) ([a8f1c71](https://github.com/andymai/gridfinity-layout-tool/commit/a8f1c7161b1e4aad9f2118cdf06d557592489359))

## [4.353.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.353.3...gridfinity-layout-tool-v4.353.4) (2026-08-03)


### Bug Fixes

* **drawer-shape:** keep the whole perimeter when the grid is shifted ([#3169](https://github.com/andymai/gridfinity-layout-tool/issues/3169), [#3170](https://github.com/andymai/gridfinity-layout-tool/issues/3170)) ([#3172](https://github.com/andymai/gridfinity-layout-tool/issues/3172)) ([696fb63](https://github.com/andymai/gridfinity-layout-tool/commit/696fb6376ffc036c1dc45c95a334ca60a14f8203))

## [4.353.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.353.2...gridfinity-layout-tool-v4.353.3) (2026-08-03)


### Bug Fixes

* **cutouts:** rotate a grouped selection as one rigid body ([#3171](https://github.com/andymai/gridfinity-layout-tool/issues/3171)) ([0c52809](https://github.com/andymai/gridfinity-layout-tool/commit/0c52809a00f2b08b8b6ae8dc2f196746f5188e30))

## [4.353.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.353.1...gridfinity-layout-tool-v4.353.2) (2026-08-02)


### Bug Fixes

* **baseplate:** keep shaped-plate seam connectors at every junction inside the perimeter ([#3163](https://github.com/andymai/gridfinity-layout-tool/issues/3163)) ([#3167](https://github.com/andymai/gridfinity-layout-tool/issues/3167)) ([2581b87](https://github.com/andymai/gridfinity-layout-tool/commit/2581b87d7d84394cbeeb73c1297c9ca735f88c9f))

## [4.353.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.353.0...gridfinity-layout-tool-v4.353.1) (2026-08-02)


### Bug Fixes

* **bin-designer:** keep the wall-cutout corner radius independent of bin height ([#3162](https://github.com/andymai/gridfinity-layout-tool/issues/3162)) ([#3164](https://github.com/andymai/gridfinity-layout-tool/issues/3164)) ([261a39e](https://github.com/andymai/gridfinity-layout-tool/commit/261a39e492274f8d63be5d2d0b3c35b62e19d803))

## [4.353.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.352.4...gridfinity-layout-tool-v4.353.0) (2026-08-02)


### Features

* **drawer-shape:** share the grid frame with the baseplate and add a manual grid shift ([#3157](https://github.com/andymai/gridfinity-layout-tool/issues/3157)) ([#3159](https://github.com/andymai/gridfinity-layout-tool/issues/3159)) ([ac34c34](https://github.com/andymai/gridfinity-layout-tool/commit/ac34c344335cd2923b3c2eed9798ee575ec64ffb))

## [4.352.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.352.3...gridfinity-layout-tool-v4.352.4) (2026-08-02)


### Bug Fixes

* **community:** harden publishing with audit fixes and a cutout-only launch gate ([#3160](https://github.com/andymai/gridfinity-layout-tool/issues/3160)) ([08e4b1a](https://github.com/andymai/gridfinity-layout-tool/commit/08e4b1add9572c13b2ae22678d0c4c04c775c7b5))

## [4.352.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.352.2...gridfinity-layout-tool-v4.352.3) (2026-08-02)


### Bug Fixes

* **baseplate:** register the perimeter re-base to the socket lattice ([#3149](https://github.com/andymai/gridfinity-layout-tool/issues/3149)) ([#3154](https://github.com/andymai/gridfinity-layout-tool/issues/3154)) ([a431b9c](https://github.com/andymai/gridfinity-layout-tool/commit/a431b9ceeba5e15dec7dbacc0de5da193fc16e46))

## [4.352.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.352.1...gridfinity-layout-tool-v4.352.2) (2026-08-02)


### Bug Fixes

* **drawer-shape:** close the implicit-mutation gaps around the custom perimeter ([#3149](https://github.com/andymai/gridfinity-layout-tool/issues/3149)) ([#3155](https://github.com/andymai/gridfinity-layout-tool/issues/3155)) ([9ba5fd5](https://github.com/andymai/gridfinity-layout-tool/commit/9ba5fd5b336bb256ba0bf5c5bbdf5ee5808d0b54))

## [4.352.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.352.0...gridfinity-layout-tool-v4.352.1) (2026-08-02)


### Bug Fixes

* **drawer-shape:** never change the custom perimeter implicitly ([#3149](https://github.com/andymai/gridfinity-layout-tool/issues/3149)) ([#3151](https://github.com/andymai/gridfinity-layout-tool/issues/3151)) ([3af0c7a](https://github.com/andymai/gridfinity-layout-tool/commit/3af0c7ad24a0822fd44ccd6eeeea1ac270087f38))

## [4.352.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.351.0...gridfinity-layout-tool-v4.352.0) (2026-08-02)


### Features

* **community:** discovery shelves, dimension filters, and find bins that fit ([#3150](https://github.com/andymai/gridfinity-layout-tool/issues/3150)) ([9c89484](https://github.com/andymai/gridfinity-layout-tool/commit/9c8948438584335f4fa77390caa8641b285d8f21))

## [4.351.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.350.0...gridfinity-layout-tool-v4.351.0) (2026-08-02)


### Features

* **baseplate:** share a tower between opposite rounded-corner tiles ([#3134](https://github.com/andymai/gridfinity-layout-tool/issues/3134)) ([c41e842](https://github.com/andymai/gridfinity-layout-tool/commit/c41e84231c832b786c09e56ab238f7802443e02f))

## [4.350.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.349.1...gridfinity-layout-tool-v4.350.0) (2026-08-02)


### Features

* **community:** mine view with owner stats, visit digest, and milestones ([#3139](https://github.com/andymai/gridfinity-layout-tool/issues/3139)) ([6ac6935](https://github.com/andymai/gridfinity-layout-tool/commit/6ac6935afb75efb8c971ac131507ef466e5577c7))

## [4.349.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.349.0...gridfinity-layout-tool-v4.349.1) (2026-08-02)


### Bug Fixes

* **baseplate:** show the corner-radius control while stacking ([#3131](https://github.com/andymai/gridfinity-layout-tool/issues/3131)) ([4fa1a57](https://github.com/andymai/gridfinity-layout-tool/commit/4fa1a575bc95717e8b823c01cccccf79d6314306))

## [4.349.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.348.0...gridfinity-layout-tool-v4.349.0) (2026-08-02)


### Features

* **baseplate:** support vertical stacking with a custom perimeter ([#3113](https://github.com/andymai/gridfinity-layout-tool/issues/3113)) ([#3128](https://github.com/andymai/gridfinity-layout-tool/issues/3128)) ([719f0aa](https://github.com/andymai/gridfinity-layout-tool/commit/719f0aa50543d411ab543ba3b551db9535316a71))

## [4.348.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.347.3...gridfinity-layout-tool-v4.348.0) (2026-08-02)


### Features

* **community:** likes, reports with auto-hide, print counts, and discovery ([#3127](https://github.com/andymai/gridfinity-layout-tool/issues/3127)) ([eeb32bf](https://github.com/andymai/gridfinity-layout-tool/commit/eeb32bfc37f8b64d0c94c0fd664eaa4b86c8bf56))

## [4.347.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.347.2...gridfinity-layout-tool-v4.347.3) (2026-08-02)


### Bug Fixes

* **baseplate:** keep a cheap preview for shaped plates ([#3111](https://github.com/andymai/gridfinity-layout-tool/issues/3111)) ([#3125](https://github.com/andymai/gridfinity-layout-tool/issues/3125)) ([ba2604c](https://github.com/andymai/gridfinity-layout-tool/commit/ba2604ca7e8f6782843177ba09337b1bfef101c0))

## [4.347.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.347.1...gridfinity-layout-tool-v4.347.2) (2026-08-02)


### Bug Fixes

* **baseplate:** centre the socket/seam grid on the custom-perimeter bbox ([#3108](https://github.com/andymai/gridfinity-layout-tool/issues/3108), [#3109](https://github.com/andymai/gridfinity-layout-tool/issues/3109)) ([#3123](https://github.com/andymai/gridfinity-layout-tool/issues/3123)) ([6a9bbf6](https://github.com/andymai/gridfinity-layout-tool/commit/6a9bbf6a71e0fac6bb53d7fceb070ac7f7184970))

## [4.347.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.347.0...gridfinity-layout-tool-v4.347.1) (2026-08-02)


### Bug Fixes

* **layout-editor:** render and preserve oversize custom perimeters ([#3107](https://github.com/andymai/gridfinity-layout-tool/issues/3107), [#3114](https://github.com/andymai/gridfinity-layout-tool/issues/3114)) ([#3121](https://github.com/andymai/gridfinity-layout-tool/issues/3121)) ([54e1150](https://github.com/andymai/gridfinity-layout-tool/commit/54e1150596f792d929bc2394ab7a073831aa662c))

## [4.347.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.346.0...gridfinity-layout-tool-v4.347.0) (2026-08-02)


### Features

* **community:** public route for browsing the community showcase ([#3119](https://github.com/andymai/gridfinity-layout-tool/issues/3119)) ([d0287fb](https://github.com/andymai/gridfinity-layout-tool/commit/d0287fbb5a825d0c11d620bb95095a5844528162))

## [4.346.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.345.0...gridfinity-layout-tool-v4.346.0) (2026-08-02)


### Features

* **community:** browsable gallery with detail view and remix ([#3116](https://github.com/andymai/gridfinity-layout-tool/issues/3116)) ([174a952](https://github.com/andymai/gridfinity-layout-tool/commit/174a9523ded5cd4bef9c572b7a6efd1d38e9f17a))

## [4.345.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.344.2...gridfinity-layout-tool-v4.345.0) (2026-08-02)


### Features

* **community:** publish flow for sharing bin designs ([#3104](https://github.com/andymai/gridfinity-layout-tool/issues/3104)) ([c810b44](https://github.com/andymai/gridfinity-layout-tool/commit/c810b4436b01551d660f9ab0100fcd8665d7105d))

## [4.344.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.344.1...gridfinity-layout-tool-v4.344.2) (2026-08-02)


### Bug Fixes

* **baseplate:** frame library thumbnails on the Y pitch for non-square grids ([#3105](https://github.com/andymai/gridfinity-layout-tool/issues/3105)) ([63fb134](https://github.com/andymai/gridfinity-layout-tool/commit/63fb134acdd73950f85fb7f58cad051d16ca0f21))
* **bin-designer:** thread the Y pitch into axis labels and preset framing ([#3106](https://github.com/andymai/gridfinity-layout-tool/issues/3106)) ([1e946a7](https://github.com/andymai/gridfinity-layout-tool/commit/1e946a75124f9d18325b61d2b5bf76602dcb54a6))

## [4.344.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.344.0...gridfinity-layout-tool-v4.344.1) (2026-08-02)


### Bug Fixes

* **baseplate:** size preview overlays on the Y pitch for non-square grids ([#3102](https://github.com/andymai/gridfinity-layout-tool/issues/3102)) ([b194935](https://github.com/andymai/gridfinity-layout-tool/commit/b1949352c164ec540c87b28a838b608ba73f0e64))

## [4.344.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.343.0...gridfinity-layout-tool-v4.344.0) (2026-08-02)


### Features

* **drawer-shape:** let pen-editor points exceed the grid, auto-growing the drawer ([#3092](https://github.com/andymai/gridfinity-layout-tool/issues/3092)) ([#3100](https://github.com/andymai/gridfinity-layout-tool/issues/3100)) ([8a93362](https://github.com/andymai/gridfinity-layout-tool/commit/8a93362a1bb69c31a2e822523dad1525f91b0f3f))

## [4.343.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.342.3...gridfinity-layout-tool-v4.343.0) (2026-08-02)


### Features

* **community:** backend foundation for publishing bin designs ([#3098](https://github.com/andymai/gridfinity-layout-tool/issues/3098)) ([3ea8740](https://github.com/andymai/gridfinity-layout-tool/commit/3ea8740e118255869e48ad37f9198469876e881f))

## [4.342.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.342.2...gridfinity-layout-tool-v4.342.3) (2026-08-01)


### Bug Fixes

* **baseplate:** collapse split pieces on the Y pitch for non-square grids ([#3089](https://github.com/andymai/gridfinity-layout-tool/issues/3089)) ([#3093](https://github.com/andymai/gridfinity-layout-tool/issues/3093)) ([92ccd67](https://github.com/andymai/gridfinity-layout-tool/commit/92ccd67a00cb65bfd7af0f3494e153f0a20c49ea))

## [4.342.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.342.1...gridfinity-layout-tool-v4.342.2) (2026-08-01)


### Bug Fixes

* **drawer-shape:** show pen-editor corner radius to 2 decimals ([#3090](https://github.com/andymai/gridfinity-layout-tool/issues/3090)) ([#3094](https://github.com/andymai/gridfinity-layout-tool/issues/3094)) ([05070c7](https://github.com/andymai/gridfinity-layout-tool/commit/05070c780d9fcbba817391b3b5cfce5d1c760640))

## [4.342.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.342.0...gridfinity-layout-tool-v4.342.1) (2026-08-01)


### Bug Fixes

* **baseplate:** offer split-into-pieces for STEP export ([#3088](https://github.com/andymai/gridfinity-layout-tool/issues/3088)) ([#3091](https://github.com/andymai/gridfinity-layout-tool/issues/3091)) ([a562881](https://github.com/andymai/gridfinity-layout-tool/commit/a5628813fb9ecdad3cf44ea3bf2df422ad13b052))

## [4.342.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.341.0...gridfinity-layout-tool-v4.342.0) (2026-08-01)


### Features

* **drawer-shape:** import a drawer perimeter from SVG or DXF ([#3085](https://github.com/andymai/gridfinity-layout-tool/issues/3085)) ([9abf72b](https://github.com/andymai/gridfinity-layout-tool/commit/9abf72b1a19746aa67ee36392a637ba79fa7c943))

## [4.341.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.340.4...gridfinity-layout-tool-v4.341.0) (2026-08-01)


### Features

* **drawer-shape:** round each corner to its own radius ([#3082](https://github.com/andymai/gridfinity-layout-tool/issues/3082)) ([24b3e33](https://github.com/andymai/gridfinity-layout-tool/commit/24b3e33a5a470fb03da913f11ecc7d630cae7d28)), closes [#3054](https://github.com/andymai/gridfinity-layout-tool/issues/3054)

## [4.340.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.340.3...gridfinity-layout-tool-v4.340.4) (2026-08-01)


### Bug Fixes

* **bin-designer:** make lid thickness control the tray floor, stack imports by size ([#3078](https://github.com/andymai/gridfinity-layout-tool/issues/3078)) ([fae5c58](https://github.com/andymai/gridfinity-layout-tool/commit/fae5c58cfb93f6a5382a1bd5aa4926cfb11e0fd4))

## [4.340.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.340.2...gridfinity-layout-tool-v4.340.3) (2026-08-01)


### Bug Fixes

* **layout-export:** export each bin's own geometry, and split oversized bins ([#3076](https://github.com/andymai/gridfinity-layout-tool/issues/3076)) ([c000a29](https://github.com/andymai/gridfinity-layout-tool/commit/c000a29661f49d2d87792fbc9944df233f62b492))

## [4.340.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.340.1...gridfinity-layout-tool-v4.340.2) (2026-08-01)


### Bug Fixes

* **design-linking:** derive the half-unit foot edge from where the bin sits ([#3077](https://github.com/andymai/gridfinity-layout-tool/issues/3077)) ([c2600cf](https://github.com/andymai/gridfinity-layout-tool/commit/c2600cf0bf524396aead8a70850da79d67d053f6))

## [4.340.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.340.0...gridfinity-layout-tool-v4.340.1) (2026-08-01)


### Bug Fixes

* **drawer-shape:** re-frame the pen canvas on resize, release space-pan on blur ([#3068](https://github.com/andymai/gridfinity-layout-tool/issues/3068)) ([e325ce5](https://github.com/andymai/gridfinity-layout-tool/commit/e325ce5514c506211fcb1321822296cb6bdb3254))

## [4.340.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.339.0...gridfinity-layout-tool-v4.340.0) (2026-08-01)


### Features

* **drawer-shape:** draw a freeform drawer perimeter, with rounded corners ([#3065](https://github.com/andymai/gridfinity-layout-tool/issues/3065)) ([a89756f](https://github.com/andymai/gridfinity-layout-tool/commit/a89756f60efc3c5b980e452943e5cdcbadd96f12))

## [4.339.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.338.1...gridfinity-layout-tool-v4.339.0) (2026-08-01)


### Features

* **baseplate:** fit whole cells to a custom perimeter ([#3064](https://github.com/andymai/gridfinity-layout-tool/issues/3064)) ([c9c3751](https://github.com/andymai/gridfinity-layout-tool/commit/c9c3751f308f6eaa78e52f806ad2fb15018a67f1))

## [4.338.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.338.0...gridfinity-layout-tool-v4.338.1) (2026-08-01)


### Bug Fixes

* **bin-designer:** keep a typed cutout size instead of truncating it to the bin ([#3062](https://github.com/andymai/gridfinity-layout-tool/issues/3062)) ([ed15276](https://github.com/andymai/gridfinity-layout-tool/commit/ed1527654e370823b7dfcfcee9adc4b2a8da20df))

## [4.338.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.337.1...gridfinity-layout-tool-v4.338.0) (2026-08-01)


### Features

* **bin-designer:** add the cutout shape list ([#3059](https://github.com/andymai/gridfinity-layout-tool/issues/3059)) ([61601c3](https://github.com/andymai/gridfinity-layout-tool/commit/61601c3841100e533c14b56f75f8280458fc29f9))

## [4.337.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.337.0...gridfinity-layout-tool-v4.337.1) (2026-08-01)


### Bug Fixes

* **bin-designer:** make cutout z-order and hide actually do something ([#3057](https://github.com/andymai/gridfinity-layout-tool/issues/3057)) ([b31a624](https://github.com/andymai/gridfinity-layout-tool/commit/b31a6241225c03e3a30784d3ee3fad232c0acdca))

## [4.337.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.336.1...gridfinity-layout-tool-v4.337.0) (2026-08-01)


### Features

* **bin-designer:** show assembled height so you can check drawer clearance ([#3055](https://github.com/andymai/gridfinity-layout-tool/issues/3055)) ([1da5f7c](https://github.com/andymai/gridfinity-layout-tool/commit/1da5f7cce1a8207e8adad4a6ef8fa439286c03ac)), closes [#3037](https://github.com/andymai/gridfinity-layout-tool/issues/3037)

## [4.336.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.336.0...gridfinity-layout-tool-v4.336.1) (2026-07-31)


### Bug Fixes

* **generation:** follow the overhang when placing lid retention magnets ([#3048](https://github.com/andymai/gridfinity-layout-tool/issues/3048)) ([#3051](https://github.com/andymai/gridfinity-layout-tool/issues/3051)) ([09966e5](https://github.com/andymai/gridfinity-layout-tool/commit/09966e5538f795c3632f54ee476a2c5dd315224c))

## [4.336.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.335.0...gridfinity-layout-tool-v4.336.0) (2026-07-31)


### Features

* **scan:** enter the reference card's measured size ([#3038](https://github.com/andymai/gridfinity-layout-tool/issues/3038)) ([#3047](https://github.com/andymai/gridfinity-layout-tool/issues/3047)) ([4633e3d](https://github.com/andymai/gridfinity-layout-tool/commit/4633e3d550da93830b45078aae37c950cfd51d4d))

## [4.335.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.334.1...gridfinity-layout-tool-v4.335.0) (2026-07-31)


### Features

* **bin-designer:** choose which wall the finger scoop rises to ([#3039](https://github.com/andymai/gridfinity-layout-tool/issues/3039)) ([#3044](https://github.com/andymai/gridfinity-layout-tool/issues/3044)) ([2ec564c](https://github.com/andymai/gridfinity-layout-tool/commit/2ec564cde97b5a772a49ed04a278427b14539a1f))

## [4.334.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.334.0...gridfinity-layout-tool-v4.334.1) (2026-07-31)


### Bug Fixes

* **generation:** time out a worker init that never reports ready ([#3035](https://github.com/andymai/gridfinity-layout-tool/issues/3035)) ([#3043](https://github.com/andymai/gridfinity-layout-tool/issues/3043)) ([0ea1e34](https://github.com/andymai/gridfinity-layout-tool/commit/0ea1e34e7b84e99f4aa6d6105625a08c50a481a5))

## [4.334.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.333.0...gridfinity-layout-tool-v4.334.0) (2026-07-31)


### Features

* **bin-designer:** show the taper band in the cutout editor ([#3034](https://github.com/andymai/gridfinity-layout-tool/issues/3034)) ([531b13b](https://github.com/andymai/gridfinity-layout-tool/commit/531b13b2135ab1c2ea7a5f62d3cac84dbcc8a911))


### Bug Fixes

* **design-linking:** accept a rotated linked design, and let Cancel stick ([#3041](https://github.com/andymai/gridfinity-layout-tool/issues/3041)) ([36395af](https://github.com/andymai/gridfinity-layout-tool/commit/36395af1a665d75222c3e31d2363ae562f747779))

## [4.333.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.332.2...gridfinity-layout-tool-v4.333.0) (2026-07-31)


### Features

* **generation:** outer-wall taper on solid (cutout) bins ([#3032](https://github.com/andymai/gridfinity-layout-tool/issues/3032)) ([af7dd04](https://github.com/andymai/gridfinity-layout-tool/commit/af7dd04a998e75674238e624d767842fbd706e6a))

## [4.332.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.332.1...gridfinity-layout-tool-v4.332.2) (2026-07-31)


### Performance

* **rate-limit:** collapse the sliding window into one atomic Lua call ([#3022](https://github.com/andymai/gridfinity-layout-tool/issues/3022)) ([9901991](https://github.com/andymai/gridfinity-layout-tool/commit/9901991fe9b6fe8ffdbee004ad3a507ce6541a8c))

## [4.332.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.332.0...gridfinity-layout-tool-v4.332.1) (2026-07-30)


### Bug Fixes

* print fit-sample coupon labels on a 0.4mm nozzle (connector + label-plate) ([#3019](https://github.com/andymai/gridfinity-layout-tool/issues/3019)) ([0618a07](https://github.com/andymai/gridfinity-layout-tool/commit/0618a071dc48d12892cbc685d50a301eccd4f4c4))

## [4.332.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.331.1...gridfinity-layout-tool-v4.332.0) (2026-07-30)


### Features

* support the wall taper on multi-compartment bins ([#3017](https://github.com/andymai/gridfinity-layout-tool/issues/3017)) ([#3021](https://github.com/andymai/gridfinity-layout-tool/issues/3021)) ([c499894](https://github.com/andymai/gridfinity-layout-tool/commit/c49989464cff3cea2df3fdc442e605c7dfbd6ffd))

## [4.331.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.331.0...gridfinity-layout-tool-v4.331.1) (2026-07-30)


### Bug Fixes

* let overhang feet coexist with a wall flare ([#2933](https://github.com/andymai/gridfinity-layout-tool/issues/2933)) ([#3018](https://github.com/andymai/gridfinity-layout-tool/issues/3018)) ([c4a0500](https://github.com/andymai/gridfinity-layout-tool/commit/c4a0500b6c4e6e1b5ee3722d2957807682dad753))

## [4.331.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.330.0...gridfinity-layout-tool-v4.331.0) (2026-07-30)


### Features

* add wall flare on top of bin overhang ([#2933](https://github.com/andymai/gridfinity-layout-tool/issues/2933)) ([#3015](https://github.com/andymai/gridfinity-layout-tool/issues/3015)) ([435c898](https://github.com/andymai/gridfinity-layout-tool/commit/435c8981d520b7f4dcd770e05ad0f45726dce7cd))

## [4.330.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.329.7...gridfinity-layout-tool-v4.330.0) (2026-07-30)


### Features

* **bin-designer:** optional raised lip on label tabs ([#2971](https://github.com/andymai/gridfinity-layout-tool/issues/2971)) ([#3012](https://github.com/andymai/gridfinity-layout-tool/issues/3012)) ([7be22fc](https://github.com/andymai/gridfinity-layout-tool/commit/7be22fce83763cda39dabd0c75166f86b1ded092))

## [4.329.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.329.6...gridfinity-layout-tool-v4.329.7) (2026-07-30)


### Bug Fixes

* **ml-telemetry:** expire every aggregate with a sliding TTL ([#3008](https://github.com/andymai/gridfinity-layout-tool/issues/3008)) ([82c30c2](https://github.com/andymai/gridfinity-layout-tool/commit/82c30c24b6bf52d326eaddea206786f7bef58a32))

## [4.329.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.329.5...gridfinity-layout-tool-v4.329.6) (2026-07-30)


### Bug Fixes

* **lint:** ignore git worktree directories ([#3009](https://github.com/andymai/gridfinity-layout-tool/issues/3009)) ([cfd03f0](https://github.com/andymai/gridfinity-layout-tool/commit/cfd03f09682a6acf57944eca97209620dd026db7))

## [4.329.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.329.4...gridfinity-layout-tool-v4.329.5) (2026-07-30)


### Bug Fixes

* **deps:** patch brepjs to dispose intersectCurves' bounding boxes ([#2985](https://github.com/andymai/gridfinity-layout-tool/issues/2985)) ([#3006](https://github.com/andymai/gridfinity-layout-tool/issues/3006)) ([f814d90](https://github.com/andymai/gridfinity-layout-tool/commit/f814d9019627ea2bf4587c145443939048871d0e))

## [4.329.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.329.3...gridfinity-layout-tool-v4.329.4) (2026-07-30)


### Bug Fixes

* **cqrs:** derive baseplate connectorStyle enum from one source ([#2982](https://github.com/andymai/gridfinity-layout-tool/issues/2982)) ([#2990](https://github.com/andymai/gridfinity-layout-tool/issues/2990)) ([8c0978a](https://github.com/andymai/gridfinity-layout-tool/commit/8c0978a4c5c58dfdaf0a803843d5c3d6d4ca66e9))

## [4.329.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.329.2...gridfinity-layout-tool-v4.329.3) (2026-07-30)

### Bug Fixes

- **baseplate:** bias split planner toward fewer pieces ([#2988](https://github.com/andymai/gridfinity-layout-tool/issues/2988)) ([#2996](https://github.com/andymai/gridfinity-layout-tool/issues/2996)) ([5c5a5c9](https://github.com/andymai/gridfinity-layout-tool/commit/5c5a5c9a720c042bfabd08e5718fa0d3face1380))
- **deps:** eliminate brace-expansion@1.x / minimatch@3 from the tree ([#2974](https://github.com/andymai/gridfinity-layout-tool/issues/2974)) ([#3000](https://github.com/andymai/gridfinity-layout-tool/issues/3000)) ([4edecdb](https://github.com/andymai/gridfinity-layout-tool/commit/4edecdb1ef8987dffae209f2d94426c383a91fe5))
- **staging:** flip rotate button on the visually top row, not the bottom ([#2979](https://github.com/andymai/gridfinity-layout-tool/issues/2979)) ([#2992](https://github.com/andymai/gridfinity-layout-tool/issues/2992)) ([6660f91](https://github.com/andymai/gridfinity-layout-tool/commit/6660f911d5c2d0683e46af6666ceb4f4004c296b))

## [4.329.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.329.1...gridfinity-layout-tool-v4.329.2) (2026-07-30)

### Bug Fixes

- **cqrs:** stop the v2 type extractors collapsing to never ([#2975](https://github.com/andymai/gridfinity-layout-tool/issues/2975)) ([3317f54](https://github.com/andymai/gridfinity-layout-tool/commit/3317f543ad2b76d8cf9160b3c17aa95b52dcae0f))

## [4.329.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.329.0...gridfinity-layout-tool-v4.329.1) (2026-07-30)

### Bug Fixes

- **bin-designer:** stop the wall-pattern selector claiming walls it doesn't pattern ([#2969](https://github.com/andymai/gridfinity-layout-tool/issues/2969)) ([0501662](https://github.com/andymai/gridfinity-layout-tool/commit/05016620fb5c2eca689edb10bd400d899cc929a6))

## [4.329.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.328.4...gridfinity-layout-tool-v4.329.0) (2026-07-30)

### Features

- **bin-designer:** apply wall patterns to selected walls only ([#2967](https://github.com/andymai/gridfinity-layout-tool/issues/2967)) ([524ab93](https://github.com/andymai/gridfinity-layout-tool/commit/524ab933d858d1e52bc39f8d691e9db5117c6d83))

## [4.328.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.328.3...gridfinity-layout-tool-v4.328.4) (2026-07-29)

### Bug Fixes

- **deps:** upgrade brace-expansion to 1.1.17 (CVE-2026-14257) ([#2964](https://github.com/andymai/gridfinity-layout-tool/issues/2964)) ([6735b2c](https://github.com/andymai/gridfinity-layout-tool/commit/6735b2c5989ed3bf981d5d4c9a95d776de531d18))

## [4.328.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.328.2...gridfinity-layout-tool-v4.328.3) (2026-07-29)

### Performance

- **sync-admin:** cut index-read cost from ~54s to ~2s ([#2962](https://github.com/andymai/gridfinity-layout-tool/issues/2962)) ([ab1a7d0](https://github.com/andymai/gridfinity-layout-tool/commit/ab1a7d037aa5f86b644ba5000fac13e36e6a8841))

## [4.328.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.328.1...gridfinity-layout-tool-v4.328.2) (2026-07-29)

### Bug Fixes

- **sync-admin:** keep findings when a re-verify fetch fails ([#2960](https://github.com/andymai/gridfinity-layout-tool/issues/2960)) ([f15db55](https://github.com/andymai/gridfinity-layout-tool/commit/f15db55890029cde63078d1a2d8e86800fbf538f))

## [4.328.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.328.0...gridfinity-layout-tool-v4.328.1) (2026-07-29)

### Bug Fixes

- **sync-admin:** stop reporting mid-scan writes as integrity errors ([#2958](https://github.com/andymai/gridfinity-layout-tool/issues/2958)) ([4346984](https://github.com/andymai/gridfinity-layout-tool/commit/43469846fe9330b3f8c30017e18134b60452c352))

## [4.328.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.327.0...gridfinity-layout-tool-v4.328.0) (2026-07-29)

### Features

- **settings:** raise the print bed size cap to 3000mm ([#2953](https://github.com/andymai/gridfinity-layout-tool/issues/2953)) ([d0764c0](https://github.com/andymai/gridfinity-layout-tool/commit/d0764c0bfbdbfd48f317061a2c693fa849b5ae96))

## [4.327.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.326.1...gridfinity-layout-tool-v4.327.0) (2026-07-28)

### Features

- **bin-designer:** compact the overhang panel and draw the taper profiles ([#2950](https://github.com/andymai/gridfinity-layout-tool/issues/2950)) ([2b0f7ee](https://github.com/andymai/gridfinity-layout-tool/commit/2b0f7ee2b19691a2c60d92feea691114169352af))

## [4.326.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.326.0...gridfinity-layout-tool-v4.326.1) (2026-07-28)

### Bug Fixes

- **generation:** stop the fillet taper cavity breaching the wall ([#2948](https://github.com/andymai/gridfinity-layout-tool/issues/2948)) ([6b480ab](https://github.com/andymai/gridfinity-layout-tool/commit/6b480ab78fc02db1d9ad975088473950d74bce7d))

## [4.326.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.325.3...gridfinity-layout-tool-v4.326.0) (2026-07-28)

### Features

- **generation:** add drawer-fit wall taper for curved bins ([#2933](https://github.com/andymai/gridfinity-layout-tool/issues/2933)) ([1e64c59](https://github.com/andymai/gridfinity-layout-tool/commit/1e64c59a4320b02eba9a4223f80cf3fd28baae43))

## [4.325.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.325.2...gridfinity-layout-tool-v4.325.3) (2026-07-28)

### Bug Fixes

- **generation:** clip dividers under a spanning label shelf ([#2943](https://github.com/andymai/gridfinity-layout-tool/issues/2943)) ([26db433](https://github.com/andymai/gridfinity-layout-tool/commit/26db433f1e1b9ba89e8cd81ee78f3ee91266d0d4))

## [4.325.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.325.1...gridfinity-layout-tool-v4.325.2) (2026-07-28)

### Bug Fixes

- **shortcuts:** scope layout keyboard shortcuts to the layout route ([#2941](https://github.com/andymai/gridfinity-layout-tool/issues/2941)) ([f8e0e3c](https://github.com/andymai/gridfinity-layout-tool/commit/f8e0e3c7f3144a9a5c8a76e6a16f656f4bc47407))

## [4.325.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.325.0...gridfinity-layout-tool-v4.325.1) (2026-07-28)

### Performance

- **generation:** cut kumiko wall pattern generation by up to 55% ([#2939](https://github.com/andymai/gridfinity-layout-tool/issues/2939)) ([4019bfc](https://github.com/andymai/gridfinity-layout-tool/commit/4019bfc72efd7189f5fa4232cf2cefa0c51b0812))

## [4.325.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.324.0...gridfinity-layout-tool-v4.325.0) (2026-07-28)

### Features

- **bin-designer:** allow lid text on lip-only stack tops ([#2936](https://github.com/andymai/gridfinity-layout-tool/issues/2936)) ([db6ee89](https://github.com/andymai/gridfinity-layout-tool/commit/db6ee896447815e93e51c089adc90f07d695cd97))

## [4.324.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.323.5...gridfinity-layout-tool-v4.324.0) (2026-07-28)

### Features

- **bin-designer:** add stacking-lip-only option for stackable lids ([#2934](https://github.com/andymai/gridfinity-layout-tool/issues/2934)) ([1627b43](https://github.com/andymai/gridfinity-layout-tool/commit/1627b431be6f842a2b241a3397b52aa824175a2d))

## [4.323.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.323.4...gridfinity-layout-tool-v4.323.5) (2026-07-28)

### Bug Fixes

- **generation:** stop lid magnet pads punching through the bin corner ([#2931](https://github.com/andymai/gridfinity-layout-tool/issues/2931)) ([6e70b14](https://github.com/andymai/gridfinity-layout-tool/commit/6e70b149bdfbeeaaee2d22ac4a733ebdeeb82ea5))

## [4.323.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.323.3...gridfinity-layout-tool-v4.323.4) (2026-07-28)

### Bug Fixes

- **bin-designer:** validate cutout placement by outline, not bounding box ([#2927](https://github.com/andymai/gridfinity-layout-tool/issues/2927)) ([17826d9](https://github.com/andymai/gridfinity-layout-tool/commit/17826d9513e20f2f0ce3387f8ff9dffdb0b7fa6b))

## [4.323.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.323.2...gridfinity-layout-tool-v4.323.3) (2026-07-28)

### Bug Fixes

- **deps:** drop vulnerable brace-expansion@2.1.2 via minimatch@10 ([#2924](https://github.com/andymai/gridfinity-layout-tool/issues/2924)) ([0faa3e5](https://github.com/andymai/gridfinity-layout-tool/commit/0faa3e5fd058c3dfaded65ccd1c394ace478bbfe))

## [4.323.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.323.1...gridfinity-layout-tool-v4.323.2) (2026-07-28)

### Bug Fixes

- **security:** stop suppressing real brace-expansion CVE findings ([#2921](https://github.com/andymai/gridfinity-layout-tool/issues/2921)) ([44b306e](https://github.com/andymai/gridfinity-layout-tool/commit/44b306e6be595f1375f53a50430ae4fae25ba0ca))

## [4.323.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.323.0...gridfinity-layout-tool-v4.323.1) (2026-07-28)

### Bug Fixes

- **deps:** patch js-yaml and brace-expansion DoS advisories ([#2919](https://github.com/andymai/gridfinity-layout-tool/issues/2919)) ([76599c2](https://github.com/andymai/gridfinity-layout-tool/commit/76599c242af9bee3c125918ef62127bb29014309))

## [4.323.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.322.1...gridfinity-layout-tool-v4.323.0) (2026-07-28)

### Features

- **bin-designer:** allow a 1u height in spacer mode ([#2917](https://github.com/andymai/gridfinity-layout-tool/issues/2917)) ([4d5c33c](https://github.com/andymai/gridfinity-layout-tool/commit/4d5c33c3caaa694ffec552752ad9e909d0545aae))

## [4.322.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.322.0...gridfinity-layout-tool-v4.322.1) (2026-07-27)

### Bug Fixes

- **bin-designer:** ship a label plate for every socket, not every compartment ([#2914](https://github.com/andymai/gridfinity-layout-tool/issues/2914)) ([028bb94](https://github.com/andymai/gridfinity-layout-tool/commit/028bb94b8150e5be3420de552e60b8a28e1729d4))

## [4.322.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.321.0...gridfinity-layout-tool-v4.322.0) (2026-07-27)

### Features

- **bin-designer:** render swappable label plates in the 3D preview ([#2912](https://github.com/andymai/gridfinity-layout-tool/issues/2912)) ([2f1bc25](https://github.com/andymai/gridfinity-layout-tool/commit/2f1bc25de9f7cc3b77a568bd8418264ef7088f5a))

## [4.321.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.320.0...gridfinity-layout-tool-v4.321.0) (2026-07-27)

### Features

- **bin-designer:** span label tabs across the full bin width ([#2909](https://github.com/andymai/gridfinity-layout-tool/issues/2909)) ([b604262](https://github.com/andymai/gridfinity-layout-tool/commit/b60426271e080069495bd695cd8efa027a686d80))

## [4.320.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.319.2...gridfinity-layout-tool-v4.320.0) (2026-07-27)

### Features

- **bin-designer:** align, distribute and batch-edit cutouts ([#2907](https://github.com/andymai/gridfinity-layout-tool/issues/2907)) ([a07ff80](https://github.com/andymai/gridfinity-layout-tool/commit/a07ff80c38e6a8d7c285f2fbfe4b74ea4a1aa852))

## [4.319.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.319.1...gridfinity-layout-tool-v4.319.2) (2026-07-27)

### Bug Fixes

- **cloud-share:** carry linked bin designs through share links ([#2904](https://github.com/andymai/gridfinity-layout-tool/issues/2904)) ([00c505f](https://github.com/andymai/gridfinity-layout-tool/commit/00c505f6aed325e725ec3115824ab360283d03ae))

## [4.319.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.319.0...gridfinity-layout-tool-v4.319.1) (2026-07-27)

### Bug Fixes

- **bin-designer:** persist pending design edits when leaving the designer ([#2903](https://github.com/andymai/gridfinity-layout-tool/issues/2903)) ([c4aeb66](https://github.com/andymai/gridfinity-layout-tool/commit/c4aeb66a760b668cbdeb09d51c9cc983ac494ce8))

## [4.319.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.318.0...gridfinity-layout-tool-v4.319.0) (2026-07-27)

### Features

- **bin-designer:** replace the plate icon dropdown with a visual grid picker ([#2888](https://github.com/andymai/gridfinity-layout-tool/issues/2888)) ([e1cc849](https://github.com/andymai/gridfinity-layout-tool/commit/e1cc8494e68de736ab35162c9e27eb13e48a0106))

## [4.318.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.317.0...gridfinity-layout-tool-v4.318.0) (2026-07-27)

### Features

- **bin-designer:** add 26 label plate icons across fasteners and tooling ([#2890](https://github.com/andymai/gridfinity-layout-tool/issues/2890)) ([952a35f](https://github.com/andymai/gridfinity-layout-tool/commit/952a35fc0f05cd656475e60124932d7a95455ec0))

## [4.317.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.316.2...gridfinity-layout-tool-v4.317.0) (2026-07-27)

### Features

- **generation:** source label plate icons from SVG paths ([#2886](https://github.com/andymai/gridfinity-layout-tool/issues/2886)) ([31f6e63](https://github.com/andymai/gridfinity-layout-tool/commit/31f6e63b65bea73c2a357a6f54f388255a9441bc))

## [4.316.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.316.1...gridfinity-layout-tool-v4.316.2) (2026-07-27)

### Performance

- **ci:** give the generators group 6 shards now that it is CPU-bound ([#2884](https://github.com/andymai/gridfinity-layout-tool/issues/2884)) ([e2e468d](https://github.com/andymai/gridfinity-layout-tool/commit/e2e468d13173aa08fa98722b97d705a38a1e4b5a))

## [4.316.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.316.0...gridfinity-layout-tool-v4.316.1) (2026-07-27)

### Performance

- **test:** split the export-integrity matrix per domain to unblock CI ([#2882](https://github.com/andymai/gridfinity-layout-tool/issues/2882)) ([1e59368](https://github.com/andymai/gridfinity-layout-tool/commit/1e59368e5f99b81623c964c77fb1a04be9d2e947))

## [4.316.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.315.0...gridfinity-layout-tool-v4.316.0) (2026-07-27)

### Features

- **baseplate:** cut key slots on all edges so split pieces are standard tiles ([#2875](https://github.com/andymai/gridfinity-layout-tool/issues/2875)) ([61badac](https://github.com/andymai/gridfinity-layout-tool/commit/61badac10dbb87f77facaa3a4c63fa9a0fd560cf))

## [4.315.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.314.0...gridfinity-layout-tool-v4.315.0) (2026-07-27)

### Features

- **bin-designer:** add a spacer mode so bins of different heights finish flush ([#2878](https://github.com/andymai/gridfinity-layout-tool/issues/2878)) ([4c2fc3b](https://github.com/andymai/gridfinity-layout-tool/commit/4c2fc3b499d8658caf92093de32bd0e384e69c76))

## [4.314.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.313.0...gridfinity-layout-tool-v4.314.0) (2026-07-27)

### Features

- **baseplate:** key the detached margin seam so rails lock on like the pieces do ([#2876](https://github.com/andymai/gridfinity-layout-tool/issues/2876)) ([c7d7a7b](https://github.com/andymai/gridfinity-layout-tool/commit/c7d7a7b156aa2fdf77f090642f9369ab70241508))

## [4.313.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.312.1...gridfinity-layout-tool-v4.313.0) (2026-07-27)

### Features

- **lid:** add edge retention magnets to stop large magnetic lids sagging ([#2853](https://github.com/andymai/gridfinity-layout-tool/issues/2853)) ([8d54b42](https://github.com/andymai/gridfinity-layout-tool/commit/8d54b42152d037d99190b80ac5ebff2999f367e7))

## [4.312.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.312.0...gridfinity-layout-tool-v4.312.1) (2026-07-27)

### Bug Fixes

- **generation:** keep wall pattern clear of corners on lip-less bins ([#2865](https://github.com/andymai/gridfinity-layout-tool/issues/2865)) ([#2870](https://github.com/andymai/gridfinity-layout-tool/issues/2870)) ([81b6420](https://github.com/andymai/gridfinity-layout-tool/commit/81b64208bb0300753f3512886cf6b45323ad1f14))

## [4.312.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.311.0...gridfinity-layout-tool-v4.312.0) (2026-07-27)

### Features

- **layout:** expand bins to fit the space around them ([#2871](https://github.com/andymai/gridfinity-layout-tool/issues/2871)) ([24ed520](https://github.com/andymai/gridfinity-layout-tool/commit/24ed520b2059d2d71645323c6d9b57f42da4413a))

## [4.311.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.310.1...gridfinity-layout-tool-v4.311.0) (2026-07-26)

### Features

- **layout:** per-placement bin overhang ([#2867](https://github.com/andymai/gridfinity-layout-tool/issues/2867)) ([0c34156](https://github.com/andymai/gridfinity-layout-tool/commit/0c341561f1c87da482174a22f437235c1bdcc15f))

## [4.310.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.310.0...gridfinity-layout-tool-v4.310.1) (2026-07-26)

### Bug Fixes

- **content:** correct max bin size, compartment grid, and magnet default ([#2863](https://github.com/andymai/gridfinity-layout-tool/issues/2863)) ([d487a88](https://github.com/andymai/gridfinity-layout-tool/commit/d487a8804fdb3655f2e12229ae6b01d7d549e815))

## [4.310.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.309.0...gridfinity-layout-tool-v4.310.0) (2026-07-26)

### Features

- **content:** add Korean (ko) SEO landing pages ([#2861](https://github.com/andymai/gridfinity-layout-tool/issues/2861)) ([11e72e9](https://github.com/andymai/gridfinity-layout-tool/commit/11e72e9883cfde7254b05a70cecc26cdf3f11002))

## [4.309.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.308.0...gridfinity-layout-tool-v4.309.0) (2026-07-26)

### Features

- **content:** add Czech (cs) SEO landing pages ([#2859](https://github.com/andymai/gridfinity-layout-tool/issues/2859)) ([f8bbf2f](https://github.com/andymai/gridfinity-layout-tool/commit/f8bbf2f0d81182a591a47e3189d77e2333019112))

## [4.308.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.307.0...gridfinity-layout-tool-v4.308.0) (2026-07-26)

### Features

- **content:** add Simplified Chinese (zh-CN) SEO landing pages ([#2857](https://github.com/andymai/gridfinity-layout-tool/issues/2857)) ([c9f282d](https://github.com/andymai/gridfinity-layout-tool/commit/c9f282daee33b62548a713f37871eeee670f66e3))

## [4.307.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.306.1...gridfinity-layout-tool-v4.307.0) (2026-07-26)

### Features

- **content:** add Polish (pl) SEO landing pages ([#2855](https://github.com/andymai/gridfinity-layout-tool/issues/2855)) ([6ec8fc3](https://github.com/andymai/gridfinity-layout-tool/commit/6ec8fc32b0289cd81141352b886de97d2ea1fe06))

## [4.306.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.306.0...gridfinity-layout-tool-v4.306.1) (2026-07-26)

### Bug Fixes

- **generation:** repair rotted **kernel-tests** diagnostics ([#2851](https://github.com/andymai/gridfinity-layout-tool/issues/2851)) ([b79957f](https://github.com/andymai/gridfinity-layout-tool/commit/b79957fa00c09994827a34a4fcd1dbb46fa14a8b))

## [4.306.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.305.0...gridfinity-layout-tool-v4.306.0) (2026-07-26)

### Features

- **i18n:** add Korean (ko) locale ([#2850](https://github.com/andymai/gridfinity-layout-tool/issues/2850)) ([41b1368](https://github.com/andymai/gridfinity-layout-tool/commit/41b1368c7a507cee36f7617dc004f1d289710ed1))

## [4.305.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.304.0...gridfinity-layout-tool-v4.305.0) (2026-07-26)

### Features

- **i18n:** add Czech (cs) locale ([#2848](https://github.com/andymai/gridfinity-layout-tool/issues/2848)) ([7accc33](https://github.com/andymai/gridfinity-layout-tool/commit/7accc3342663182d6237a8e07d4eec84ccd3547d))

## [4.304.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.303.0...gridfinity-layout-tool-v4.304.0) (2026-07-26)

### Features

- **i18n:** add Simplified Chinese (zh-CN) locale ([#2846](https://github.com/andymai/gridfinity-layout-tool/issues/2846)) ([37ce071](https://github.com/andymai/gridfinity-layout-tool/commit/37ce0719917ad6ec0a4e0ad3f193227b384bc905))

## [4.303.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.302.2...gridfinity-layout-tool-v4.303.0) (2026-07-26)

### Features

- **i18n:** add Polish (pl) locale ([#2840](https://github.com/andymai/gridfinity-layout-tool/issues/2840)) ([315263a](https://github.com/andymai/gridfinity-layout-tool/commit/315263ab8aae99c5c20c2c479345f41d95cd85aa))

## [4.302.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.302.1...gridfinity-layout-tool-v4.302.2) (2026-07-26)

### Performance

- **build:** make chunk hashes reproducible across builds ([#2842](https://github.com/andymai/gridfinity-layout-tool/issues/2842)) ([2525a63](https://github.com/andymai/gridfinity-layout-tool/commit/2525a63e8788065ccc4d967d83685098f8d28242))

## [4.302.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.302.0...gridfinity-layout-tool-v4.302.1) (2026-07-26)

### Performance

- **build:** serve ML model weights as fetched assets, not JS chunks ([#2839](https://github.com/andymai/gridfinity-layout-tool/issues/2839)) ([6aae33a](https://github.com/andymai/gridfinity-layout-tool/commit/6aae33a7026d6be08a2b78320eca37ae72bb35af))

## [4.302.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.301.0...gridfinity-layout-tool-v4.302.0) (2026-07-26)

### Features

- **bin-inspector:** localize catalog label suggestions to the user's language ([#2836](https://github.com/andymai/gridfinity-layout-tool/issues/2836)) ([ad78f1c](https://github.com/andymai/gridfinity-layout-tool/commit/ad78f1c9a855d77062bb3a9f8c27444f97cf3b09))

### Bug Fixes

- **build:** separate ML model weights from the app JS budget ([#2837](https://github.com/andymai/gridfinity-layout-tool/issues/2837)) ([d20518d](https://github.com/andymai/gridfinity-layout-tool/commit/d20518d5e89a1ee5001eb5f78795b198301406ee))

## [4.301.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.300.0...gridfinity-layout-tool-v4.301.0) (2026-07-26)

### Features

- **ci:** scheduled growth-gated retrain for the label-suggester model ([#2832](https://github.com/andymai/gridfinity-layout-tool/issues/2832)) ([7b2b644](https://github.com/andymai/gridfinity-layout-tool/commit/7b2b6440ebb863f2a6d5738caee195a2e720fdb8))

## [4.300.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.299.0...gridfinity-layout-tool-v4.300.0) (2026-07-25)

### Features

- **bin-inspector:** train and activate the label-suggester model ([#2830](https://github.com/andymai/gridfinity-layout-tool/issues/2830)) ([8c5fff0](https://github.com/andymai/gridfinity-layout-tool/commit/8c5fff0c634a554fcb7a67bb1e28a38bc6ddba7a))
- **bin-inspector:** trained popularity + co-occurrence prior for labels ([#2828](https://github.com/andymai/gridfinity-layout-tool/issues/2828)) ([4c05a18](https://github.com/andymai/gridfinity-layout-tool/commit/4c05a18582a9435073d6015edb90973854b5a7b9))

## [4.299.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.298.1...gridfinity-layout-tool-v4.299.0) (2026-07-25)

### Features

- **generation:** drainage and ventilation holes through the bin floor ([#2820](https://github.com/andymai/gridfinity-layout-tool/issues/2820)) ([d42f6b3](https://github.com/andymai/gridfinity-layout-tool/commit/d42f6b3fd9900dbdf5db6a2a7fb9c43d62e23f86))

## [4.298.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.298.0...gridfinity-layout-tool-v4.298.1) (2026-07-25)

### Bug Fixes

- **bin-inspector:** rank literal label matches above meaning-only ones ([#2825](https://github.com/andymai/gridfinity-layout-tool/issues/2825)) ([517c576](https://github.com/andymai/gridfinity-layout-tool/commit/517c57683bccc03d8f696c7ee09801907a9716b3))

## [4.298.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.297.0...gridfinity-layout-tool-v4.298.0) (2026-07-25)

### Features

- **bin-inspector:** concept + related-term semantic matching for labels ([#2823](https://github.com/andymai/gridfinity-layout-tool/issues/2823)) ([fcf55ed](https://github.com/andymai/gridfinity-layout-tool/commit/fcf55edcc6e148f901eedbf40ef7633817e21a3d))

## [4.297.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.296.0...gridfinity-layout-tool-v4.297.0) (2026-07-25)

### Features

- **bin-inspector:** smart on-device label autocomplete ([#2821](https://github.com/andymai/gridfinity-layout-tool/issues/2821)) ([60264c8](https://github.com/andymai/gridfinity-layout-tool/commit/60264c80bc1378b96f7ccfbfcddb91fe58b34104))

## [4.296.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.295.1...gridfinity-layout-tool-v4.296.0) (2026-07-25)

### Features

- **generation:** pattern removable divider pieces on slotted bins ([#2818](https://github.com/andymai/gridfinity-layout-tool/issues/2818)) ([186535b](https://github.com/andymai/gridfinity-layout-tool/commit/186535be4d8bce7e4102a0971938dfcc9d73f7ea))

## [4.295.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.295.0...gridfinity-layout-tool-v4.295.1) (2026-07-25)

### Bug Fixes

- **analytics:** suppress Firefox-for-iOS **firefox** error noise ([#2812](https://github.com/andymai/gridfinity-layout-tool/issues/2812)) ([f07eb91](https://github.com/andymai/gridfinity-layout-tool/commit/f07eb91f4838e04f9acb39b7c647394838991b58))

## [4.295.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.294.0...gridfinity-layout-tool-v4.295.0) (2026-07-25)

### Features

- **generation:** carry the wall pattern through compartment dividers ([#2814](https://github.com/andymai/gridfinity-layout-tool/issues/2814)) ([b73d067](https://github.com/andymai/gridfinity-layout-tool/commit/b73d067f55b7381f30e39d927c202467ee69cabe))

## [4.294.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.293.5...gridfinity-layout-tool-v4.294.0) (2026-07-25)

### Features

- **generation:** size wall, lid and tab text to the glyph ink box ([#2810](https://github.com/andymai/gridfinity-layout-tool/issues/2810)) ([3968d0f](https://github.com/andymai/gridfinity-layout-tool/commit/3968d0f25d88c3abb5fec7fba8fc807f2cc251cf))

## [4.293.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.293.4...gridfinity-layout-tool-v4.293.5) (2026-07-25)

### Bug Fixes

- **inspector:** stop height hints stretching the clearance cell ([#2808](https://github.com/andymai/gridfinity-layout-tool/issues/2808)) ([9582e85](https://github.com/andymai/gridfinity-layout-tool/commit/9582e85416ee57e6af0470fd6747f25bab2da9fd))

## [4.293.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.293.3...gridfinity-layout-tool-v4.293.4) (2026-07-25)

### Bug Fixes

- **designer:** raise the plate icon width cap to 11.5mm ([#2806](https://github.com/andymai/gridfinity-layout-tool/issues/2806)) ([f7f0953](https://github.com/andymai/gridfinity-layout-tool/commit/f7f0953ce0cf169311d1ef06e4e8047896f7566a))

## [4.293.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.293.2...gridfinity-layout-tool-v4.293.3) (2026-07-24)

### Bug Fixes

- **designer:** size plate hardware icons to their own silhouette ([#2804](https://github.com/andymai/gridfinity-layout-tool/issues/2804)) ([ba32852](https://github.com/andymai/gridfinity-layout-tool/commit/ba328529e6e5d6798c6688deeade8977c31c7383))

## [4.293.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.293.1...gridfinity-layout-tool-v4.293.2) (2026-07-24)

### Bug Fixes

- **designer:** stop label plates lifting stacked bins and printing holes ([#2802](https://github.com/andymai/gridfinity-layout-tool/issues/2802)) ([6eca10e](https://github.com/andymai/gridfinity-layout-tool/commit/6eca10efbe16ae5540ed85480b31ed8f2fc96298))

## [4.293.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.293.0...gridfinity-layout-tool-v4.293.1) (2026-07-24)

### Bug Fixes

- **deps:** bump transitive tar to 7.5.21 for GHSA-r292-9mhp-454m ([#2800](https://github.com/andymai/gridfinity-layout-tool/issues/2800)) ([4abb1e0](https://github.com/andymai/gridfinity-layout-tool/commit/4abb1e01ce2cac5e57aaf15a86a8ae8a4fee0ffc))

## [4.293.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.292.0...gridfinity-layout-tool-v4.293.0) (2026-07-24)

### Features

- **export:** mobile continue-on-desktop handoff via account sync ([#2797](https://github.com/andymai/gridfinity-layout-tool/issues/2797)) ([848ba05](https://github.com/andymai/gridfinity-layout-tool/commit/848ba051c1af59c44f9831b8f6287c7b4a501607))

## [4.292.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.291.0...gridfinity-layout-tool-v4.292.0) (2026-07-24)

### Features

- **baseplate:** first-run orientation card and post-export planner bridge ([#2796](https://github.com/andymai/gridfinity-layout-tool/issues/2796)) ([ac79186](https://github.com/andymai/gridfinity-layout-tool/commit/ac79186e8cd610730d953eda7257fd76c6300fb4))

## [4.291.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.290.0...gridfinity-layout-tool-v4.291.0) (2026-07-24)

### Features

- **bin-designer:** first-run orientation card and post-export planner bridge ([#2794](https://github.com/andymai/gridfinity-layout-tool/issues/2794)) ([12439a8](https://github.com/andymai/gridfinity-layout-tool/commit/12439a854ccc2000b6db8479a1eb991aba0097ba))

## [4.290.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.289.0...gridfinity-layout-tool-v4.290.0) (2026-07-24)

### Features

- **analytics:** per-surface conversion funnel events, remove dead welcome modal ([#2792](https://github.com/andymai/gridfinity-layout-tool/issues/2792)) ([53486c9](https://github.com/andymai/gridfinity-layout-tool/commit/53486c90786e0038020236929768d243ec1046f6))

## [4.289.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.288.4...gridfinity-layout-tool-v4.289.0) (2026-07-24)

### Features

- **baseplate:** add labeled assembly-map PNG to split export ZIPs ([#2788](https://github.com/andymai/gridfinity-layout-tool/issues/2788)) ([d164c75](https://github.com/andymai/gridfinity-layout-tool/commit/d164c75d373d04dc136cb6decb6aa92faba14d2d))

## [4.288.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.288.3...gridfinity-layout-tool-v4.288.4) (2026-07-24)

### Bug Fixes

- **generation:** pack diamond wall pattern as a tight staggered lattice ([#2789](https://github.com/andymai/gridfinity-layout-tool/issues/2789)) ([d8eb8e5](https://github.com/andymai/gridfinity-layout-tool/commit/d8eb8e5a39c67afe4a06484cbcc806d96a37f0f1))

## [4.288.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.288.2...gridfinity-layout-tool-v4.288.3) (2026-07-24)

### Bug Fixes

- **generation:** restore falling kumiko diagonals at bin corners ([#2785](https://github.com/andymai/gridfinity-layout-tool/issues/2785)) ([14ba236](https://github.com/andymai/gridfinity-layout-tool/commit/14ba236aa49684cd1b85a43e5b4a8575a5e667aa))

## [4.288.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.288.1...gridfinity-layout-tool-v4.288.2) (2026-07-23)

### Bug Fixes

- **bin-designer:** align lid enable toggle with other feature toggles ([#2781](https://github.com/andymai/gridfinity-layout-tool/issues/2781)) ([7daf80d](https://github.com/andymai/gridfinity-layout-tool/commit/7daf80d935180d94a32a719ca3000a15ceb5c1db))

## [4.288.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.288.0...gridfinity-layout-tool-v4.288.1) (2026-07-23)

### Bug Fixes

- **generation:** carry per-segment widths through every clip path, retune sakura ([#2780](https://github.com/andymai/gridfinity-layout-tool/issues/2780)) ([9954b82](https://github.com/andymai/gridfinity-layout-tool/commit/9954b826398ef06fbc0fd740eaab947dfbcc97f8))

## [4.288.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.287.2...gridfinity-layout-tool-v4.288.0) (2026-07-23)

### Features

- **bin-designer:** complete the kumiko pattern set — six new wall patterns ([#2777](https://github.com/andymai/gridfinity-layout-tool/issues/2777)) ([027630d](https://github.com/andymai/gridfinity-layout-tool/commit/027630d84b4275bbbe53c59d4fe6e7b08042d1bb))

## [4.287.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.287.1...gridfinity-layout-tool-v4.287.2) (2026-07-23)

### Bug Fixes

- **generation:** stop stale-bundle WASM 404s spawning a new issue per deploy ([#2776](https://github.com/andymai/gridfinity-layout-tool/issues/2776)) ([b791704](https://github.com/andymai/gridfinity-layout-tool/commit/b791704ef119e2e84e758156a9eeadcb1553e504))

## [4.287.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.287.0...gridfinity-layout-tool-v4.287.1) (2026-07-23)

### Bug Fixes

- **bin-designer:** sink click-in label sockets below the stacking plane ([#2774](https://github.com/andymai/gridfinity-layout-tool/issues/2774)) ([9ee8c85](https://github.com/andymai/gridfinity-layout-tool/commit/9ee8c85f638b76b2b668e4eb99a33682ea5a46ed))

## [4.287.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.286.1...gridfinity-layout-tool-v4.287.0) (2026-07-23)

### Features

- **bin-designer:** add kumiko wrapped-lattice wall patterns with mitsukude ([#2772](https://github.com/andymai/gridfinity-layout-tool/issues/2772)) ([193f6bf](https://github.com/andymai/gridfinity-layout-tool/commit/193f6bff4cdfdb634f6eddb8d63f19003f95753c))

## [4.286.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.286.0...gridfinity-layout-tool-v4.286.1) (2026-07-23)

### Bug Fixes

- **generation:** anchor lid retention magnets to the cavity bottom ([#2770](https://github.com/andymai/gridfinity-layout-tool/issues/2770)) ([47e0a1a](https://github.com/andymai/gridfinity-layout-tool/commit/47e0a1a5de5a1d6f44afd7a61fa7d2babd338354))

## [4.286.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.285.2...gridfinity-layout-tool-v4.286.0) (2026-07-23)

### Features

- **bin-designer:** adjustable lid thickness and magnetic fit relief ([#2768](https://github.com/andymai/gridfinity-layout-tool/issues/2768)) ([5376863](https://github.com/andymai/gridfinity-layout-tool/commit/53768634207e2abbc86fbc655cc329b0e13734db))

## [4.285.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.285.1...gridfinity-layout-tool-v4.285.2) (2026-07-23)

### Bug Fixes

- **lint:** re-arm eslint-plugin-boundaries after silent v7 breakage ([#2750](https://github.com/andymai/gridfinity-layout-tool/issues/2750)) ([353331f](https://github.com/andymai/gridfinity-layout-tool/commit/353331f679df490f9871b6627da5e4b2b6fc3d7d))

## [4.285.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.285.0...gridfinity-layout-tool-v4.285.1) (2026-07-23)

### Bug Fixes

- **design-system:** center Input left icon vertically ([#2746](https://github.com/andymai/gridfinity-layout-tool/issues/2746)) ([2a3ffd2](https://github.com/andymai/gridfinity-layout-tool/commit/2a3ffd24b321313123f5aede56c35f3c8ec7715f))

## [4.285.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.284.0...gridfinity-layout-tool-v4.285.0) (2026-07-23)

### Features

- **labs:** graduate collab, STL import, and bin size suggestions ([#2742](https://github.com/andymai/gridfinity-layout-tool/issues/2742)) ([ad99bf6](https://github.com/andymai/gridfinity-layout-tool/commit/ad99bf61bc2fc169416dcf2742181de477436c7a))

## [4.284.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.283.0...gridfinity-layout-tool-v4.284.0) (2026-07-23)

### Features

- **designer:** gate wall and lid text behind toggles ([#2737](https://github.com/andymai/gridfinity-layout-tool/issues/2737)) ([6cd0b95](https://github.com/andymai/gridfinity-layout-tool/commit/6cd0b95ff2a32f889f62c7d5360f5e79f4cceef0))

## [4.283.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.282.3...gridfinity-layout-tool-v4.283.0) (2026-07-23)

### Features

- **settings:** replace the non-square grid switch with a linked X/Y control ([#2736](https://github.com/andymai/gridfinity-layout-tool/issues/2736)) ([f34058f](https://github.com/andymai/gridfinity-layout-tool/commit/f34058f1a5f5cb8c3c2da72db83245f4c00f3053))

## [4.282.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.282.2...gridfinity-layout-tool-v4.282.3) (2026-07-23)

### Bug Fixes

- **layout:** scale custom drawer shapes by the Y grid pitch on non-square grids ([#2734](https://github.com/andymai/gridfinity-layout-tool/issues/2734)) ([fd453cb](https://github.com/andymai/gridfinity-layout-tool/commit/fd453cb9982d455cd511f4ade8d85415855a23cc))

## [4.282.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.282.1...gridfinity-layout-tool-v4.282.2) (2026-07-22)

### Bug Fixes

- **deps:** patch fast-uri and sharp security advisories ([#2731](https://github.com/andymai/gridfinity-layout-tool/issues/2731)) ([fca2878](https://github.com/andymai/gridfinity-layout-tool/commit/fca287859ec3f1e3e9a0ac8c5eccb593958f3256))

## [4.282.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.282.0...gridfinity-layout-tool-v4.282.1) (2026-07-22)

### Bug Fixes

- **designer:** engrave cutout labels on the recess floor ([#2726](https://github.com/andymai/gridfinity-layout-tool/issues/2726)) ([#2729](https://github.com/andymai/gridfinity-layout-tool/issues/2729)) ([8ad0119](https://github.com/andymai/gridfinity-layout-tool/commit/8ad0119ee690c3e36fadac1ba8432a0d9a95388a))

## [4.282.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.281.0...gridfinity-layout-tool-v4.282.0) (2026-07-22)

### Features

- **labels:** scale label sockets to the print nozzle ([#2690](https://github.com/andymai/gridfinity-layout-tool/issues/2690)) ([#2727](https://github.com/andymai/gridfinity-layout-tool/issues/2727)) ([01b5694](https://github.com/andymai/gridfinity-layout-tool/commit/01b56940ef778e68ffc90ad4274c576e0da56e8d))

## [4.281.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.280.0...gridfinity-layout-tool-v4.281.0) (2026-07-22)

### Features

- **designer:** auto-fit surface text on the bin's outer walls ([#2695](https://github.com/andymai/gridfinity-layout-tool/issues/2695)) ([#2723](https://github.com/andymai/gridfinity-layout-tool/issues/2723)) ([1c44640](https://github.com/andymai/gridfinity-layout-tool/commit/1c446408f2359864962295cc04e95302356ea3c2))

## [4.280.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.279.1...gridfinity-layout-tool-v4.280.0) (2026-07-22)

### Features

- **designer:** engraved, embossed & through-cut text on the lid top ([#2695](https://github.com/andymai/gridfinity-layout-tool/issues/2695)) ([#2720](https://github.com/andymai/gridfinity-layout-tool/issues/2720)) ([56f45df](https://github.com/andymai/gridfinity-layout-tool/commit/56f45dfbaeba3d255e9f0d122e9914e48b5c3f6b))

## [4.279.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.279.0...gridfinity-layout-tool-v4.279.1) (2026-07-22)

### Bug Fixes

- **baseplate:** stop navigation from dropping an unsaved layout's padding ([#2721](https://github.com/andymai/gridfinity-layout-tool/issues/2721)) ([f7b1277](https://github.com/andymai/gridfinity-layout-tool/commit/f7b12777db54b57582f0a52b4d4c60b74d026b39))

## [4.279.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.278.1...gridfinity-layout-tool-v4.279.0) (2026-07-22)

### Features

- **baseplate:** compose padding into every custom shape + show its rim in the layout ([#2705](https://github.com/andymai/gridfinity-layout-tool/issues/2705)) ([#2718](https://github.com/andymai/gridfinity-layout-tool/issues/2718)) ([edebde2](https://github.com/andymai/gridfinity-layout-tool/commit/edebde249483f7a4df4a502381443c88952a0f8a))

## [4.278.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.278.0...gridfinity-layout-tool-v4.278.1) (2026-07-22)

### Bug Fixes

- **drawer:** stop measured size from silently resizing the grid ([#2705](https://github.com/andymai/gridfinity-layout-tool/issues/2705)) ([#2715](https://github.com/andymai/gridfinity-layout-tool/issues/2715)) ([725eb7e](https://github.com/andymai/gridfinity-layout-tool/commit/725eb7e48d0a181a784e1c58d2c30b575bdf1352))

## [4.278.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.277.0...gridfinity-layout-tool-v4.278.0) (2026-07-22)

### Features

- **designer:** support-free tapered magnet pads with rounded corners ([#2714](https://github.com/andymai/gridfinity-layout-tool/issues/2714)) ([bc1f6db](https://github.com/andymai/gridfinity-layout-tool/commit/bc1f6db45c64bb03c7583cc415d836f55616d11c))

## [4.277.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.276.0...gridfinity-layout-tool-v4.277.0) (2026-07-22)

### Features

- **designer:** non-square grid polish — baseplate echo + outline overlay ([#2704](https://github.com/andymai/gridfinity-layout-tool/issues/2704)) ([5d80881](https://github.com/andymai/gridfinity-layout-tool/commit/5d80881fb9c36bdd5a6357d43b1975f94f4c0a1c))

## [4.276.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.275.0...gridfinity-layout-tool-v4.276.0) (2026-07-22)

### Features

- **designer:** non-square depth axis in the 3D layout preview ([#2704](https://github.com/andymai/gridfinity-layout-tool/issues/2704)) ([7f47d12](https://github.com/andymai/gridfinity-layout-tool/commit/7f47d12644aca146d212f94f7913958ec3d2dab7))

## [4.275.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.274.0...gridfinity-layout-tool-v4.275.0) (2026-07-22)

### Features

- non-square grid for the layout and baseplates ([#2704](https://github.com/andymai/gridfinity-layout-tool/issues/2704)) ([4f60f1f](https://github.com/andymai/gridfinity-layout-tool/commit/4f60f1f79855f035ad4334eafe1304fd8c378f50))

## [4.274.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.273.2...gridfinity-layout-tool-v4.274.0) (2026-07-21)

### Features

- **designer:** rearchitect lid customization into its own group ([#2702](https://github.com/andymai/gridfinity-layout-tool/issues/2702)) ([e6a475e](https://github.com/andymai/gridfinity-layout-tool/commit/e6a475e7a176c96cfe2e028dcd53bd1ab842dee9))

## [4.273.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.273.1...gridfinity-layout-tool-v4.273.2) (2026-07-21)

### Bug Fixes

- **designer:** reject bins where magnet corner pads would merge ([#2698](https://github.com/andymai/gridfinity-layout-tool/issues/2698)) ([#2700](https://github.com/andymai/gridfinity-layout-tool/issues/2700)) ([a0ae551](https://github.com/andymai/gridfinity-layout-tool/commit/a0ae5519995bd0bc9c748f00f40bb702baab4bb0))

## [4.273.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.273.0...gridfinity-layout-tool-v4.273.1) (2026-07-21)

### Bug Fixes

- **designer:** correct magnetic lid geometry and panel layout ([#2694](https://github.com/andymai/gridfinity-layout-tool/issues/2694)) ([#2698](https://github.com/andymai/gridfinity-layout-tool/issues/2698)) ([a3d134b](https://github.com/andymai/gridfinity-layout-tool/commit/a3d134b3d005ad20c9c86cbda78c9ec6e704e77b))

## [4.273.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.272.0...gridfinity-layout-tool-v4.273.0) (2026-07-21)

### Features

- **designer:** magnetic-retention lids and tray tops ([#2694](https://github.com/andymai/gridfinity-layout-tool/issues/2694)) ([#2696](https://github.com/andymai/gridfinity-layout-tool/issues/2696)) ([6049597](https://github.com/andymai/gridfinity-layout-tool/commit/60495976067fe3aa720248078e24ce18d1bc017c))

## [4.272.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.271.0...gridfinity-layout-tool-v4.272.0) (2026-07-21)

### Features

- **designer:** add round, diamond, triangle, and slot wall patterns with scale control ([#2692](https://github.com/andymai/gridfinity-layout-tool/issues/2692)) ([773286d](https://github.com/andymai/gridfinity-layout-tool/commit/773286d6bdc89e60c6431f0993e2107d79319d3c))

## [4.271.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.270.0...gridfinity-layout-tool-v4.271.0) (2026-07-21)

### Features

- **designer:** slide-channel socket style for label tabs ([#2666](https://github.com/andymai/gridfinity-layout-tool/issues/2666)) ([#2689](https://github.com/andymai/gridfinity-layout-tool/issues/2689)) ([d635b23](https://github.com/andymai/gridfinity-layout-tool/commit/d635b23d17040589e2b79f8a0e322331fa98da96))

## [4.270.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.269.0...gridfinity-layout-tool-v4.270.0) (2026-07-21)

### Features

- **designer:** hardware icons on swappable label plates ([#2666](https://github.com/andymai/gridfinity-layout-tool/issues/2666)) ([#2687](https://github.com/andymai/gridfinity-layout-tool/issues/2687)) ([e744326](https://github.com/andymai/gridfinity-layout-tool/commit/e7443262fadecd48f6227b2c6b1c683e7c28ff07))

## [4.269.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.268.1...gridfinity-layout-tool-v4.269.0) (2026-07-21)

### Features

- **designer:** paint_color face zones for label plates ([#2666](https://github.com/andymai/gridfinity-layout-tool/issues/2666)) ([#2685](https://github.com/andymai/gridfinity-layout-tool/issues/2685)) ([8759ef9](https://github.com/andymai/gridfinity-layout-tool/commit/8759ef960930b13cbc040c84a0e2b14f8a481db0))

## [4.268.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.268.0...gridfinity-layout-tool-v4.268.1) (2026-07-21)

### Bug Fixes

- **designer:** flare v1-compat channel ends on 1U label plates ([#2666](https://github.com/andymai/gridfinity-layout-tool/issues/2666)) ([#2683](https://github.com/andymai/gridfinity-layout-tool/issues/2683)) ([0965a89](https://github.com/andymai/gridfinity-layout-tool/commit/0965a8989f231267b797bb425b672725c3d160c3))

## [4.268.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.267.0...gridfinity-layout-tool-v4.268.0) (2026-07-21)

### Features

- **designer:** label socket fit-calibration coupon ([#2666](https://github.com/andymai/gridfinity-layout-tool/issues/2666)) ([#2681](https://github.com/andymai/gridfinity-layout-tool/issues/2681)) ([53e142b](https://github.com/andymai/gridfinity-layout-tool/commit/53e142b438d75d0bf3eaecb9431f4231b2aca283))

## [4.267.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.266.1...gridfinity-layout-tool-v4.267.0) (2026-07-21)

### Features

- **print-export:** label plate counts in the print list ([#2666](https://github.com/andymai/gridfinity-layout-tool/issues/2666)) ([#2677](https://github.com/andymai/gridfinity-layout-tool/issues/2677)) ([2b1bc35](https://github.com/andymai/gridfinity-layout-tool/commit/2b1bc352394d7f15930b2e5487dc35a7f328fdad))

## [4.266.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.266.0...gridfinity-layout-tool-v4.266.1) (2026-07-21)

### Bug Fixes

- **deps:** patch brace-expansion and protobufjs DoS advisories ([#2678](https://github.com/andymai/gridfinity-layout-tool/issues/2678)) ([7409d20](https://github.com/andymai/gridfinity-layout-tool/commit/7409d2083ed779e6067855d585513d4efd06e377))

## [4.266.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.265.0...gridfinity-layout-tool-v4.266.0) (2026-07-20)

### Features

- **designer:** batch label plate export in the layout ZIP ([#2666](https://github.com/andymai/gridfinity-layout-tool/issues/2666)) ([#2675](https://github.com/andymai/gridfinity-layout-tool/issues/2675)) ([f5f2c50](https://github.com/andymai/gridfinity-layout-tool/commit/f5f2c50095428d6792679f92c527a13da5631855))

## [4.265.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.264.0...gridfinity-layout-tool-v4.265.0) (2026-07-20)

### Features

- **designer:** printable label plates for socket-mode tabs ([#2666](https://github.com/andymai/gridfinity-layout-tool/issues/2666)) ([#2673](https://github.com/andymai/gridfinity-layout-tool/issues/2673)) ([c9e7a59](https://github.com/andymai/gridfinity-layout-tool/commit/c9e7a59e27313b58227f843a80cb83aae7981116))

## [4.264.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.263.0...gridfinity-layout-tool-v4.264.0) (2026-07-20)

### Features

- **designer:** swappable-label socket mode for label tabs ([#2666](https://github.com/andymai/gridfinity-layout-tool/issues/2666)) ([#2669](https://github.com/andymai/gridfinity-layout-tool/issues/2669)) ([e1a2d29](https://github.com/andymai/gridfinity-layout-tool/commit/e1a2d29258beb02d53d9aed67aed88c5215fff80))

## [4.263.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.262.0...gridfinity-layout-tool-v4.263.0) (2026-07-20)

### Features

- **baseplate:** capture preview thumbnails for the library manager ([#2670](https://github.com/andymai/gridfinity-layout-tool/issues/2670)) ([ae455b0](https://github.com/andymai/gridfinity-layout-tool/commit/ae455b0b2c8b306238debb3505c41e43037ad9f3))

## [4.262.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.261.0...gridfinity-layout-tool-v4.262.0) (2026-07-20)

### Features

- **designer:** tag appearance customization (icons & colors) ([#2652](https://github.com/andymai/gridfinity-layout-tool/issues/2652)) ([c661bcb](https://github.com/andymai/gridfinity-layout-tool/commit/c661bcbdec53f2315f292af112c3e74014fd7e0f))

## [4.261.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.260.3...gridfinity-layout-tool-v4.261.0) (2026-07-20)

### Features

- **preview:** render real design geometry for linked bins in 3D preview ([#2654](https://github.com/andymai/gridfinity-layout-tool/issues/2654)) ([7744398](https://github.com/andymai/gridfinity-layout-tool/commit/774439859c88f29133e0ce7a8afa54140cf234ea))

## [4.260.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.260.2...gridfinity-layout-tool-v4.260.3) (2026-07-20)

### Bug Fixes

- **shell:** bin list table edge-to-edge and sidebar group cleanup ([#2663](https://github.com/andymai/gridfinity-layout-tool/issues/2663)) ([10cae9a](https://github.com/andymai/gridfinity-layout-tool/commit/10cae9a4061c4c862451b251ee89d4642c9006f4))

## [4.260.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.260.1...gridfinity-layout-tool-v4.260.2) (2026-07-20)

### Bug Fixes

- **baseplate:** replace flat connector key with locking puzzle-lobe dogbone ([#2642](https://github.com/andymai/gridfinity-layout-tool/issues/2642)) ([921f102](https://github.com/andymai/gridfinity-layout-tool/commit/921f102b0a9c10450ca0ef922a6c9551a74ad505)), closes [#2637](https://github.com/andymai/gridfinity-layout-tool/issues/2637)

## [4.260.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.260.0...gridfinity-layout-tool-v4.260.1) (2026-07-20)

### Bug Fixes

- **baseplate:** snap clip can actually be inserted — thin the retaining wall, trim the barb ([#2643](https://github.com/andymai/gridfinity-layout-tool/issues/2643)) ([5456f0d](https://github.com/andymai/gridfinity-layout-tool/commit/5456f0d4a3087178257c88fbb088a85693f0a7aa)), closes [#2638](https://github.com/andymai/gridfinity-layout-tool/issues/2638)

## [4.260.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.259.0...gridfinity-layout-tool-v4.260.0) (2026-07-20)

### Features

- **designer:** partial-length and custom removable dividers ([#2651](https://github.com/andymai/gridfinity-layout-tool/issues/2651)) ([3ecf54c](https://github.com/andymai/gridfinity-layout-tool/commit/3ecf54ccf98a3c858310d0aa6dee682b0f82e857))

## [4.259.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.258.0...gridfinity-layout-tool-v4.259.0) (2026-07-20)

### Features

- **supporters:** recency signals, supporter messages, and find-your-bin ([#2648](https://github.com/andymai/gridfinity-layout-tool/issues/2648)) ([6508777](https://github.com/andymai/gridfinity-layout-tool/commit/6508777503a8ddfe48568963f1cec6fdaf2257ee))

## [4.258.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.257.0...gridfinity-layout-tool-v4.258.0) (2026-07-20)

### Features

- **shell:** regroup sidebar into labeled clusters with progressive disclosure ([#2644](https://github.com/andymai/gridfinity-layout-tool/issues/2644)) ([ce08225](https://github.com/andymai/gridfinity-layout-tool/commit/ce0822588f362fee7088f4fe0998b3d222d4f1b8))

## [4.257.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.256.0...gridfinity-layout-tool-v4.257.0) (2026-07-20)

### Features

- **baseplate:** compose stack printing with detached margins ([#2641](https://github.com/andymai/gridfinity-layout-tool/issues/2641)) ([#2645](https://github.com/andymai/gridfinity-layout-tool/issues/2645)) ([2b97376](https://github.com/andymai/gridfinity-layout-tool/commit/2b97376550900323b84d87c8b24c07dba01d6e30))

## [4.256.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.255.0...gridfinity-layout-tool-v4.256.0) (2026-07-19)

### Features

- **designer:** preserve tool relief in STL imprint pockets ([#2639](https://github.com/andymai/gridfinity-layout-tool/issues/2639)) ([a5eb89c](https://github.com/andymai/gridfinity-layout-tool/commit/a5eb89c387cb9ce7f44537bba3a38ee63a619c4c))

## [4.255.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.254.0...gridfinity-layout-tool-v4.255.0) (2026-07-19)

### Features

- **designer:** per-compartment cross dividers with face receptacles ([#2635](https://github.com/andymai/gridfinity-layout-tool/issues/2635)) ([eddb8a6](https://github.com/andymai/gridfinity-layout-tool/commit/eddb8a6ff675be3999c99be44597f5fdd4e1db67))

## [4.254.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.253.0...gridfinity-layout-tool-v4.254.0) (2026-07-19)

### Features

- **designer:** interlocking dividers for both directions at once ([#2632](https://github.com/andymai/gridfinity-layout-tool/issues/2632)) ([aeb7be5](https://github.com/andymai/gridfinity-layout-tool/commit/aeb7be53fad1e402a38da0e2c7479670b3126d53))

## [4.253.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.252.2...gridfinity-layout-tool-v4.253.0) (2026-07-18)

### Features

- **designer:** precise scanned-STL outlines, 5mm clearance cap, free import rotation ([#2628](https://github.com/andymai/gridfinity-layout-tool/issues/2628)) ([9651642](https://github.com/andymai/gridfinity-layout-tool/commit/9651642bf9dbb1b89c3deec1045d5a027b1e8879))

## [4.252.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.252.1...gridfinity-layout-tool-v4.252.2) (2026-07-18)

### Bug Fixes

- **worker:** recover the brepkit kernel after a borrow-flag poison ([#2626](https://github.com/andymai/gridfinity-layout-tool/issues/2626)) ([49767d0](https://github.com/andymai/gridfinity-layout-tool/commit/49767d08e7d0463f18a89d0042150f461a3fe1bc))

## [4.252.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.252.0...gridfinity-layout-tool-v4.252.1) (2026-07-17)

### Bug Fixes

- **print-export:** stop zeroing acceleration in multi-color 3MF exports ([#2623](https://github.com/andymai/gridfinity-layout-tool/issues/2623)) ([d49503d](https://github.com/andymai/gridfinity-layout-tool/commit/d49503dc62dec3a3c9f4fe954ebcd8bd0c523f73))

## [4.252.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.251.0...gridfinity-layout-tool-v4.252.0) (2026-07-17)

### Features

- **designer:** import STL files as 3D imprint cutouts ([#2618](https://github.com/andymai/gridfinity-layout-tool/issues/2618)) ([54356f7](https://github.com/andymai/gridfinity-layout-tool/commit/54356f73b8b10aba1cedeeab692a8ff036c51ba2))

## [4.251.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.250.0...gridfinity-layout-tool-v4.251.0) (2026-07-17)

### Features

- **baseplate:** compose padding with corner-cut shapes, lift corner radius cap ([#2619](https://github.com/andymai/gridfinity-layout-tool/issues/2619)) ([35c7519](https://github.com/andymai/gridfinity-layout-tool/commit/35c7519ea6c8b538f14902d83481b35d669ae650))

## [4.250.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.249.0...gridfinity-layout-tool-v4.250.0) (2026-07-16)

### Features

- **seo:** answer-first lead paragraphs on sizes and what-is pages ([#2609](https://github.com/andymai/gridfinity-layout-tool/issues/2609)) ([c42da04](https://github.com/andymai/gridfinity-layout-tool/commit/c42da049d3c641f69e59cc99e60f89cec90df37d))
- **seo:** make homepage content visible to search crawlers ([#2610](https://github.com/andymai/gridfinity-layout-tool/issues/2610)) ([df3a82c](https://github.com/andymai/gridfinity-layout-tool/commit/df3a82cff6a70b19579bac8a057497645083b4cf))
- **seo:** position generator page against other online generators ([#2608](https://github.com/andymai/gridfinity-layout-tool/issues/2608)) ([43b1488](https://github.com/andymai/gridfinity-layout-tool/commit/43b14887cbe78f1fd13e21d776eaa6d7e653bff7))

## [4.249.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.248.4...gridfinity-layout-tool-v4.249.0) (2026-07-16)

### Features

- **drawer:** enter measured drawer size in mm with fit and slack feedback ([#2606](https://github.com/andymai/gridfinity-layout-tool/issues/2606)) ([84a1a11](https://github.com/andymai/gridfinity-layout-tool/commit/84a1a11820dc283726e2f495d49ff261c35fd08b))

## [4.248.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.248.3...gridfinity-layout-tool-v4.248.4) (2026-07-16)

### Bug Fixes

- **shell:** polish sidebars and top bar across desktop, tablet, and mobile ([#2603](https://github.com/andymai/gridfinity-layout-tool/issues/2603)) ([46d2d27](https://github.com/andymai/gridfinity-layout-tool/commit/46d2d27a4b31c52aeb46aa18954fd96f1d53ee6c))

## [4.248.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.248.2...gridfinity-layout-tool-v4.248.3) (2026-07-15)

### Bug Fixes

- **baseplate:** stop discarding a saved baseplate name silently ([#2599](https://github.com/andymai/gridfinity-layout-tool/issues/2599)) ([9ba3670](https://github.com/andymai/gridfinity-layout-tool/commit/9ba3670244f66f8c2d05bfb26da08afbafa07b00))

## [4.248.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.248.1...gridfinity-layout-tool-v4.248.2) (2026-07-15)

### Bug Fixes

- **baseplate:** flatten the generator header to match the designer ([#2590](https://github.com/andymai/gridfinity-layout-tool/issues/2590)) ([f4313c3](https://github.com/andymai/gridfinity-layout-tool/commit/f4313c3b4e77b665b1cd0b3c5f5fe188a5dbb55b))

## [4.248.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.248.0...gridfinity-layout-tool-v4.248.1) (2026-07-15)

### Bug Fixes

- serve /supporters instead of 404ing it ([#2596](https://github.com/andymai/gridfinity-layout-tool/issues/2596)) ([3791406](https://github.com/andymai/gridfinity-layout-tool/commit/3791406bb630673cb7c3580cc7d77520445d3a48))

## [4.248.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.247.1...gridfinity-layout-tool-v4.248.0) (2026-07-15)

### Features

- **supporters:** keep the supporters page up to date automatically ([#2593](https://github.com/andymai/gridfinity-layout-tool/issues/2593)) ([1ec7747](https://github.com/andymai/gridfinity-layout-tool/commit/1ec7747435ba0c6fed1035f70c17649515ee2e48))

## [4.247.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.247.0...gridfinity-layout-tool-v4.247.1) (2026-07-15)

### Bug Fixes

- **sidebar:** make baseplate, drawer shape, and stack solver match the sidebar ([#2589](https://github.com/andymai/gridfinity-layout-tool/issues/2589)) ([f5cbd59](https://github.com/andymai/gridfinity-layout-tool/commit/f5cbd59b42ccf63cbcec439a0ae5b5b76faac659))

## [4.247.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.246.1...gridfinity-layout-tool-v4.247.0) (2026-07-15)

### Features

- **bin-designer:** add per-label size control ([#2586](https://github.com/andymai/gridfinity-layout-tool/issues/2586)) ([#2587](https://github.com/andymai/gridfinity-layout-tool/issues/2587)) ([a991d7c](https://github.com/andymai/gridfinity-layout-tool/commit/a991d7cc30e10e20bf066e7bbd03cdba4f7cb4ae))

## [4.246.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.246.0...gridfinity-layout-tool-v4.246.1) (2026-07-14)

### Bug Fixes

- **bin-designer:** keep cutout labels visible on narrow cutouts ([#2584](https://github.com/andymai/gridfinity-layout-tool/issues/2584)) ([843a884](https://github.com/andymai/gridfinity-layout-tool/commit/843a8841c3f1ecf3ac78166d717042fac430e1f0))

## [4.246.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.245.3...gridfinity-layout-tool-v4.246.0) (2026-07-13)

### Features

- **i18n:** add Italian localization ([#2566](https://github.com/andymai/gridfinity-layout-tool/issues/2566)) ([c7c01b2](https://github.com/andymai/gridfinity-layout-tool/commit/c7c01b2f2173d6c434f0d5ee9d25b6d56850e706))

## [4.245.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.245.2...gridfinity-layout-tool-v4.245.3) (2026-07-13)

### Bug Fixes

- **baseplate:** thicken magnet pad walls ([#2560](https://github.com/andymai/gridfinity-layout-tool/issues/2560)) ([f08fe9b](https://github.com/andymai/gridfinity-layout-tool/commit/f08fe9baef73111e662911329af09752154fbb4e))

## [4.245.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.245.1...gridfinity-layout-tool-v4.245.2) (2026-07-13)

### Bug Fixes

- **baseplate:** widen 0.6mm magnet pad margin to a full 3 perimeters ([#2563](https://github.com/andymai/gridfinity-layout-tool/issues/2563)) ([26ac0c5](https://github.com/andymai/gridfinity-layout-tool/commit/26ac0c534774b545e5bf0aa33dd80c69ff7ccb7d))

## [4.245.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.245.0...gridfinity-layout-tool-v4.245.1) (2026-07-13)

### Bug Fixes

- **baseplate:** key mesh cache on nozzle for lightweight magnet pads ([#2561](https://github.com/andymai/gridfinity-layout-tool/issues/2561)) ([706ef03](https://github.com/andymai/gridfinity-layout-tool/commit/706ef0358319a799c33c62819e2cd6399d25304f))

## [4.245.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.244.2...gridfinity-layout-tool-v4.245.0) (2026-07-12)

### Features

- **labs:** graduate custom drawer shapes out of labs ([#2557](https://github.com/andymai/gridfinity-layout-tool/issues/2557)) ([03b7963](https://github.com/andymai/gridfinity-layout-tool/commit/03b79633b18c3eaaed3d967a162477447081add9))

## [4.244.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.244.1...gridfinity-layout-tool-v4.244.2) (2026-07-12)

### Bug Fixes

- **baseplate:** apply connector fit offset to split-piece geometry ([#2555](https://github.com/andymai/gridfinity-layout-tool/issues/2555)) ([5b79efd](https://github.com/andymai/gridfinity-layout-tool/commit/5b79efd9d6aae36f7714e80a1975a0a5eef87a51)), closes [#2554](https://github.com/andymai/gridfinity-layout-tool/issues/2554)

## [4.244.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.244.0...gridfinity-layout-tool-v4.244.1) (2026-07-12)

### Bug Fixes

- **grid-editor:** keep axis labels clear of the overhang margin band ([#2549](https://github.com/andymai/gridfinity-layout-tool/issues/2549)) ([#2552](https://github.com/andymai/gridfinity-layout-tool/issues/2552)) ([a217b7c](https://github.com/andymai/gridfinity-layout-tool/commit/a217b7c7ee3bbe119316a84abbab09cd222ae4e1))

## [4.244.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.243.0...gridfinity-layout-tool-v4.244.0) (2026-07-12)

### Features

- **baseplate:** configurable magnet anchor for grids larger than 42mm ([#2550](https://github.com/andymai/gridfinity-layout-tool/issues/2550)) ([cdcb338](https://github.com/andymai/gridfinity-layout-tool/commit/cdcb3384de19a56e7913901a87c86591e5af0158))

## [4.243.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.242.1...gridfinity-layout-tool-v4.243.0) (2026-07-12)

### Features

- **drawer-shape:** per-corner cuts editor with chamfer, radius, and notch ([#2546](https://github.com/andymai/gridfinity-layout-tool/issues/2546)) ([31e762f](https://github.com/andymai/gridfinity-layout-tool/commit/31e762f83858a1fe535436461eddfe4ece019152))

## [4.242.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.242.0...gridfinity-layout-tool-v4.242.1) (2026-07-12)

### Bug Fixes

- strengthen magnet hole pads for wide nozzles ([#2544](https://github.com/andymai/gridfinity-layout-tool/issues/2544)) ([dd720ca](https://github.com/andymai/gridfinity-layout-tool/commit/dd720ca93bf903b3dda7561e38f704f35cc0f9de))

## [4.242.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.241.0...gridfinity-layout-tool-v4.242.0) (2026-07-12)

### Features

- **drawer-shape:** cell-paint shape editor and bin-layout tracing behind labs flag ([#2542](https://github.com/andymai/gridfinity-layout-tool/issues/2542)) ([74bee99](https://github.com/andymai/gridfinity-layout-tool/commit/74bee99defce056aa4dc68b9596552305ad7853f))

## [4.241.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.240.0...gridfinity-layout-tool-v4.241.0) (2026-07-12)

### Features

- **baseplate:** hide shape-subsumed controls and explain shaped drawers in the panel ([#2539](https://github.com/andymai/gridfinity-layout-tool/issues/2539)) ([68b1649](https://github.com/andymai/gridfinity-layout-tool/commit/68b1649b4c3112314b748adfb3c0bd70d9bb93ae))

## [4.240.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.239.0...gridfinity-layout-tool-v4.240.0) (2026-07-12)

### Features

- **grid:** gate bin placement and render the drawer outline in the layout tab ([#2537](https://github.com/andymai/gridfinity-layout-tool/issues/2537)) ([eadba86](https://github.com/andymai/gridfinity-layout-tool/commit/eadba86c5a408df954f78f6bbd2ba61475c36303))

## [4.239.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.238.0...gridfinity-layout-tool-v4.239.0) (2026-07-12)

### Features

- **drawer:** setOutline command, resize adaptation, and outline persistence guards ([#2535](https://github.com/andymai/gridfinity-layout-tool/issues/2535)) ([b0cb5d5](https://github.com/andymai/gridfinity-layout-tool/commit/b0cb5d58084c5092033b220065212e477ba1b21d))

## [4.238.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.237.0...gridfinity-layout-tool-v4.238.0) (2026-07-12)

### Features

- **baseplate:** split shaped plates with outline-aware pieces ([#2534](https://github.com/andymai/gridfinity-layout-tool/issues/2534)) ([7ec7e6f](https://github.com/andymai/gridfinity-layout-tool/commit/7ec7e6f87b003802e6ababfe654eb603322ee636))

## [4.237.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.236.0...gridfinity-layout-tool-v4.237.0) (2026-07-12)

### Features

- **baseplate:** generate non-rectangular baseplates from drawer outlines ([#2532](https://github.com/andymai/gridfinity-layout-tool/issues/2532)) ([02ad023](https://github.com/andymai/gridfinity-layout-tool/commit/02ad023df6ac65eb10e5a3acfbe8acbf64fab9bc))

## [4.236.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.235.1...gridfinity-layout-tool-v4.236.0) (2026-07-11)

### Features

- **drawer:** add drawer outline model for non-rectangular drawers ([#2530](https://github.com/andymai/gridfinity-layout-tool/issues/2530)) ([8cb37f9](https://github.com/andymai/gridfinity-layout-tool/commit/8cb37f9454cc1e9bbf579deea262d8e907ddacce))

## [4.235.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.235.0...gridfinity-layout-tool-v4.235.1) (2026-07-11)

### Bug Fixes

- **baseplate:** edge-anchor magnet holes on grid units larger than 42mm ([#2526](https://github.com/andymai/gridfinity-layout-tool/issues/2526)) ([11b6d5e](https://github.com/andymai/gridfinity-layout-tool/commit/11b6d5e8551aea599d565748166d587503bb62da))

## [4.235.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.234.1...gridfinity-layout-tool-v4.235.0) (2026-07-11)

### Features

- **baseplate:** multiple saved baseplate designs with per-layout active selection ([#2522](https://github.com/andymai/gridfinity-layout-tool/issues/2522)) ([9464ee7](https://github.com/andymai/gridfinity-layout-tool/commit/9464ee7c584938595d8a1f2ba1f6ddef440bbeb7))

## [4.234.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.234.0...gridfinity-layout-tool-v4.234.1) (2026-07-11)

### Bug Fixes

- **design-linking:** infer half-unit edge from drawer & warn on mismatch ([#2518](https://github.com/andymai/gridfinity-layout-tool/issues/2518)) ([#2520](https://github.com/andymai/gridfinity-layout-tool/issues/2520)) ([09bfa78](https://github.com/andymai/gridfinity-layout-tool/commit/09bfa7862a533f65abe9ba34f8b10843a54b4350))

## [4.234.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.233.0...gridfinity-layout-tool-v4.234.0) (2026-07-11)

### Features

- **bin-designer:** add top accent color band ([#2516](https://github.com/andymai/gridfinity-layout-tool/issues/2516)) ([a622c2b](https://github.com/andymai/gridfinity-layout-tool/commit/a622c2bb7306e08a6d07ad467c5283251f100065))

## [4.233.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.232.0...gridfinity-layout-tool-v4.233.0) (2026-07-09)

### Features

- **a11y:** support Windows High Contrast Mode (forced-colors) ([#2505](https://github.com/andymai/gridfinity-layout-tool/issues/2505)) ([6c9724f](https://github.com/andymai/gridfinity-layout-tool/commit/6c9724fd2012c95d7d9e5a8fd5a4978865235f5d))

## [4.232.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.231.0...gridfinity-layout-tool-v4.232.0) (2026-07-09)

### Features

- **a11y:** add Accessibility settings tab (high-contrast, category patterns) ([#2510](https://github.com/andymai/gridfinity-layout-tool/issues/2510)) ([6734dad](https://github.com/andymai/gridfinity-layout-tool/commit/6734dad6da4a149b249787c93eb84d67b043d7dd))

## [4.231.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.230.0...gridfinity-layout-tool-v4.231.0) (2026-07-09)

### Features

- **a11y:** add screen-reader text alternative for the 3D preview ([#2509](https://github.com/andymai/gridfinity-layout-tool/issues/2509)) ([882b75b](https://github.com/andymai/gridfinity-layout-tool/commit/882b75bbcf382fb1b6235371be0a211cb547bd33))

## [4.230.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.229.1...gridfinity-layout-tool-v4.230.0) (2026-07-09)

### Features

- **a11y:** localize grid screen-reader announcements and bin labels ([#2503](https://github.com/andymai/gridfinity-layout-tool/issues/2503)) ([d278f71](https://github.com/andymai/gridfinity-layout-tool/commit/d278f71b353ae758f02689aa41c01e7a320d1d2c))

## [4.229.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.229.0...gridfinity-layout-tool-v4.229.1) (2026-07-09)

### Bug Fixes

- **a11y:** move keyboard focus to nearest bin after deleting focused bin ([#2504](https://github.com/andymai/gridfinity-layout-tool/issues/2504)) ([0027a6d](https://github.com/andymai/gridfinity-layout-tool/commit/0027a6d331c5318e011fd16e4c35751720d107bc))

## [4.229.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.228.2...gridfinity-layout-tool-v4.229.0) (2026-07-09)

### Features

- **bin-designer:** add extra exterior wall height (collar) ([#2501](https://github.com/andymai/gridfinity-layout-tool/issues/2501)) ([8c34c61](https://github.com/andymai/gridfinity-layout-tool/commit/8c34c61b5a0a048afbd3cf5ea3ba231f9eb5d912))

## [4.228.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.228.1...gridfinity-layout-tool-v4.228.2) (2026-07-08)

### Bug Fixes

- **supporters:** also guard against empty indices in bake ([#2498](https://github.com/andymai/gridfinity-layout-tool/issues/2498)) ([3d66879](https://github.com/andymai/gridfinity-layout-tool/commit/3d668799ae354152cad5b34f294e7ba851b64aca))

## [4.228.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.228.0...gridfinity-layout-tool-v4.228.1) (2026-07-08)

### Bug Fixes

- **supporters:** fail bake loudly on empty mesh or edge data ([#2496](https://github.com/andymai/gridfinity-layout-tool/issues/2496)) ([48f42a5](https://github.com/andymai/gridfinity-layout-tool/commit/48f42a5fcbf00e18f25363b33eb4600b3c4887d9))

## [4.228.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.227.0...gridfinity-layout-tool-v4.228.0) (2026-07-08)

### Features

- **supporters:** draw real BREP edge lines, drop auto-rotate and ghost bin ([#2494](https://github.com/andymai/gridfinity-layout-tool/issues/2494)) ([a2435a6](https://github.com/andymai/gridfinity-layout-tool/commit/a2435a674e1cb9474c98de6e2a70f8ade78033c7))

## [4.227.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.226.1...gridfinity-layout-tool-v4.227.0) (2026-07-08)

### Features

- **supporters:** restyle scene to match the app and fix tab orientation ([#2492](https://github.com/andymai/gridfinity-layout-tool/issues/2492)) ([ed9ce9c](https://github.com/andymai/gridfinity-layout-tool/commit/ed9ce9c758383e5f6707d12ecde3eed0e8b6429b))

## [4.226.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.226.0...gridfinity-layout-tool-v4.226.1) (2026-07-08)

### Bug Fixes

- **bin-designer:** stop parameter panel from scrolling the whole page ([#2490](https://github.com/andymai/gridfinity-layout-tool/issues/2490)) ([c4150a2](https://github.com/andymai/gridfinity-layout-tool/commit/c4150a2d82479a01bce9058daf7a40b06affbad0))

## [4.226.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.225.0...gridfinity-layout-tool-v4.226.0) (2026-07-08)

### Features

- **supporters:** redesign page with real generated Gridfinity bin renders ([#2488](https://github.com/andymai/gridfinity-layout-tool/issues/2488)) ([3c22911](https://github.com/andymai/gridfinity-layout-tool/commit/3c229116029b09946b9240e64edf5abdcf134848))

## [4.225.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.224.2...gridfinity-layout-tool-v4.225.0) (2026-07-08)

### Features

- **bin-designer:** add extra lid height for tall lids over short bins ([#2486](https://github.com/andymai/gridfinity-layout-tool/issues/2486)) ([bc0a38d](https://github.com/andymai/gridfinity-layout-tool/commit/bc0a38df200403cb9aa68bcb841883bdc499060f))

## [4.224.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.224.1...gridfinity-layout-tool-v4.224.2) (2026-07-08)

### Bug Fixes

- **baseplate:** export puzzle connector fit sample as puzzle, not dovetail ([#2484](https://github.com/andymai/gridfinity-layout-tool/issues/2484)) ([f36f26b](https://github.com/andymai/gridfinity-layout-tool/commit/f36f26b27445d70779507338456e0625c703d26e))

## [4.224.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.224.0...gridfinity-layout-tool-v4.224.1) (2026-07-08)

### Bug Fixes

- **size:** measure Total JS for one locale, not all ten ([#2480](https://github.com/andymai/gridfinity-layout-tool/issues/2480)) ([3022c8f](https://github.com/andymai/gridfinity-layout-tool/commit/3022c8fe88940ad2025bef56870c3cc758566466))

## [4.224.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.223.0...gridfinity-layout-tool-v4.224.0) (2026-07-08)

### Features

- **supporters:** immersive WebGL redesign of the supporters page ([#2478](https://github.com/andymai/gridfinity-layout-tool/issues/2478)) ([5de39ef](https://github.com/andymai/gridfinity-layout-tool/commit/5de39ef36ba9b1dc1ed2466dd83e6edbf3bc4189))

## [4.223.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.222.0...gridfinity-layout-tool-v4.223.0) (2026-07-08)

### Features

- **supporters:** add supporters thank-you page ([#2476](https://github.com/andymai/gridfinity-layout-tool/issues/2476)) ([0c940bf](https://github.com/andymai/gridfinity-layout-tool/commit/0c940bf4d4e832a6ee5ae5406f53fdb311ccb7a7))

## [4.222.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.221.0...gridfinity-layout-tool-v4.222.0) (2026-07-07)

### Features

- **labs:** graduate 'Extend Bins into Drawer Margin' + full-flow e2e ([#2474](https://github.com/andymai/gridfinity-layout-tool/issues/2474)) ([1f19897](https://github.com/andymai/gridfinity-layout-tool/commit/1f19897651606ac7ca07885da74e7f34f249db20))

## [4.221.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.220.1...gridfinity-layout-tool-v4.221.0) (2026-07-07)

### Features

- **layout:** extend edge bins into the baseplate drawer margin (Labs) ([#2472](https://github.com/andymai/gridfinity-layout-tool/issues/2472)) ([35bf73a](https://github.com/andymai/gridfinity-layout-tool/commit/35bf73a1c62fced0ca6fcd44ab5041cd1ff01d55))

## [4.220.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.220.0...gridfinity-layout-tool-v4.220.1) (2026-07-07)

### Bug Fixes

- **bin-designer:** wire label color swatches into the swap-colors tool ([#2469](https://github.com/andymai/gridfinity-layout-tool/issues/2469)) ([f24f57b](https://github.com/andymai/gridfinity-layout-tool/commit/f24f57ba84a63360f59cf5dbfca5c1bdae45af4e))

## [4.220.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.219.0...gridfinity-layout-tool-v4.220.0) (2026-07-07)

### Features

- **grid-editor:** show baseplate drawer-fit margin in the layout view ([#2468](https://github.com/andymai/gridfinity-layout-tool/issues/2468)) ([f214fae](https://github.com/andymai/gridfinity-layout-tool/commit/f214fae63f7298fc66c30aed6509aeb32e0eab70))

### Bug Fixes

- **bin-designer:** make the Custom Cutouts editor overhang-aware ([#2467](https://github.com/andymai/gridfinity-layout-tool/issues/2467)) ([78e3405](https://github.com/andymai/gridfinity-layout-tool/commit/78e340570aa5dfea4cce3550676d9090fdd34bab))

## [4.219.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.218.0...gridfinity-layout-tool-v4.219.0) (2026-07-07)

### Features

- **bin-designer:** color controls for labels in the Label section ([#2465](https://github.com/andymai/gridfinity-layout-tool/issues/2465)) ([8cd0bd5](https://github.com/andymai/gridfinity-layout-tool/commit/8cd0bd59c7c86976c00fe5c53190e0dbb355b080))

## [4.218.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.217.0...gridfinity-layout-tool-v4.218.0) (2026-07-07)

### Features

- **bin-designer:** optional separate glue-on baseplate for stackable lids ([#2463](https://github.com/andymai/gridfinity-layout-tool/issues/2463)) ([ed12b24](https://github.com/andymai/gridfinity-layout-tool/commit/ed12b242d0e61c5c318283c1d34905e7bfdfe635))

## [4.217.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.216.0...gridfinity-layout-tool-v4.217.0) (2026-07-07)

### Features

- **bin-designer:** two-variable finger scoop with curved/straight styles ([#2459](https://github.com/andymai/gridfinity-layout-tool/issues/2459)) ([7b4ac94](https://github.com/andymai/gridfinity-layout-tool/commit/7b4ac9488a731807e2d5317ff750c8b6f7530127))

## [4.216.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.215.2...gridfinity-layout-tool-v4.216.0) (2026-07-05)

### Features

- **baseplate:** solid floor toggle for baseplates ([#2445](https://github.com/andymai/gridfinity-layout-tool/issues/2445)) ([abeb2e4](https://github.com/andymai/gridfinity-layout-tool/commit/abeb2e48df1d0f496879d01fb74379be04276a46))

## [4.215.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.215.1...gridfinity-layout-tool-v4.215.2) (2026-07-05)

### Bug Fixes

- **generation:** bump brepjs to 18.118.3 for overlapping-cutout color ([#2443](https://github.com/andymai/gridfinity-layout-tool/issues/2443)) ([#2448](https://github.com/andymai/gridfinity-layout-tool/issues/2448)) ([724de22](https://github.com/andymai/gridfinity-layout-tool/commit/724de2219645dd9483bdd97ef104a8a22ed5a494))

## [4.215.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.215.0...gridfinity-layout-tool-v4.215.1) (2026-07-04)

### Bug Fixes

- **bin-designer:** accept solid style on design import ([#2444](https://github.com/andymai/gridfinity-layout-tool/issues/2444)) ([#2446](https://github.com/andymai/gridfinity-layout-tool/issues/2446)) ([d0dede4](https://github.com/andymai/gridfinity-layout-tool/commit/d0dede4881ed1bc6f43eb389e4932b702443a21d))

## [4.215.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.214.0...gridfinity-layout-tool-v4.215.0) (2026-07-04)

### Features

- support non-square grid units for bins and baseplates ([#2438](https://github.com/andymai/gridfinity-layout-tool/issues/2438)) ([5f48ebf](https://github.com/andymai/gridfinity-layout-tool/commit/5f48ebf2f4a37033cd2fa2b3d92c32e71eed6c0d))

## [4.214.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.213.1...gridfinity-layout-tool-v4.214.0) (2026-07-04)

### Features

- **bin-designer:** shadow-board colors for custom cutouts ([#2440](https://github.com/andymai/gridfinity-layout-tool/issues/2440)) ([4dd403e](https://github.com/andymai/gridfinity-layout-tool/commit/4dd403e505b8572c6ca1cd27a4135bc4dde34d2e))

## [4.213.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.213.0...gridfinity-layout-tool-v4.213.1) (2026-07-03)

### Performance

- **bin-designer:** persist preview meshes across sessions ([#2436](https://github.com/andymai/gridfinity-layout-tool/issues/2436)) ([e2c63bb](https://github.com/andymai/gridfinity-layout-tool/commit/e2c63bb7a2d1f0014cd4293a4da6e7807e8be71a))

## [4.213.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.212.0...gridfinity-layout-tool-v4.213.0) (2026-07-03)

### Features

- **bin-inspector:** suggest a common bin size from its label ([#2434](https://github.com/andymai/gridfinity-layout-tool/issues/2434)) ([7f840eb](https://github.com/andymai/gridfinity-layout-tool/commit/7f840eb1960b365150da6c5b48950dd04ab52a9b))

## [4.212.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.211.3...gridfinity-layout-tool-v4.212.0) (2026-07-01)

### Features

- **baseplate:** distribute margin seam connectors one per grid cell ([#2427](https://github.com/andymai/gridfinity-layout-tool/issues/2427)) ([#2429](https://github.com/andymai/gridfinity-layout-tool/issues/2429)) ([619aba6](https://github.com/andymai/gridfinity-layout-tool/commit/619aba65744dc186dd4ebeb6e436d5a0fd118d03))

## [4.211.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.211.2...gridfinity-layout-tool-v4.211.3) (2026-07-01)

### Bug Fixes

- **baseplate:** align margin seam connector on corner rail segments ([#2427](https://github.com/andymai/gridfinity-layout-tool/issues/2427)) ([#2428](https://github.com/andymai/gridfinity-layout-tool/issues/2428)) ([506a278](https://github.com/andymai/gridfinity-layout-tool/commit/506a2788c7153ea3e9f603b96c3c6c259f557b06))

## [4.211.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.211.1...gridfinity-layout-tool-v4.211.2) (2026-07-01)

### Bug Fixes

- **bin-designer:** gate label tab on wall height, not unit count ([#2422](https://github.com/andymai/gridfinity-layout-tool/issues/2422)) ([#2425](https://github.com/andymai/gridfinity-layout-tool/issues/2425)) ([88f85b6](https://github.com/andymai/gridfinity-layout-tool/commit/88f85b6f617eaf296e6b623235fb1ddb24ee0ecb))

## [4.211.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.211.0...gridfinity-layout-tool-v4.211.1) (2026-07-01)

### Bug Fixes

- **baseplate:** margin connector must engage on the default dovetail style ([#2423](https://github.com/andymai/gridfinity-layout-tool/issues/2423)) ([557d7ff](https://github.com/andymai/gridfinity-layout-tool/commit/557d7ffd5f8d3adff40d0c59b57e9a49932b6057))

## [4.211.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.210.1...gridfinity-layout-tool-v4.211.0) (2026-07-01)

### Features

- **baseplate:** opt-in connectors for detachable margins ([#2414](https://github.com/andymai/gridfinity-layout-tool/issues/2414)) ([#2420](https://github.com/andymai/gridfinity-layout-tool/issues/2420)) ([c5f5836](https://github.com/andymai/gridfinity-layout-tool/commit/c5f58368585e38ab6d997232534a9fb74ea191ea))

## [4.210.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.210.0...gridfinity-layout-tool-v4.210.1) (2026-07-01)

### Bug Fixes

- **bin-designer:** stack-pitch readout + target-height solver ([#2416](https://github.com/andymai/gridfinity-layout-tool/issues/2416)) ([#2417](https://github.com/andymai/gridfinity-layout-tool/issues/2417)) ([3bd9616](https://github.com/andymai/gridfinity-layout-tool/commit/3bd9616c0cf24d4eeed6a6355ca389c505257917))

## [4.210.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.209.1...gridfinity-layout-tool-v4.210.0) (2026-06-30)

### Features

- batch-export whole layout (linked bins + baseplate) to a ZIP ([#2413](https://github.com/andymai/gridfinity-layout-tool/issues/2413)) ([937f08d](https://github.com/andymai/gridfinity-layout-tool/commit/937f08d75dd376b96e703fb597adc0e4b0050e7f))

## [4.209.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.209.0...gridfinity-layout-tool-v4.209.1) (2026-06-30)

### Bug Fixes

- **api:** replace deprecated Liveblocks FULL_ACCESS/READ_ACCESS scopes ([#2403](https://github.com/andymai/gridfinity-layout-tool/issues/2403)) ([6cfb216](https://github.com/andymai/gridfinity-layout-tool/commit/6cfb2160d481feabbd4cc1548d5d7ab1b8ec0557))

## [4.209.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.208.0...gridfinity-layout-tool-v4.209.0) (2026-06-30)

### Features

- **baseplate:** solid-fill option for half-grid leftover margin ([#2397](https://github.com/andymai/gridfinity-layout-tool/issues/2397)) ([#2400](https://github.com/andymai/gridfinity-layout-tool/issues/2400)) ([ebf6200](https://github.com/andymai/gridfinity-layout-tool/commit/ebf62005d41add775bac8ee5eecfc5da6579aabb))

## [4.208.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.207.1...gridfinity-layout-tool-v4.208.0) (2026-06-30)

### Features

- **baseplate:** detach margins into separate printable pieces ([#2392](https://github.com/andymai/gridfinity-layout-tool/issues/2392)) ([#2398](https://github.com/andymai/gridfinity-layout-tool/issues/2398)) ([97d339c](https://github.com/andymai/gridfinity-layout-tool/commit/97d339c2d3f97464135a82adcc124162d2c1acef))

## [4.207.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.207.0...gridfinity-layout-tool-v4.207.1) (2026-06-29)

### Bug Fixes

- **height:** clarify units and consolidate the mm height UI ([#2389](https://github.com/andymai/gridfinity-layout-tool/issues/2389)) ([069b819](https://github.com/andymai/gridfinity-layout-tool/commit/069b8195c6f6fd4aeada4cacacd79505fe5e5d01))

## [4.207.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.206.2...gridfinity-layout-tool-v4.207.0) (2026-06-29)

### Features

- **height:** enter bin and drawer height directly in mm ([#2385](https://github.com/andymai/gridfinity-layout-tool/issues/2385)) ([68a7684](https://github.com/andymai/gridfinity-layout-tool/commit/68a76848876d58939fd54314aa3f57e52c0a4136))

## [4.206.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.206.1...gridfinity-layout-tool-v4.206.2) (2026-06-29)

### Bug Fixes

- **baseplate:** keep half-grid margin fill on split plates ([#2386](https://github.com/andymai/gridfinity-layout-tool/issues/2386)) ([4e48cfe](https://github.com/andymai/gridfinity-layout-tool/commit/4e48cfe19200bdc3559403d92eec9861573f70af))

## [4.206.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.206.0...gridfinity-layout-tool-v4.206.1) (2026-06-28)

### Bug Fixes

- **baseplate:** half-grid draft preview no longer caps half-sockets ([#2380](https://github.com/andymai/gridfinity-layout-tool/issues/2380)) ([#2382](https://github.com/andymai/gridfinity-layout-tool/issues/2382)) ([e45be1e](https://github.com/andymai/gridfinity-layout-tool/commit/e45be1e4b4ae6bd9becf49da48068ea556fa3d24))

## [4.206.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.205.6...gridfinity-layout-tool-v4.206.0) (2026-06-28)

### Features

- **baseplate:** add half-grid margin fill mode ([#2378](https://github.com/andymai/gridfinity-layout-tool/issues/2378)) ([#2379](https://github.com/andymai/gridfinity-layout-tool/issues/2379)) ([c48a37f](https://github.com/andymai/gridfinity-layout-tool/commit/c48a37f42fccff2e621e15f60e3734cd88e8a19e))

## [4.205.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.205.5...gridfinity-layout-tool-v4.205.6) (2026-06-28)

### Bug Fixes

- **scoop:** cap auto scoop radius at MAX_SCOOP_RADIUS ([#2376](https://github.com/andymai/gridfinity-layout-tool/issues/2376)) ([20fc47c](https://github.com/andymai/gridfinity-layout-tool/commit/20fc47ced06684437b9aac8f79e49fccb8cb4841))

## [4.205.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.205.4...gridfinity-layout-tool-v4.205.5) (2026-06-27)

### Bug Fixes

- **bin-export:** tune timeout budget for heavy exports ([#2372](https://github.com/andymai/gridfinity-layout-tool/issues/2372)) ([e06632e](https://github.com/andymai/gridfinity-layout-tool/commit/e06632ec23d395bc0c83e2806bc6c6c7216eed4f))

## [4.205.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.205.3...gridfinity-layout-tool-v4.205.4) (2026-06-27)

### Bug Fixes

- **cqrs:** harden IndexedDB event store against transaction-lifetime and disk-full failures ([#2369](https://github.com/andymai/gridfinity-layout-tool/issues/2369)) ([ff38555](https://github.com/andymai/gridfinity-layout-tool/commit/ff38555fc0090a674fcbad3f38a8de1a755388f5))

## [4.205.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.205.2...gridfinity-layout-tool-v4.205.3) (2026-06-27)

### Bug Fixes

- **command-palette:** guard null CustomEvent detail when opening Settings ([#2367](https://github.com/andymai/gridfinity-layout-tool/issues/2367)) ([d469d2e](https://github.com/andymai/gridfinity-layout-tool/commit/d469d2ebd73d150c79a8b60f63a9fd8955a6202e))

## [4.205.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.205.1...gridfinity-layout-tool-v4.205.2) (2026-06-27)

### Bug Fixes

- **build:** set explicit Vite build target to support Safari 15 ([#2366](https://github.com/andymai/gridfinity-layout-tool/issues/2366)) ([ba1195d](https://github.com/andymai/gridfinity-layout-tool/commit/ba1195d5105f90fa4baf63b97133333a798e16aa))

## [4.205.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.205.0...gridfinity-layout-tool-v4.205.1) (2026-06-27)

### Bug Fixes

- **webgl:** dedupe context errors and harden GL capability probe ([#2363](https://github.com/andymai/gridfinity-layout-tool/issues/2363)) ([0bb7c2c](https://github.com/andymai/gridfinity-layout-tool/commit/0bb7c2c2d447ded3a6be12f135516835c0614d6e))

## [4.205.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.204.0...gridfinity-layout-tool-v4.205.0) (2026-06-25)

### Features

- **baseplate:** export one file per piece in split ZIPs ([#2360](https://github.com/andymai/gridfinity-layout-tool/issues/2360)) ([a06ed69](https://github.com/andymai/gridfinity-layout-tool/commit/a06ed6966903bcc491ff826074f0f0de20cad29f))

## [4.204.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.203.0...gridfinity-layout-tool-v4.204.0) (2026-06-24)

### Features

- **bin-designer:** off-board arrays + concave-mask recovery ([#2356](https://github.com/andymai/gridfinity-layout-tool/issues/2356)) ([bbca9e0](https://github.com/andymai/gridfinity-layout-tool/commit/bbca9e0462c14acef5f4f6fdbdb73c59c2eb1a0e))

## [4.203.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.202.6...gridfinity-layout-tool-v4.203.0) (2026-06-24)

### Features

- **bin-designer:** resize the bin from inside the cutout editor ([#2354](https://github.com/andymai/gridfinity-layout-tool/issues/2354)) ([2cefc35](https://github.com/andymai/gridfinity-layout-tool/commit/2cefc35dab360330eabf606ce703e29323025b4f))

## [4.202.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.202.5...gridfinity-layout-tool-v4.202.6) (2026-06-24)

### Performance

- **generation:** extend bin direct-mesh draft to magnet/screw bases ([#2334](https://github.com/andymai/gridfinity-layout-tool/issues/2334)) ([93d52b4](https://github.com/andymai/gridfinity-layout-tool/commit/93d52b417f43659e316dcc2c8af35b6dd37c2b34))

## [4.202.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.202.4...gridfinity-layout-tool-v4.202.5) (2026-06-24)

### Performance

- **generation:** instant direct-mesh draft for the bin preview ([#2334](https://github.com/andymai/gridfinity-layout-tool/issues/2334)) ([012d627](https://github.com/andymai/gridfinity-layout-tool/commit/012d627c5f40319096169a30fc6d3093ea5743da))

## [4.202.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.202.3...gridfinity-layout-tool-v4.202.4) (2026-06-24)

### Bug Fixes

- **wall-cutouts:** sync divider cutout alignment/offset/mm with outer walls ([#2347](https://github.com/andymai/gridfinity-layout-tool/issues/2347)) ([14525cb](https://github.com/andymai/gridfinity-layout-tool/commit/14525cb71b2dc53c4adbb0034c9d75d0a445f152))

## [4.202.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.202.2...gridfinity-layout-tool-v4.202.3) (2026-06-24)

### Performance

- **generation:** resume from a cached post-boolean body ([#2342](https://github.com/andymai/gridfinity-layout-tool/issues/2342)) ([0fdff68](https://github.com/andymai/gridfinity-layout-tool/commit/0fdff68319612c9b6e789c1b15c5fbd52b52090b))

## [4.202.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.202.1...gridfinity-layout-tool-v4.202.2) (2026-06-24)

### Performance

- **generation:** cache one cell-socket template and clone per cell ([#2340](https://github.com/andymai/gridfinity-layout-tool/issues/2340)) ([b4083da](https://github.com/andymai/gridfinity-layout-tool/commit/b4083da96a3b17baad9820c4849f29ac7d361bf8))

## [4.202.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.202.0...gridfinity-layout-tool-v4.202.1) (2026-06-24)

### Bug Fixes

- **bin-designer:** carry compartment labels on grid resize + read top-left first ([#2339](https://github.com/andymai/gridfinity-layout-tool/issues/2339)) ([63988f3](https://github.com/andymai/gridfinity-layout-tool/commit/63988f3dc4e051fb8381f00a58cae2f9c486c277))

## [4.202.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.201.6...gridfinity-layout-tool-v4.202.0) (2026-06-24)

### Features

- **bin-designer:** label compartments directly on the 2D grid ([#2331](https://github.com/andymai/gridfinity-layout-tool/issues/2331)) ([49f3ded](https://github.com/andymai/gridfinity-layout-tool/commit/49f3dedfaf4df65a824a8cb8f2b89b887caf2ae2))

## [4.201.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.201.5...gridfinity-layout-tool-v4.201.6) (2026-06-23)

### Bug Fixes

- **generation:** hard-reset wedged worker on generation timeout ([#2328](https://github.com/andymai/gridfinity-layout-tool/issues/2328)) ([9c12e6b](https://github.com/andymai/gridfinity-layout-tool/commit/9c12e6b6885fb29a0169b58e9a486f94a4f9799e))

## [4.201.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.201.4...gridfinity-layout-tool-v4.201.5) (2026-06-23)

### Bug Fixes

- **seo:** rework what-is-gridfinity title/meta for CTR + add SERP length guard ([#2324](https://github.com/andymai/gridfinity-layout-tool/issues/2324)) ([e34b27a](https://github.com/andymai/gridfinity-layout-tool/commit/e34b27a3394a3740f91ce70deb91d08427ddaad4))

## [4.201.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.201.3...gridfinity-layout-tool-v4.201.4) (2026-06-22)

### Bug Fixes

- **generation:** beef up split-bin wall connectors so they actually lock ([#2321](https://github.com/andymai/gridfinity-layout-tool/issues/2321)) ([2bebf79](https://github.com/andymai/gridfinity-layout-tool/commit/2bebf79991026aaae83aa527312fda5edbe1d566))

## [4.201.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.201.2...gridfinity-layout-tool-v4.201.3) (2026-06-22)

### Bug Fixes

- **generation:** solid skirt above the floor for honeycomb walls ([#2317](https://github.com/andymai/gridfinity-layout-tool/issues/2317)) ([#2319](https://github.com/andymai/gridfinity-layout-tool/issues/2319)) ([d6cd2a7](https://github.com/andymai/gridfinity-layout-tool/commit/d6cd2a73c6f65785f47ea6a6c893012f9fd73ba8))

## [4.201.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.201.1...gridfinity-layout-tool-v4.201.2) (2026-06-22)

### Bug Fixes

- **generation:** tighten brepkit edge angular tolerance to 0.01 rad ([#2312](https://github.com/andymai/gridfinity-layout-tool/issues/2312)) ([a336353](https://github.com/andymai/gridfinity-layout-tool/commit/a33635341ec62e1402fa34237762367defe8025e))

## [4.201.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.201.0...gridfinity-layout-tool-v4.201.1) (2026-06-22)

### Bug Fixes

- **generation:** pass radian angular tolerance to brepkit edge sampling ([#2310](https://github.com/andymai/gridfinity-layout-tool/issues/2310)) ([fdc2738](https://github.com/andymai/gridfinity-layout-tool/commit/fdc2738d4ebc6ac50da331b17b1c8cfe4ddf8329))

## [4.201.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.200.0...gridfinity-layout-tool-v4.201.0) (2026-06-21)

### Features

- **baseplate:** reset generator settings to defaults ([#2305](https://github.com/andymai/gridfinity-layout-tool/issues/2305)) ([8010583](https://github.com/andymai/gridfinity-layout-tool/commit/8010583c41dd2d81e850b576c10ee591cdbb7ccd))

## [4.200.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.199.0...gridfinity-layout-tool-v4.200.0) (2026-06-21)

### Features

- **baseplate:** smarter split — optimize for fewest build-plate loads ([#2303](https://github.com/andymai/gridfinity-layout-tool/issues/2303)) ([9fcd0c6](https://github.com/andymai/gridfinity-layout-tool/commit/9fcd0c6479b6525e2afff8803d2987eaed8b9c9f))

## [4.199.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.198.1...gridfinity-layout-tool-v4.199.0) (2026-06-21)

### Features

- **baseplate:** copies field for stack-print (print one layout N times) ([#2301](https://github.com/andymai/gridfinity-layout-tool/issues/2301)) ([5e223c0](https://github.com/andymai/gridfinity-layout-tool/commit/5e223c0ae7093a226f149291c43af22ebcf04739))

## [4.198.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.198.0...gridfinity-layout-tool-v4.198.1) (2026-06-21)

### Bug Fixes

- **bin-designer:** stop color-zones toggle from jumping the page to the bottom ([#2299](https://github.com/andymai/gridfinity-layout-tool/issues/2299)) ([60b6704](https://github.com/andymai/gridfinity-layout-tool/commit/60b6704c2701f14e1922fc914658358f36ce905f))

## [4.198.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.197.7...gridfinity-layout-tool-v4.198.0) (2026-06-20)

### Features

- **bin-designer:** color stacking lip by quadrant × band grid ([#2294](https://github.com/andymai/gridfinity-layout-tool/issues/2294)) ([181724b](https://github.com/andymai/gridfinity-layout-tool/commit/181724b819ac83edd47c05542065477889cb345e)), closes [#1654](https://github.com/andymai/gridfinity-layout-tool/issues/1654)

## [4.197.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.197.6...gridfinity-layout-tool-v4.197.7) (2026-06-20)

### Bug Fixes

- **split:** generate wall connectors on overhung split walls ([#2295](https://github.com/andymai/gridfinity-layout-tool/issues/2295)) ([50e440f](https://github.com/andymai/gridfinity-layout-tool/commit/50e440fdafc2cc52c13f5a6540d034c4faffcb25))

## [4.197.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.197.5...gridfinity-layout-tool-v4.197.6) (2026-06-20)

### Bug Fixes

- **seo:** trim what-is-gridfinity title and description to fit SERP limits ([#2292](https://github.com/andymai/gridfinity-layout-tool/issues/2292)) ([5fd26b1](https://github.com/andymai/gridfinity-layout-tool/commit/5fd26b141f0fd94c7d6dee0c50df897c40136b31))

## [4.197.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.197.4...gridfinity-layout-tool-v4.197.5) (2026-06-20)

### Bug Fixes

- **deps:** bump transitive undici to patched 6.27.0/7.28.0 ([#2290](https://github.com/andymai/gridfinity-layout-tool/issues/2290)) ([25090b2](https://github.com/andymai/gridfinity-layout-tool/commit/25090b20f62d458053a61b24c0e4412b2746f895))

## [4.197.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.197.3...gridfinity-layout-tool-v4.197.4) (2026-06-20)

### Bug Fixes

- **generation:** keep the label-tab shelf top tagged for multi-color ([#2288](https://github.com/andymai/gridfinity-layout-tool/issues/2288)) ([da8cc3a](https://github.com/andymai/gridfinity-layout-tool/commit/da8cc3aa6b773dc94fdfa8942772a7d8a8ff7c25))

## [4.197.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.197.2...gridfinity-layout-tool-v4.197.3) (2026-06-20)

### Bug Fixes

- **bin-designer:** paint the lid its zone color in the multi-color preview ([#2286](https://github.com/andymai/gridfinity-layout-tool/issues/2286)) ([1ca3fb8](https://github.com/andymai/gridfinity-layout-tool/commit/1ca3fb86800ba12836093bcde4b8858f67975a49))

## [4.197.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.197.1...gridfinity-layout-tool-v4.197.2) (2026-06-20)

### Bug Fixes

- **generation:** only blend divider ends genuinely adjacent to wall cutouts ([#2283](https://github.com/andymai/gridfinity-layout-tool/issues/2283)) ([a9d904e](https://github.com/andymai/gridfinity-layout-tool/commit/a9d904e1af18e6132c1a8e5557749ef550b0caf1))

## [4.197.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.197.0...gridfinity-layout-tool-v4.197.1) (2026-06-20)

### Bug Fixes

- **bin-designer:** align wall cutouts and handles to tilted dividers ([#2282](https://github.com/andymai/gridfinity-layout-tool/issues/2282)) ([f98339c](https://github.com/andymai/gridfinity-layout-tool/commit/f98339cd00d6227b3c3b3a11bcd24696303f5eed))

## [4.197.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.196.0...gridfinity-layout-tool-v4.197.0) (2026-06-20)

### Features

- **bin-designer:** choose which side the half-unit foot sits on ([#2279](https://github.com/andymai/gridfinity-layout-tool/issues/2279)) ([1431fca](https://github.com/andymai/gridfinity-layout-tool/commit/1431fca07463dae354861569e268dc9669b97d44))

## [4.196.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.195.5...gridfinity-layout-tool-v4.196.0) (2026-06-20)

### Features

- **cutouts:** improve label visibility and add fine-tuned placement ([#2277](https://github.com/andymai/gridfinity-layout-tool/issues/2277)) ([8c98508](https://github.com/andymai/gridfinity-layout-tool/commit/8c9850872aaa06b1c28f10ca31ff952f851d5fa7))

## [4.195.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.195.4...gridfinity-layout-tool-v4.195.5) (2026-06-19)

### Bug Fixes

- **baseplate:** align stacked plate connectors and warn when nothing stacks ([#2274](https://github.com/andymai/gridfinity-layout-tool/issues/2274)) ([d588949](https://github.com/andymai/gridfinity-layout-tool/commit/d58894981cd128eb44ff4ca31e0ed6a7187b8fd5))

## [4.195.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.195.3...gridfinity-layout-tool-v4.195.4) (2026-06-19)

### Bug Fixes

- **header:** tint reddit support icon with currentColor to match row ([#2272](https://github.com/andymai/gridfinity-layout-tool/issues/2272)) ([4b12a57](https://github.com/andymai/gridfinity-layout-tool/commit/4b12a5778989de7a6d9e5ae6b066eaca4caad02c))

## [4.195.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.195.2...gridfinity-layout-tool-v4.195.3) (2026-06-18)

### Bug Fixes

- **deps:** bump dompurify to 3.4.11 for GHSA-cmwh-pvxp-8882 ([#2268](https://github.com/andymai/gridfinity-layout-tool/issues/2268)) ([e2039c1](https://github.com/andymai/gridfinity-layout-tool/commit/e2039c176da972a2b20b782a3ebbe61915475dd9))

## [4.195.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.195.1...gridfinity-layout-tool-v4.195.2) (2026-06-18)

### Bug Fixes

- **export:** align export dialog bottom padding to design-system token ([#2266](https://github.com/andymai/gridfinity-layout-tool/issues/2266)) ([ead72a1](https://github.com/andymai/gridfinity-layout-tool/commit/ead72a19209fc071b7673b26a323909e7296bc67))

## [4.195.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.195.0...gridfinity-layout-tool-v4.195.1) (2026-06-18)

### Bug Fixes

- **baseplate:** make sidebar stack state format-aware ([#2264](https://github.com/andymai/gridfinity-layout-tool/issues/2264)) ([0f2f16f](https://github.com/andymai/gridfinity-layout-tool/commit/0f2f16f65354d91ea3676a0095d2df77326fc667))

## [4.195.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.194.0...gridfinity-layout-tool-v4.195.0) (2026-06-18)

### Features

- **seo:** de-cannibalize generator titles and rework underperforming snippets ([#2262](https://github.com/andymai/gridfinity-layout-tool/issues/2262)) ([c15a7db](https://github.com/andymai/gridfinity-layout-tool/commit/c15a7db16fcf66a30e9f4e98df770ca688a3ada8))

## [4.194.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.193.0...gridfinity-layout-tool-v4.194.0) (2026-06-18)

### Features

- **seo:** expand learn links and tune landing-page metadata ([#2260](https://github.com/andymai/gridfinity-layout-tool/issues/2260)) ([1f9c203](https://github.com/andymai/gridfinity-layout-tool/commit/1f9c2031327580ffcc624585142601b2290885f7))

## [4.193.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.192.1...gridfinity-layout-tool-v4.193.0) (2026-06-18)

### Features

- **engagement:** add r/gridfinity community links with impact framing ([#2258](https://github.com/andymai/gridfinity-layout-tool/issues/2258)) ([e0e9895](https://github.com/andymai/gridfinity-layout-tool/commit/e0e9895addc89f266d0a49cd416bafbbd6c25533))

## [4.192.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.192.0...gridfinity-layout-tool-v4.192.1) (2026-06-18)

### Bug Fixes

- **lid:** size lids to the overhang-expanded bin body ([#2255](https://github.com/andymai/gridfinity-layout-tool/issues/2255)) ([bd1f104](https://github.com/andymai/gridfinity-layout-tool/commit/bd1f104938c6ca07f38f56a305245e73a7684095))

## [4.192.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.191.0...gridfinity-layout-tool-v4.192.0) (2026-06-18)

### Features

- **baseplate:** add 'puzzle' locking connector style ([#2241](https://github.com/andymai/gridfinity-layout-tool/issues/2241)) ([#2246](https://github.com/andymai/gridfinity-layout-tool/issues/2246)) ([b78caa0](https://github.com/andymai/gridfinity-layout-tool/commit/b78caa012751e8b024d47b6c03f9397486e19895))

## [4.191.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.190.0...gridfinity-layout-tool-v4.191.0) (2026-06-18)

### Features

- **labs:** graduate vertical stack and design linking out of experimental ([#2253](https://github.com/andymai/gridfinity-layout-tool/issues/2253)) ([eca8a21](https://github.com/andymai/gridfinity-layout-tool/commit/eca8a21e61f3c2658fdabee30bddf26300d04720))

## [4.190.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.189.0...gridfinity-layout-tool-v4.190.0) (2026-06-18)

### Features

- **scan:** refine example, scan multiple tools per session, desktop cleanup ([#2251](https://github.com/andymai/gridfinity-layout-tool/issues/2251)) ([bb1dcde](https://github.com/andymai/gridfinity-layout-tool/commit/bb1dcde9e8b01bae5acc9d424009426e0980863c))

## [4.189.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.188.0...gridfinity-layout-tool-v4.189.0) (2026-06-18)

### Features

- **scan:** add real annotated example photo and on-device privacy note ([#2248](https://github.com/andymai/gridfinity-layout-tool/issues/2248)) ([7514ca8](https://github.com/andymai/gridfinity-layout-tool/commit/7514ca81a7787f8b98da56e5746e917aed7f3a86))

## [4.188.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.187.0...gridfinity-layout-tool-v4.188.0) (2026-06-18)

### Features

- **bin-designer:** non-bin item foundation + slanted tool rack (labs) ([#2247](https://github.com/andymai/gridfinity-layout-tool/issues/2247)) ([dcde999](https://github.com/andymai/gridfinity-layout-tool/commit/dcde99975af1b23acc81fbcfd80db00df63c8bf1))

## [4.187.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.186.0...gridfinity-layout-tool-v4.187.0) (2026-06-17)

### Features

- **scan:** fit clean Bézier curves to the tool outline ([#2238](https://github.com/andymai/gridfinity-layout-tool/issues/2238)) ([8ef61fb](https://github.com/andymai/gridfinity-layout-tool/commit/8ef61fbc5c9fb6686d2a6e8cbec7429412d10f51))

## [4.186.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.185.0...gridfinity-layout-tool-v4.186.0) (2026-06-17)

### Features

- **scan:** auto-symmetrize symmetric tool outlines (gated) ([#2237](https://github.com/andymai/gridfinity-layout-tool/issues/2237)) ([e64cb66](https://github.com/andymai/gridfinity-layout-tool/commit/e64cb668f7f12cb5fbae3a5b7d978ebdb89e5038))

## [4.185.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.184.4...gridfinity-layout-tool-v4.185.0) (2026-06-17)

### Features

- **scan:** sub-pixel tool trace from the soft confidence mask ([#2240](https://github.com/andymai/gridfinity-layout-tool/issues/2240)) ([42f6374](https://github.com/andymai/gridfinity-layout-tool/commit/42f6374330a33699944a72731aa066b9691146b8))

## [4.184.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.184.3...gridfinity-layout-tool-v4.184.4) (2026-06-17)

### Bug Fixes

- **scan:** don't mistake a card-shaped tool for the reference card ([#2235](https://github.com/andymai/gridfinity-layout-tool/issues/2235)) ([58bd345](https://github.com/andymai/gridfinity-layout-tool/commit/58bd3450ff5cd11e75c900979fa0430db6074b69))

## [4.184.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.184.2...gridfinity-layout-tool-v4.184.3) (2026-06-17)

### Bug Fixes

- **scan:** recover eroded-corner cards via min-area rectangle ([#2233](https://github.com/andymai/gridfinity-layout-tool/issues/2233)) ([8e9f9b0](https://github.com/andymai/gridfinity-layout-tool/commit/8e9f9b04a2b803c8f03d5c5c464f6d6d2123c740))

## [4.184.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.184.1...gridfinity-layout-tool-v4.184.2) (2026-06-17)

### Bug Fixes

- **scan:** detect color-neutral cards via chroma channel sweep ([#2230](https://github.com/andymai/gridfinity-layout-tool/issues/2230)) ([c90919b](https://github.com/andymai/gridfinity-layout-tool/commit/c90919b7065ba3eca42c00c6816d04b956464347))

## [4.184.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.184.0...gridfinity-layout-tool-v4.184.1) (2026-06-17)

### Bug Fixes

- **ui:** settings search icon sizing + cutout inspector hint spacing ([#2229](https://github.com/andymai/gridfinity-layout-tool/issues/2229)) ([9bbfda4](https://github.com/andymai/gridfinity-layout-tool/commit/9bbfda42ed20095113638e6c0c6fb9333b0b4c13))

## [4.184.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.183.8...gridfinity-layout-tool-v4.184.0) (2026-06-17)

### Features

- legible cutout labels + emboss option ([#2226](https://github.com/andymai/gridfinity-layout-tool/issues/2226)) ([3a0d1ae](https://github.com/andymai/gridfinity-layout-tool/commit/3a0d1ae6ef3b260c7c06d240f6800e4d5e6be262))

## [4.183.8](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.183.7...gridfinity-layout-tool-v4.183.8) (2026-06-17)

### Performance

- **baseplate:** cross-session IndexedDB cache for split-export pieces ([#2224](https://github.com/andymai/gridfinity-layout-tool/issues/2224)) ([eabcaae](https://github.com/andymai/gridfinity-layout-tool/commit/eabcaae8c49ef4e7b46c61b88ebf58f74a1643b3))

## [4.183.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.183.6...gridfinity-layout-tool-v4.183.7) (2026-06-17)

### Performance

- **baseplate:** dedupe geometrically-identical split pieces via corner signature ([#2221](https://github.com/andymai/gridfinity-layout-tool/issues/2221)) ([3064ef4](https://github.com/andymai/gridfinity-layout-tool/commit/3064ef46cecb55c00094327767e9c3cf09f75b4b))

## [4.183.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.183.5...gridfinity-layout-tool-v4.183.6) (2026-06-17)

### Performance

- **baseplate:** faster exports — simpler floor relief + coarser STL tessellation ([#2220](https://github.com/andymai/gridfinity-layout-tool/issues/2220)) ([f06634b](https://github.com/andymai/gridfinity-layout-tool/commit/f06634b3390e8c98d27098806a61be7e2dc89021))

## [4.183.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.183.4...gridfinity-layout-tool-v4.183.5) (2026-06-17)

### Performance

- **baseplate:** draft preview + defer BREP for large plates ([#2218](https://github.com/andymai/gridfinity-layout-tool/issues/2218)) ([d988b85](https://github.com/andymai/gridfinity-layout-tool/commit/d988b85344e7fdbf71e87cc54d3538918487e087))

## [4.183.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.183.3...gridfinity-layout-tool-v4.183.4) (2026-06-17)

### Performance

- **generation:** cache per-text glyph solids across compartments ([#2211](https://github.com/andymai/gridfinity-layout-tool/issues/2211)) ([08bfaf0](https://github.com/andymai/gridfinity-layout-tool/commit/08bfaf0b720a0eb77400153c6543d2487d804844))

## [4.183.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.183.2...gridfinity-layout-tool-v4.183.3) (2026-06-17)

### Bug Fixes

- **print:** SplitPreview crash on half-grid (fractional) bin dimensions ([#2213](https://github.com/andymai/gridfinity-layout-tool/issues/2213)) ([7a41252](https://github.com/andymai/gridfinity-layout-tool/commit/7a4125280905780ec8c6c39a6c921d1a6eb91854))

## [4.183.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.183.1...gridfinity-layout-tool-v4.183.2) (2026-06-17)

### Performance

- **generation:** linear font fit + memoized text metrics ([#2210](https://github.com/andymai/gridfinity-layout-tool/issues/2210)) ([877d4bd](https://github.com/andymai/gridfinity-layout-tool/commit/877d4bddd6c7e682ac4cf7cc0d3195b158dc6282))

## [4.183.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.183.0...gridfinity-layout-tool-v4.183.1) (2026-06-17)

### Performance

- **bin-designer:** defer compartment text commit to idle/blur ([#2209](https://github.com/andymai/gridfinity-layout-tool/issues/2209)) ([1f24220](https://github.com/andymai/gridfinity-layout-tool/commit/1f24220ba59926db6418e819841f87aee82956d7))

## [4.183.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.182.0...gridfinity-layout-tool-v4.183.0) (2026-06-17)

### Features

- **scan-capture:** sharper tool traces, clearer card status, safer scale ([#2207](https://github.com/andymai/gridfinity-layout-tool/issues/2207)) ([68b7d3c](https://github.com/andymai/gridfinity-layout-tool/commit/68b7d3cab54ae45be9df09e17f46137d051e1426))

## [4.182.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.181.0...gridfinity-layout-tool-v4.182.0) (2026-06-17)

### Features

- **baseplate:** stack-print retains dovetail connectors ([#2206](https://github.com/andymai/gridfinity-layout-tool/issues/2206)) ([da6c6aa](https://github.com/andymai/gridfinity-layout-tool/commit/da6c6aaa79a1cd7c658a14660d58bd651c22ad39))

## [4.181.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.180.0...gridfinity-layout-tool-v4.181.0) (2026-06-17)

### Features

- **bin-designer:** full fit parity (clearance + chamfer + scoop) for path cutouts ([#2204](https://github.com/andymai/gridfinity-layout-tool/issues/2204)) ([89dc283](https://github.com/andymai/gridfinity-layout-tool/commit/89dc283b3b637dfe33f29dae1e1be219da4e350d))

## [4.180.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.179.1...gridfinity-layout-tool-v4.180.0) (2026-06-17)

### Features

- **scan-capture:** tap-prompted ML tool segmentation + phone UX overhaul ([#2202](https://github.com/andymai/gridfinity-layout-tool/issues/2202)) ([d694922](https://github.com/andymai/gridfinity-layout-tool/commit/d694922e8b74a29760adc7a1cb75e5321d566b22))

## [4.179.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.179.0...gridfinity-layout-tool-v4.179.1) (2026-06-17)

### Bug Fixes

- **design-system:** restore card button styling regressed by button migration ([#2200](https://github.com/andymai/gridfinity-layout-tool/issues/2200)) ([c5708fc](https://github.com/andymai/gridfinity-layout-tool/commit/c5708fce7b9fbc924d6d377ba961cf6b6dfe8d4e))

## [4.179.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.178.1...gridfinity-layout-tool-v4.179.0) (2026-06-16)

### Features

- **bin-designer:** scan a tool with your phone to create a cutout ([#2197](https://github.com/andymai/gridfinity-layout-tool/issues/2197)) ([ea31d79](https://github.com/andymai/gridfinity-layout-tool/commit/ea31d79d9d11a56b5838697436ebb279a9a00959))

## [4.178.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.178.0...gridfinity-layout-tool-v4.178.1) (2026-06-16)

### Performance

- **generation:** cache deferred socket tessellation across edits ([#2194](https://github.com/andymai/gridfinity-layout-tool/issues/2194)) ([3e8e08f](https://github.com/andymai/gridfinity-layout-tool/commit/3e8e08f0d2ec4e68506d4b4eccc38100ac9c1521))

## [4.178.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.177.1...gridfinity-layout-tool-v4.178.0) (2026-06-15)

### Features

- **baseplate:** stack-print UX polish ([#2186](https://github.com/andymai/gridfinity-layout-tool/issues/2186)) ([407785b](https://github.com/andymai/gridfinity-layout-tool/commit/407785b00bc12a27b2c9d87c6fd53e83256e2c42))

## [4.177.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.177.0...gridfinity-layout-tool-v4.177.1) (2026-06-15)

### Bug Fixes

- **deps:** bump protobufjs to 7.6.3 for GHSA-wcpc-wj8m-hjx6 and GHSA-f38q-mgvj-vph7 ([#2183](https://github.com/andymai/gridfinity-layout-tool/issues/2183)) ([f06fd71](https://github.com/andymai/gridfinity-layout-tool/commit/f06fd711acc7a25e2076afca6ef67e16c5268d74))

## [4.177.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.176.1...gridfinity-layout-tool-v4.177.0) (2026-06-15)

### Features

- **export:** grant exports a far higher timeout ceiling ([#2181](https://github.com/andymai/gridfinity-layout-tool/issues/2181)) ([b854db6](https://github.com/andymai/gridfinity-layout-tool/commit/b854db6923f737756fa6162446f4e3c41f05fb72))

## [4.176.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.176.0...gridfinity-layout-tool-v4.176.1) (2026-06-15)

### Bug Fixes

- **deps:** resolve dompurify, js-yaml, and @babel/core security alerts ([#2180](https://github.com/andymai/gridfinity-layout-tool/issues/2180)) ([62b7e22](https://github.com/andymai/gridfinity-layout-tool/commit/62b7e22a97c81feaf3f233a530c7b021d1415e48))

## [4.176.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.175.0...gridfinity-layout-tool-v4.176.0) (2026-06-15)

### Features

- **bin-designer:** lightweight floor option ([#2177](https://github.com/andymai/gridfinity-layout-tool/issues/2177)) ([5e03b0f](https://github.com/andymai/gridfinity-layout-tool/commit/5e03b0f254951fe1c006405dadc2142b8c26c806))

## [4.175.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.174.2...gridfinity-layout-tool-v4.175.0) (2026-06-15)

### Features

- **baseplate:** document multi-material separation for vertical stacks ([#2176](https://github.com/andymai/gridfinity-layout-tool/issues/2176)) ([32a464c](https://github.com/andymai/gridfinity-layout-tool/commit/32a464cc9a77aae2f983d75e22f5e0b27ad91b4a))

## [4.174.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.174.1...gridfinity-layout-tool-v4.174.2) (2026-06-15)

### Bug Fixes

- tighten grid-size stepper and stacked-baseplate preview spacing ([#2174](https://github.com/andymai/gridfinity-layout-tool/issues/2174)) ([d918f95](https://github.com/andymai/gridfinity-layout-tool/commit/d918f95278d1a58b28657d3a0dc7aa9245dd3384))

## [4.174.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.174.0...gridfinity-layout-tool-v4.174.1) (2026-06-15)

### Bug Fixes

- **sidebar:** non-sticky footer, trim attribution, and dev content-route parity ([#2172](https://github.com/andymai/gridfinity-layout-tool/issues/2172)) ([119e29c](https://github.com/andymai/gridfinity-layout-tool/commit/119e29c52bac62054893e02c930e140b19a70a3d))

## [4.174.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.173.1...gridfinity-layout-tool-v4.174.0) (2026-06-15)

### Features

- **baseplate:** refine generator panel, connectors, and stack/fit-sample exports ([#2169](https://github.com/andymai/gridfinity-layout-tool/issues/2169)) ([a58015c](https://github.com/andymai/gridfinity-layout-tool/commit/a58015caa398e6c5fc686f4c4adb091121570e1f))

## [4.173.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.173.0...gridfinity-layout-tool-v4.173.1) (2026-06-15)

### Bug Fixes

- **baseplate:** snap-clip resists pull-apart via seam-side retaining wall ([#2162](https://github.com/andymai/gridfinity-layout-tool/issues/2162)) ([a421808](https://github.com/andymai/gridfinity-layout-tool/commit/a421808b8e7166da5a7b7027797b58e06dbe3782))

## [4.173.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.172.1...gridfinity-layout-tool-v4.173.0) (2026-06-15)

### Features

- **baseplate:** match bin designer edgeline quality in 3D preview ([#2160](https://github.com/andymai/gridfinity-layout-tool/issues/2160)) ([228faa1](https://github.com/andymai/gridfinity-layout-tool/commit/228faa132dab36efe2c5923fb70f17c88918c7b3))

## [4.172.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.172.0...gridfinity-layout-tool-v4.172.1) (2026-06-15)

### Bug Fixes

- **bin-designer:** make overhang, multi-color & lid feature toggles; sidebar polish ([#2158](https://github.com/andymai/gridfinity-layout-tool/issues/2158)) ([56a0963](https://github.com/andymai/gridfinity-layout-tool/commit/56a0963a5807c1e258b2c2ad7480305f1ce421bd))

## [4.172.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.171.2...gridfinity-layout-tool-v4.172.0) (2026-06-15)

### Features

- **baseplate:** move nozzle size into connector controls, externalize fit offset unit ([#2155](https://github.com/andymai/gridfinity-layout-tool/issues/2155)) ([03fe1c6](https://github.com/andymai/gridfinity-layout-tool/commit/03fe1c64d832cb0f67ad4ff473fa2da187bf7644))

## [4.171.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.171.1...gridfinity-layout-tool-v4.171.2) (2026-06-15)

### Bug Fixes

- **baseplate:** fix stack preview dark background + letterboxing ([#2154](https://github.com/andymai/gridfinity-layout-tool/issues/2154)) ([36515e8](https://github.com/andymai/gridfinity-layout-tool/commit/36515e819bf19e81b7860b8d889d2aae5678dd43))

## [4.171.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.171.0...gridfinity-layout-tool-v4.171.1) (2026-06-15)

### Bug Fixes

- **i18n:** allowlist nb 'plate' singular to unblock main Quality ([#2151](https://github.com/andymai/gridfinity-layout-tool/issues/2151)) ([f8496f9](https://github.com/andymai/gridfinity-layout-tool/commit/f8496f95ada78e6821ce957022a3f26a49abb322))

## [4.171.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.170.0...gridfinity-layout-tool-v4.171.0) (2026-06-15)

### Features

- **baseplate:** add stack-printable baseplates ([#2149](https://github.com/andymai/gridfinity-layout-tool/issues/2149)) ([01e3db2](https://github.com/andymai/gridfinity-layout-tool/commit/01e3db266900b6c3b1e1fa95ad73d60474ce95b2))

## [4.170.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.169.1...gridfinity-layout-tool-v4.170.0) (2026-06-14)

### Features

- **settings:** redesign settings modal — DS Dialog, grouped tabs, search, per-section reset ([#2147](https://github.com/andymai/gridfinity-layout-tool/issues/2147)) ([7bd34c4](https://github.com/andymai/gridfinity-layout-tool/commit/7bd34c44f38fea1165ae33a3d8f37d95117e3dc8))

## [4.169.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.169.0...gridfinity-layout-tool-v4.169.1) (2026-06-14)

### Bug Fixes

- **stepper:** stretch solo steppers to full width ([#2145](https://github.com/andymai/gridfinity-layout-tool/issues/2145)) ([16a810c](https://github.com/andymai/gridfinity-layout-tool/commit/16a810c16be454197a27dc8e6bfc2e63acfafefa))

## [4.169.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.168.2...gridfinity-layout-tool-v4.169.0) (2026-06-14)

### Features

- **bin-designer:** show compartment grid at true bin proportions (fixes stepper overlap) ([#2143](https://github.com/andymai/gridfinity-layout-tool/issues/2143)) ([1fabd57](https://github.com/andymai/gridfinity-layout-tool/commit/1fabd571fce6a6a6cb923386b20e68b2f3194bb9))

## [4.168.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.168.1...gridfinity-layout-tool-v4.168.2) (2026-06-14)

### Performance

- **bundle:** cut eager initial JS 904→353KB by lazy-loading the 3D + collab stacks ([#2141](https://github.com/andymai/gridfinity-layout-tool/issues/2141)) ([401cd6d](https://github.com/andymai/gridfinity-layout-tool/commit/401cd6d5361b3af4d369948911b45dd1de2e2cd8))

## [4.168.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.168.0...gridfinity-layout-tool-v4.168.1) (2026-06-13)

### Bug Fixes

- **deps:** force esbuild to 0.28.1 to clear OSV advisories ([#2138](https://github.com/andymai/gridfinity-layout-tool/issues/2138)) ([b8a4ae7](https://github.com/andymai/gridfinity-layout-tool/commit/b8a4ae7724688e71291ac6e01dcfe0364cc008af))

## [4.168.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.167.3...gridfinity-layout-tool-v4.168.0) (2026-06-13)

### Features

- **design-system:** add fullWidth variant to Stepper ([#2136](https://github.com/andymai/gridfinity-layout-tool/issues/2136)) ([c25d2fa](https://github.com/andymai/gridfinity-layout-tool/commit/c25d2fa6f6c61c1492df7692ee3025f8a29bed28))

## [4.167.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.167.2...gridfinity-layout-tool-v4.167.3) (2026-06-13)

### Bug Fixes

- **generation:** raise generation timeout ceiling to 3 min ([#2132](https://github.com/andymai/gridfinity-layout-tool/issues/2132)) ([7e476cd](https://github.com/andymai/gridfinity-layout-tool/commit/7e476cd26c0b87e4c3d08be92ffe84bf22eb565b))

## [4.167.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.167.1...gridfinity-layout-tool-v4.167.2) (2026-06-12)

### Bug Fixes

- **label-tabs:** trim tab corners flush with the bin's rounded outer wall ([#2122](https://github.com/andymai/gridfinity-layout-tool/issues/2122)) ([a5e10b5](https://github.com/andymai/gridfinity-layout-tool/commit/a5e10b5f0a196d3ce0b8c8566cdd78fc2f7f3a41))

## [4.167.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.167.0...gridfinity-layout-tool-v4.167.1) (2026-06-12)

### Bug Fixes

- **baseplate:** relieve split dovetail tongues from neighbour sockets ([#2119](https://github.com/andymai/gridfinity-layout-tool/issues/2119)) ([ed40dae](https://github.com/andymai/gridfinity-layout-tool/commit/ed40dae23e0338f19931cdb8c967f83c95b972ac))

## [4.167.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.166.0...gridfinity-layout-tool-v4.167.0) (2026-06-12)

### Features

- **design-system:** add 16 primitives and extend dialog compound component ([#2111](https://github.com/andymai/gridfinity-layout-tool/issues/2111)) ([ca73706](https://github.com/andymai/gridfinity-layout-tool/commit/ca737069cef9694e8c67f7709911744d98caaac6))

## [4.166.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.165.0...gridfinity-layout-tool-v4.166.0) (2026-06-12)

### Features

- **bin-designer:** surface "default for new bins" across discovery points ([#2114](https://github.com/andymai/gridfinity-layout-tool/issues/2114)) ([d1e851b](https://github.com/andymai/gridfinity-layout-tool/commit/d1e851b312097b2c611b44cbdb8fa1dc9be88cb5))

## [4.165.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.164.1...gridfinity-layout-tool-v4.165.0) (2026-06-12)

### Features

- **bin-designer:** set current settings as default for new bins ([#2112](https://github.com/andymai/gridfinity-layout-tool/issues/2112)) ([29a81d1](https://github.com/andymai/gridfinity-layout-tool/commit/29a81d1ff91bda4550b551a9c2140b94fb61a369))

## [4.164.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.164.0...gridfinity-layout-tool-v4.164.1) (2026-06-12)

### Bug Fixes

- **bin-designer:** keep scoop and label support inside the rounded bin corners ([#2109](https://github.com/andymai/gridfinity-layout-tool/issues/2109)) ([2dd27ba](https://github.com/andymai/gridfinity-layout-tool/commit/2dd27ba7b9fc9e8118c8f309a8d25eb456dcd598))

## [4.164.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.163.1...gridfinity-layout-tool-v4.164.0) (2026-06-11)

### Features

- **bin-designer:** unify compartment sizing into one size-led panel ([#2107](https://github.com/andymai/gridfinity-layout-tool/issues/2107)) ([70b1de7](https://github.com/andymai/gridfinity-layout-tool/commit/70b1de78fddc1d5eedd38a4c57bf0111b2218156))

## [4.163.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.163.0...gridfinity-layout-tool-v4.163.1) (2026-06-11)

### Bug Fixes

- **bin-designer:** keep stacking lip on split custom-shape and overhung bins ([#2105](https://github.com/andymai/gridfinity-layout-tool/issues/2105)) ([7fb37a6](https://github.com/andymai/gridfinity-layout-tool/commit/7fb37a61792d1cd553e8495fd428ae74712d99d5))

## [4.163.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.162.0...gridfinity-layout-tool-v4.163.0) (2026-06-11)

### Features

- **baseplate:** expose fractional edge controls in baseplate generator ([#2102](https://github.com/andymai/gridfinity-layout-tool/issues/2102)) ([c554695](https://github.com/andymai/gridfinity-layout-tool/commit/c554695062421c04b2a064ce13b1506475053cc4))

## [4.162.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.161.1...gridfinity-layout-tool-v4.162.0) (2026-06-11)

### Features

- **bin-designer:** show compartment dimensions in mm and tile by size ([#2101](https://github.com/andymai/gridfinity-layout-tool/issues/2101)) ([fd004e3](https://github.com/andymai/gridfinity-layout-tool/commit/fd004e3aef51563f7f273fecb31adc6ea8a6afe1))

## [4.161.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.161.0...gridfinity-layout-tool-v4.161.1) (2026-06-11)

### Bug Fixes

- **bin-designer:** address divider-height review comments ([#2099](https://github.com/andymai/gridfinity-layout-tool/issues/2099)) ([b699765](https://github.com/andymai/gridfinity-layout-tool/commit/b6997652bb8420ebf563fc72e30a402e350971e3))

## [4.161.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.160.1...gridfinity-layout-tool-v4.161.0) (2026-06-11)

### Features

- **bin-designer:** add interior divider height control ([#2097](https://github.com/andymai/gridfinity-layout-tool/issues/2097)) ([72c119e](https://github.com/andymai/gridfinity-layout-tool/commit/72c119ea20c5ee426bcb2b7027d79c098a5ea1b3))

## [4.160.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.160.0...gridfinity-layout-tool-v4.160.1) (2026-06-10)

### Bug Fixes

- **shell:** simplify version badge link to /releases ([#2095](https://github.com/andymai/gridfinity-layout-tool/issues/2095)) ([10601d9](https://github.com/andymai/gridfinity-layout-tool/commit/10601d9425b958ada0a518358ab13277ef347e72))

## [4.160.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.159.1...gridfinity-layout-tool-v4.160.0) (2026-06-10)

### Features

- **shell:** unify attribution footer across layout, bin designer, and baseplate ([#2091](https://github.com/andymai/gridfinity-layout-tool/issues/2091)) ([3d1905e](https://github.com/andymai/gridfinity-layout-tool/commit/3d1905ee848b9e7de6293d59c54439fa79d39c12))

## [4.159.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.159.0...gridfinity-layout-tool-v4.159.1) (2026-06-10)

### Bug Fixes

- **export:** watertight STL for scoop, magnet+feature, chamfer, and handle bins ([#2085](https://github.com/andymai/gridfinity-layout-tool/issues/2085)) ([#2088](https://github.com/andymai/gridfinity-layout-tool/issues/2088)) ([3c1ad13](https://github.com/andymai/gridfinity-layout-tool/commit/3c1ad13d19aa61282c9f00e6c10522bb7cdacac6))

## [4.159.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.158.0...gridfinity-layout-tool-v4.159.0) (2026-06-10)

### Features

- **shell:** display app version in sidebar and mobile settings footer ([#2089](https://github.com/andymai/gridfinity-layout-tool/issues/2089)) ([ccd4fca](https://github.com/andymai/gridfinity-layout-tool/commit/ccd4fcadf53f209934f2c922ede6c5dc1e2ae2f6)), closes [#2087](https://github.com/andymai/gridfinity-layout-tool/issues/2087)

### Bug Fixes

- **export:** make scoop/label-tab STL exports watertight ([#2086](https://github.com/andymai/gridfinity-layout-tool/issues/2086)) ([7d935bc](https://github.com/andymai/gridfinity-layout-tool/commit/7d935bc55a95ce3f3ed731203339525f9d73b12a))

## [4.158.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.157.0...gridfinity-layout-tool-v4.158.0) (2026-06-10)

### Features

- **rightpanel:** add nozzle size input to the desktop print list ([#2082](https://github.com/andymai/gridfinity-layout-tool/issues/2082)) ([2f5d8f8](https://github.com/andymai/gridfinity-layout-tool/commit/2f5d8f882fd327b27244f17f121a46f2eed8ae39))

## [4.157.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.156.0...gridfinity-layout-tool-v4.157.0) (2026-06-10)

### Features

- **connectors:** make split/baseplate connectors print on wider nozzles ([#2080](https://github.com/andymai/gridfinity-layout-tool/issues/2080)) ([54e9a7f](https://github.com/andymai/gridfinity-layout-tool/commit/54e9a7f4c4fccb24ad8d45b921872305e16688c6))

## [4.156.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.155.6...gridfinity-layout-tool-v4.156.0) (2026-06-10)

### Features

- **seo:** real product imagery, per-route meta, and four keyword landing pages ([#2078](https://github.com/andymai/gridfinity-layout-tool/issues/2078)) ([451d634](https://github.com/andymai/gridfinity-layout-tool/commit/451d6340847b12fe14e2d71304f569e564a7872c))

## [4.155.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.155.5...gridfinity-layout-tool-v4.155.6) (2026-06-09)

### Bug Fixes

- **preview:** build a fuse-free lip for the Manifold draft ([#2076](https://github.com/andymai/gridfinity-layout-tool/issues/2076)) ([f6147fb](https://github.com/andymai/gridfinity-layout-tool/commit/f6147fb33a8422d491807329525648dfcd9a43e6))

## [4.155.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.155.4...gridfinity-layout-tool-v4.155.5) (2026-06-09)

### Bug Fixes

- **split:** clean split draft preview edges and skip redundant drafts ([#2073](https://github.com/andymai/gridfinity-layout-tool/issues/2073)) ([0bcbeef](https://github.com/andymai/gridfinity-layout-tool/commit/0bcbeef1dcdc8fb43a524c148d8ca2b7b3bedddc))

## [4.155.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.155.3...gridfinity-layout-tool-v4.155.4) (2026-06-08)

### Performance

- **split:** render a Manifold draft split on the leading edge ([#2071](https://github.com/andymai/gridfinity-layout-tool/issues/2071)) ([ddb84e7](https://github.com/andymai/gridfinity-layout-tool/commit/ddb84e7a6152243e81434ebdcb359906f1f823d7))

## [4.155.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.155.2...gridfinity-layout-tool-v4.155.3) (2026-06-08)

### Performance

- **split:** cut only each worker's assigned pieces ([#2069](https://github.com/andymai/gridfinity-layout-tool/issues/2069)) ([b1adcd3](https://github.com/andymai/gridfinity-layout-tool/commit/b1adcd36db6e78d3ee6c8408ea9c7174b730fa19))

## [4.155.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.155.1...gridfinity-layout-tool-v4.155.2) (2026-06-08)

### Bug Fixes

- **cutouts:** circle cutouts with a chamfer or oval size now cut in 3D ([#2067](https://github.com/andymai/gridfinity-layout-tool/issues/2067)) ([fbe0e05](https://github.com/andymai/gridfinity-layout-tool/commit/fbe0e05d30b1ed68fbec0c7f4090d091a43f3c42))

## [4.155.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.155.0...gridfinity-layout-tool-v4.155.1) (2026-06-08)

### Bug Fixes

- **print-export:** correct filament & print-time estimates (were too high) ([#2065](https://github.com/andymai/gridfinity-layout-tool/issues/2065)) ([6208360](https://github.com/andymai/gridfinity-layout-tool/commit/62083601c6dde221faf04fa503638bf76084fe5b))

## [4.155.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.154.0...gridfinity-layout-tool-v4.155.0) (2026-06-08)

### Features

- **baseplate:** connector fit-sample test print ([#2059](https://github.com/andymai/gridfinity-layout-tool/issues/2059)) ([5e724b4](https://github.com/andymai/gridfinity-layout-tool/commit/5e724b4865c2e4594c26633d8d027392db24d8ea))

## [4.154.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.153.3...gridfinity-layout-tool-v4.154.0) (2026-06-08)

### Features

- **baseplate:** snap-together clip connectors ([#1610](https://github.com/andymai/gridfinity-layout-tool/issues/1610)) ([#2055](https://github.com/andymai/gridfinity-layout-tool/issues/2055)) ([39de331](https://github.com/andymai/gridfinity-layout-tool/commit/39de33121d3159798dc565d557d9631534dbf769))

## [4.153.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.153.2...gridfinity-layout-tool-v4.153.3) (2026-06-08)

### Bug Fixes

- **generation:** footprint-aware timeout budget + relax large-bin lip tessellation ([#2056](https://github.com/andymai/gridfinity-layout-tool/issues/2056)) ([2381109](https://github.com/andymai/gridfinity-layout-tool/commit/23811096a4eaa98c84e893ac2e568c78c9110ee6))

## [4.153.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.153.1...gridfinity-layout-tool-v4.153.2) (2026-06-07)

### Bug Fixes

- **export:** recover STL exports that OCCT's writer rejects ([#2051](https://github.com/andymai/gridfinity-layout-tool/issues/2051)) ([3c53ded](https://github.com/andymai/gridfinity-layout-tool/commit/3c53dedd50c02a215ca5114b099de734d4925b49))

## [4.153.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.153.0...gridfinity-layout-tool-v4.153.1) (2026-06-07)

### Bug Fixes

- **preview:** degrade gracefully when WebGL context creation fails ([#2052](https://github.com/andymai/gridfinity-layout-tool/issues/2052)) ([a594fed](https://github.com/andymai/gridfinity-layout-tool/commit/a594fedde904bfb5423a034ba811c16f03117a97))

## [4.153.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.152.2...gridfinity-layout-tool-v4.153.0) (2026-06-07)

### Features

- **pwa:** self-heal stale bundles on refresh/revisit ([#2049](https://github.com/andymai/gridfinity-layout-tool/issues/2049)) ([e7c4897](https://github.com/andymai/gridfinity-layout-tool/commit/e7c489732935b2fee088dd8c28001d47fe372eca))

## [4.152.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.152.1...gridfinity-layout-tool-v4.152.2) (2026-06-07)

### Bug Fixes

- **generation:** bump occt-wasm to 3.3.0 for Safari/iOS engine load ([#2045](https://github.com/andymai/gridfinity-layout-tool/issues/2045)) ([81dd719](https://github.com/andymai/gridfinity-layout-tool/commit/81dd71928bc6ff853cd72758612fe8fbaf60daf5))

## [4.152.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.152.0...gridfinity-layout-tool-v4.152.1) (2026-06-07)

### Bug Fixes

- **bin-designer:** gate angled dividers behind advanced opt-in ([#2046](https://github.com/andymai/gridfinity-layout-tool/issues/2046)) ([60e5ea3](https://github.com/andymai/gridfinity-layout-tool/commit/60e5ea379cbbe911a151683e6fbd03bd8a7d76a7))

## [4.152.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.151.2...gridfinity-layout-tool-v4.152.0) (2026-06-06)

### Features

- revamp Ko-fi support prompts in header and export flow ([#2042](https://github.com/andymai/gridfinity-layout-tool/issues/2042)) ([02ed517](https://github.com/andymai/gridfinity-layout-tool/commit/02ed517880833eff34f9aba63d0615f7be94850a))

## [4.151.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.151.1...gridfinity-layout-tool-v4.151.2) (2026-06-06)

### Bug Fixes

- **generation:** surface 3D engine load failures and restore kernel-perf metric ([#2040](https://github.com/andymai/gridfinity-layout-tool/issues/2040)) ([0ce40eb](https://github.com/andymai/gridfinity-layout-tool/commit/0ce40eb86b89b33b9d30600cf4d3209bcd58c178))

## [4.151.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.151.0...gridfinity-layout-tool-v4.151.1) (2026-06-06)

### Bug Fixes

- **cqrs:** build mutations over a live commandBus shim to survive chunk-cycle races ([#2038](https://github.com/andymai/gridfinity-layout-tool/issues/2038)) ([a50f975](https://github.com/andymai/gridfinity-layout-tool/commit/a50f975c61e928f0da7b50d273f3c83c1e5d2824))

## [4.151.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.150.1...gridfinity-layout-tool-v4.151.0) (2026-06-06)

### Features

- match manifold draft edge lines to occt-wasm ([#2036](https://github.com/andymai/gridfinity-layout-tool/issues/2036)) ([391e46b](https://github.com/andymai/gridfinity-layout-tool/commit/391e46b3e9f1efde997e89b7c507e06e2908d2af))

## [4.150.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.150.0...gridfinity-layout-tool-v4.150.1) (2026-06-06)

### Bug Fixes

- **bin-designer:** make panel buttons read as buttons ([#2034](https://github.com/andymai/gridfinity-layout-tool/issues/2034)) ([84181b3](https://github.com/andymai/gridfinity-layout-tool/commit/84181b39a959fe5d87214216908a658a729e8aba))

## [4.150.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.149.0...gridfinity-layout-tool-v4.150.0) (2026-06-05)

### Features

- **bin-designer:** unify wall-cutout and handle panel UI ([#2032](https://github.com/andymai/gridfinity-layout-tool/issues/2032)) ([659ed48](https://github.com/andymai/gridfinity-layout-tool/commit/659ed48445f22af7b0ccc6e352fff0df9891ad6c))

## [4.149.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.148.0...gridfinity-layout-tool-v4.149.0) (2026-06-05)

### Features

- **baseplate:** adjustable connector fit offset ([#2024](https://github.com/andymai/gridfinity-layout-tool/issues/2024)) ([#2030](https://github.com/andymai/gridfinity-layout-tool/issues/2030)) ([ab6bbe5](https://github.com/andymai/gridfinity-layout-tool/commit/ab6bbe5ef07871b6ecaef7ff158956ba7a98b7fa))

## [4.148.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.147.0...gridfinity-layout-tool-v4.148.0) (2026-06-05)

### Features

- **export:** determinate progress bar instead of a spinner ([#2028](https://github.com/andymai/gridfinity-layout-tool/issues/2028)) ([3f1e970](https://github.com/andymai/gridfinity-layout-tool/commit/3f1e970a450d936c2147364112f4b030014a8b9e))

## [4.147.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.146.1...gridfinity-layout-tool-v4.147.0) (2026-06-05)

### Features

- **bin-designer:** remove broken u-shape handle; segment shape & side selectors ([#2026](https://github.com/andymai/gridfinity-layout-tool/issues/2026)) ([83c8729](https://github.com/andymai/gridfinity-layout-tool/commit/83c87295a83f1ea1e6f927995561ce65a7cd4802))

## [4.146.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.146.0...gridfinity-layout-tool-v4.146.1) (2026-06-05)

### Performance

- **generation:** defer base-socket fuse to export for faster cold preview ([#2023](https://github.com/andymai/gridfinity-layout-tool/issues/2023)) ([0bf922b](https://github.com/andymai/gridfinity-layout-tool/commit/0bf922b457781322581a65b10d9250c9da1bf5a1))

## [4.146.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.145.2...gridfinity-layout-tool-v4.146.0) (2026-06-05)

### Features

- **labs:** graduate faster live preview out of labs ([#2021](https://github.com/andymai/gridfinity-layout-tool/issues/2021)) ([2e0c764](https://github.com/andymai/gridfinity-layout-tool/commit/2e0c7640ea4022933b213964224ea38fb40e0b35))

## [4.145.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.145.1...gridfinity-layout-tool-v4.145.2) (2026-06-05)

### Bug Fixes

- **deps:** bump brepjs 18.66.1 -&gt; 18.66.2 (Manifold honeycomb wall-pattern fix) ([#2014](https://github.com/andymai/gridfinity-layout-tool/issues/2014)) ([40e1979](https://github.com/andymai/gridfinity-layout-tool/commit/40e197966f0e156b33cb976d91b1b0a22ba3ad4e))

## [4.145.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.145.0...gridfinity-layout-tool-v4.145.1) (2026-06-05)

### Bug Fixes

- **labs:** re-render feature toggles when flags change ([#2011](https://github.com/andymai/gridfinity-layout-tool/issues/2011)) ([80b2ab0](https://github.com/andymai/gridfinity-layout-tool/commit/80b2ab02fa5cc40b392351bf8f63ee10d95d9b3a))

## [4.145.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.144.2...gridfinity-layout-tool-v4.145.0) (2026-06-05)

### Features

- **generation:** faster live 3D preview via Manifold draft kernel ([#2009](https://github.com/andymai/gridfinity-layout-tool/issues/2009)) ([8cead49](https://github.com/andymai/gridfinity-layout-tool/commit/8cead492b7537f255520a5e60f99f96439307048))

## [4.144.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.144.1...gridfinity-layout-tool-v4.144.2) (2026-06-04)

### Bug Fixes

- **cutouts:** translate path vertices for array instances ([#2006](https://github.com/andymai/gridfinity-layout-tool/issues/2006)) ([95730c9](https://github.com/andymai/gridfinity-layout-tool/commit/95730c9e2e8521d061e6615b763323a4b2fbe826))

## [4.144.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.144.0...gridfinity-layout-tool-v4.144.1) (2026-06-04)

### Bug Fixes

- **generation:** stop path cutouts collapsing to a rectangle on duplicate vertices ([#2004](https://github.com/andymai/gridfinity-layout-tool/issues/2004)) ([a4fc6dd](https://github.com/andymai/gridfinity-layout-tool/commit/a4fc6ddc898c4a47b6c10353ef77951017bef456))

## [4.144.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.143.0...gridfinity-layout-tool-v4.144.0) (2026-06-04)

### Features

- **cutout-editor:** responsive multi-select toolbar + accessibility + tests ([#2002](https://github.com/andymai/gridfinity-layout-tool/issues/2002)) ([ef07a66](https://github.com/andymai/gridfinity-layout-tool/commit/ef07a6693fd27bbb1834f0e44be94defbb967c71))

## [4.143.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.142.0...gridfinity-layout-tool-v4.143.0) (2026-06-04)

### Features

- **cutout-editor:** inspector panel UX overhaul + array tile performance ([20890d6](https://github.com/andymai/gridfinity-layout-tool/commit/20890d6eaa913aa42840db4167df4e78a8043bb5))

## [4.142.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.141.0...gridfinity-layout-tool-v4.142.0) (2026-06-04)

### Features

- **slider:** tactile grip knob with app-matched polish ([#1999](https://github.com/andymai/gridfinity-layout-tool/issues/1999)) ([a6f6cdd](https://github.com/andymai/gridfinity-layout-tool/commit/a6f6cddee2ed7c21eca83ceed4e967c5fd0aca69))

## [4.141.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.140.0...gridfinity-layout-tool-v4.141.0) (2026-06-04)

### Features

- **cutout-editor:** polish side-panel controls + smart fit defaults ([#1997](https://github.com/andymai/gridfinity-layout-tool/issues/1997)) ([ed43124](https://github.com/andymai/gridfinity-layout-tool/commit/ed4312406bc4b56c68d45dc1c3a00eeed9e4c8b0))

## [4.140.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.139.0...gridfinity-layout-tool-v4.140.0) (2026-06-04)

### Features

- **cutouts:** cutout editor inspector overhaul (dock + number-first controls + states) ([#1995](https://github.com/andymai/gridfinity-layout-tool/issues/1995)) ([be5934c](https://github.com/andymai/gridfinity-layout-tool/commit/be5934c9b57a2df6a8565e673755982cd9ba255a))

## [4.139.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.138.0...gridfinity-layout-tool-v4.139.0) (2026-06-03)

### Features

- **pwa:** apply updates without interrupting active sessions ([#1990](https://github.com/andymai/gridfinity-layout-tool/issues/1990)) ([51b788d](https://github.com/andymai/gridfinity-layout-tool/commit/51b788d8235a4db423039e39fbc843c3dd67b849))

## [4.138.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.137.0...gridfinity-layout-tool-v4.138.0) (2026-06-03)

### Features

- **cutouts:** show engraved labels in the 2D cut editor ([#1988](https://github.com/andymai/gridfinity-layout-tool/issues/1988)) ([5d56658](https://github.com/andymai/gridfinity-layout-tool/commit/5d566582ae5d8faa21d5d11e4005f2d6b8df8d1b))

## [4.137.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.136.2...gridfinity-layout-tool-v4.137.0) (2026-06-03)

### Features

- custom cutout shapes, entry chamfers, and parametric arrays for organizers ([#1985](https://github.com/andymai/gridfinity-layout-tool/issues/1985)) ([c6517a5](https://github.com/andymai/gridfinity-layout-tool/commit/c6517a589f1533899015757b95c7ce4aeed907e2))

## [4.136.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.136.1...gridfinity-layout-tool-v4.136.2) (2026-06-03)

### Bug Fixes

- **generation:** include overhang expansion in innerW/innerD ([#1984](https://github.com/andymai/gridfinity-layout-tool/issues/1984)) ([d6f4e4a](https://github.com/andymai/gridfinity-layout-tool/commit/d6f4e4ad8e92d67c415cb5b4ce8bcc04e7e6b965))

## [4.136.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.136.0...gridfinity-layout-tool-v4.136.1) (2026-06-03)

### Bug Fixes

- **error-boundary:** remove one-click destructive reset from crash screens ([#1979](https://github.com/andymai/gridfinity-layout-tool/issues/1979)) ([185cb07](https://github.com/andymai/gridfinity-layout-tool/commit/185cb071d0a950e6aa1180a8533dcf5d19ba5636))

## [4.136.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.135.0...gridfinity-layout-tool-v4.136.0) (2026-06-02)

### Features

- **kernel:** make occt-wasm the default geometry kernel, remove legacy opencascade ([#1970](https://github.com/andymai/gridfinity-layout-tool/issues/1970)) ([5f5db50](https://github.com/andymai/gridfinity-layout-tool/commit/5f5db5094292c089142805dd72ed1f4d39d9a924))

### Bug Fixes

- **generation:** round cavity corners to fix corner gap on thin-walled dividers ([#1968](https://github.com/andymai/gridfinity-layout-tool/issues/1968)) ([#1969](https://github.com/andymai/gridfinity-layout-tool/issues/1969)) ([918eff5](https://github.com/andymai/gridfinity-layout-tool/commit/918eff5fe9c36c1d54d8b4648fdb7a318b961ada))

## [4.135.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.134.0...gridfinity-layout-tool-v4.135.0) (2026-06-02)

### Features

- **baseplate:** make padding alignment control self-explanatory ([#1966](https://github.com/andymai/gridfinity-layout-tool/issues/1966)) ([24bed71](https://github.com/andymai/gridfinity-layout-tool/commit/24bed712d6c2ee9555e4a3f2c9531df88860aeba))

## [4.134.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.133.0...gridfinity-layout-tool-v4.134.0) (2026-06-01)

### Features

- add a bin design showcase gallery ([#1964](https://github.com/andymai/gridfinity-layout-tool/issues/1964)) ([3f05b56](https://github.com/andymai/gridfinity-layout-tool/commit/3f05b561e003751b3cb08117c5a72d127006167c))

## [4.133.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.132.3...gridfinity-layout-tool-v4.133.0) (2026-06-01)

### Features

- rebrand the bin palette as "Size Brush" with clear paint-mode feedback ([#1962](https://github.com/andymai/gridfinity-layout-tool/issues/1962)) ([ec129ff](https://github.com/andymai/gridfinity-layout-tool/commit/ec129ff72e780f0cdb562d0b6f9a14617963ec67))

## [4.132.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.132.2...gridfinity-layout-tool-v4.132.3) (2026-05-31)

### Bug Fixes

- **bin-designer:** allow fractional magnet depth input ([#1958](https://github.com/andymai/gridfinity-layout-tool/issues/1958)) ([2aee382](https://github.com/andymai/gridfinity-layout-tool/commit/2aee382224e0d8cbf3c0d77a2188cd24ce50f5c6))

## [4.132.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.132.1...gridfinity-layout-tool-v4.132.2) (2026-05-31)

### Bug Fixes

- **print-export:** color the lid by extruder so BambuStudio renders it ([#1955](https://github.com/andymai/gridfinity-layout-tool/issues/1955)) ([860b645](https://github.com/andymai/gridfinity-layout-tool/commit/860b645b6feb1b4dc15c704f3ace221a6da18220))

## [4.132.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.132.0...gridfinity-layout-tool-v4.132.1) (2026-05-31)

### Bug Fixes

- **print-export:** preserve overhang when splitting an oversized bin ([#1952](https://github.com/andymai/gridfinity-layout-tool/issues/1952)) ([570a2ca](https://github.com/andymai/gridfinity-layout-tool/commit/570a2ca166f97de48a4baf16a3e2787af7ed6d8b))

## [4.132.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.131.0...gridfinity-layout-tool-v4.132.0) (2026-05-31)

### Features

- generated bin-grid identicon avatars (dock + collaborators) ([#1950](https://github.com/andymai/gridfinity-layout-tool/issues/1950)) ([4be33b8](https://github.com/andymai/gridfinity-layout-tool/commit/4be33b88763ad9bc750e8e611e1d47b8315f488e))

## [4.131.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.130.0...gridfinity-layout-tool-v4.131.0) (2026-05-31)

### Features

- **bin-designer:** highlight the affected wall when hovering overhang controls ([#1947](https://github.com/andymai/gridfinity-layout-tool/issues/1947)) ([2c9d6d8](https://github.com/andymai/gridfinity-layout-tool/commit/2c9d6d8a671f619a72d5223efa328566af66cae7))

## [4.130.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.129.1...gridfinity-layout-tool-v4.130.0) (2026-05-30)

### Features

- non-integral bins — overhang, over-tile baseplates, and fractional feet ([#1945](https://github.com/andymai/gridfinity-layout-tool/issues/1945)) ([cbc177e](https://github.com/andymai/gridfinity-layout-tool/commit/cbc177eaf9686ea477ca797e97b40f8c86221949))

## [4.129.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.129.0...gridfinity-layout-tool-v4.129.1) (2026-05-30)

### Bug Fixes

- **print-export:** make print-bed link toggle clearly visible ([#1943](https://github.com/andymai/gridfinity-layout-tool/issues/1943)) ([c780f99](https://github.com/andymai/gridfinity-layout-tool/commit/c780f993fcf071e64696f1220418fb196461a3c0)), closes [#1938](https://github.com/andymai/gridfinity-layout-tool/issues/1938)

## [4.129.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.128.0...gridfinity-layout-tool-v4.129.0) (2026-05-30)

### Features

- **layout-library:** header thumbnail quick-switch for layouts ([#1941](https://github.com/andymai/gridfinity-layout-tool/issues/1941)) ([6ec4ec2](https://github.com/andymai/gridfinity-layout-tool/commit/6ec4ec2e992356788050f5d16a1b5ef748a04849))

## [4.128.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.127.0...gridfinity-layout-tool-v4.128.0) (2026-05-30)

### Features

- **bin-designer:** organize saved designs with tags, filtering, and bulk actions ([#1939](https://github.com/andymai/gridfinity-layout-tool/issues/1939)) ([86feab6](https://github.com/andymai/gridfinity-layout-tool/commit/86feab627f30701a014c103716e7360205317e13))

## [4.127.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.126.1...gridfinity-layout-tool-v4.127.0) (2026-05-29)

### Features

- **bin-designer:** add synced organization tags to saved designs ([#1936](https://github.com/andymai/gridfinity-layout-tool/issues/1936)) ([7d732ba](https://github.com/andymai/gridfinity-layout-tool/commit/7d732bab7603101077f511de12fb0c23d8ba467a))

## [4.126.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.126.0...gridfinity-layout-tool-v4.126.1) (2026-05-29)

### Bug Fixes

- **bin-designer:** stop 3D preview crashing when the browser auto-translates ([#1934](https://github.com/andymai/gridfinity-layout-tool/issues/1934)) ([d5d4d6a](https://github.com/andymai/gridfinity-layout-tool/commit/d5d4d6a4ea066a1ba4f8db115094a63431ee7d95))

## [4.126.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.125.2...gridfinity-layout-tool-v4.126.0) (2026-05-29)

### Features

- **bin-designer:** angle-first diagonal divider editing ([#1932](https://github.com/andymai/gridfinity-layout-tool/issues/1932)) ([7b892b7](https://github.com/andymai/gridfinity-layout-tool/commit/7b892b78c96841d85a576f321e2dc4ed641ee1ab))

## [4.125.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.125.1...gridfinity-layout-tool-v4.125.2) (2026-05-29)

### Bug Fixes

- **generation:** retain occt-wasm kernel wrapper to prevent GC use-after-free ([#1930](https://github.com/andymai/gridfinity-layout-tool/issues/1930)) ([e56a8fa](https://github.com/andymai/gridfinity-layout-tool/commit/e56a8fa27de7ffdbd5bd427f0fdae7cd65687aac))

## [4.125.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.125.0...gridfinity-layout-tool-v4.125.1) (2026-05-29)

### Bug Fixes

- **bin-designer:** fit default 3D preview to screen at any bin size ([#1928](https://github.com/andymai/gridfinity-layout-tool/issues/1928)) ([b26601b](https://github.com/andymai/gridfinity-layout-tool/commit/b26601b4d221144da5a23d8cd02e160badd666dc))

## [4.125.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.124.0...gridfinity-layout-tool-v4.125.0) (2026-05-29)

### Features

- **baseplate:** dovetail-key connectors for split baseplates ([#1610](https://github.com/andymai/gridfinity-layout-tool/issues/1610)) ([#1921](https://github.com/andymai/gridfinity-layout-tool/issues/1921)) ([7c1c1d3](https://github.com/andymai/gridfinity-layout-tool/commit/7c1c1d3822835f58c45aabeda506d0fd8d5a215c))

## [4.124.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.123.8...gridfinity-layout-tool-v4.124.0) (2026-05-29)

### Features

- **split-bin:** wall connectors to keep tall split pieces aligned ([#1922](https://github.com/andymai/gridfinity-layout-tool/issues/1922)) ([f3102f1](https://github.com/andymai/gridfinity-layout-tool/commit/f3102f11af2f1880fbb413b1d1d579ecda0175af))

## [4.123.8](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.123.7...gridfinity-layout-tool-v4.123.8) (2026-05-29)

### Bug Fixes

- **baseplate:** restore top-down fit-in-view as the default camera ([#1923](https://github.com/andymai/gridfinity-layout-tool/issues/1923)) ([5ca6bd5](https://github.com/andymai/gridfinity-layout-tool/commit/5ca6bd506682fdc92e788a8f534a64b5ce358ad1))

## [4.123.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.123.6...gridfinity-layout-tool-v4.123.7) (2026-05-28)

### Bug Fixes

- **bin-designer:** wall cutouts now carry through dividers ([#1882](https://github.com/andymai/gridfinity-layout-tool/issues/1882)) ([#1919](https://github.com/andymai/gridfinity-layout-tool/issues/1919)) ([0b1e872](https://github.com/andymai/gridfinity-layout-tool/commit/0b1e872329a764bca2e55a5a5492fd805026156d))

## [4.123.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.123.5...gridfinity-layout-tool-v4.123.6) (2026-05-28)

### Bug Fixes

- **vite:** exclude occt-wasm from optimizeDeps pre-bundling ([#1917](https://github.com/andymai/gridfinity-layout-tool/issues/1917)) ([fb52ea7](https://github.com/andymai/gridfinity-layout-tool/commit/fb52ea7c6d54f5b5a853f1e9663061100d329beb))

## [4.123.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.123.4...gridfinity-layout-tool-v4.123.5) (2026-05-28)

### Bug Fixes

- **i18n:** translate hardcoded UI strings that bypassed t() lookups ([#1915](https://github.com/andymai/gridfinity-layout-tool/issues/1915)) ([c308a3f](https://github.com/andymai/gridfinity-layout-tool/commit/c308a3f5163d8436270dc4b1f2941432fa774861))

## [4.123.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.123.3...gridfinity-layout-tool-v4.123.4) (2026-05-28)

### Bug Fixes

- **estimates:** count label tabs by group, not by column ([#1913](https://github.com/andymai/gridfinity-layout-tool/issues/1913)) ([77b3b48](https://github.com/andymai/gridfinity-layout-tool/commit/77b3b4848f23a3721d98f017aaa8995b700eaae1))

## [4.123.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.123.2...gridfinity-layout-tool-v4.123.3) (2026-05-28)

### Bug Fixes

- **bin-designer:** show both print bed dimensions in Physical Units ([#1910](https://github.com/andymai/gridfinity-layout-tool/issues/1910)) ([7ce5670](https://github.com/andymai/gridfinity-layout-tool/commit/7ce567074837f059b24dd48f35a59a3d03408a15))

## [4.123.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.123.1...gridfinity-layout-tool-v4.123.2) (2026-05-28)

### Bug Fixes

- **export:** multi-color polish (lid color, lid layout, lip parity) ([#1903](https://github.com/andymai/gridfinity-layout-tool/issues/1903)) ([303d938](https://github.com/andymai/gridfinity-layout-tool/commit/303d938736cc712c9a16c4d619990915e26cae43))

## [4.123.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.123.0...gridfinity-layout-tool-v4.123.1) (2026-05-28)

### Bug Fixes

- **split-bin:** cut stacking lip with wall cutouts ([#1908](https://github.com/andymai/gridfinity-layout-tool/issues/1908)) ([5c041ff](https://github.com/andymai/gridfinity-layout-tool/commit/5c041ffd679d3f24619783c8dddd31630b2562d1))

## [4.123.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.122.0...gridfinity-layout-tool-v4.123.0) (2026-05-28)

### Features

- **label-tabs:** tuck-under ledges for wire bins ([#1904](https://github.com/andymai/gridfinity-layout-tool/issues/1904)) ([1b63337](https://github.com/andymai/gridfinity-layout-tool/commit/1b633374730623c052d30757cdcee3f71c6efab1))

## [4.122.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.121.0...gridfinity-layout-tool-v4.122.0) (2026-05-27)

### Features

- **label-tabs:** add adjustable shelf height ([#1901](https://github.com/andymai/gridfinity-layout-tool/issues/1901)) ([f03602f](https://github.com/andymai/gridfinity-layout-tool/commit/f03602f701f234970471b4c731918306c5e26e14))

## [4.121.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.120.7...gridfinity-layout-tool-v4.121.0) (2026-05-27)

### Features

- **i18n:** add Japanese (ja) locale ([#1899](https://github.com/andymai/gridfinity-layout-tool/issues/1899)) ([d4f70ab](https://github.com/andymai/gridfinity-layout-tool/commit/d4f70abc8653670bf70d5efa936cf3d094995991))

## [4.120.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.120.6...gridfinity-layout-tool-v4.120.7) (2026-05-27)

### Bug Fixes

- pin acceleration to silence Orca + sync server caps with [#1873](https://github.com/andymai/gridfinity-layout-tool/issues/1873) ([#1896](https://github.com/andymai/gridfinity-layout-tool/issues/1896)) ([a07c41d](https://github.com/andymai/gridfinity-layout-tool/commit/a07c41d612f4355eb6d751b315c9dd4e05db2da1))

## [4.120.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.120.5...gridfinity-layout-tool-v4.120.6) (2026-05-27)

### Bug Fixes

- **export:** center bins on the plate when claiming BambuStudio identity ([#1895](https://github.com/andymai/gridfinity-layout-tool/issues/1895)) ([5edde06](https://github.com/andymai/gridfinity-layout-tool/commit/5edde0656b5ba7bfc79e91c32728da3226e35644))
- **export:** pre-fill AMS palette for multi-color 3MFs in BambuStudio ([#1893](https://github.com/andymai/gridfinity-layout-tool/issues/1893)) ([b5dac2d](https://github.com/andymai/gridfinity-layout-tool/commit/b5dac2de1e4d9074dd421e291f677c16f4522c1e))

## [4.120.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.120.4...gridfinity-layout-tool-v4.120.5) (2026-05-27)

### Bug Fixes

- **export:** off-by-one collapsed body+lip onto the same AMS slot ([#1891](https://github.com/andymai/gridfinity-layout-tool/issues/1891)) ([785ab91](https://github.com/andymai/gridfinity-layout-tool/commit/785ab91c80b56cbb5ad8824d92ad47864b4bac67))

## [4.120.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.120.3...gridfinity-layout-tool-v4.120.4) (2026-05-27)

### Bug Fixes

- **export:** satisfy OrcaSlicer's multi-material slice validation ([#1889](https://github.com/andymai/gridfinity-layout-tool/issues/1889)) ([fd35a22](https://github.com/andymai/gridfinity-layout-tool/commit/fd35a22d04e418188103815df9dba7dd300b75ab))

## [4.120.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.120.2...gridfinity-layout-tool-v4.120.3) (2026-05-27)

### Bug Fixes

- **export:** drop BambuStudio identity claim — OrcaSlicer rejects it ([#1887](https://github.com/andymai/gridfinity-layout-tool/issues/1887)) ([692646c](https://github.com/andymai/gridfinity-layout-tool/commit/692646c02fef2920528f20a61255ab133f632c5c))

## [4.120.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.120.1...gridfinity-layout-tool-v4.120.2) (2026-05-27)

### Bug Fixes

- **export:** paint per-triangle via paint_color for Bambu/Orca/Prusa ([#1885](https://github.com/andymai/gridfinity-layout-tool/issues/1885)) ([1dc8f34](https://github.com/andymai/gridfinity-layout-tool/commit/1dc8f3438e4f1b293c17dd60a33a260632cd38cf))

## [4.120.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.120.0...gridfinity-layout-tool-v4.120.1) (2026-05-26)

### Bug Fixes

- **export:** emit 3MF Materials Extension colorgroup for Bambu/Orca + spec audit ([#1883](https://github.com/andymai/gridfinity-layout-tool/issues/1883)) ([d21dbab](https://github.com/andymai/gridfinity-layout-tool/commit/d21dbab7833415a5c202d44f342f0e40d8e69e0f))

## [4.120.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.119.1...gridfinity-layout-tool-v4.120.0) (2026-05-25)

### Features

- **bin-designer:** pathfinder boolean controls in the cutout editor ([#1878](https://github.com/andymai/gridfinity-layout-tool/issues/1878)) ([3a33c7e](https://github.com/andymai/gridfinity-layout-tool/commit/3a33c7e2f57b9ed157203a2c65a3c62a83bd3c1b))

## [4.119.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.119.0...gridfinity-layout-tool-v4.119.1) (2026-05-25)

### Performance

- **generation:** instrument + bench + safe wall-pattern optimizations ([#1879](https://github.com/andymai/gridfinity-layout-tool/issues/1879)) ([9051477](https://github.com/andymai/gridfinity-layout-tool/commit/905147733ec780dfcf2842c1f6cdfb0cd80f66c0))

## [4.119.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.118.1...gridfinity-layout-tool-v4.119.0) (2026-05-24)

### Features

- **bin-designer:** raise compartment row/col cap from 8 to 12 ([#1873](https://github.com/andymai/gridfinity-layout-tool/issues/1873)) ([5f9fe59](https://github.com/andymai/gridfinity-layout-tool/commit/5f9fe59db5023c70c0775d495ed4f0ac164f8221))

## [4.118.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.118.0...gridfinity-layout-tool-v4.118.1) (2026-05-24)

### Bug Fixes

- **preview:** set Z-up on drei cameras at construction time ([#1874](https://github.com/andymai/gridfinity-layout-tool/issues/1874)) ([99441ee](https://github.com/andymai/gridfinity-layout-tool/commit/99441eef33328b1e24f0803932297ea7629bdef9))

## [4.118.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.117.2...gridfinity-layout-tool-v4.118.0) (2026-05-24)

### Features

- **preview:** add xray and projection toggles ([#1870](https://github.com/andymai/gridfinity-layout-tool/issues/1870)) ([92eb99b](https://github.com/andymai/gridfinity-layout-tool/commit/92eb99b864c9dbde5b59d7ff7efbea033c579e81))

## [4.117.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.117.1...gridfinity-layout-tool-v4.117.2) (2026-05-24)

### Bug Fixes

- **generation:** route solid-bin cutouts through booleanStage's cutAllBisect ([#1866](https://github.com/andymai/gridfinity-layout-tool/issues/1866)) ([0199ed5](https://github.com/andymai/gridfinity-layout-tool/commit/0199ed5b48a925fd73d87ab293623113041951e5))

## [4.117.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.117.0...gridfinity-layout-tool-v4.117.1) (2026-05-24)

### Bug Fixes

- **generation:** surface cutout boolean failures instead of dropping them ([#1864](https://github.com/andymai/gridfinity-layout-tool/issues/1864)) ([e8cb300](https://github.com/andymai/gridfinity-layout-tool/commit/e8cb300ecaf131b64c4e635a024814e18c8b1c85))

## [4.117.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.116.2...gridfinity-layout-tool-v4.117.0) (2026-05-23)

### Features

- **baseplate:** add 9-point padding anchor selector ([#1862](https://github.com/andymai/gridfinity-layout-tool/issues/1862)) ([ef27601](https://github.com/andymai/gridfinity-layout-tool/commit/ef27601dac9401e1f73a49cbed59208672c8a0db))

## [4.116.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.116.1...gridfinity-layout-tool-v4.116.2) (2026-05-23)

### Bug Fixes

- **cloud-share:** unblock first-time recipients of share links ([#1860](https://github.com/andymai/gridfinity-layout-tool/issues/1860)) ([b9ea617](https://github.com/andymai/gridfinity-layout-tool/commit/b9ea6178d8e53fcec108a77d6d98de97f90cebe4))

## [4.116.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.116.0...gridfinity-layout-tool-v4.116.1) (2026-05-23)

### Bug Fixes

- **bin-designer:** include text zone in slicer handoff preview ([#1857](https://github.com/andymai/gridfinity-layout-tool/issues/1857)) ([c25ed79](https://github.com/andymai/gridfinity-layout-tool/commit/c25ed79a46ebe231c8da6b38917e72942e9d2045))

## [4.116.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.115.4...gridfinity-layout-tool-v4.116.0) (2026-05-22)

### Features

- **bin-designer:** redesign diagonal-divider UI ([#1855](https://github.com/andymai/gridfinity-layout-tool/issues/1855)) ([e6cbed4](https://github.com/andymai/gridfinity-layout-tool/commit/e6cbed4ee70780e99292ab27c1e7deaba9f4c18c))

## [4.115.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.115.3...gridfinity-layout-tool-v4.115.4) (2026-05-22)

### Bug Fixes

- **generation:** [#1822](https://github.com/andymai/gridfinity-layout-tool/issues/1822) — manifold coverage + booleanStage simplify ([#1853](https://github.com/andymai/gridfinity-layout-tool/issues/1853)) ([004b65f](https://github.com/andymai/gridfinity-layout-tool/commit/004b65f5d2f116ffc7a45ae34e1ef3423f06d6bb))

## [4.115.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.115.2...gridfinity-layout-tool-v4.115.3) (2026-05-22)

### Bug Fixes

- **generation:** [#1850](https://github.com/andymai/gridfinity-layout-tool/issues/1850) — drop scoop rim fillet that broke STL export ([#1851](https://github.com/andymai/gridfinity-layout-tool/issues/1851)) ([cd607b1](https://github.com/andymai/gridfinity-layout-tool/commit/cd607b1261d7e28562cda72c82ee70c90478d5c8))

## [4.115.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.115.1...gridfinity-layout-tool-v4.115.2) (2026-05-21)

### Bug Fixes

- **baseplate:** [#1847](https://github.com/andymai/gridfinity-layout-tool/issues/1847) — dovetail positions honor fractionalEdge under rotation ([#1848](https://github.com/andymai/gridfinity-layout-tool/issues/1848)) ([c0f91d3](https://github.com/andymai/gridfinity-layout-tool/commit/c0f91d369d70c0d10fdc329e1075786cb141f4e1))

## [4.115.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.115.0...gridfinity-layout-tool-v4.115.1) (2026-05-21)

### Bug Fixes

- **generation:** [#1822](https://github.com/andymai/gridfinity-layout-tool/issues/1822) — wire dividerOverrides through the cut path ([#1844](https://github.com/andymai/gridfinity-layout-tool/issues/1844)) ([7d2d2f2](https://github.com/andymai/gridfinity-layout-tool/commit/7d2d2f21fdec5f3aa792a48b82923001e5172671))

## [4.115.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.114.1...gridfinity-layout-tool-v4.115.0) (2026-05-21)

### Features

- **bin-designer:** angled-dividers polish + flag graduation (PR 4 of 4) ([#1840](https://github.com/andymai/gridfinity-layout-tool/issues/1840)) ([2fed8d2](https://github.com/andymai/gridfinity-layout-tool/commit/2fed8d2217d854d0055db28a42b79b09bb990b53))

### Bug Fixes

- **bin-designer:** [#1840](https://github.com/andymai/gridfinity-layout-tool/issues/1840) review — partial-span tilt coverage + 3 smaller ([#1842](https://github.com/andymai/gridfinity-layout-tool/issues/1842)) ([efd89ea](https://github.com/andymai/gridfinity-layout-tool/commit/efd89ea525477febc51187d27d3329c7b9c38984))

## [4.114.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.114.0...gridfinity-layout-tool-v4.114.1) (2026-05-21)

### Bug Fixes

- **bin-designer:** [#1835](https://github.com/andymai/gridfinity-layout-tool/issues/1835) canvas-drag review — 8 items, 2 critical ([#1837](https://github.com/andymai/gridfinity-layout-tool/issues/1837)) ([39b083d](https://github.com/andymai/gridfinity-layout-tool/commit/39b083d1c297528cbcc50f73ee368a498224308b))
- **bin-designer:** [#1837](https://github.com/andymai/gridfinity-layout-tool/issues/1837) review — critical commit regression + doc/sync nits ([#1839](https://github.com/andymai/gridfinity-layout-tool/issues/1839)) ([3378c2a](https://github.com/andymai/gridfinity-layout-tool/commit/3378c2a856c2a471f492fb6ed40e964a5ee52150))

## [4.114.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.113.0...gridfinity-layout-tool-v4.114.0) (2026-05-21)

### Features

- **bin-designer:** canvas drag handles for angled dividers (PR 3 of 3-ish) ([#1835](https://github.com/andymai/gridfinity-layout-tool/issues/1835)) ([1085a58](https://github.com/andymai/gridfinity-layout-tool/commit/1085a588cfb9c2b72f0c9f5e9f9193110aeeb9d5))

## [4.113.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.112.1...gridfinity-layout-tool-v4.113.0) (2026-05-21)

### Features

- **bin-designer:** angled-dividers panel UI (PR 2 of 3) ([#1832](https://github.com/andymai/gridfinity-layout-tool/issues/1832)) ([040cde5](https://github.com/andymai/gridfinity-layout-tool/commit/040cde5650b9f6c3a6aa267150aa454676acff86))

### Bug Fixes

- **bin-designer:** [#1832](https://github.com/andymai/gridfinity-layout-tool/issues/1832) review carryover (critical first-time UX + 2 smaller) ([#1834](https://github.com/andymai/gridfinity-layout-tool/issues/1834)) ([7adee20](https://github.com/andymai/gridfinity-layout-tool/commit/7adee20bcb6d430e5f87dc85b8a2712c5a029742))

## [4.112.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.112.0...gridfinity-layout-tool-v4.112.1) (2026-05-21)

### Bug Fixes

- **bin-designer:** address [#1829](https://github.com/andymai/gridfinity-layout-tool/issues/1829) follow-up review (3 items) ([#1831](https://github.com/andymai/gridfinity-layout-tool/issues/1831)) ([450bd0c](https://github.com/andymai/gridfinity-layout-tool/commit/450bd0c92c96dabb302fc418227f807ed3a2c9a6))
- **bin-designer:** address Greptile + Copilot review on [#1827](https://github.com/andymai/gridfinity-layout-tool/issues/1827) ([#1829](https://github.com/andymai/gridfinity-layout-tool/issues/1829)) ([d307d3c](https://github.com/andymai/gridfinity-layout-tool/commit/d307d3cac21920053a6e2b98cb78a9621cd74075))

## [4.112.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.111.2...gridfinity-layout-tool-v4.112.0) (2026-05-21)

### Features

- **bin-designer:** foundation for angled dividers (issue [#1822](https://github.com/andymai/gridfinity-layout-tool/issues/1822)) ([#1827](https://github.com/andymai/gridfinity-layout-tool/issues/1827)) ([2fcc48c](https://github.com/andymai/gridfinity-layout-tool/commit/2fcc48cde232403bb2c455a4c85b4e6f1df3ccf2))

## [4.111.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.111.1...gridfinity-layout-tool-v4.111.2) (2026-05-21)

### Bug Fixes

- **bin-designer:** address [#1815](https://github.com/andymai/gridfinity-layout-tool/issues/1815) review (emboss coplanar fix + rotation-aware AABB) ([#1819](https://github.com/andymai/gridfinity-layout-tool/issues/1819)) ([d2a8312](https://github.com/andymai/gridfinity-layout-tool/commit/d2a83120f938989f1df2430fe90ecb561fe0bbef))

## [4.111.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.111.0...gridfinity-layout-tool-v4.111.1) (2026-05-21)

### Bug Fixes

- **bin-designer:** address [#1812](https://github.com/andymai/gridfinity-layout-tool/issues/1812) review carryover (a11y + typo + test polish) ([#1817](https://github.com/andymai/gridfinity-layout-tool/issues/1817)) ([a083ccc](https://github.com/andymai/gridfinity-layout-tool/commit/a083ccc491d137380752174dcb3cf979b3df996c))

## [4.111.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.110.1...gridfinity-layout-tool-v4.111.0) (2026-05-21)

### Features

- **bin-designer:** complete engraved-text feature (cutouts + emboss/through-cut + font picker) ([#1815](https://github.com/andymai/gridfinity-layout-tool/issues/1815)) ([bb4dc57](https://github.com/andymai/gridfinity-layout-tool/commit/bb4dc57e6b694bbbfa282c249c57e0aa3bfe38b5))

## [4.110.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.110.0...gridfinity-layout-tool-v4.110.1) (2026-05-21)

### Bug Fixes

- **bin-designer:** address [#1809](https://github.com/andymai/gridfinity-layout-tool/issues/1809) review (a11y + occt-wasm fonts + tests) ([#1812](https://github.com/andymai/gridfinity-layout-tool/issues/1812)) ([000ae64](https://github.com/andymai/gridfinity-layout-tool/commit/000ae648db1bcb02245c68f54049d0847a88678e))
- **bin-designer:** ghost previews track params.gridUnitMm ([#1814](https://github.com/andymai/gridfinity-layout-tool/issues/1814)) ([e00e7cd](https://github.com/andymai/gridfinity-layout-tool/commit/e00e7cdc6eefd6149599f19b64e086f39629ec41))

## [4.110.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.109.0...gridfinity-layout-tool-v4.110.0) (2026-05-21)

### Features

- **bin-designer:** engraved text on label tabs (end-to-end) ([#1809](https://github.com/andymai/gridfinity-layout-tool/issues/1809)) ([8ddb9d5](https://github.com/andymai/gridfinity-layout-tool/commit/8ddb9d514671db0b6303035bbca785c241a77265))

## [4.109.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.108.5...gridfinity-layout-tool-v4.109.0) (2026-05-21)

### Features

- **bin-designer:** foundation for engraved text on label tabs and cutouts ([#1807](https://github.com/andymai/gridfinity-layout-tool/issues/1807)) ([b55581e](https://github.com/andymai/gridfinity-layout-tool/commit/b55581e2ff9b3f751ea0731d1044f52a09797e76))

## [4.108.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.108.4...gridfinity-layout-tool-v4.108.5) (2026-05-20)

### Bug Fixes

- **bin-designer:** rotation-aware drag clamp + resize joint constraint ([#1805](https://github.com/andymai/gridfinity-layout-tool/issues/1805)) ([c86a06e](https://github.com/andymai/gridfinity-layout-tool/commit/c86a06e91314849d1de6372d46a587bfe3ae6c2c))

## [4.108.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.108.3...gridfinity-layout-tool-v4.108.4) (2026-05-20)

### Bug Fixes

- **bin-designer:** scale path cutouts on width/depth update ([#1803](https://github.com/andymai/gridfinity-layout-tool/issues/1803)) ([e1a6fe2](https://github.com/andymai/gridfinity-layout-tool/commit/e1a6fe2f612ab371be192ac46b8284cb2298988b))

## [4.108.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.108.2...gridfinity-layout-tool-v4.108.3) (2026-05-20)

### Bug Fixes

- **bin-designer:** skip generation epoch on cosmetic cutout mutations ([#1801](https://github.com/andymai/gridfinity-layout-tool/issues/1801)) ([8416577](https://github.com/andymai/gridfinity-layout-tool/commit/84165774baef56bdc25f30fe1dfe6b46ecbedffe))

## [4.108.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.108.1...gridfinity-layout-tool-v4.108.2) (2026-05-20)

### Bug Fixes

- **bin-designer:** tearing-safe useCustomBins + idle-aware autosave wait ([#1799](https://github.com/andymai/gridfinity-layout-tool/issues/1799)) ([409d255](https://github.com/andymai/gridfinity-layout-tool/commit/409d255d9c8bfce1d0e6025b4c539da82b3f5e9d))

## [4.108.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.108.0...gridfinity-layout-tool-v4.108.1) (2026-05-20)

### Bug Fixes

- **bin-designer:** handle diagonally-adjacent holes in custom shapes ([#1797](https://github.com/andymai/gridfinity-layout-tool/issues/1797)) ([8a220dc](https://github.com/andymai/gridfinity-layout-tool/commit/8a220dc3a14f44a76facf7dcda1e815b4d73fc83))

## [4.108.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.107.0...gridfinity-layout-tool-v4.108.0) (2026-05-20)

### Features

- **generation:** adopt brepjs cutAllBisect/fuseAllBisect (step 3 of [#1792](https://github.com/andymai/gridfinity-layout-tool/issues/1792)) ([#1795](https://github.com/andymai/gridfinity-layout-tool/issues/1795)) ([3685d02](https://github.com/andymai/gridfinity-layout-tool/commit/3685d027094f8b338dce6bf96f56d43d7e2f18c5))

## [4.107.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.106.0...gridfinity-layout-tool-v4.107.0) (2026-05-20)

### Features

- **analytics:** instrument boolean batch fallbacks (step 1 of [#1792](https://github.com/andymai/gridfinity-layout-tool/issues/1792)) ([#1793](https://github.com/andymai/gridfinity-layout-tool/issues/1793)) ([e56ebe7](https://github.com/andymai/gridfinity-layout-tool/commit/e56ebe76d70d384cf39c660a6db2dfd22c58a64b))

## [4.106.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.105.2...gridfinity-layout-tool-v4.106.0) (2026-05-20)

### Features

- **analytics:** emit per-cache hit rates in generation_cache_stats ([#1790](https://github.com/andymai/gridfinity-layout-tool/issues/1790)) ([2e40752](https://github.com/andymai/gridfinity-layout-tool/commit/2e40752d2018b76c4bf0fb07887bef3f6ba53156))

## [4.105.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.105.1...gridfinity-layout-tool-v4.105.2) (2026-05-20)

### Bug Fixes

- **settings:** tighten physical unit bounds and add reset ([#1787](https://github.com/andymai/gridfinity-layout-tool/issues/1787)) ([0c2631f](https://github.com/andymai/gridfinity-layout-tool/commit/0c2631f5ae4180fb1cf1869f760b36bd3cce368b))

## [4.105.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.105.0...gridfinity-layout-tool-v4.105.1) (2026-05-20)

### Bug Fixes

- **layout-library:** always show card actions in grid view ([#1784](https://github.com/andymai/gridfinity-layout-tool/issues/1784)) ([5e88e2c](https://github.com/andymai/gridfinity-layout-tool/commit/5e88e2c122a9b9b50ad851ef7ade4c9b6d31fde3))

## [4.105.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.104.0...gridfinity-layout-tool-v4.105.0) (2026-05-19)

### Features

- **bin-designer:** background thumbnail regeneration on app boot ([#1770](https://github.com/andymai/gridfinity-layout-tool/issues/1770)) ([c097bb7](https://github.com/andymai/gridfinity-layout-tool/commit/c097bb7f2fd7d09560407b6a0d6c92a11b5e6cab))

### Bug Fixes

- **bin-designer:** set index buffer on offscreen thumbnail geometry ([#1769](https://github.com/andymai/gridfinity-layout-tool/issues/1769)) ([6ef0348](https://github.com/andymai/gridfinity-layout-tool/commit/6ef0348a5ba7b0ef11a6ccb9d8bdc4ad029100a9))

## [4.104.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.103.0...gridfinity-layout-tool-v4.104.0) (2026-05-19)

### Features

- **lid:** granular per-side rail conflicts + Fix UX ([#1767](https://github.com/andymai/gridfinity-layout-tool/issues/1767)) ([c84a269](https://github.com/andymai/gridfinity-layout-tool/commit/c84a2698c4ea9c5566f607f537f6dde6e3fae4c5))

## [4.103.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.102.0...gridfinity-layout-tool-v4.103.0) (2026-05-19)

### Features

- **seo:** planner-led title + internal linking + structured-data polish ([#1764](https://github.com/andymai/gridfinity-layout-tool/issues/1764)) ([a24ab78](https://github.com/andymai/gridfinity-layout-tool/commit/a24ab78df2a148270f4a45ba3450a5fefb813d5c))

### Bug Fixes

- **generation:** bypass OCCT STL writer for split-bin pieces ([#1760](https://github.com/andymai/gridfinity-layout-tool/issues/1760)) ([#1765](https://github.com/andymai/gridfinity-layout-tool/issues/1765)) ([411ba58](https://github.com/andymai/gridfinity-layout-tool/commit/411ba587db8f684db807ec94ac4701ef18bf5aba))

## [4.102.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.101.5...gridfinity-layout-tool-v4.102.0) (2026-05-19)

### Features

- **half-grid:** rename half-bin → half-grid, couple to halfSockets ([#1752](https://github.com/andymai/gridfinity-layout-tool/issues/1752)) ([#1762](https://github.com/andymai/gridfinity-layout-tool/issues/1762)) ([1cf920f](https://github.com/andymai/gridfinity-layout-tool/commit/1cf920fd7d0531064c186940d010b09f62167490))

## [4.101.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.101.4...gridfinity-layout-tool-v4.101.5) (2026-05-19)

### Bug Fixes

- **export:** translate brepjs export Err to a user-readable message ([#1757](https://github.com/andymai/gridfinity-layout-tool/issues/1757)) ([#1759](https://github.com/andymai/gridfinity-layout-tool/issues/1759)) ([a179a14](https://github.com/andymai/gridfinity-layout-tool/commit/a179a14349604ce61399cc10df75423f315d90bf))

## [4.101.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.101.3...gridfinity-layout-tool-v4.101.4) (2026-05-19)

### Bug Fixes

- **generation:** build compartmented bins as multi-cavity cut ([#1753](https://github.com/andymai/gridfinity-layout-tool/issues/1753)) ([#1756](https://github.com/andymai/gridfinity-layout-tool/issues/1756)) ([19497f8](https://github.com/andymai/gridfinity-layout-tool/commit/19497f8545da5b8b3691742cefeb1bec1c37e115))

## [4.101.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.101.2...gridfinity-layout-tool-v4.101.3) (2026-05-18)

### Bug Fixes

- **help:** surface print-bed help in designer and baseplate modes ([#1750](https://github.com/andymai/gridfinity-layout-tool/issues/1750)) ([1feb2ad](https://github.com/andymai/gridfinity-layout-tool/commit/1feb2ad72fb80a587ef0931714e3478c9e78001c))

## [4.101.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.101.1...gridfinity-layout-tool-v4.101.2) (2026-05-18)

### Bug Fixes

- **smoke:** raise /version.json timeout to 30s ([#1748](https://github.com/andymai/gridfinity-layout-tool/issues/1748)) ([45efda8](https://github.com/andymai/gridfinity-layout-tool/commit/45efda8f62b075ef0f5c4d1975d63d52e9e5d957))

## [4.101.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.101.0...gridfinity-layout-tool-v4.101.1) (2026-05-18)

### Bug Fixes

- **test:** route dispatcher test to jsdom env ([#1746](https://github.com/andymai/gridfinity-layout-tool/issues/1746)) ([6184bf0](https://github.com/andymai/gridfinity-layout-tool/commit/6184bf084b7620519f25a037fd9caa8bcd4138b2))

## [4.101.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.100.0...gridfinity-layout-tool-v4.101.0) (2026-05-18)

### Features

- **help:** mode-aware search + bin-designer catalog ([#1744](https://github.com/andymai/gridfinity-layout-tool/issues/1744)) ([62f3ad2](https://github.com/andymai/gridfinity-layout-tool/commit/62f3ad2afb805c1efc65af70aafab75ce4d50db9))

## [4.100.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.99.0...gridfinity-layout-tool-v4.100.0) (2026-05-18)

### Features

- **help:** ⌘K initialQuery + empty-state CTA + telemetry ([#1742](https://github.com/andymai/gridfinity-layout-tool/issues/1742)) ([2fff8f1](https://github.com/andymai/gridfinity-layout-tool/commit/2fff8f1108ef9f7ba50559dc643479342e470367))

## [4.99.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.98.0...gridfinity-layout-tool-v4.99.0) (2026-05-18)

### Features

- **help:** add unified search to MobileHelpModal ([#1740](https://github.com/andymai/gridfinity-layout-tool/issues/1740)) ([f3abb16](https://github.com/andymai/gridfinity-layout-tool/commit/f3abb1611047b57d5a1b7a6e3f10a5a0b232d363))
- **help:** expand catalog with 5 sidebar entries ([#1739](https://github.com/andymai/gridfinity-layout-tool/issues/1739)) ([225bf02](https://github.com/andymai/gridfinity-layout-tool/commit/225bf02ae3c57218df7de3460e26c99a579ad7fb))

## [4.98.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.97.0...gridfinity-layout-tool-v4.98.0) (2026-05-18)

### Features

- **help:** natural-language search across shortcuts + features + settings ([#1737](https://github.com/andymai/gridfinity-layout-tool/issues/1737)) ([d88b7eb](https://github.com/andymai/gridfinity-layout-tool/commit/d88b7eb87bf9c227683f2e484b1e9fb29fafc65b))

## [4.97.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.96.0...gridfinity-layout-tool-v4.97.0) (2026-05-18)

### Features

- **seo:** migrate /gridfinity-generator to markdown + localize for 8 locales ([#1735](https://github.com/andymai/gridfinity-layout-tool/issues/1735)) ([a596043](https://github.com/andymai/gridfinity-layout-tool/commit/a596043387ee7f310c90261ed07950ab048257d4))

## [4.96.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.95.1...gridfinity-layout-tool-v4.96.0) (2026-05-18)

### Features

- **seo:** add language switcher to nav on every content page ([#1733](https://github.com/andymai/gridfinity-layout-tool/issues/1733)) ([a150395](https://github.com/andymai/gridfinity-layout-tool/commit/a150395e5ca52017370e70d56fab52ddc47bdfd1))

## [4.95.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.95.0...gridfinity-layout-tool-v4.95.1) (2026-05-18)

### Bug Fixes

- **seo:** broken locale-root links (logo, CTA, breadcrumb home, body CTAs) ([#1731](https://github.com/andymai/gridfinity-layout-tool/issues/1731)) ([7981a77](https://github.com/andymai/gridfinity-layout-tool/commit/7981a77819e47e680fc2c2b0106615e3b1549a7f))

## [4.95.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.94.0...gridfinity-layout-tool-v4.95.0) (2026-05-18)

### Features

- **seo:** add phase-2 locales (nl, sv, nb, uk) for all content pages ([#1728](https://github.com/andymai/gridfinity-layout-tool/issues/1728)) ([c07887d](https://github.com/andymai/gridfinity-layout-tool/commit/c07887def376eceb0abed7f2ad4b95dcc57c9189))

## [4.94.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.93.0...gridfinity-layout-tool-v4.94.0) (2026-05-18)

### Features

- **seo:** localize generator pages for de/fr/es/pt-BR ([#1725](https://github.com/andymai/gridfinity-layout-tool/issues/1725)) ([43684bb](https://github.com/andymai/gridfinity-layout-tool/commit/43684bb3b61ecf23c910b9273aaa0c53a5b2c8f4))

## [4.93.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.92.0...gridfinity-layout-tool-v4.93.0) (2026-05-18)

### Features

- **seo:** emit googlebot/bingbot meta on all generated content pages ([#1723](https://github.com/andymai/gridfinity-layout-tool/issues/1723)) ([f9ec62e](https://github.com/andymai/gridfinity-layout-tool/commit/f9ec62ecd05ae991c4b70fce44b5b69ad4dc8a22))

### Bug Fixes

- **seo:** address Copilot review on build-content.ts ([#1720](https://github.com/andymai/gridfinity-layout-tool/issues/1720)) ([aa41316](https://github.com/andymai/gridfinity-layout-tool/commit/aa41316e41066abeb130bbdde74e1ca19ca1248a))

## [4.92.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.91.0...gridfinity-layout-tool-v4.92.0) (2026-05-18)

### Features

- **seo:** migrate hand-crafted pages to markdown-driven pipeline ([#1717](https://github.com/andymai/gridfinity-layout-tool/issues/1717)) ([8ce9fdf](https://github.com/andymai/gridfinity-layout-tool/commit/8ce9fdffa23c7b1aeb948416044413dc3aacb21c))

## [4.91.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.90.0...gridfinity-layout-tool-v4.91.0) (2026-05-18)

### Features

- **seo:** add de/fr/es/pt-BR locales for /what-is-gridfinity and /guide ([#1714](https://github.com/andymai/gridfinity-layout-tool/issues/1714)) ([b2e2c66](https://github.com/andymai/gridfinity-layout-tool/commit/b2e2c66c6769ec574c30d7a1a70787367597eef2))

## [4.90.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.89.0...gridfinity-layout-tool-v4.90.0) (2026-05-18)

### Features

- **seo:** add FAQPage and BreadcrumbList schema to /guide and /what-is-gridfinity ([#1711](https://github.com/andymai/gridfinity-layout-tool/issues/1711)) ([d846fe1](https://github.com/andymai/gridfinity-layout-tool/commit/d846fe13dba2eaecb1c023ee5e4d23b81ee38bf3))

## [4.89.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.88.4...gridfinity-layout-tool-v4.89.0) (2026-05-17)

### Features

- sync-admin CLI for blob/index integrity audits ([#1708](https://github.com/andymai/gridfinity-layout-tool/issues/1708)) ([c9d39ed](https://github.com/andymai/gridfinity-layout-tool/commit/c9d39eddb41aaea7a4c35e74de758d9a9d28f190))

## [4.88.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.88.3...gridfinity-layout-tool-v4.88.4) (2026-05-17)

### Bug Fixes

- **analytics:** filter browser-extension noise from PostHog capture ([#1706](https://github.com/andymai/gridfinity-layout-tool/issues/1706)) ([692eff6](https://github.com/andymai/gridfinity-layout-tool/commit/692eff6a53e2ba81fe267b5129fa502f927cfe66))

## [4.88.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.88.2...gridfinity-layout-tool-v4.88.3) (2026-05-17)

### Bug Fixes

- **lazy:** wrap design-linking dynamic imports with lazyWithRetry ([#1703](https://github.com/andymai/gridfinity-layout-tool/issues/1703)) ([6a46ffb](https://github.com/andymai/gridfinity-layout-tool/commit/6a46ffba8f0bdfb0bce5430f41e0dfd310e21d0a))

## [4.88.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.88.1...gridfinity-layout-tool-v4.88.2) (2026-05-16)

### Bug Fixes

- **sync:** gate manifest pull + outbox flush on authenticated session ([#1701](https://github.com/andymai/gridfinity-layout-tool/issues/1701)) ([9dabcfc](https://github.com/andymai/gridfinity-layout-tool/commit/9dabcfc0b052303e1faa9b5b52028d53b626c91e))

## [4.88.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.88.0...gridfinity-layout-tool-v4.88.1) (2026-05-16)

### Bug Fixes

- **baseplate:** show proactive fallback when WebGL is unavailable ([#1697](https://github.com/andymai/gridfinity-layout-tool/issues/1697)) ([b9ead4e](https://github.com/andymai/gridfinity-layout-tool/commit/b9ead4e638e09674fe00c3856ebcd3286340f3ee))

## [4.88.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.87.3...gridfinity-layout-tool-v4.88.0) (2026-05-16)

### Features

- **labs:** graduate cloud_sync — sign in to sync across devices ([#1693](https://github.com/andymai/gridfinity-layout-tool/issues/1693)) ([f2b48aa](https://github.com/andymai/gridfinity-layout-tool/commit/f2b48aa984477eb5b2978ba9d478dc1586f5c703))

## [4.87.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.87.2...gridfinity-layout-tool-v4.87.3) (2026-05-16)

### Bug Fixes

- **sync:** graduation prep — 10 verified defects ([#1691](https://github.com/andymai/gridfinity-layout-tool/issues/1691)) ([80356ac](https://github.com/andymai/gridfinity-layout-tool/commit/80356ac0e218076b32c6569635583738d7c8bbc8))

## [4.87.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.87.1...gridfinity-layout-tool-v4.87.2) (2026-05-16)

### Bug Fixes

- **sync:** carry design name in cloud payload ([#1689](https://github.com/andymai/gridfinity-layout-tool/issues/1689)) ([638afea](https://github.com/andymai/gridfinity-layout-tool/commit/638afea764969e9ab867a1b7d8b7beaabb7f232f))

## [4.87.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.87.0...gridfinity-layout-tool-v4.87.1) (2026-05-16)

### Bug Fixes

- **bin-designer:** keep material attach intact across multi-color toggle ([#1687](https://github.com/andymai/gridfinity-layout-tool/issues/1687)) ([6c0ecc4](https://github.com/andymai/gridfinity-layout-tool/commit/6c0ecc4c569ae70359f0da9ef1d523895b503e4c))

## [4.87.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.86.3...gridfinity-layout-tool-v4.87.0) (2026-05-16)

### Features

- **bin-designer:** eyedropper + swap tools for multi-color zones ([#1678](https://github.com/andymai/gridfinity-layout-tool/issues/1678)) ([9d22832](https://github.com/andymai/gridfinity-layout-tool/commit/9d22832d0b1cd757244bc034c7d5e2f76f83b2e9))

## [4.86.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.86.2...gridfinity-layout-tool-v4.86.3) (2026-05-16)

### Bug Fixes

- **api,security:** accept solid/flat/fillet enums and drop browsing-topics from Permissions-Policy ([2ccc270](https://github.com/andymai/gridfinity-layout-tool/commit/2ccc270c3ae41e507003bde344f0c5ddc39ae4c9))
- **api,security:** close validator enum gap, tighten CodeQL regex, relax browsing-topics ([#1684](https://github.com/andymai/gridfinity-layout-tool/issues/1684)) ([c52d397](https://github.com/andymai/gridfinity-layout-tool/commit/c52d3971865c28cb5662549b207e2f5b40c73013))
- **scripts:** broaden inline-script closing-tag regex for CodeQL js/bad-tag-filter ([481d7f7](https://github.com/andymai/gridfinity-layout-tool/commit/481d7f76845d8bb63829fcd05bc8d52c3b606fca))

## [4.86.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.86.1...gridfinity-layout-tool-v4.86.2) (2026-05-16)

### Bug Fixes

- **generation:** nudge split cut planes off socket-cell boundaries ([#1681](https://github.com/andymai/gridfinity-layout-tool/issues/1681)) ([bc2a9c1](https://github.com/andymai/gridfinity-layout-tool/commit/bc2a9c1e59b63c2a0d87d399daff88384724fce1))

## [4.86.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.86.0...gridfinity-layout-tool-v4.86.1) (2026-05-16)

### Bug Fixes

- **bin-designer:** roll back per-corner lip UI to a single lip color ([c45f8a8](https://github.com/andymai/gridfinity-layout-tool/commit/c45f8a8f90988f96036b40929932002efdc3d17b))
- **bin-designer:** roll back per-corner lip UI to a single lip color ([#1679](https://github.com/andymai/gridfinity-layout-tool/issues/1679)) ([7254c19](https://github.com/andymai/gridfinity-layout-tool/commit/7254c19e770e4e757f3e7da9447d6c760bc68220))
- **sync,csp:** unblock design sync + tighten CSP for fonts and inline scripts ([#1677](https://github.com/andymai/gridfinity-layout-tool/issues/1677)) ([c35764b](https://github.com/andymai/gridfinity-layout-tool/commit/c35764bec1e17a742816213ec4a1eeee2218a388))

## [4.86.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.85.0...gridfinity-layout-tool-v4.86.0) (2026-05-16)

### Features

- **bin-designer:** graduate multi-color export with per-design toggle ([#1674](https://github.com/andymai/gridfinity-layout-tool/issues/1674)) ([0fa4408](https://github.com/andymai/gridfinity-layout-tool/commit/0fa440891ad6c2ae27ae543e5ab13ebbc325a3d8))

## [4.85.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.84.0...gridfinity-layout-tool-v4.85.0) (2026-05-16)

### Features

- **bin-designer:** comprehensive color-panel UX/UI polish ([#1672](https://github.com/andymai/gridfinity-layout-tool/issues/1672)) ([fd991a5](https://github.com/andymai/gridfinity-layout-tool/commit/fd991a58dec48b8b74695426adaefe29a1f0450a))

## [4.84.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.83.0...gridfinity-layout-tool-v4.84.0) (2026-05-16)

### Features

- **bin-designer:** per-corner lip + base/scoop/dividers color zones ([#1671](https://github.com/andymai/gridfinity-layout-tool/issues/1671)) ([f2ff675](https://github.com/andymai/gridfinity-layout-tool/commit/f2ff675852f18f022c9a28c76d11ed00d741f252))
- **bin-designer:** redesign multi-color panel + fix popover anchor ([#1669](https://github.com/andymai/gridfinity-layout-tool/issues/1669)) ([8de3bab](https://github.com/andymai/gridfinity-layout-tool/commit/8de3bab857bc116d620d809447600eef7ccd0372))

## [4.83.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.82.2...gridfinity-layout-tool-v4.83.0) (2026-05-16)

### Features

- **baseplate:** snap-clip connector style alongside dovetails ([#1611](https://github.com/andymai/gridfinity-layout-tool/issues/1611)) ([9e2127f](https://github.com/andymai/gridfinity-layout-tool/commit/9e2127f40198199531e91608bb5b1333e954ae8b))

## [4.82.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.82.1...gridfinity-layout-tool-v4.82.2) (2026-05-16)

### Bug Fixes

- **sync:** accept the generateDesignId shape on the designer sync route ([#1664](https://github.com/andymai/gridfinity-layout-tool/issues/1664)) ([6c8d5bf](https://github.com/andymai/gridfinity-layout-tool/commit/6c8d5bf0e29f2e607c0f942624239504d2addbb7))

## [4.82.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.82.0...gridfinity-layout-tool-v4.82.1) (2026-05-15)

### Bug Fixes

- **generation:** propagate face tags via setShapeOrigin so multi-color export works ([#1662](https://github.com/andymai/gridfinity-layout-tool/issues/1662)) ([476b1e2](https://github.com/andymai/gridfinity-layout-tool/commit/476b1e29db1250a4a60cee4c67fcdfa36d419af8))

## [4.82.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.81.2...gridfinity-layout-tool-v4.82.0) (2026-05-15)

### Features

- **cutouts:** split scoop into per-axis radii with per-edge toggles ([#1660](https://github.com/andymai/gridfinity-layout-tool/issues/1660)) ([1a00899](https://github.com/andymai/gridfinity-layout-tool/commit/1a00899427ac7d4a9bc8aad667b4b81e3db2b57b))

## [4.81.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.81.1...gridfinity-layout-tool-v4.81.2) (2026-05-15)

### Bug Fixes

- **generation:** cut lid magnet holes before fusing stack grid ([#1657](https://github.com/andymai/gridfinity-layout-tool/issues/1657)) ([68f3a1a](https://github.com/andymai/gridfinity-layout-tool/commit/68f3a1a4fca9d934ebd6c24a1290c45b585f57c8))

## [4.81.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.81.0...gridfinity-layout-tool-v4.81.1) (2026-05-15)

### Bug Fixes

- **generation:** cut divider notches through lip in split slotted bins ([#1653](https://github.com/andymai/gridfinity-layout-tool/issues/1653)) ([6051fc0](https://github.com/andymai/gridfinity-layout-tool/commit/6051fc04aa20757e83e283e3cdcc3e83fed5fe8e))

## [4.81.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.80.0...gridfinity-layout-tool-v4.81.0) (2026-05-13)

### Features

- **baseplate:** rotational-symmetric split pieces ([#1648](https://github.com/andymai/gridfinity-layout-tool/issues/1648)) ([bdd00c0](https://github.com/andymai/gridfinity-layout-tool/commit/bdd00c0677527d0c4263b5a8112a322a85720aab))

## [4.80.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.79.1...gridfinity-layout-tool-v4.80.0) (2026-05-13)

### Features

- **baseplate:** auto-stack copies of each part in 3MF export ([#1646](https://github.com/andymai/gridfinity-layout-tool/issues/1646)) ([26e9c9b](https://github.com/andymai/gridfinity-layout-tool/commit/26e9c9b154e91360d10d1ad43975afa85e4f7750))

## [4.79.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.79.0...gridfinity-layout-tool-v4.79.1) (2026-05-13)

### Bug Fixes

- **bin-designer:** scale SVG imports to physical units and curve-aware bounds ([#1644](https://github.com/andymai/gridfinity-layout-tool/issues/1644)) ([34a0c7b](https://github.com/andymai/gridfinity-layout-tool/commit/34a0c7bac707795491d17ea6d0af79a601a508b1))

## [4.79.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.78.1...gridfinity-layout-tool-v4.79.0) (2026-05-11)

### Features

- **cutout-editor:** rewrite quickstart overlay with action-driving copy ([#1631](https://github.com/andymai/gridfinity-layout-tool/issues/1631)) ([3229a53](https://github.com/andymai/gridfinity-layout-tool/commit/3229a5347a58cf672a1bb44660d745d0da3913ca))

## [4.78.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.78.0...gridfinity-layout-tool-v4.78.1) (2026-05-11)

### Bug Fixes

- **bin-recommender:** apply Copilot review feedback from PR [#1627](https://github.com/andymai/gridfinity-layout-tool/issues/1627) ([#1629](https://github.com/andymai/gridfinity-layout-tool/issues/1629)) ([86a2d57](https://github.com/andymai/gridfinity-layout-tool/commit/86a2d57e3c05866b1350471774a684cf8e36b918))

## [4.78.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.77.0...gridfinity-layout-tool-v4.78.0) (2026-05-11)

### Features

- **bin-recommender:** pure-function library + Python training pipeline ([#1627](https://github.com/andymai/gridfinity-layout-tool/issues/1627)) ([7b3d440](https://github.com/andymai/gridfinity-layout-tool/commit/7b3d440b922b9ab695ee73d8986090ab49dd5659))

## [4.77.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.76.0...gridfinity-layout-tool-v4.77.0) (2026-05-11)

### Features

- **ml-telemetry:** emit per-label sizes on high-quality snapshots ([#1625](https://github.com/andymai/gridfinity-layout-tool/issues/1625)) ([1c0dd85](https://github.com/andymai/gridfinity-layout-tool/commit/1c0dd85edbf02995a0473a7083984dad0ea30dd1))

## [4.76.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.75.0...gridfinity-layout-tool-v4.76.0) (2026-05-09)

### Features

- **sync:** wire Delete account UI; meet Google OAuth brand verification ([#1622](https://github.com/andymai/gridfinity-layout-tool/issues/1622)) ([b7c2890](https://github.com/andymai/gridfinity-layout-tool/commit/b7c28906a3097e14d958db288f7471a0352f7919))

## [4.75.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.74.0...gridfinity-layout-tool-v4.75.0) (2026-05-09)

### Features

- **auth:** teach the dock that anonymous is a real mode ([#1620](https://github.com/andymai/gridfinity-layout-tool/issues/1620)) ([6647284](https://github.com/andymai/gridfinity-layout-tool/commit/6647284209ad8b7771122eb4e42f8c9cdce8c246))

## [4.74.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.73.1...gridfinity-layout-tool-v4.74.0) (2026-05-09)

### Features

- **auth:** modern UserDock in every sidebar; new Account tab ([#1618](https://github.com/andymai/gridfinity-layout-tool/issues/1618)) ([9a93bc3](https://github.com/andymai/gridfinity-layout-tool/commit/9a93bc349fb69587acede3afcda65ccf2fa8f167))

## [4.73.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.73.0...gridfinity-layout-tool-v4.73.1) (2026-05-08)

### Bug Fixes

- **analytics:** use posthog.captureException for valid $exception_list schema ([#1616](https://github.com/andymai/gridfinity-layout-tool/issues/1616)) ([7bfae55](https://github.com/andymai/gridfinity-layout-tool/commit/7bfae5547e8dcdc5b96667a509ff1c705be87082))

## [4.73.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.72.1...gridfinity-layout-tool-v4.73.0) (2026-05-08)

### Features

- **sync:** replace SYNC_UI_ENABLED build gate with cloud_sync Labs flag ([#1605](https://github.com/andymai/gridfinity-layout-tool/issues/1605)) ([f7d5a1d](https://github.com/andymai/gridfinity-layout-tool/commit/f7d5a1d3f4a7a3a1a95be11325900b3c96c32858))

## [4.72.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.72.0...gridfinity-layout-tool-v4.72.1) (2026-05-08)

### Bug Fixes

- **labs:** render EngineSelector in Settings → Labs tab ([#1608](https://github.com/andymai/gridfinity-layout-tool/issues/1608)) ([d554daf](https://github.com/andymai/gridfinity-layout-tool/commit/d554dafac584e37fe88db18085771423fdcc7daf))

## [4.72.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.71.0...gridfinity-layout-tool-v4.72.0) (2026-05-08)

### Features

- **labs:** segmented control for 3D engine selection ([#1606](https://github.com/andymai/gridfinity-layout-tool/issues/1606)) ([c25eeca](https://github.com/andymai/gridfinity-layout-tool/commit/c25eeca49110580eaa9cddd77bb9b7d38ebee765))

## [4.71.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.70.0...gridfinity-layout-tool-v4.71.0) (2026-05-08)

### Features

- **sync:** claim flow + explicit sign-out ([#1603](https://github.com/andymai/gridfinity-layout-tool/issues/1603)) ([b748c37](https://github.com/andymai/gridfinity-layout-tool/commit/b748c377162feaee0c8c4611414a36f2841a26f7))

## [4.70.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.69.0...gridfinity-layout-tool-v4.70.0) (2026-05-07)

### Features

- **sync:** boot wiring + offline toast + i18n (PR 4d) ([#1598](https://github.com/andymai/gridfinity-layout-tool/issues/1598)) ([37498d6](https://github.com/andymai/gridfinity-layout-tool/commit/37498d68adcc4539c45be83f4a754207554af521))

## [4.69.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.68.0...gridfinity-layout-tool-v4.69.0) (2026-05-07)

### Features

- **sync:** poller + periodic-poll trigger (PR 4c) ([#1597](https://github.com/andymai/gridfinity-layout-tool/issues/1597)) ([eb29f3d](https://github.com/andymai/gridfinity-layout-tool/commit/eb29f3dac4c59870d6b4507b2022b1b287fdde8d))

## [4.68.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.67.0...gridfinity-layout-tool-v4.68.0) (2026-05-07)

### Features

- **sync:** engine + DesignAdapter + push triggers (PR 4b) ([#1596](https://github.com/andymai/gridfinity-layout-tool/issues/1596)) ([693dd2a](https://github.com/andymai/gridfinity-layout-tool/commit/693dd2a19c724f0b15414b5ccf58fea5edad86bf))

## [4.67.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.66.0...gridfinity-layout-tool-v4.67.0) (2026-05-07)

### Features

- **sync:** client engine foundation — adapters, outbox, status store ([#1595](https://github.com/andymai/gridfinity-layout-tool/issues/1595)) ([ac2fa77](https://github.com/andymai/gridfinity-layout-tool/commit/ac2fa77341c130bef87fa3482a63cdbddae7b6d5))

## [4.66.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.65.0...gridfinity-layout-tool-v4.66.0) (2026-05-07)

### Features

- **sync:** add server endpoints for layouts/designs/manifest/export/account ([#1593](https://github.com/andymai/gridfinity-layout-tool/issues/1593)) ([0493b6f](https://github.com/andymai/gridfinity-layout-tool/commit/0493b6f045cdfd746e7822ca4e3f166582bc61e8))

## [4.65.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.64.0...gridfinity-layout-tool-v4.65.0) (2026-05-07)

### Features

- **auth:** add OAuth sign-in foundation (Google + GitHub) for sync ([#1591](https://github.com/andymai/gridfinity-layout-tool/issues/1591)) ([226e3f2](https://github.com/andymai/gridfinity-layout-tool/commit/226e3f2a964826a1d487240138bcb5ddd0c76fab))

## [4.64.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.63.0...gridfinity-layout-tool-v4.64.0) (2026-05-06)

### Features

- **result:** add ResultAsync wrapper and preserve unwrap cause ([#1589](https://github.com/andymai/gridfinity-layout-tool/issues/1589)) ([5c52679](https://github.com/andymai/gridfinity-layout-tool/commit/5c526799ecb8b3e10356c2f68a3aab30d70c4b0a))

## [4.63.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.62.1...gridfinity-layout-tool-v4.63.0) (2026-05-06)

### Features

- **i18n:** add Swedish (sv) locale ([#1587](https://github.com/andymai/gridfinity-layout-tool/issues/1587)) ([0c25e6a](https://github.com/andymai/gridfinity-layout-tool/commit/0c25e6a28e930fc382daef2b65c03082bd30b9f4))
- **i18n:** add Ukrainian (uk) locale ([#1585](https://github.com/andymai/gridfinity-layout-tool/issues/1585)) ([e243778](https://github.com/andymai/gridfinity-layout-tool/commit/e2437783b5918db096540930b6a465976b75618a))

## [4.62.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.62.0...gridfinity-layout-tool-v4.62.1) (2026-05-06)

### Bug Fixes

- **api:** security audit fixes (3 MED, 4 LOW) ([#1582](https://github.com/andymai/gridfinity-layout-tool/issues/1582)) ([aecb730](https://github.com/andymai/gridfinity-layout-tool/commit/aecb730720025afd359a69956e442a22fb8e9727))

## [4.62.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.61.0...gridfinity-layout-tool-v4.62.0) (2026-05-05)

### Features

- **generation:** add occt-wasm as opt-in third kernel (parity-verified) ([#1578](https://github.com/andymai/gridfinity-layout-tool/issues/1578)) ([6cd9381](https://github.com/andymai/gridfinity-layout-tool/commit/6cd93814f263f8e2764677b98c278efa691ea02d))

## [4.61.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.60.3...gridfinity-layout-tool-v4.61.0) (2026-05-05)

### Features

- **api:** add storage primitive layer for upcoming sync feature ([#1572](https://github.com/andymai/gridfinity-layout-tool/issues/1572)) ([d50c82b](https://github.com/andymai/gridfinity-layout-tool/commit/d50c82b2dd510082f956aa456448ba0596d79b3b))

## [4.60.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.60.2...gridfinity-layout-tool-v4.60.3) (2026-05-03)

### Bug Fixes

- **staging:** keep fractional-depth bins inside the stash grid ([#1570](https://github.com/andymai/gridfinity-layout-tool/issues/1570)) ([5517327](https://github.com/andymai/gridfinity-layout-tool/commit/5517327aee9aead6dfec18f92b39b508c35a6dae))

## [4.60.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.60.1...gridfinity-layout-tool-v4.60.2) (2026-05-01)

### Bug Fixes

- **baseplate:** scale orbit zoom-out cap to baseplate size ([#1568](https://github.com/andymai/gridfinity-layout-tool/issues/1568)) ([05360c3](https://github.com/andymai/gridfinity-layout-tool/commit/05360c35aa5824f6d5e6241e9476bc62651310f9))

## [4.60.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.60.0...gridfinity-layout-tool-v4.60.1) (2026-05-01)

### Bug Fixes

- **cqrs:** build cqrsMutations lazily to avoid chunk-init undefined bus ([#1563](https://github.com/andymai/gridfinity-layout-tool/issues/1563)) ([cbd8bf7](https://github.com/andymai/gridfinity-layout-tool/commit/cbd8bf7247cd787ce5aba2849cc36366c675bea4)), closes [#1558](https://github.com/andymai/gridfinity-layout-tool/issues/1558)

## [4.60.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.59.0...gridfinity-layout-tool-v4.60.0) (2026-05-01)

### Features

- **cqrs:** migrate remaining 5 library commands to v2 (library complete) ([#1560](https://github.com/andymai/gridfinity-layout-tool/issues/1560)) ([8458ade](https://github.com/andymai/gridfinity-layout-tool/commit/8458ade2154e803eb3e78d921a26984149fea004))

## [4.59.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.58.0...gridfinity-layout-tool-v4.59.0) (2026-05-01)

### Features

- **cqrs:** migrate 5 simpler library commands to v2 (library aggregate) ([#1557](https://github.com/andymai/gridfinity-layout-tool/issues/1557)) ([581ad16](https://github.com/andymai/gridfinity-layout-tool/commit/581ad164a77684e4e887abcf31495aa44e99a24d))

## [4.58.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.57.0...gridfinity-layout-tool-v4.58.0) (2026-05-01)

### Features

- **cqrs:** migrate drawer + 5 layout-metadata commands to v2 ([#1554](https://github.com/andymai/gridfinity-layout-tool/issues/1554)) ([ad46338](https://github.com/andymai/gridfinity-layout-tool/commit/ad46338ff97ce257cfc7d94a9803b71b1bdab6b7))

## [4.57.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.56.0...gridfinity-layout-tool-v4.57.0) (2026-05-01)

### Features

- **cqrs:** migrate category commands to v2 defineCommand ([#1552](https://github.com/andymai/gridfinity-layout-tool/issues/1552)) ([8b07781](https://github.com/andymai/gridfinity-layout-tool/commit/8b07781a6dc83fbe6a5fe25d1eac6bd955ce5fb6))

## [4.56.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.55.0...gridfinity-layout-tool-v4.56.0) (2026-05-01)

### Features

- **cqrs:** migrate layer commands to v2 defineCommand ([#1550](https://github.com/andymai/gridfinity-layout-tool/issues/1550)) ([fb32fe8](https://github.com/andymai/gridfinity-layout-tool/commit/fb32fe8d2b61d71dd01e5fa9894d7dc8d770fb4d))

## [4.55.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.54.0...gridfinity-layout-tool-v4.55.0) (2026-05-01)

### Features

- **cqrs:** migrate fill commands to v2; delete \_fillMeta side-channel ([#1548](https://github.com/andymai/gridfinity-layout-tool/issues/1548)) ([e030619](https://github.com/andymai/gridfinity-layout-tool/commit/e03061902d181f616ac7278336240bd2c7d9c124))

## [4.54.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.53.0...gridfinity-layout-tool-v4.54.0) (2026-05-01)

### Features

- **cqrs:** migrate bin.duplicate + bin.moveFromStaging to v2 ([#1546](https://github.com/andymai/gridfinity-layout-tool/issues/1546)) ([9918455](https://github.com/andymai/gridfinity-layout-tool/commit/99184557eae7f829b15e925760bc83e875da2f20))

## [4.53.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.52.0...gridfinity-layout-tool-v4.53.0) (2026-05-01)

### Features

- **cqrs:** migrate 5 simpler bin commands to v2 defineCommand ([#1544](https://github.com/andymai/gridfinity-layout-tool/issues/1544)) ([1fd34c4](https://github.com/andymai/gridfinity-layout-tool/commit/1fd34c460d72acd430a498a913c1330b8ada60e6))

## [4.52.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.51.2...gridfinity-layout-tool-v4.52.0) (2026-05-01)

### Features

- **cqrs:** v2 defineCommand foundations + type-inference tests ([#1539](https://github.com/andymai/gridfinity-layout-tool/issues/1539)) ([c445587](https://github.com/andymai/gridfinity-layout-tool/commit/c445587354c449f96b3c260986de5d1079b2ef84))

## [4.51.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.51.1...gridfinity-layout-tool-v4.51.2) (2026-05-01)

### Bug Fixes

- **analytics:** trackers follow-up review fixes ([#1522](https://github.com/andymai/gridfinity-layout-tool/issues/1522)) ([59f09da](https://github.com/andymai/gridfinity-layout-tool/commit/59f09da0581286ace95e3f1a23fbc5f2d65cd1d9))

## [4.51.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.51.0...gridfinity-layout-tool-v4.51.1) (2026-05-01)

### Bug Fixes

- **shell:** address mobile cloud-share follow-up review comments ([#1519](https://github.com/andymai/gridfinity-layout-tool/issues/1519)) ([7e6d093](https://github.com/andymai/gridfinity-layout-tool/commit/7e6d093df7474a660bb416dca6638a089f3d2d41))

## [4.51.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.50.0...gridfinity-layout-tool-v4.51.0) (2026-04-29)

### Features

- **bin-designer:** harden bin export against intermittent worker failures ([#1511](https://github.com/andymai/gridfinity-layout-tool/issues/1511)) ([54443be](https://github.com/andymai/gridfinity-layout-tool/commit/54443bed793db332bbfe16ae018d35f8bbd8d9eb))

## [4.50.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.49.5...gridfinity-layout-tool-v4.50.0) (2026-04-29)

### Features

- **bin-designer:** add click-lock lid as bin companion piece ([#1509](https://github.com/andymai/gridfinity-layout-tool/issues/1509)) ([7410e6e](https://github.com/andymai/gridfinity-layout-tool/commit/7410e6ee2c0f9c3a371e47a94474635f61121b2c))

## [4.49.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.49.4...gridfinity-layout-tool-v4.49.5) (2026-04-27)

### Bug Fixes

- **baseplate:** split planner reserves bed budget for dovetail tongues ([#1498](https://github.com/andymai/gridfinity-layout-tool/issues/1498)) ([#1499](https://github.com/andymai/gridfinity-layout-tool/issues/1499)) ([bb5e23f](https://github.com/andymai/gridfinity-layout-tool/commit/bb5e23f2d3aae9e674e9aa9fd063ce0903e89b12))

## [4.49.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.49.3...gridfinity-layout-tool-v4.49.4) (2026-04-27)

### Bug Fixes

- **baseplate:** repair mesh winding before STL export ([#1490](https://github.com/andymai/gridfinity-layout-tool/issues/1490)) ([#1493](https://github.com/andymai/gridfinity-layout-tool/issues/1493)) ([6a4270b](https://github.com/andymai/gridfinity-layout-tool/commit/6a4270b97c9c021ae9f7d09b8488a9556c14ffb1))

## [4.49.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.49.2...gridfinity-layout-tool-v4.49.3) (2026-04-26)

### Bug Fixes

- **generation:** restore angled support beneath stacking lip overhang ([#1491](https://github.com/andymai/gridfinity-layout-tool/issues/1491)) ([dc0e7d3](https://github.com/andymai/gridfinity-layout-tool/commit/dc0e7d3b143983551441bc0c658be88a2f7c7e32))
- **stryker:** exclude **dual-kernel** from mutation set ([#1488](https://github.com/andymai/gridfinity-layout-tool/issues/1488)) ([133a09b](https://github.com/andymai/gridfinity-layout-tool/commit/133a09b9a0394311cd250a83e07c0462f92dd116))

## [4.49.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.49.1...gridfinity-layout-tool-v4.49.2) (2026-04-26)

### Bug Fixes

- **ci:** unblock nightly mutation testing — bump dry-run timeout + cache hygiene ([#1482](https://github.com/andymai/gridfinity-layout-tool/issues/1482)) ([6aee4f8](https://github.com/andymai/gridfinity-layout-tool/commit/6aee4f89e3ee3df26f513ac1dbfd0f335cbae19f))

## [4.49.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.49.0...gridfinity-layout-tool-v4.49.1) (2026-04-26)

### Performance

- **baseplate:** instant direct-mesh preview while BREP runs ([#1450](https://github.com/andymai/gridfinity-layout-tool/issues/1450)) ([2a8cb8a](https://github.com/andymai/gridfinity-layout-tool/commit/2a8cb8a40ec58cebaa6fbaff59f2fb511e09bf8f))

## [4.49.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.48.1...gridfinity-layout-tool-v4.49.0) (2026-04-26)

### Features

- **pwa:** add tier-2 client-side update smoke gate ([#1479](https://github.com/andymai/gridfinity-layout-tool/issues/1479)) ([2b6b4a1](https://github.com/andymai/gridfinity-layout-tool/commit/2b6b4a1a732d40ba4af789a245976d82b10aebd1))

## [4.48.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.48.0...gridfinity-layout-tool-v4.48.1) (2026-04-26)

### Bug Fixes

- **pwa:** repair post-promote smoke + revert README smoke section ([#1477](https://github.com/andymai/gridfinity-layout-tool/issues/1477)) ([6f301b6](https://github.com/andymai/gridfinity-layout-tool/commit/6f301b6cdc01582f7519f7d50ed1330665f8e347))

## [4.48.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.47.9...gridfinity-layout-tool-v4.48.0) (2026-04-26)

### Features

- **pwa:** add tier-1 update smoke gate (CI) ([#1475](https://github.com/andymai/gridfinity-layout-tool/issues/1475)) ([2ef144b](https://github.com/andymai/gridfinity-layout-tool/commit/2ef144baf69c1ca7c7b49f6f100f32405291ff27))

## [4.47.9](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.47.8...gridfinity-layout-tool-v4.47.9) (2026-04-26)

### Bug Fixes

- **baseplate:** solid-infill slicing — broken STL winding heuristic ([#1472](https://github.com/andymai/gridfinity-layout-tool/issues/1472)) ([#1473](https://github.com/andymai/gridfinity-layout-tool/issues/1473)) ([32f89cf](https://github.com/andymai/gridfinity-layout-tool/commit/32f89cf0fb842d24cabd0c2849dfb69b249cc00a))

## [4.47.8](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.47.7...gridfinity-layout-tool-v4.47.8) (2026-04-26)

### Bug Fixes

- **analytics:** defer DEFAULT_CATEGORIES read to avoid blank-page on boot ([#1467](https://github.com/andymai/gridfinity-layout-tool/issues/1467)) ([600573a](https://github.com/andymai/gridfinity-layout-tool/commit/600573a2024f60388e1eae86d099288e9a57d119))

## [4.47.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.47.6...gridfinity-layout-tool-v4.47.7) (2026-04-25)

### Bug Fixes

- **baseplate:** editable input fields for all padding steppers ([#1451](https://github.com/andymai/gridfinity-layout-tool/issues/1451)) ([6579fbb](https://github.com/andymai/gridfinity-layout-tool/commit/6579fbb00701cad2d1533aa3f7a7c0707fde9f06))

## [4.47.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.47.5...gridfinity-layout-tool-v4.47.6) (2026-04-24)

### Bug Fixes

- **generation:** respect custom heightUnitMm in bin export ([#1448](https://github.com/andymai/gridfinity-layout-tool/issues/1448)) ([dcd3fac](https://github.com/andymai/gridfinity-layout-tool/commit/dcd3fac8c4b0409ab5c3c237a33609c8042b3208))

## [4.47.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.47.4...gridfinity-layout-tool-v4.47.5) (2026-04-24)

### Bug Fixes

- **baseplate:** complexity-aware generation timeout + tagged boolean errors ([#1446](https://github.com/andymai/gridfinity-layout-tool/issues/1446)) ([c05e9ac](https://github.com/andymai/gridfinity-layout-tool/commit/c05e9aca2718b9b9236b6844fc9cba9cba76d711))

## [4.47.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.47.3...gridfinity-layout-tool-v4.47.4) (2026-04-22)

### Performance

- **generation:** speed up custom-shape bin regen ([#1442](https://github.com/andymai/gridfinity-layout-tool/issues/1442)) ([cf2f08f](https://github.com/andymai/gridfinity-layout-tool/commit/cf2f08fb18fe928e31a02e96c7c77c7b4d94f094))

## [4.47.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.47.2...gridfinity-layout-tool-v4.47.3) (2026-04-22)

### Bug Fixes

- **geometry,hooks:** wall pattern mirror + divider overlap + subscription consolidation ([#1437](https://github.com/andymai/gridfinity-layout-tool/issues/1437)) ([25c1d08](https://github.com/andymai/gridfinity-layout-tool/commit/25c1d08000e4c5fe766c068f8766b7292e928942))

## [4.47.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.47.1...gridfinity-layout-tool-v4.47.2) (2026-04-22)

### Bug Fixes

- **collab:** race + stale closure + remote-undo absorption ([#1436](https://github.com/andymai/gridfinity-layout-tool/issues/1436)) ([0154477](https://github.com/andymai/gridfinity-layout-tool/commit/01544770f679ceae73ab456a6a17f5ecd4f5724d))

## [4.47.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.47.0...gridfinity-layout-tool-v4.47.1) (2026-04-22)

### Bug Fixes

- **storage:** address review findings from [#1432](https://github.com/andymai/gridfinity-layout-tool/issues/1432) ([#1434](https://github.com/andymai/gridfinity-layout-tool/issues/1434)) ([6b137c2](https://github.com/andymai/gridfinity-layout-tool/commit/6b137c29a661b71e7f084438ea57d3860a1d74cf))
- **storage:** four atomicity bugs that leak data or corrupt state ([#1432](https://github.com/andymai/gridfinity-layout-tool/issues/1432)) ([5db2c13](https://github.com/andymai/gridfinity-layout-tool/commit/5db2c13dc63500c23e4cd7facc6ac9305520ec37))

## [4.47.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.46.1...gridfinity-layout-tool-v4.47.0) (2026-04-21)

### Features

- **baseplate:** unify top panel into single Dimensions section ([#1430](https://github.com/andymai/gridfinity-layout-tool/issues/1430)) ([6475d75](https://github.com/andymai/gridfinity-layout-tool/commit/6475d75023fad50d3fc9c048b9efe62cfc0549b9))

## [4.46.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.46.0...gridfinity-layout-tool-v4.46.1) (2026-04-21)

### Bug Fixes

- stacking lip missing from STL export after split preview ([#1424](https://github.com/andymai/gridfinity-layout-tool/issues/1424)) ([1da4e83](https://github.com/andymai/gridfinity-layout-tool/commit/1da4e837a419482c994d0b3fe666564cbea28be3))

## [4.46.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.45.1...gridfinity-layout-tool-v4.46.0) (2026-04-21)

### Features

- **bin-designer:** polygon-aware wall patterns on custom bin shapes ([#1427](https://github.com/andymai/gridfinity-layout-tool/issues/1427)) ([4be1e7b](https://github.com/andymai/gridfinity-layout-tool/commit/4be1e7ba96751cb19e9b82644b6aa7163bb353b0))

## [4.45.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.45.0...gridfinity-layout-tool-v4.45.1) (2026-04-21)

### Performance

- **bin-designer:** cache split + deferred commits for hex pattern + cutout timeouts ([#1425](https://github.com/andymai/gridfinity-layout-tool/issues/1425)) ([e58de58](https://github.com/andymai/gridfinity-layout-tool/commit/e58de58dc9b10ee3348ec7c855775d4a9db9aff2))

## [4.45.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.44.0...gridfinity-layout-tool-v4.45.0) (2026-04-21)

### Features

- **bin-designer:** polygon-aware handle cutouts on custom bin shapes ([#1422](https://github.com/andymai/gridfinity-layout-tool/issues/1422)) ([622f820](https://github.com/andymai/gridfinity-layout-tool/commit/622f8203853aa505a6870171346031c6b429ef43))

## [4.44.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.43.0...gridfinity-layout-tool-v4.44.0) (2026-04-21)

### Features

- **bin-designer:** polygon-aware wall cutouts on custom bin shapes ([#1420](https://github.com/andymai/gridfinity-layout-tool/issues/1420)) ([a7397b3](https://github.com/andymai/gridfinity-layout-tool/commit/a7397b3f9c396a11d505e7c147edff411ed844a9))

## [4.43.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.42.0...gridfinity-layout-tool-v4.43.0) (2026-04-21)

### Features

- **bin-designer:** mask-aware cutouts for non-rectangular footprints ([#1418](https://github.com/andymai/gridfinity-layout-tool/issues/1418)) ([74fc80b](https://github.com/andymai/gridfinity-layout-tool/commit/74fc80bec982dd425c286abfddfe90e3647f1b6d))

## [4.42.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.41.0...gridfinity-layout-tool-v4.42.0) (2026-04-21)

### Features

- **bin-designer:** shape editor for non-rectangular bin footprints ([#1415](https://github.com/andymai/gridfinity-layout-tool/issues/1415)) ([6982bfe](https://github.com/andymai/gridfinity-layout-tool/commit/6982bfea4c8949a753d5cc4b5101f20b334fb607))

## [4.41.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.40.5...gridfinity-layout-tool-v4.41.0) (2026-04-20)

### Features

- **generation:** support non-rectangular bin footprints via cellMask ([#1386](https://github.com/andymai/gridfinity-layout-tool/issues/1386)) ([2da27ba](https://github.com/andymai/gridfinity-layout-tool/commit/2da27ba527d6aac983c0cdf9932384ce0cdc5894))

## [4.40.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.40.4...gridfinity-layout-tool-v4.40.5) (2026-04-20)

### Bug Fixes

- **baseplate:** overlap dovetail tongue into slab to prevent solid-infill export ([#1411](https://github.com/andymai/gridfinity-layout-tool/issues/1411)) ([d6775bd](https://github.com/andymai/gridfinity-layout-tool/commit/d6775bd60936db41f5943ff1ead15d4e9afa1789))

## [4.40.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.40.3...gridfinity-layout-tool-v4.40.4) (2026-04-20)

### Bug Fixes

- **bin-designer:** split oversized bins into minimum equal pieces ([#1404](https://github.com/andymai/gridfinity-layout-tool/issues/1404)) ([d96b842](https://github.com/andymai/gridfinity-layout-tool/commit/d96b842d16e3fbd90c6cd052fafda5cfab303249)), closes [#1400](https://github.com/andymai/gridfinity-layout-tool/issues/1400)

## [4.40.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.40.2...gridfinity-layout-tool-v4.40.3) (2026-04-20)

### Bug Fixes

- **designer,baseplate:** unclip language dropdown in page headers ([#1402](https://github.com/andymai/gridfinity-layout-tool/issues/1402)) ([a8b1f72](https://github.com/andymai/gridfinity-layout-tool/commit/a8b1f722084f2af52b45b13c6dd407129ef34152)), closes [#1399](https://github.com/andymai/gridfinity-layout-tool/issues/1399)

## [4.40.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.40.1...gridfinity-layout-tool-v4.40.2) (2026-04-19)

### Bug Fixes

- **mutation-testing:** relax vite fs.strict so Stryker sandbox can resolve WASM asset imports ([#1396](https://github.com/andymai/gridfinity-layout-tool/issues/1396)) ([081c0f5](https://github.com/andymai/gridfinity-layout-tool/commit/081c0f5b08656771ce3d03fbaedac08c0d92ba10))

## [4.40.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.40.0...gridfinity-layout-tool-v4.40.1) (2026-04-18)

### Bug Fixes

- **bin-designer:** shrink-to-fit long bin names in 3D preview ([#1390](https://github.com/andymai/gridfinity-layout-tool/issues/1390)) ([615ddf9](https://github.com/andymai/gridfinity-layout-tool/commit/615ddf9aba2bf22f923ab9e70c3decffcc3dd1cf))

## [4.40.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.39.2...gridfinity-layout-tool-v4.40.0) (2026-04-18)

### Features

- **export:** default export format to STL instead of 3MF ([#1388](https://github.com/andymai/gridfinity-layout-tool/issues/1388)) ([404562f](https://github.com/andymai/gridfinity-layout-tool/commit/404562f686ad3c7b35fda84b27b5eba5e96e49ba))

## [4.39.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.39.1...gridfinity-layout-tool-v4.39.2) (2026-04-17)

### Bug Fixes

- **bin-designer:** stop pinch-zoom from snapping camera back to isometric on mobile ([#1384](https://github.com/andymai/gridfinity-layout-tool/issues/1384)) ([4cd4570](https://github.com/andymai/gridfinity-layout-tool/commit/4cd457032a24f22ad6d4c0b8d053b0f7f12ac072))

## [4.39.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.39.0...gridfinity-layout-tool-v4.39.1) (2026-04-16)

### Bug Fixes

- **generation:** use loft for stacking lip on all kernels ([#1380](https://github.com/andymai/gridfinity-layout-tool/issues/1380)) ([a6a5218](https://github.com/andymai/gridfinity-layout-tool/commit/a6a5218d60c388de30bdf5f34f4f4b047cea9627))

## [4.39.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.38.1...gridfinity-layout-tool-v4.39.0) (2026-04-15)

### Features

- add fit-to-page option for print layout ([#1378](https://github.com/andymai/gridfinity-layout-tool/issues/1378)) ([8af52a3](https://github.com/andymai/gridfinity-layout-tool/commit/8af52a3fb1626f957eef7de0e16834671decf017))
- add per-piece dovetail inversion for split baseplates ([#1376](https://github.com/andymai/gridfinity-layout-tool/issues/1376)) ([07f0b60](https://github.com/andymai/gridfinity-layout-tool/commit/07f0b606891dde6771f08c86ea04f66525a4900e))

## [4.38.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.38.0...gridfinity-layout-tool-v4.38.1) (2026-04-15)

### Bug Fixes

- prevent OOM and WASM leaks in baseplate generator ([#1373](https://github.com/andymai/gridfinity-layout-tool/issues/1373)) ([d825a81](https://github.com/andymai/gridfinity-layout-tool/commit/d825a81d57da98d29c88167abf213dec2599abba))

## [4.38.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.11...gridfinity-layout-tool-v4.38.0) (2026-04-13)

### Features

- add animated bin transitions in 3D preview ([#1369](https://github.com/andymai/gridfinity-layout-tool/issues/1369)) ([d4d36a7](https://github.com/andymai/gridfinity-layout-tool/commit/d4d36a77c97f3ae488eeb106cd2173f51f544e79))

## [4.37.11](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.10...gridfinity-layout-tool-v4.37.11) (2026-04-13)

### Bug Fixes

- floor max grid units to 0.5 increments for half-bin mode ([#1361](https://github.com/andymai/gridfinity-layout-tool/issues/1361)) ([97f53dc](https://github.com/andymai/gridfinity-layout-tool/commit/97f53dcbfa75d4ded5531693fef2cbe53ec130fc))

## [4.37.10](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.9...gridfinity-layout-tool-v4.37.10) (2026-04-13)

### Bug Fixes

- harden store mutations, geometry guard, and error handling ([#1358](https://github.com/andymai/gridfinity-layout-tool/issues/1358)) ([523f4ea](https://github.com/andymai/gridfinity-layout-tool/commit/523f4eac96a9fc285f6841a8a04026a32c5b2d1e))

## [4.37.9](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.8...gridfinity-layout-tool-v4.37.9) (2026-04-12)

### Bug Fixes

- **generation:** ensure clip depth covers hex prism extrusion at thick walls ([#1354](https://github.com/andymai/gridfinity-layout-tool/issues/1354)) ([#1355](https://github.com/andymai/gridfinity-layout-tool/issues/1355)) ([8405f57](https://github.com/andymai/gridfinity-layout-tool/commit/8405f577fb332fa541e929c7f304e52aa0bed68c))

## [4.37.8](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.7...gridfinity-layout-tool-v4.37.8) (2026-04-12)

### Bug Fixes

- **generation:** fix honeycomb pattern at divider-wall junctions ([#1351](https://github.com/andymai/gridfinity-layout-tool/issues/1351)) ([cf4c3d2](https://github.com/andymai/gridfinity-layout-tool/commit/cf4c3d2340e0f81472e68e16147f9ec85ec28512))

## [4.37.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.6...gridfinity-layout-tool-v4.37.7) (2026-04-11)

### Bug Fixes

- **generation:** block honeycomb pattern at divider-wall junctions ([#1348](https://github.com/andymai/gridfinity-layout-tool/issues/1348)) ([5ad5336](https://github.com/andymai/gridfinity-layout-tool/commit/5ad53360b21781719716ff6518524fdcc4d618ea))

## [4.37.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.5...gridfinity-layout-tool-v4.37.6) (2026-04-11)

### Bug Fixes

- **bin-designer:** use diameter instead of radius for magnet/screw UI ([#1346](https://github.com/andymai/gridfinity-layout-tool/issues/1346)) ([dbeef9e](https://github.com/andymai/gridfinity-layout-tool/commit/dbeef9e02ac3c891a142a7a622772a76827ee89b))

## [4.37.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.4...gridfinity-layout-tool-v4.37.5) (2026-04-09)

### Bug Fixes

- **generation:** export retry + PostHog telemetry for [#1339](https://github.com/andymai/gridfinity-layout-tool/issues/1339) failures ([#1342](https://github.com/andymai/gridfinity-layout-tool/issues/1342)) ([0eff596](https://github.com/andymai/gridfinity-layout-tool/commit/0eff596eadbdf2c0a78d5b13306c87f7e988c08e))

## [4.37.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.3...gridfinity-layout-tool-v4.37.4) (2026-04-09)

### Bug Fixes

- **generation:** full-fidelity regeneration for exports ([#1339](https://github.com/andymai/gridfinity-layout-tool/issues/1339)) ([#1340](https://github.com/andymai/gridfinity-layout-tool/issues/1340)) ([9b52816](https://github.com/andymai/gridfinity-layout-tool/commit/9b5281690996f1a7fe0cad7651e5ec1ad60048ac))

## [4.37.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.2...gridfinity-layout-tool-v4.37.3) (2026-04-08)

### Bug Fixes

- **generation:** plug remaining WASM leaks in shellStage and dividerExport ([#1336](https://github.com/andymai/gridfinity-layout-tool/issues/1336)) ([2ce7dee](https://github.com/andymai/gridfinity-layout-tool/commit/2ce7dee2d08f220d8543ba15ececda2e596b44de))

## [4.37.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.1...gridfinity-layout-tool-v4.37.2) (2026-04-08)

### Bug Fixes

- **generation:** plug WASM handle leaks causing memory access OOB in bin designer ([#1334](https://github.com/andymai/gridfinity-layout-tool/issues/1334)) ([038aaff](https://github.com/andymai/gridfinity-layout-tool/commit/038aaffbae46436fa97cb171e82cb8a3c065684f))

## [4.37.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.37.0...gridfinity-layout-tool-v4.37.1) (2026-04-07)

### Bug Fixes

- **ci:** invoke vitest directly so -u actually updates snapshots on PRs ([#1329](https://github.com/andymai/gridfinity-layout-tool/issues/1329)) ([4534477](https://github.com/andymai/gridfinity-layout-tool/commit/45344776a77abb0c85b61c68846c1653b270b0f8))

## [4.37.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.36.6...gridfinity-layout-tool-v4.37.0) (2026-04-05)

### Features

- support asymmetric print bed sizes (width × depth) ([#1323](https://github.com/andymai/gridfinity-layout-tool/issues/1323)) ([5202855](https://github.com/andymai/gridfinity-layout-tool/commit/5202855c3c67bacb029487c70e324b6fea330aab))

## [4.36.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.36.5...gridfinity-layout-tool-v4.36.6) (2026-04-04)

### Bug Fixes

- **ci:** pass -u on PR shards so missing snapshots don't fail ([#1321](https://github.com/andymai/gridfinity-layout-tool/issues/1321)) ([b456ba4](https://github.com/andymai/gridfinity-layout-tool/commit/b456ba4a11a0dbae0ce07557ab71b86de4fd6e78))

## [4.36.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.36.4...gridfinity-layout-tool-v4.36.5) (2026-04-04)

### Bug Fixes

- **export:** fix 3MF blob corruption from unsafe ArrayBuffer access ([#1319](https://github.com/andymai/gridfinity-layout-tool/issues/1319)) ([0390765](https://github.com/andymai/gridfinity-layout-tool/commit/039076536064c67b14384e91ad32e683fcd4de96))

## [4.36.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.36.3...gridfinity-layout-tool-v4.36.4) (2026-04-04)

### Bug Fixes

- **ci:** pass --update on main so vitest writes fresh snapshots ([8f9078f](https://github.com/andymai/gridfinity-layout-tool/commit/8f9078fc761083f064d668470935135b8d6ec502))

## [4.36.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.36.2...gridfinity-layout-tool-v4.36.3) (2026-04-04)

### Bug Fixes

- **ci:** pass --update on main so vitest writes fresh snapshots ([10be545](https://github.com/andymai/gridfinity-layout-tool/commit/10be545cd3b570a55e2292d1492f860451dfc05b))

## [4.36.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.36.1...gridfinity-layout-tool-v4.36.2) (2026-04-03)

### Bug Fixes

- **ci:** delete stale scenario snapshots for CI regeneration ([3d1fccb](https://github.com/andymai/gridfinity-layout-tool/commit/3d1fccb77409d78373100b47b132d9c677b277f8))

## [4.36.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.36.0...gridfinity-layout-tool-v4.36.1) (2026-04-03)

### Bug Fixes

- **generation:** eliminate wall-to-lip seam ([#1314](https://github.com/andymai/gridfinity-layout-tool/issues/1314)) ([54210ce](https://github.com/andymai/gridfinity-layout-tool/commit/54210cefb0b14f82eafe9e8700f259b108b6667b))

## [4.36.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.35.3...gridfinity-layout-tool-v4.36.0) (2026-04-03)

### Features

- **labs:** experimental kernel disclaimer in 3D previews ([#1311](https://github.com/andymai/gridfinity-layout-tool/issues/1311)) ([36aa91b](https://github.com/andymai/gridfinity-layout-tool/commit/36aa91b0cda3b41684d2942c37244e6aed1063a3))

## [4.35.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.35.2...gridfinity-layout-tool-v4.35.3) (2026-03-31)

### Bug Fixes

- **generation:** stacking lip overhang on rectangular bins ([#1306](https://github.com/andymai/gridfinity-layout-tool/issues/1306)) ([76832cb](https://github.com/andymai/gridfinity-layout-tool/commit/76832cb8e0434ea7116da4e742f07d8133afddbd))

## [4.35.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.35.1...gridfinity-layout-tool-v4.35.2) (2026-03-30)

### Bug Fixes

- **bin-designer:** allow closer pinch-zoom on mobile preview ([#1303](https://github.com/andymai/gridfinity-layout-tool/issues/1303)) ([8abcacf](https://github.com/andymai/gridfinity-layout-tool/commit/8abcacfe950df3b86b7826d389f512529fd312bb))
- **bin-designer:** disable label tabs at 2u bin height ([#1305](https://github.com/andymai/gridfinity-layout-tool/issues/1305)) ([e548495](https://github.com/andymai/gridfinity-layout-tool/commit/e5484951614958ccf5d8acd09710114e106b2b01))

## [4.35.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.35.0...gridfinity-layout-tool-v4.35.1) (2026-03-30)

### Bug Fixes

- **onboarding:** skip welcome modal on deep-link routes ([#1301](https://github.com/andymai/gridfinity-layout-tool/issues/1301)) ([38550a0](https://github.com/andymai/gridfinity-layout-tool/commit/38550a01472e09ff955afd2effa0ee56c6bd8ef2))

## [4.35.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.34.4...gridfinity-layout-tool-v4.35.0) (2026-03-28)

### Features

- **generation:** aesthetic divider-cutout blending ([#1289](https://github.com/andymai/gridfinity-layout-tool/issues/1289)) ([c44da70](https://github.com/andymai/gridfinity-layout-tool/commit/c44da702a8c516bc8517bedd3aa7332a01cdbd80))

## [4.34.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.34.3...gridfinity-layout-tool-v4.34.4) (2026-03-28)

### Bug Fixes

- **labs:** responsive toggles + updated copy ([#1287](https://github.com/andymai/gridfinity-layout-tool/issues/1287)) ([11a56c5](https://github.com/andymai/gridfinity-layout-tool/commit/11a56c59b916830dec724a4fe8d173d6e5fb807a))

## [4.34.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.34.2...gridfinity-layout-tool-v4.34.3) (2026-03-28)

### Bug Fixes

- **baseplate:** respect fractional values in padding and dimension display ([#1284](https://github.com/andymai/gridfinity-layout-tool/issues/1284)) ([2aec81a](https://github.com/andymai/gridfinity-layout-tool/commit/2aec81aa0bc2f33367d403655496a4960e311ebb))

## [4.34.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.34.1...gridfinity-layout-tool-v4.34.2) (2026-03-28)

### Bug Fixes

- **tests:** add missing trackEvent to 12 incomplete posthog mocks ([#1281](https://github.com/andymai/gridfinity-layout-tool/issues/1281)) ([faacb1c](https://github.com/andymai/gridfinity-layout-tool/commit/faacb1c72e26f4d11a21703e8424e4a89307788c))

## [4.34.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.34.0...gridfinity-layout-tool-v4.34.1) (2026-03-28)

### Bug Fixes

- **generation:** recover from worker crashes and generation timeouts ([#1279](https://github.com/andymai/gridfinity-layout-tool/issues/1279)) ([8f3776b](https://github.com/andymai/gridfinity-layout-tool/commit/8f3776b6dcae72ac3f426c746d011c029e074f18))

## [4.34.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.33.0...gridfinity-layout-tool-v4.34.0) (2026-03-28)

### Features

- **undo:** show smart undo/redo toasts with action descriptions ([#1277](https://github.com/andymai/gridfinity-layout-tool/issues/1277)) ([2f92910](https://github.com/andymai/gridfinity-layout-tool/commit/2f929109e716d60cd1b23846a2d4cadd53250787))

## [4.33.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.32.2...gridfinity-layout-tool-v4.33.0) (2026-03-27)

### Features

- **cqrs:** complete CQRS adoption with library, designer, restore, and UI commands ([#1269](https://github.com/andymai/gridfinity-layout-tool/issues/1269)) ([09d87a0](https://github.com/andymai/gridfinity-layout-tool/commit/09d87a03ee432948939336215a7a8970a08f25cd))

## [4.32.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.32.1...gridfinity-layout-tool-v4.32.2) (2026-03-27)

### Bug Fixes

- **routing:** add Vercel rewrites for /designer and /baseplate SPA routes ([#1266](https://github.com/andymai/gridfinity-layout-tool/issues/1266)) ([97c608f](https://github.com/andymai/gridfinity-layout-tool/commit/97c608f528042bdc5e39901690013fec1be6b289))

## [4.32.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.32.0...gridfinity-layout-tool-v4.32.1) (2026-03-26)

### Bug Fixes

- **bin-designer:** resolve Immer proxy revocation in history operations ([#1264](https://github.com/andymai/gridfinity-layout-tool/issues/1264)) ([5f72b92](https://github.com/andymai/gridfinity-layout-tool/commit/5f72b9242cf7d38cf90bb9cb20f54f63a99d0f01))

## [4.32.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.31.0...gridfinity-layout-tool-v4.32.0) (2026-03-26)

### Features

- **colors:** redesign multi-color UI with direct color pickers ([#1257](https://github.com/andymai/gridfinity-layout-tool/issues/1257)) ([2f8454f](https://github.com/andymai/gridfinity-layout-tool/commit/2f8454fb46aaa4bacdb3858b8f7ab3b963598fa9))

## [4.31.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.30.0...gridfinity-layout-tool-v4.31.0) (2026-03-26)

### Features

- combine bin and divider exports into single download ([#1251](https://github.com/andymai/gridfinity-layout-tool/issues/1251)) ([#1259](https://github.com/andymai/gridfinity-layout-tool/issues/1259)) ([76e944c](https://github.com/andymai/gridfinity-layout-tool/commit/76e944c590b1c533deaf4c8b8a022ac25aa5bb68))

## [4.30.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.29.1...gridfinity-layout-tool-v4.30.0) (2026-03-25)

### Features

- **bin-designer:** multi-color UX — visual swatch palette + featureColors persistence ([#1253](https://github.com/andymai/gridfinity-layout-tool/issues/1253)) ([a65157d](https://github.com/andymai/gridfinity-layout-tool/commit/a65157d9cac4a60ba225dbba5d06d66da11b4230))

## [4.29.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.29.0...gridfinity-layout-tool-v4.29.1) (2026-03-25)

### Performance

- **generation:** tighten preview tessellation for smoother 3D preview ([#1255](https://github.com/andymai/gridfinity-layout-tool/issues/1255)) ([4c6d43c](https://github.com/andymai/gridfinity-layout-tool/commit/4c6d43ca5da92af32967ae227a05cae01b9a9ecb))

## [4.29.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.28.2...gridfinity-layout-tool-v4.29.0) (2026-03-25)

### Features

- redesign handle cutouts with shapes, multi-handle, and per-side controls ([#1252](https://github.com/andymai/gridfinity-layout-tool/issues/1252)) ([5f490c6](https://github.com/andymai/gridfinity-layout-tool/commit/5f490c6fba0add32a236053c7baed3ea22b6a75a))

## [4.28.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.28.1...gridfinity-layout-tool-v4.28.2) (2026-03-25)

### Performance

- **baseplate:** deduplicate identical split pieces ([#1249](https://github.com/andymai/gridfinity-layout-tool/issues/1249)) ([15b983f](https://github.com/andymai/gridfinity-layout-tool/commit/15b983f39418f24bf2eebb82f0609055bf0cce58))

## [4.28.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.28.0...gridfinity-layout-tool-v4.28.1) (2026-03-25)

### Performance

- deduplicate identical generation requests in bridge ([#1247](https://github.com/andymai/gridfinity-layout-tool/issues/1247)) ([586c480](https://github.com/andymai/gridfinity-layout-tool/commit/586c48019ae8e258a0a6389c0aa35ed606d607ee))

## [4.28.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.27.0...gridfinity-layout-tool-v4.28.0) (2026-03-25)

### Features

- **handles:** graduate handle holes out of labs ([#1244](https://github.com/andymai/gridfinity-layout-tool/issues/1244)) ([33e2d6d](https://github.com/andymai/gridfinity-layout-tool/commit/33e2d6d49900a56b5d2321a4b38c1c5fa87931da))

## [4.27.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.26.0...gridfinity-layout-tool-v4.27.0) (2026-03-25)

### Features

- **generation:** add border around handles in honeycomb wall pattern ([#1241](https://github.com/andymai/gridfinity-layout-tool/issues/1241)) ([c2f7925](https://github.com/andymai/gridfinity-layout-tool/commit/c2f792544c690fb444781dee79c0b61643ac33ce))

## [4.26.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.25.1...gridfinity-layout-tool-v4.26.0) (2026-03-24)

### Features

- **handles:** replace ledge handles with through-hole grip cutouts ([#1237](https://github.com/andymai/gridfinity-layout-tool/issues/1237)) ([ee94d94](https://github.com/andymai/gridfinity-layout-tool/commit/ee94d94bf7fc8422b2c1cb7070f151a75e026adc))

## [4.25.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.25.0...gridfinity-layout-tool-v4.25.1) (2026-03-24)

### Bug Fixes

- **handles:** split handles around wall cutouts to prevent topology gaps ([#1235](https://github.com/andymai/gridfinity-layout-tool/issues/1235)) ([27e35e2](https://github.com/andymai/gridfinity-layout-tool/commit/27e35e2fdba5ff505f962de71edd6f1b199c8dd0))

## [4.25.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.24.0...gridfinity-layout-tool-v4.25.0) (2026-03-24)

### Features

- **cqrs:** promote undo to always-on, add batch(), remove useUndoableAction ([#1231](https://github.com/andymai/gridfinity-layout-tool/issues/1231)) ([4060a01](https://github.com/andymai/gridfinity-layout-tool/commit/4060a01d61bf3724a7d32ec0a7f0b8b279bd1d9e))

## [4.24.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.23.2...gridfinity-layout-tool-v4.24.0) (2026-03-24)

### Features

- **cqrs:** event-driven selection pruning subscriber ([#1228](https://github.com/andymai/gridfinity-layout-tool/issues/1228)) ([23e4c67](https://github.com/andymai/gridfinity-layout-tool/commit/23e4c675d6c3500376e4f7f95ee981d6f0458923))

## [4.23.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.23.1...gridfinity-layout-tool-v4.23.2) (2026-03-24)

### Bug Fixes

- svg ry attribute, label tab test regression, brepkit stats guard ([#1225](https://github.com/andymai/gridfinity-layout-tool/issues/1225)) ([e9ee3a6](https://github.com/andymai/gridfinity-layout-tool/commit/e9ee3a618a81ac442131ed1674fd970ff1226ba6))

## [4.23.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.23.0...gridfinity-layout-tool-v4.23.1) (2026-03-24)

### Bug Fixes

- address unresolved PR review comments from recent merges ([#1224](https://github.com/andymai/gridfinity-layout-tool/issues/1224)) ([6dc4807](https://github.com/andymai/gridfinity-layout-tool/commit/6dc4807bd743a9531a0004da1fffd1e857b259b6))

## [4.23.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.22.0...gridfinity-layout-tool-v4.23.0) (2026-03-24)

### Features

- **design-system:** redesign sliders with custom Slider primitive and editable value badge ([#1222](https://github.com/andymai/gridfinity-layout-tool/issues/1222)) ([662b6da](https://github.com/andymai/gridfinity-layout-tool/commit/662b6da1e0a4975c4268dc21247a4b06b95d3694))

## [4.22.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.21.3...gridfinity-layout-tool-v4.22.0) (2026-03-23)

### Features

- **privacy:** respect browser Do Not Track and Global Privacy Control signals ([#1219](https://github.com/andymai/gridfinity-layout-tool/issues/1219)) ([f8ef009](https://github.com/andymai/gridfinity-layout-tool/commit/f8ef00906d211e7b6222bcb31f922ae0a9bdd2e5))

## [4.21.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.21.2...gridfinity-layout-tool-v4.21.3) (2026-03-23)

### Bug Fixes

- **generation:** extend label tab support to reach shelf front edge ([#1206](https://github.com/andymai/gridfinity-layout-tool/issues/1206)) ([a1b14d5](https://github.com/andymai/gridfinity-layout-tool/commit/a1b14d531edb8c6c6e0c9f1e1852cbc797a63233))

## [4.21.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.21.1...gridfinity-layout-tool-v4.21.2) (2026-03-23)

### Bug Fixes

- standardize disabled opacity, focus rings, icon alignment, modal overlays, and labs reactivity ([#1203](https://github.com/andymai/gridfinity-layout-tool/issues/1203)) ([b3badcf](https://github.com/andymai/gridfinity-layout-tool/commit/b3badcfcc3a6b06d87e975957a31234383bf3189))

## [4.21.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.21.0...gridfinity-layout-tool-v4.21.1) (2026-03-23)

### Bug Fixes

- post-merge polish for SVG import and wall patterns ([#1201](https://github.com/andymai/gridfinity-layout-tool/issues/1201)) ([0954e44](https://github.com/andymai/gridfinity-layout-tool/commit/0954e44b4e4250acfafef02fd4efeaf3e9f152f4))

## [4.21.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.20.1...gridfinity-layout-tool-v4.21.0) (2026-03-23)

### Features

- **generation:** solid border around wall cutouts in honeycomb pattern ([#1199](https://github.com/andymai/gridfinity-layout-tool/issues/1199)) ([8ce8945](https://github.com/andymai/gridfinity-layout-tool/commit/8ce894555948caed97c2488103111a71b76f41fe))

## [4.20.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.20.0...gridfinity-layout-tool-v4.20.1) (2026-03-23)

### Performance

- **generation:** upgrade brepjs to v14 and optimize hex wall pattern ([#1196](https://github.com/andymai/gridfinity-layout-tool/issues/1196)) ([845e2f2](https://github.com/andymai/gridfinity-layout-tool/commit/845e2f22d1fd625d1f68ded0d8e314aeb6e6e1e7))

## [4.20.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.19.0...gridfinity-layout-tool-v4.20.0) (2026-03-22)

### Features

- **bin-designer:** add SVG file import for custom cutouts ([#1194](https://github.com/andymai/gridfinity-layout-tool/issues/1194)) ([64a6850](https://github.com/andymai/gridfinity-layout-tool/commit/64a6850ef619ba98693b14b9c24d45cebdb3cd17))

## [4.19.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.18.3...gridfinity-layout-tool-v4.19.0) (2026-03-22)

### Features

- **bin-designer:** multi-color 3MF export ([#1182](https://github.com/andymai/gridfinity-layout-tool/issues/1182)) ([f79a60a](https://github.com/andymai/gridfinity-layout-tool/commit/f79a60af2844ebf5d65519da2916944d33bf5a2e))

### Bug Fixes

- **ci:** use -- separator for pnpm shard arg forwarding ([#1193](https://github.com/andymai/gridfinity-layout-tool/issues/1193)) ([e28d8d2](https://github.com/andymai/gridfinity-layout-tool/commit/e28d8d266473024b5c19fc0360884a05af78ee56))

### Performance

- **ci:** shard PR unit tests across 2 parallel runners ([#1191](https://github.com/andymai/gridfinity-layout-tool/issues/1191)) ([15ab9e3](https://github.com/andymai/gridfinity-layout-tool/commit/15ab9e35f3bfe8b8f5381984700e2b47ab4fa970))

## [4.18.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.18.2...gridfinity-layout-tool-v4.18.3) (2026-03-22)

### Bug Fixes

- **bin-designer:** add bottom padding to export dialog ([#1189](https://github.com/andymai/gridfinity-layout-tool/issues/1189)) ([9710caa](https://github.com/andymai/gridfinity-layout-tool/commit/9710caa1779c39fd50daba312077f77c48273891))

## [4.18.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.18.1...gridfinity-layout-tool-v4.18.2) (2026-03-22)

### Bug Fixes

- use configurable gridUnitMm in generation pipeline ([#1187](https://github.com/andymai/gridfinity-layout-tool/issues/1187)) ([3c33cfc](https://github.com/andymai/gridfinity-layout-tool/commit/3c33cfc7967b5537bfd9278f06afdd4fc6b501c9))

## [4.18.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.18.0...gridfinity-layout-tool-v4.18.1) (2026-03-22)

### Performance

- **ci:** optimize unit test speed with workspace split ([#1185](https://github.com/andymai/gridfinity-layout-tool/issues/1185)) ([116a4a6](https://github.com/andymai/gridfinity-layout-tool/commit/116a4a69079bdeed7457e44f0920a141abd31e7c))

## [4.18.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.17.2...gridfinity-layout-tool-v4.18.0) (2026-03-22)

### Features

- **baseplate:** click-to-edit mm dimensions ([#1181](https://github.com/andymai/gridfinity-layout-tool/issues/1181)) ([d1b25bf](https://github.com/andymai/gridfinity-layout-tool/commit/d1b25bf113c8d3ad59ea6507809bc65b9273883b))

## [4.17.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.17.1...gridfinity-layout-tool-v4.17.2) (2026-03-22)

### Bug Fixes

- make fillet support concave (less material) instead of convex bulge ([#1177](https://github.com/andymai/gridfinity-layout-tool/issues/1177)) ([eadee5a](https://github.com/andymai/gridfinity-layout-tool/commit/eadee5a13dcf7cd17d73a029c98bc17a08a85d0e))

## [4.17.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.17.0...gridfinity-layout-tool-v4.17.1) (2026-03-22)

### Bug Fixes

- **baseplate:** prevent lightweight floor overhangs and reduce pad size ([#1175](https://github.com/andymai/gridfinity-layout-tool/issues/1175)) ([2c6064b](https://github.com/andymai/gridfinity-layout-tool/commit/2c6064b1f087b6e592e41afee89918b6acd39902))

## [4.17.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.16.1...gridfinity-layout-tool-v4.17.0) (2026-03-22)

### Features

- **baseplate:** lightweight floor with cross-shaped cutout ([#1172](https://github.com/andymai/gridfinity-layout-tool/issues/1172)) ([13fb101](https://github.com/andymai/gridfinity-layout-tool/commit/13fb1012f4705cf28003e81bb33d6642f2a3369f))

### Bug Fixes

- position label tab fillet support under shelf ([#1171](https://github.com/andymai/gridfinity-layout-tool/issues/1171)) ([4dafd83](https://github.com/andymai/gridfinity-layout-tool/commit/4dafd830446f5bb478e835062b56fa2a53991eee))

## [4.16.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.16.0...gridfinity-layout-tool-v4.16.1) (2026-03-22)

### Bug Fixes

- use catch-all rewrite for PostHog proxy routes ([#1169](https://github.com/andymai/gridfinity-layout-tool/issues/1169)) ([8db20e9](https://github.com/andymai/gridfinity-layout-tool/commit/8db20e96a621a8f16d0283d17a93e81f9fc4116d))

## [4.16.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.15.1...gridfinity-layout-tool-v4.16.0) (2026-03-22)

### Features

- **split:** replace connectors with FDM-friendly scarf lap floor joint ([#1166](https://github.com/andymai/gridfinity-layout-tool/issues/1166)) ([97d4460](https://github.com/andymai/gridfinity-layout-tool/commit/97d44600a7f9d0b6fc7963c5dbc54b5f30ccc164))

## [4.15.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.15.0...gridfinity-layout-tool-v4.15.1) (2026-03-21)

### Bug Fixes

- align box corner radius and lip fillet with Gridfinity spec ([#1164](https://github.com/andymai/gridfinity-layout-tool/issues/1164)) ([31aaadb](https://github.com/andymai/gridfinity-layout-tool/commit/31aaadbd092c02189f3a23ec46a14d74a59444b4))

## [4.15.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.14.0...gridfinity-layout-tool-v4.15.0) (2026-03-21)

### Features

- add wall cutout positioning and fix split connector tab clipping ([#1162](https://github.com/andymai/gridfinity-layout-tool/issues/1162)) ([a049a48](https://github.com/andymai/gridfinity-layout-tool/commit/a049a48bef703c46b9fbc2db3d9724bc8eb219a7))

## [4.14.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.13.0...gridfinity-layout-tool-v4.14.0) (2026-03-21)

### Features

- gate handle ledges behind labs feature flag ([#1160](https://github.com/andymai/gridfinity-layout-tool/issues/1160)) ([f4cf594](https://github.com/andymai/gridfinity-layout-tool/commit/f4cf5948019fef18f0902909f55aa399947b97d5))

## [4.13.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.12.2...gridfinity-layout-tool-v4.13.0) (2026-03-21)

### Features

- add interior handle ledges and fillet label tab support ([#1105](https://github.com/andymai/gridfinity-layout-tool/issues/1105)) ([#1158](https://github.com/andymai/gridfinity-layout-tool/issues/1158)) ([b250d96](https://github.com/andymai/gridfinity-layout-tool/commit/b250d9691117a1107ba0bf455ba8f76bd28990b8))

## [4.12.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.12.1...gridfinity-layout-tool-v4.12.2) (2026-03-20)

### Bug Fixes

- split bin export geometry and seamless wall connectors ([#1156](https://github.com/andymai/gridfinity-layout-tool/issues/1156)) ([e317948](https://github.com/andymai/gridfinity-layout-tool/commit/e317948f9a95f7d650d1ab1ff8d70a8e3b24eaa2))

## [4.12.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.12.0...gridfinity-layout-tool-v4.12.1) (2026-03-20)

### Bug Fixes

- add security headers, restrict PostHog proxy, block source maps ([#1154](https://github.com/andymai/gridfinity-layout-tool/issues/1154)) ([7210166](https://github.com/andymai/gridfinity-layout-tool/commit/7210166aa885091dcf254de353261564d350e3f8))

## [4.12.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.11.1...gridfinity-layout-tool-v4.12.0) (2026-03-20)

### Features

- add exploded layer view to 3D preview ([#1150](https://github.com/andymai/gridfinity-layout-tool/issues/1150)) ([9d8cc22](https://github.com/andymai/gridfinity-layout-tool/commit/9d8cc22ca680a17b7bfe801913a3daf66bb1de2f))
- add PWA install and UTM parameter analytics tracking ([#1153](https://github.com/andymai/gridfinity-layout-tool/issues/1153)) ([8f4c56d](https://github.com/andymai/gridfinity-layout-tool/commit/8f4c56d2f41fd8b6e91695b44b419843c071c8de))

## [4.11.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.11.0...gridfinity-layout-tool-v4.11.1) (2026-03-20)

### Bug Fixes

- speed up honeycomb wall + wall cutout generation 3.6× ([#1148](https://github.com/andymai/gridfinity-layout-tool/issues/1148)) ([9f59224](https://github.com/andymai/gridfinity-layout-tool/commit/9f59224901fe139e2c7ae60944a9cbbec42b80e6))

## [4.11.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.10.5...gridfinity-layout-tool-v4.11.0) (2026-03-20)

### Features

- add selection toolbar with alignment and bulk actions ([#1145](https://github.com/andymai/gridfinity-layout-tool/issues/1145)) ([87e4093](https://github.com/andymai/gridfinity-layout-tool/commit/87e409369a004c805de6191fe759dcf47853c7e9))

## [4.10.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.10.4...gridfinity-layout-tool-v4.10.5) (2026-03-19)

### Bug Fixes

- posthog-driven product improvements ([#1140](https://github.com/andymai/gridfinity-layout-tool/issues/1140)) ([ed2bda0](https://github.com/andymai/gridfinity-layout-tool/commit/ed2bda0c3bf685a6d3d90b738bc275ab43b55baa))

## [4.10.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.10.3...gridfinity-layout-tool-v4.10.4) (2026-03-19)

### Bug Fixes

- exempt instructional animations from app-level reduce motion ([#1138](https://github.com/andymai/gridfinity-layout-tool/issues/1138)) ([6e6cfc6](https://github.com/andymai/gridfinity-layout-tool/commit/6e6cfc62c16b389bbf02b1389fc0c4091745a045))

## [4.10.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.10.2...gridfinity-layout-tool-v4.10.3) (2026-03-19)

### Internationalization

- rewrite labs settings copy for hobbyist audience ([#1136](https://github.com/andymai/gridfinity-layout-tool/issues/1136)) ([bf63940](https://github.com/andymai/gridfinity-layout-tool/commit/bf63940080a2c2dbb57d8a70009f9cd87fa72c0e))

## [4.10.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.10.1...gridfinity-layout-tool-v4.10.2) (2026-03-19)

### Bug Fixes

- stabilize flaky scenario and performance tests in full-suite runs ([#1134](https://github.com/andymai/gridfinity-layout-tool/issues/1134)) ([07b3d82](https://github.com/andymai/gridfinity-layout-tool/commit/07b3d82475fdafee2b398710fad8a2b4ea92bf5d))

## [4.10.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.10.0...gridfinity-layout-tool-v4.10.1) (2026-03-19)

### Bug Fixes

- harden runtime error handling for Immer proxies, IndexedDB, and WebGL ([#1132](https://github.com/andymai/gridfinity-layout-tool/issues/1132)) ([1d48d3d](https://github.com/andymai/gridfinity-layout-tool/commit/1d48d3db83fe750253fdc445a0eb506b0f43cbc7))

## [4.10.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.9.5...gridfinity-layout-tool-v4.10.0) (2026-03-19)

### Features

- unify header support links across all desktop views ([#1130](https://github.com/andymai/gridfinity-layout-tool/issues/1130)) ([910a6f7](https://github.com/andymai/gridfinity-layout-tool/commit/910a6f76808519e20283af00c3a3d5eeccd7e19f))

## [4.9.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.9.4...gridfinity-layout-tool-v4.9.5) (2026-03-18)

### Bug Fixes

- **parity:** relax bbox tolerance to 1.5mm for lip height difference ([50ae52c](https://github.com/andymai/gridfinity-layout-tool/commit/50ae52c5a044cb4cb1ad74a765af677ab9951bce))

## [4.9.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.9.3...gridfinity-layout-tool-v4.9.4) (2026-03-18)

### Bug Fixes

- **parity:** use relaxed validation for brepkit topology stats ([1a11b2a](https://github.com/andymai/gridfinity-layout-tool/commit/1a11b2a0c5f312408868998dfa7406349591c11c))

## [4.9.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.9.2...gridfinity-layout-tool-v4.9.3) (2026-03-18)

### Bug Fixes

- **parity:** pre-compute bounds to avoid disposed handle error ([5a82f34](https://github.com/andymai/gridfinity-layout-tool/commit/5a82f345bc7aebbb65ee754869f5c9994fe096e2))

## [4.9.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.9.1...gridfinity-layout-tool-v4.9.2) (2026-03-17)

### Bug Fixes

- add explicit WASM shape disposal to generation caches ([#1124](https://github.com/andymai/gridfinity-layout-tool/issues/1124)) ([38faac6](https://github.com/andymai/gridfinity-layout-tool/commit/38faac6916a2d2824e5ea25442e7ee54f1c99456))

## [4.9.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.9.0...gridfinity-layout-tool-v4.9.1) (2026-03-16)

### Bug Fixes

- resolve 4 Dependabot security alerts via pnpm overrides ([#1115](https://github.com/andymai/gridfinity-layout-tool/issues/1115)) ([10788ae](https://github.com/andymai/gridfinity-layout-tool/commit/10788ae280f548fe04418cddf5661a9d3b5ef7cb))

## [4.9.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.8.1...gridfinity-layout-tool-v4.9.0) (2026-03-15)

### Features

- cqrs maturation — versioning, validation, undo middleware, retry queue ([#1112](https://github.com/andymai/gridfinity-layout-tool/issues/1112)) ([5252565](https://github.com/andymai/gridfinity-layout-tool/commit/52525654fac123f3fe336dc090f454ba7bc7beb8))

## [4.8.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.8.0...gridfinity-layout-tool-v4.8.1) (2026-03-13)

### Bug Fixes

- split export coplanar cut plane drops walls/lip ([#1091](https://github.com/andymai/gridfinity-layout-tool/issues/1091)) ([#1095](https://github.com/andymai/gridfinity-layout-tool/issues/1095)) ([e9f8e83](https://github.com/andymai/gridfinity-layout-tool/commit/e9f8e838512661ff6bcd048e2122fc2ac562ad72))

## [4.8.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.7.0...gridfinity-layout-tool-v4.8.0) (2026-03-12)

### Features

- add brepkit shell volume diagnostic tests and topology parity improvements ([#1092](https://github.com/andymai/gridfinity-layout-tool/issues/1092)) ([03aec45](https://github.com/andymai/gridfinity-layout-tool/commit/03aec45a9951b405252bedd3a3ae00c8c8501543))

## [4.7.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.6.1...gridfinity-layout-tool-v4.7.0) (2026-03-11)

### Features

- bump brepkit-wasm to v1.0.6 with visual parity tests ([#1086](https://github.com/andymai/gridfinity-layout-tool/issues/1086)) ([05e37e1](https://github.com/andymai/gridfinity-layout-tool/commit/05e37e15bf10013dee22662bd4fd0a7be0ad4829))

## [4.6.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.6.0...gridfinity-layout-tool-v4.6.1) (2026-03-11)

### Bug Fixes

- reject 0.5×0.5 bin footprint as invalid ([#1084](https://github.com/andymai/gridfinity-layout-tool/issues/1084)) ([944f448](https://github.com/andymai/gridfinity-layout-tool/commit/944f4480bab01c8e0c4b82ad8b8b9f9582f78a0a))

## [4.6.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.5.0...gridfinity-layout-tool-v4.6.0) (2026-03-11)

### Features

- add brepkit-wasm as alternative geometry kernel via Labs flag ([#1080](https://github.com/andymai/gridfinity-layout-tool/issues/1080)) ([84f0c5e](https://github.com/andymai/gridfinity-layout-tool/commit/84f0c5ed4962db1d762d129b76e2f3ac81331361))

## [4.5.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.4.0...gridfinity-layout-tool-v4.5.0) (2026-03-09)

### Features

- add branded unit types for compile-time unit safety ([#1075](https://github.com/andymai/gridfinity-layout-tool/issues/1075)) ([11a30ce](https://github.com/andymai/gridfinity-layout-tool/commit/11a30ce1f3c651719337a52853b12447760b2f88))

## [4.4.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.3.1...gridfinity-layout-tool-v4.4.0) (2026-03-09)

### Features

- add cqrs command bus and event sourcing infrastructure ([#1073](https://github.com/andymai/gridfinity-layout-tool/issues/1073)) ([7c6d2b5](https://github.com/andymai/gridfinity-layout-tool/commit/7c6d2b5cbe4dc00022c8a8c5c5313bb7b17e32c2))

## [4.3.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.3.0...gridfinity-layout-tool-v4.3.1) (2026-03-08)

### Bug Fixes

- remove What's New changelog feature ([#1071](https://github.com/andymai/gridfinity-layout-tool/issues/1071)) ([abe433d](https://github.com/andymai/gridfinity-layout-tool/commit/abe433df5e3a0757aeb0ed46aa1f516d4d56d7a3))

## [4.3.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.2.1...gridfinity-layout-tool-v4.3.0) (2026-03-08)

### Features

- benchmark infra and kernel swap for brepjs migration ([#1069](https://github.com/andymai/gridfinity-layout-tool/issues/1069)) ([f719a8c](https://github.com/andymai/gridfinity-layout-tool/commit/f719a8ce8b367ea0f351553c47fd5ef7d6c11a20))

## [4.2.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.2.0...gridfinity-layout-tool-v4.2.1) (2026-03-08)

### Bug Fixes

- dynamic modal title per tab, add seed changelog entries ([#1067](https://github.com/andymai/gridfinity-layout-tool/issues/1067)) ([387ab9d](https://github.com/andymai/gridfinity-layout-tool/commit/387ab9da8cce934d51cd28d46d772c34db0c7302))

## [4.2.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.1.2...gridfinity-layout-tool-v4.2.0) (2026-03-08)

### Features

- engagement-gated feedback nudges, Ko-fi prompts, and changelog ([#1065](https://github.com/andymai/gridfinity-layout-tool/issues/1065)) ([80adaa7](https://github.com/andymai/gridfinity-layout-tool/commit/80adaa766850ebb0dd103b11829f9e370abea594))

## [4.1.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.1.1...gridfinity-layout-tool-v4.1.2) (2026-03-05)

### Bug Fixes

- **baseplate:** default camera to top view, fix padding stepper width ([#1057](https://github.com/andymai/gridfinity-layout-tool/issues/1057)) ([6c44961](https://github.com/andymai/gridfinity-layout-tool/commit/6c449616ed25db8315e672ed9d7f02a12506ce5f))

## [4.1.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.1.0...gridfinity-layout-tool-v4.1.1) (2026-03-05)

### Bug Fixes

- revert version from 5.0.0 to 4.1.0 ([47e7f90](https://github.com/andymai/gridfinity-layout-tool/commit/47e7f90a681f7625d744298041a9bab9d3b07e16))

## [5.0.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.1.0...gridfinity-layout-tool-v5.0.0) (2026-03-04)

### ⚠ BREAKING CHANGES

- topOffset is now a global setting in cutoutConfig, not per-cutout

### Features

- add AbortSignal cancellation for mid-operation generation abort ([#640](https://github.com/andymai/gridfinity-layout-tool/issues/640)) ([ac1cb55](https://github.com/andymai/gridfinity-layout-tool/commit/ac1cb550102caf3855985848a286fa7f40e0f242))
- add alignment connectors to split bin exports ([#1004](https://github.com/andymai/gridfinity-layout-tool/issues/1004)) ([c1361b2](https://github.com/andymai/gridfinity-layout-tool/commit/c1361b2af466613bbfa1ffb98813ec39468e36c7))
- add branded ID types for compile-time type safety ([7918752](https://github.com/andymai/gridfinity-layout-tool/commit/791875291220fefb0301caa6ab953a8356dc0dcf))
- add bulk export/import for all layouts ([#802](https://github.com/andymai/gridfinity-layout-tool/issues/802)) ([a6c5bc7](https://github.com/andymai/gridfinity-layout-tool/commit/a6c5bc75aeed22e68fba71751bf9982c2f085afc))
- add constraint resolution engine for bin designer ([#693](https://github.com/andymai/gridfinity-layout-tool/issues/693)) ([053273e](https://github.com/andymai/gridfinity-layout-tool/commit/053273e59fc27ef4a93737bd7073447d49fcf1d0))
- add design system with CVA-based component architecture ([#618](https://github.com/andymai/gridfinity-layout-tool/issues/618)) ([91ae9a3](https://github.com/andymai/gridfinity-layout-tool/commit/91ae9a3c2619dab3bf178686eefbb43772e66668))
- add face origin provenance pipeline (brepjs 8.3.0) ([#763](https://github.com/andymai/gridfinity-layout-tool/issues/763)) ([7fbc59a](https://github.com/andymai/gridfinity-layout-tool/commit/7fbc59ad171446dcbfa41e4f36b7091786a58fb5))
- add feedback UI with GitHub Issue creation ([#722](https://github.com/andymai/gridfinity-layout-tool/issues/722)) ([707580d](https://github.com/andymai/gridfinity-layout-tool/commit/707580d0f748adc2d1f81d6cc4ceaec89cd7a6a4))
- add flat floor (no socket) base option to bin designer ([#621](https://github.com/andymai/gridfinity-layout-tool/issues/621)) ([f3bdaa6](https://github.com/andymai/gridfinity-layout-tool/commit/f3bdaa6e80d5e4a4ef3640109e4a31e7f8add50e))
- add flip horizontal/vertical to cutout editor ([#1047](https://github.com/andymai/gridfinity-layout-tool/issues/1047)) ([70a35f3](https://github.com/andymai/gridfinity-layout-tool/commit/70a35f359c9eef5a1303a8ea64aa6d8358ddb9f7))
- add half sockets option for bins ([#659](https://github.com/andymai/gridfinity-layout-tool/issues/659)) ([1973458](https://github.com/andymai/gridfinity-layout-tool/commit/19734585b9e6e12f46a0d97b09da83ad3f3ca105))
- add half-lap wall connectors for thin walls (&lt; 1.4mm) ([#1029](https://github.com/andymai/gridfinity-layout-tool/issues/1029)) ([c98410f](https://github.com/andymai/gridfinity-layout-tool/commit/c98410f4107fe1bb7b546518191554584161ac17))
- add honeycomb wall cutouts to bin designer ([#589](https://github.com/andymai/gridfinity-layout-tool/issues/589)) ([b5fe8a2](https://github.com/andymai/gridfinity-layout-tool/commit/b5fe8a2a2144eb60e3716b080c9c3759b6ec23c6))
- add i18n untranslated values check and translate ~1,200 locale strings ([#571](https://github.com/andymai/gridfinity-layout-tool/issues/571)) ([78407b4](https://github.com/andymai/gridfinity-layout-tool/commit/78407b4de0ff9eaef4b55d97c67369891b20f2bb))
- add multi-format export (STL / STEP / 3MF) to bin designer ([#683](https://github.com/andymai/gridfinity-layout-tool/issues/683)) ([7f62eae](https://github.com/andymai/gridfinity-layout-tool/commit/7f62eae34f85311bc6f84955b4020344e6596c16))
- add pen tool for freeform path cutouts ([#685](https://github.com/andymai/gridfinity-layout-tool/issues/685)) ([ca16505](https://github.com/andymai/gridfinity-layout-tool/commit/ca165058dc21634cad4e1358388f2500be97020f))
- add ruler measurement tool to cutout editor ([#706](https://github.com/andymai/gridfinity-layout-tool/issues/706)) ([31e9d0d](https://github.com/andymai/gridfinity-layout-tool/commit/31e9d0d9bef8c4da04c70f4c8688409416fea559))
- add scoop and funnel wall cutout shapes ([523439e](https://github.com/andymai/gridfinity-layout-tool/commit/523439e651483dba11153a326ec167e25b7c0196))
- add shape cutouts for solid bins in bin designer ([#629](https://github.com/andymai/gridfinity-layout-tool/issues/629)) ([f5fb107](https://github.com/andymai/gridfinity-layout-tool/commit/f5fb107a0f9a8e888f6dee004dfe8b5bd1c378f2))
- add solid parameter to BaseConfig for future cutouts support ([#624](https://github.com/andymai/gridfinity-layout-tool/issues/624)) ([9a9ecad](https://github.com/andymai/gridfinity-layout-tool/commit/9a9ecade822cf58ff8087c93898bc2b89a02d77a))
- add Storage dashboard tab in Settings ([#801](https://github.com/andymai/gridfinity-layout-tool/issues/801)) ([60447b7](https://github.com/andymai/gridfinity-layout-tool/commit/60447b7d5382b76d35165645842102a6df66c112))
- add wall cutout feature to bin designer ([cdd1fe0](https://github.com/andymai/gridfinity-layout-tool/commit/cdd1fe05d629ce48e8b859610d2af0f0d14e36ec))
- add wall cutout feature to bin designer ([#707](https://github.com/andymai/gridfinity-layout-tool/issues/707)) ([8675067](https://github.com/andymai/gridfinity-layout-tool/commit/86750678196951e561d02a4d615c49fccc727ae0))
- always show ToolSwitcher in baseplate generator header ([#1019](https://github.com/andymai/gridfinity-layout-tool/issues/1019)) ([8e6f0e8](https://github.com/andymai/gridfinity-layout-tool/commit/8e6f0e894632cc9ab5e9c8fcf1bb30d134d08082))
- **analytics:** replace Vercel heartbeat with rich PostHog heartbeat ([#886](https://github.com/andymai/gridfinity-layout-tool/issues/886)) ([ec2070f](https://github.com/andymai/gridfinity-layout-tool/commit/ec2070f8dcbc49c88bca9764eed918dcace53739))
- **api:** add hourly cron to clean up expired slicer-temp blobs ([#848](https://github.com/andymai/gridfinity-layout-tool/issues/848)) ([4bac1f8](https://github.com/andymai/gridfinity-layout-tool/commit/4bac1f86a3c1c10eb4524b6d20e6d9af3cd4c294))
- auto-clean localStorage layout backups ([#800](https://github.com/andymai/gridfinity-layout-tool/issues/800)) ([6391445](https://github.com/andymai/gridfinity-layout-tool/commit/6391445e4d37feea3aa1be6a72cdbfc749e4ed58))
- auto-enable half-bin mode on fractional grid input ([#634](https://github.com/andymai/gridfinity-layout-tool/issues/634)) ([908cc5b](https://github.com/andymai/gridfinity-layout-tool/commit/908cc5bee1649ebb9f6f86769c158808284b58ac))
- **baseplate:** 3D preview visual polish ([#939](https://github.com/andymai/gridfinity-layout-tool/issues/939)) ([7860d29](https://github.com/andymai/gridfinity-layout-tool/commit/7860d297c333b6164fd72b1778b2648b9ef8285b))
- **baseplate:** add custom grid size with "Synced with layout" toggle ([#918](https://github.com/andymai/gridfinity-layout-tool/issues/918)) ([fa18138](https://github.com/andymai/gridfinity-layout-tool/commit/fa181380a560f59b0226b425702fc13c75e48972))
- **baseplate:** add dovetail connectors for split baseplate pieces ([#900](https://github.com/andymai/gridfinity-layout-tool/issues/900)) ([0e36ab9](https://github.com/andymai/gridfinity-layout-tool/commit/0e36ab9850cb77de24c6c4a665890af1f1b7f657))
- **baseplate:** add edge lines, improve tessellation, and polish 3D preview ([#925](https://github.com/andymai/gridfinity-layout-tool/issues/925)) ([985d314](https://github.com/andymai/gridfinity-layout-tool/commit/985d3146e9bcdd86e9dad032df1c374629df0264))
- **baseplate:** add magnet holes and direct mesh generator ([#896](https://github.com/andymai/gridfinity-layout-tool/issues/896)) ([d7804c4](https://github.com/andymai/gridfinity-layout-tool/commit/d7804c48bfc1bd454439b568f94cba0ce60027ee))
- **baseplate:** add standalone baseplate generator ([#892](https://github.com/andymai/gridfinity-layout-tool/issues/892)) ([94c8f49](https://github.com/andymai/gridfinity-layout-tool/commit/94c8f49d5492c3b05c33c51e1430d1ee8f66eb5e))
- **baseplate:** graduate generator and add SEO landing page ([#937](https://github.com/andymai/gridfinity-layout-tool/issues/937)) ([7a54033](https://github.com/andymai/gridfinity-layout-tool/commit/7a5403395f3d3ec281c884b81a621a51f1759771))
- **baseplate:** improve panel hierarchy, loading UX, and section transitions ([#944](https://github.com/andymai/gridfinity-layout-tool/issues/944)) ([4262810](https://github.com/andymai/gridfinity-layout-tool/commit/426281021610e285f7a092e9e5676a3a6f8ef2e1))
- **baseplate:** replace greedy 1D split with optimal 2D tiling ([#898](https://github.com/andymai/gridfinity-layout-tool/issues/898)) ([a18622c](https://github.com/andymai/gridfinity-layout-tool/commit/a18622c868e183aeb9211532a231d5bbde4eef27))
- **baseplate:** shared ExportDialog with parallel export and slicer integration ([#932](https://github.com/andymai/gridfinity-layout-tool/issues/932)) ([2a8dfe1](https://github.com/andymai/gridfinity-layout-tool/commit/2a8dfe1daec3f2d780e9ce30f5e1c4f90212ad0d))
- **baseplate:** spatial padding schematic for edge padding section ([#935](https://github.com/andymai/gridfinity-layout-tool/issues/935)) ([994fcac](https://github.com/andymai/gridfinity-layout-tool/commit/994fcac178791a6d2c5c6ab2e01b02b152fbd554))
- **bin-designer:** add Open in Slicer deep-link export ([#846](https://github.com/andymai/gridfinity-layout-tool/issues/846)) ([39d70df](https://github.com/andymai/gridfinity-layout-tool/commit/39d70df3ca6e33b5e7684389e3bba8763f8bd08f))
- **bin-designer:** auto-enable half-bin mode when fractional dimension is typed ([#893](https://github.com/andymai/gridfinity-layout-tool/issues/893)) ([d26a4bc](https://github.com/andymai/gridfinity-layout-tool/commit/d26a4bcc4ef822e6943370e872c535c715dcf2c3))
- **bin-designer:** cutout editor UX polish ([#964](https://github.com/andymai/gridfinity-layout-tool/issues/964)) ([8abacea](https://github.com/andymai/gridfinity-layout-tool/commit/8abacea39c0b32c7ca2123fd8e7391165cd00279))
- **bin-designer:** improve cutout editor onboarding and discoverability ([#962](https://github.com/andymai/gridfinity-layout-tool/issues/962)) ([fb059c7](https://github.com/andymai/gridfinity-layout-tool/commit/fb059c77e50e4812f33a3a13680edc8123455531))
- **bin-designer:** pattern registry architecture and dropdown UI ([#614](https://github.com/andymai/gridfinity-layout-tool/issues/614)) ([d68158b](https://github.com/andymai/gridfinity-layout-tool/commit/d68158b1f37aed1e858418f0fa9ac5ae6b7e11e5))
- branded ID types for compile-time type safety ([#567](https://github.com/andymai/gridfinity-layout-tool/issues/567)) ([cee698c](https://github.com/andymai/gridfinity-layout-tool/commit/cee698ca3ba0e6020b6c2e6d64f0e3b879a3932f))
- **design-linking:** auto-sync linked bin design dimensions ([#812](https://github.com/andymai/gridfinity-layout-tool/issues/812)) ([e31a86c](https://github.com/andymai/gridfinity-layout-tool/commit/e31a86c826c85aa87253ad034199d7f424090104))
- **export:** make 3MF the default export format ([#966](https://github.com/andymai/gridfinity-layout-tool/issues/966)) ([a4bc7af](https://github.com/andymai/gridfinity-layout-tool/commit/a4bc7af9fe15e46b8e226ab4cac49b0a747e18a1))
- **feedback:** llm-enriched issue creation with priority and duplicate detection ([#731](https://github.com/andymai/gridfinity-layout-tool/issues/731)) ([cd4ea84](https://github.com/andymai/gridfinity-layout-tool/commit/cd4ea847ec07988a59d57b991b6aa9b484317301))
- finger scoop with stacking lip alignment ([#668](https://github.com/andymai/gridfinity-layout-tool/issues/668)) ([cf4cdcc](https://github.com/andymai/gridfinity-layout-tool/commit/cf4cdcc5ae8010546862a9ef53e7d4ad2f18da43))
- **generation:** add magnet support for half-unit bins and baseplates ([#920](https://github.com/andymai/gridfinity-layout-tool/issues/920)) ([f4081a0](https://github.com/andymai/gridfinity-layout-tool/commit/f4081a0fbb7557133ba4d6b926bb6ec09df953c8))
- **generation:** add multi-threaded WASM support for OpenCascade ([#600](https://github.com/andymai/gridfinity-layout-tool/issues/600)) ([0a3487b](https://github.com/andymai/gridfinity-layout-tool/commit/0a3487bb9acbd65a7967c164b78041a368780354))
- **generation:** indexedDB WASM module caching + shared pool compilation ([#950](https://github.com/andymai/gridfinity-layout-tool/issues/950)) ([980f8ae](https://github.com/andymai/gridfinity-layout-tool/commit/980f8ae36ed3e9c764c3ec73de0a1009c9784fee))
- **generation:** rotate honeycomb hex cutouts to pointy-top orientation ([#606](https://github.com/andymai/gridfinity-layout-tool/issues/606)) ([de4a067](https://github.com/andymai/gridfinity-layout-tool/commit/de4a067183884f9ab1a8df674759668d660fa740))
- **generation:** shared BridgeManager with WASM preloading ([#948](https://github.com/andymai/gridfinity-layout-tool/issues/948)) ([9b0d0bb](https://github.com/andymai/gridfinity-layout-tool/commit/9b0d0bbe571050f2297348a7f11c9879054d21e4))
- **generation:** upgrade to brepjs 4.0.3 with minification-safe isShape3D ([7b540d8](https://github.com/andymai/gridfinity-layout-tool/commit/7b540d8389a5aee713596ddd1fcd12b4da199572))
- **i18n:** consolidate redundant keys and remove 152 orphaned translations ([#843](https://github.com/andymai/gridfinity-layout-tool/issues/843)) ([aec5e9a](https://github.com/andymai/gridfinity-layout-tool/commit/aec5e9a949b1c97ace78a0a5cf1aa2081fa5c071))
- **i18n:** localize bin designer loading messages ([#551](https://github.com/andymai/gridfinity-layout-tool/issues/551)) ([83364ea](https://github.com/andymai/gridfinity-layout-tool/commit/83364ea05e860b7e4f9a3636295e73fd9b2cba88))
- improve auto scoop radius with height-aware formula and resolved display ([#671](https://github.com/andymai/gridfinity-layout-tool/issues/671)) ([7ba7847](https://github.com/andymai/gridfinity-layout-tool/commit/7ba78477bfc60d099c0bcfacd77ac241e51fa887))
- improve divider export with descriptive filenames ([fd78b59](https://github.com/andymai/gridfinity-layout-tool/commit/fd78b5931edc64e8b3ac1790b12b72a5db1399df))
- improve print time/filament estimates with enhanced volume calc and user settings ([#573](https://github.com/andymai/gridfinity-layout-tool/issues/573)) ([6ed6c13](https://github.com/andymai/gridfinity-layout-tool/commit/6ed6c13eb5c139644188afedc134269374058143))
- increase max bin dimensions from 8x8 to 16x16 ([#630](https://github.com/andymai/gridfinity-layout-tool/issues/630)) ([06b4a1a](https://github.com/andymai/gridfinity-layout-tool/commit/06b4a1ac55d9943c64ff6d9d5977c934c8715058))
- indexed mesh wire format ([#639](https://github.com/andymai/gridfinity-layout-tool/issues/639)) ([17de936](https://github.com/andymai/gridfinity-layout-tool/commit/17de9363f10b44ce9516ef2ea9739be867a1b780))
- **layers:** layer height UX overhaul ([#816](https://github.com/andymai/gridfinity-layout-tool/issues/816)) ([af597c0](https://github.com/andymai/gridfinity-layout-tool/commit/af597c088fbb0115ee1aa262481f4bb38d462374))
- **layers:** replace bin palette panel with compact popover toolbar ([#929](https://github.com/andymai/gridfinity-layout-tool/issues/929)) ([3a5b6c4](https://github.com/andymai/gridfinity-layout-tool/commit/3a5b6c4febe02f177e09c35748c15a617a2dd718))
- migrate library index from localStorage to IndexedDB ([#799](https://github.com/andymai/gridfinity-layout-tool/issues/799)) ([e1068bd](https://github.com/andymai/gridfinity-layout-tool/commit/e1068bda1f034e13e725b75e9b0dd346ca5f7696))
- optimize localStorage with key consolidation and IDB migration ([#806](https://github.com/andymai/gridfinity-layout-tool/issues/806)) ([41f954d](https://github.com/andymai/gridfinity-layout-tool/commit/41f954dcc22483fe56e2b2cbe575b9f5115cc70f))
- prefetch lazy-loaded chunks during browser idle time ([#553](https://github.com/andymai/gridfinity-layout-tool/issues/553)) ([fcf2790](https://github.com/andymai/gridfinity-layout-tool/commit/fcf279085bd877e8e1b265fc22dc4fd7c8869342))
- **print:** unify filament estimates with analytical volume model, add nozzle size setting ([#829](https://github.com/andymai/gridfinity-layout-tool/issues/829)) ([284548c](https://github.com/andymai/gridfinity-layout-tool/commit/284548ca6b529a5d40d6d1909a0eb05293cd79fd))
- remove delete bin drop zone ([#835](https://github.com/andymai/gridfinity-layout-tool/issues/835)) ([c6bcb69](https://github.com/andymai/gridfinity-layout-tool/commit/c6bcb6931077ba92140f565d39ac958a92a36991))
- remove expanded bin list modal feature ([bfa0c08](https://github.com/andymai/gridfinity-layout-tool/commit/bfa0c0859b8fbff573e7ec1f17d53e3c537b7f92))
- remove expanded bin list modal feature ([#626](https://github.com/andymai/gridfinity-layout-tool/issues/626)) ([1c1a321](https://github.com/andymai/gridfinity-layout-tool/commit/1c1a321158b543e40435c386407525a73f83f375))
- remove vercel speed insights ([#652](https://github.com/andymai/gridfinity-layout-tool/issues/652)) ([3a02938](https://github.com/andymai/gridfinity-layout-tool/commit/3a0293853dadaabfeb115169f4ad211ebbe2b5a6))
- **result:** add useResultToast hook with recovery hints ([#973](https://github.com/andymai/gridfinity-layout-tool/issues/973)) ([ef42261](https://github.com/andymai/gridfinity-layout-tool/commit/ef42261b383b24aff2d4793eae9900dad9d034d7))
- **seo:** dynamic meta tags + server-side bot OG injection ([#559](https://github.com/andymai/gridfinity-layout-tool/issues/559)) ([f765bdb](https://github.com/andymai/gridfinity-layout-tool/commit/f765bdb5f6e59b41472df350ebb8ec59a25b6cd1))
- **settings:** add Appearance tab with theme, accent, density, and grid controls ([#748](https://github.com/andymai/gridfinity-layout-tool/issues/748)) ([5cbce12](https://github.com/andymai/gridfinity-layout-tool/commit/5cbce12abd7917da9411ae6e760f7a02ee0f5450))
- shared ref-counted worker pool for parallel split operations ([#1015](https://github.com/andymai/gridfinity-layout-tool/issues/1015)) ([74683c2](https://github.com/andymai/gridfinity-layout-tool/commit/74683c2147226b1453d44c5f4e4786e85210a318))
- show disabled label tabs with explanation instead of hiding ([72b3779](https://github.com/andymai/gridfinity-layout-tool/commit/72b3779048b3da4cc7829111a71fd212e5ade6cb))
- smart snap placement for bins near collisions ([#832](https://github.com/andymai/gridfinity-layout-tool/issues/832)) ([7e4fdbb](https://github.com/andymai/gridfinity-layout-tool/commit/7e4fdbb5f641078e4a9477ad08366bf63bdf1b89))
- snapshot history with auto-save, restore, and IndexedDB recovery ([#797](https://github.com/andymai/gridfinity-layout-tool/issues/797)) ([f2bf4ec](https://github.com/andymai/gridfinity-layout-tool/commit/f2bf4ec0596682897403ab02b6082cd94829835a))
- split export for oversized bins in Bin Designer ([#582](https://github.com/andymai/gridfinity-layout-tool/issues/582)) ([0283639](https://github.com/andymai/gridfinity-layout-tool/commit/028363925ff3e93581a7e5eb3e7f9633ca3de0cc))
- **storage:** www → canonical domain storage migration ([#856](https://github.com/andymai/gridfinity-layout-tool/issues/856)) ([582f3e3](https://github.com/andymai/gridfinity-layout-tool/commit/582f3e309cc7c3ccf6ffdd4d34192ff066494412))
- **store:** add extracted selector hooks for cross-store derivations ([#970](https://github.com/andymai/gridfinity-layout-tool/issues/970)) ([735b39c](https://github.com/andymai/gridfinity-layout-tool/commit/735b39c8232fb4b430b4a12c572f6e7ba3d0150f))
- **toolswitcher:** shorten labels to Layout / Bins / Baseplate ([#942](https://github.com/andymai/gridfinity-layout-tool/issues/942)) ([2895f54](https://github.com/andymai/gridfinity-layout-tool/commit/2895f54d2cf05877e732ff18b4a4a4f026894ace))
- **ux:** communicate grid interaction failures and surface the stash to new users ([5cd6b46](https://github.com/andymai/gridfinity-layout-tool/commit/5cd6b465ecca9f498b3746a20fd4d957b01d2022))

### Bug Fixes

- 4 bugs found via systematic codebase audit (round 2) ([#767](https://github.com/andymai/gridfinity-layout-tool/issues/767)) ([6b538f3](https://github.com/andymai/gridfinity-layout-tool/commit/6b538f3ad4906c423495290037f33382a002ece1))
- 5 bugs found via systematic codebase audit with TDD ([#765](https://github.com/andymai/gridfinity-layout-tool/issues/765)) ([2458e69](https://github.com/andymai/gridfinity-layout-tool/commit/2458e69df0df642455439c9475c7e3587045a4a1))
- add volumetric overlap for split bin lip fuse to eliminate geometry artifacts ([#1039](https://github.com/andymai/gridfinity-layout-tool/issues/1039)) ([ffd6791](https://github.com/andymai/gridfinity-layout-tool/commit/ffd6791a3f284ab281135a3e71ac359502163bf3))
- adjust coverage thresholds to realistic achievable levels ([#648](https://github.com/andymai/gridfinity-layout-tool/issues/648)) ([49d0d13](https://github.com/andymai/gridfinity-layout-tool/commit/49d0d1318105142c6fd7f2b8805818fb0ab556b2))
- align Button, Input, Checkbox, Toast, Dialog sizing to match production ([#664](https://github.com/andymai/gridfinity-layout-tool/issues/664)) ([807b70c](https://github.com/andymai/gridfinity-layout-tool/commit/807b70ce91ae86d99fcc4a18994f7bd59400e78c))
- align design system sizing to match production components ([#662](https://github.com/andymai/gridfinity-layout-tool/issues/662)) ([a1aa1d5](https://github.com/andymai/gridfinity-layout-tool/commit/a1aa1d59e12d2864f330ed83ad47ec8dd24ca6d0))
- align Select, Stepper, Toast sizing to match production and add visual regression tests ([#666](https://github.com/andymai/gridfinity-layout-tool/issues/666)) ([2ceddbe](https://github.com/andymai/gridfinity-layout-tool/commit/2ceddbe712b2dd124d2f3e4c4df6e06313efb064))
- allow clicking export file name to edit it directly ([#632](https://github.com/andymai/gridfinity-layout-tool/issues/632)) ([4d99a1b](https://github.com/andymai/gridfinity-layout-tool/commit/4d99a1b16673337abd28b45535ddc314fc5d42c3))
- **analytics:** prevent Infinity binsPerMinute in ML confidence scoring ([#741](https://github.com/andymai/gridfinity-layout-tool/issues/741)) ([203d768](https://github.com/andymai/gridfinity-layout-tool/commit/203d7688fa26b624729ce35d978db059ce4da1f8))
- **api:** add missing allowOverwrite to report endpoint blob put ([#739](https://github.com/andymai/gridfinity-layout-tool/issues/739)) ([162b18e](https://github.com/andymai/gridfinity-layout-tool/commit/162b18e8e6d6e3fab4900fdb3e4f0c455b3232d0))
- **baseplate:** defer worker pool exposure until WASM init completes ([#922](https://github.com/andymai/gridfinity-layout-tool/issues/922)) ([2884057](https://github.com/andymai/gridfinity-layout-tool/commit/28840570d8fbffbf7c21c6e3e3e7f2084121677c))
- **baseplate:** pin fractional half-units to edge positions in split tiling ([#902](https://github.com/andymai/gridfinity-layout-tool/issues/902)) ([7af94ea](https://github.com/andymai/gridfinity-layout-tool/commit/7af94ea7be9094087b48d29cf2dcb3b6422ef3a8))
- bin designer UI fixes and remove JSON export from export modal ([#548](https://github.com/andymai/gridfinity-layout-tool/issues/548)) ([9bf5a89](https://github.com/andymai/gridfinity-layout-tool/commit/9bf5a8986f74dedf06198b610fc0aebc8a09dee4))
- **bin-designer:** enable scrolling in saved designs dialog with 9+ designs ([#790](https://github.com/andymai/gridfinity-layout-tool/issues/790)) ([c31fc6b](https://github.com/andymai/gridfinity-layout-tool/commit/c31fc6bc87ab13fd9e4541fe82ca09160b681b9b))
- **bin-designer:** enable scrolling in saved designs dialog with 9+ designs ([#792](https://github.com/andymai/gridfinity-layout-tool/issues/792)) ([872de41](https://github.com/andymai/gridfinity-layout-tool/commit/872de417d9712533f9743033d077bc5862289d6f))
- **bin-designer:** fix export dialog bugs and UX issues ([#850](https://github.com/andymai/gridfinity-layout-tool/issues/850)) ([9b1ba6b](https://github.com/andymai/gridfinity-layout-tool/commit/9b1ba6ba87ba3a29fd0cc32f40a9931b76b990d6))
- **bin-designer:** fix Open in Slicer 400 error and clean up test warnings ([#859](https://github.com/andymai/gridfinity-layout-tool/issues/859)) ([f0f4398](https://github.com/andymai/gridfinity-layout-tool/commit/f0f4398e68d7c1b846d7f470a7c36a92b1e339ea))
- **bin-designer:** fix Open in Slicer 403 by checking all Vercel URL env vars ([#854](https://github.com/andymai/gridfinity-layout-tool/issues/854)) ([13dea6a](https://github.com/andymai/gridfinity-layout-tool/commit/13dea6af95a7e7eeaa60bede353007032150742b))
- **bin-designer:** fix Open in Slicer firing download instead of opening app ([#852](https://github.com/andymai/gridfinity-layout-tool/issues/852)) ([9654a00](https://github.com/andymai/gridfinity-layout-tool/commit/9654a003c965bf82ab912bbb1b7f76e4c2fb4dd5))
- **bin-designer:** mobile UI fixes for touch targets, layout, and UX ([#774](https://github.com/andymai/gridfinity-layout-tool/issues/774)) ([19e8dfb](https://github.com/andymai/gridfinity-layout-tool/commit/19e8dfb805d7814c04d80f7b370a19f54e4d3d53))
- **bin-designer:** optimize 3D preview for mobile web ([#780](https://github.com/andymai/gridfinity-layout-tool/issues/780)) ([611f257](https://github.com/andymai/gridfinity-layout-tool/commit/611f2570074ae064571a94515047d7c3e0734ece))
- **bin-designer:** poll blob URL after upload to handle CDN propagation delay ([#870](https://github.com/andymai/gridfinity-layout-tool/issues/870)) ([f07bb3c](https://github.com/andymai/gridfinity-layout-tool/commit/f07bb3cd77ed1e976bb7b101d3add0209c4d46a6))
- **bin-designer:** preserve stacking lip wall in preview tessellation ([#782](https://github.com/andymai/gridfinity-layout-tool/issues/782)) ([c813a61](https://github.com/andymai/gridfinity-layout-tool/commit/c813a61c1e98c4d7174cd9b080433fe1b79d0980))
- **bin-designer:** use dimension-based tessellation with tight lip tolerance ([#787](https://github.com/andymai/gridfinity-layout-tool/issues/787)) ([54aab1a](https://github.com/andymai/gridfinity-layout-tool/commit/54aab1ab501a5eb2d8fcd73c1834b06fec59fcee))
- **bin-designer:** use Override in 3MF content types for slicer compatibility ([#868](https://github.com/andymai/gridfinity-layout-tool/issues/868)) ([4d69971](https://github.com/andymai/gridfinity-layout-tool/commit/4d699713eb25cf250c7a13ba712f5a1f49a83566))
- **bin-designer:** use scrollbar-thin style in saved designs dialog ([#794](https://github.com/andymai/gridfinity-layout-tool/issues/794)) ([f1b8551](https://github.com/andymai/gridfinity-layout-tool/commit/f1b85512e36322314ab33071f74d8a387cb8745e))
- **build:** export formatDimension from shared utils ([e0fa499](https://github.com/andymai/gridfinity-layout-tool/commit/e0fa499d946bcd8f9eb4d86edba6d4a32cc54178))
- **build:** resolve npm vulnerabilities and build warnings ([#608](https://github.com/andymai/gridfinity-layout-tool/issues/608)) ([e01c9b5](https://github.com/andymai/gridfinity-layout-tool/commit/e01c9b589699d4ae8aefbb9e162273ed0992f067))
- **categories:** widen color picker popup to prevent squished layout ([#756](https://github.com/andymai/gridfinity-layout-tool/issues/756)) ([e3faa80](https://github.com/andymai/gridfinity-layout-tool/commit/e3faa80e20c88fbe9b81758bb3dadb72789d24e6))
- **ci:** remove duplicate push trigger for release-please branch ([#917](https://github.com/andymai/gridfinity-layout-tool/issues/917)) ([3c3b250](https://github.com/andymai/gridfinity-layout-tool/commit/3c3b2509092a6aec4e37f5f923d713ece86296fd))
- **ci:** resolve post-merge ESLint errors in InitErrorFallback and report handler ([7c38671](https://github.com/andymai/gridfinity-layout-tool/commit/7c386710962da69d7073c7040a2de9d5f7767053))
- **ci:** skip Vercel preview builds for release-please branches ([#906](https://github.com/andymai/gridfinity-layout-tool/issues/906)) ([63919e5](https://github.com/andymai/gridfinity-layout-tool/commit/63919e5cdd21508b87044c3ced6e9fad6f04f2d4))
- **ci:** update PostHog source map upload inputs for v2 ([#772](https://github.com/andymai/gridfinity-layout-tool/issues/772)) ([aee03ee](https://github.com/andymai/gridfinity-layout-tool/commit/aee03eeadc22272004cdf8ae5baca74f922587ee))
- cls loading spinner, mobile resize, and vibrate guards ([#876](https://github.com/andymai/gridfinity-layout-tool/issues/876)) ([74074ba](https://github.com/andymai/gridfinity-layout-tool/commit/74074ba795fa878c2f4f6ce6b79cf00bf39437e2))
- **cls:** eliminate loading spinner CLS regression from IndexedDB migration ([#874](https://github.com/andymai/gridfinity-layout-tool/issues/874)) ([a4b2241](https://github.com/andymai/gridfinity-layout-tool/commit/a4b2241f1d72186d5c23d383dea5db496fad8876))
- code review cleanup - memory leaks and error handling ([#592](https://github.com/andymai/gridfinity-layout-tool/issues/592)) ([d9ecfd4](https://github.com/andymai/gridfinity-layout-tool/commit/d9ecfd4227f2ecc5fee2a70ce6e9e86bc82f4d66))
- correct half-lap clearance to 0.1mm per side and add depth relief ([#1031](https://github.com/andymai/gridfinity-layout-tool/issues/1031)) ([7b454c2](https://github.com/andymai/gridfinity-layout-tool/commit/7b454c2718e6ab7a9d8e823bf1100b8397a88a85))
- correct wall cutout sketch orientation and improve penetration depth ([410bccf](https://github.com/andymai/gridfinity-layout-tool/commit/410bccf8c8dbd34d9e868e216f672cbbfd5cfc58))
- correct Y-axis split connector prism positioning ([#1041](https://github.com/andymai/gridfinity-layout-tool/issues/1041)) ([db12346](https://github.com/andymai/gridfinity-layout-tool/commit/db123465905a7aa12bc538f4c8ecb8aa83bd8946))
- default cutout editor to rectangle tool on open ([#1045](https://github.com/andymai/gridfinity-layout-tool/issues/1045)) ([1a0d176](https://github.com/andymai/gridfinity-layout-tool/commit/1a0d17658900280379787d29641e7dcac4ead195))
- **deps:** resolve 5 high-severity Dependabot alerts via npm overrides ([#988](https://github.com/andymai/gridfinity-layout-tool/issues/988)) ([0b6e3a1](https://github.com/andymai/gridfinity-layout-tool/commit/0b6e3a121c43ef7bd99869eed7f1670f96624ea1))
- **deps:** scope minimatch overrides to preserve v3 API for eslint plugins ([#990](https://github.com/andymai/gridfinity-layout-tool/issues/990)) ([b9bb32c](https://github.com/andymai/gridfinity-layout-tool/commit/b9bb32c4bd9af3bf8c926a1f60bdbcadfd85ea59))
- **deps:** update brepjs to v2 and fix undici peer dependency ([89fd031](https://github.com/andymai/gridfinity-layout-tool/commit/89fd031541f32eacc1a0a55a9c7ee74f41078578))
- **deps:** upgrade brepjs 8.3.0→8.8.8 and brepjs-opencascade 0.7.2→0.8.2 ([#992](https://github.com/andymai/gridfinity-layout-tool/issues/992)) ([7f29e88](https://github.com/andymai/gridfinity-layout-tool/commit/7f29e880bd962c7b6701e864543c240eaaa742d5))
- **design-linking:** reconcile design→grid sync on navigation return ([#821](https://github.com/andymai/gridfinity-layout-tool/issues/821)) ([4405181](https://github.com/andymai/gridfinity-layout-tool/commit/440518123e7d0c5ffa3a5ada21f3f4fc6fc00e58))
- **design-linking:** sync inspector dimension changes to linked designs ([#814](https://github.com/andymai/gridfinity-layout-tool/issues/814)) ([9b94f53](https://github.com/andymai/gridfinity-layout-tool/commit/9b94f53146a8e0de7f41fdb1f3ef46c3b8c8a5f5))
- disable threaded WASM — Emscripten pthreads incompatible with Vite ([#1011](https://github.com/andymai/gridfinity-layout-tool/issues/1011)) ([9bc5d46](https://github.com/andymai/gridfinity-layout-tool/commit/9bc5d4691d531cf0da3c1faa5a5f7bf3bcc7ff6a))
- divider height stepper stuck after decreasing from auto ([36815f9](https://github.com/andymai/gridfinity-layout-tool/commit/36815f922bfff88e0e4250411b9ff5c928eaa717))
- **e2e:** update Playwright tests for current UI state ([#946](https://github.com/andymai/gridfinity-layout-tool/issues/946)) ([063131a](https://github.com/andymai/gridfinity-layout-tool/commit/063131a9099f8a53ccc3c334173f7c8176ad86e8))
- **feedback:** address review comments on sanitization and formatting ([#733](https://github.com/andymai/gridfinity-layout-tool/issues/733)) ([e35bf3c](https://github.com/andymai/gridfinity-layout-tool/commit/e35bf3c8451c6c3ae5ff745e188f4f1a03146e9d))
- floor tongue skipped at default wall thickness due to floating point ([3cfbe68](https://github.com/andymai/gridfinity-layout-tool/commit/3cfbe68eef946d3007a1bc356d740fdca4e03031))
- **generation:** add mainScriptUrlOrBlob for threaded WASM module resolution ([#604](https://github.com/andymai/gridfinity-layout-tool/issues/604)) ([cc29444](https://github.com/andymai/gridfinity-layout-tool/commit/cc294444ef52a795a982a6ae02f607a306a244a6))
- **generation:** address PR review feedback for slot export fix ([#927](https://github.com/andymai/gridfinity-layout-tool/issues/927)) ([2443223](https://github.com/andymai/gridfinity-layout-tool/commit/244322370ce6c58b8065c5d30e8a6eb87ceae4f4))
- **generation:** resolve non-manifold slot geometry on STL export ([#921](https://github.com/andymai/gridfinity-layout-tool/issues/921)) ([#923](https://github.com/andymai/gridfinity-layout-tool/issues/923)) ([4b328d6](https://github.com/andymai/gridfinity-layout-tool/commit/4b328d6017d3d7fb29760ee739dd8a851745344c))
- **grid-editor:** clamp fractional row/column coords to valid half-bin positions ([#737](https://github.com/andymai/gridfinity-layout-tool/issues/737)) ([f7fb02c](https://github.com/andymai/gridfinity-layout-tool/commit/f7fb02c43c479a196aef49c1ad250cc9b01756b1))
- handle legacy bin designer designs missing compartments field ([#650](https://github.com/andymai/gridfinity-layout-tool/issues/650)) ([392dacd](https://github.com/andymai/gridfinity-layout-tool/commit/392dacd8a32c8748334d9a9f5afd22bf7680c738))
- hide SEO fallback content flash on page load ([#714](https://github.com/andymai/gridfinity-layout-tool/issues/714)) ([b278ded](https://github.com/andymai/gridfinity-layout-tool/commit/b278ded69e84ebec1d455c15a8b102c6509c63c9))
- honeycomb wall pattern for 3u bins ([#595](https://github.com/andymai/gridfinity-layout-tool/issues/595)) ([0c80a95](https://github.com/andymai/gridfinity-layout-tool/commit/0c80a958f62922d886059c0bbeeb35f4fcfc8aae))
- **i18n:** eliminate CLS from fullscreen loading spinner on initial render ([#915](https://github.com/andymai/gridfinity-layout-tool/issues/915)) ([3adfbe1](https://github.com/andymai/gridfinity-layout-tool/commit/3adfbe1273e22cf86fd4be6eb471315992c692c2))
- **icons:** eliminate transparent corners in favicon and PWA icons ([#840](https://github.com/andymai/gridfinity-layout-tool/issues/840)) ([3c7c03c](https://github.com/andymai/gridfinity-layout-tool/commit/3c7c03cfb371a2f7009fe003acb62563de3d42da))
- inset focus rings, pattern registry fallback, and honeycomb icon ([#616](https://github.com/andymai/gridfinity-layout-tool/issues/616)) ([01bcd00](https://github.com/andymai/gridfinity-layout-tool/commit/01bcd0049799c16d613c0e7e04901f43f75f9b13))
- **lint:** resolve all 10 ESLint no-unnecessary-condition warnings ([#761](https://github.com/andymai/gridfinity-layout-tool/issues/761)) ([7b831f3](https://github.com/andymai/gridfinity-layout-tool/commit/7b831f3002c1fd4fbb8b4fa5e63db42e2607d16f))
- make half-lap connectors work with stacking lip ([#1034](https://github.com/andymai/gridfinity-layout-tool/issues/1034)) ([2ead738](https://github.com/andymai/gridfinity-layout-tool/commit/2ead7386c86484dbf68d909a803aa5c3ff09f0e8))
- make split connector booleans robust for threaded OCCT builds ([#1023](https://github.com/andymai/gridfinity-layout-tool/issues/1023)) ([58e9810](https://github.com/andymai/gridfinity-layout-tool/commit/58e98106b1f21fe5022b52aefcb56cfd3b16267f))
- **mobile:** improve touch grid usability and polish mobile UX ([3066246](https://github.com/andymai/gridfinity-layout-tool/commit/3066246a58bb19d1dac29e38de2e48ee640d0969))
- **mobile:** make settings modal responsive on mobile viewports ([#904](https://github.com/andymai/gridfinity-layout-tool/issues/904)) ([a5f3466](https://github.com/andymai/gridfinity-layout-tool/commit/a5f3466c07bb54400e2ea88e8002350898a9ee2e))
- **mobile:** use portrait-oriented default drawer size on mobile ([#878](https://github.com/andymai/gridfinity-layout-tool/issues/878)) ([94b0313](https://github.com/andymai/gridfinity-layout-tool/commit/94b031391d3da1fd079bc0300528b4fc92bea126))
- move baseplate export button next to tool switcher for discoverability ([#1043](https://github.com/andymai/gridfinity-layout-tool/issues/1043)) ([4d7d216](https://github.com/andymai/gridfinity-layout-tool/commit/4d7d216f0baa6324dfc28ee8c7ce15c0943f39eb))
- overhaul split bin generation chain ([#1027](https://github.com/andymai/gridfinity-layout-tool/issues/1027)) ([270f768](https://github.com/andymai/gridfinity-layout-tool/commit/270f76843b2cd94bd8ea9b1c436156e62e25e9b9))
- pass gridUnitMm and categories to mobile TSV export ([6d86076](https://github.com/andymai/gridfinity-layout-tool/commit/6d86076a26ce58bc42cd7b4b33cd6c11caa68baa))
- patch undici security vulnerabilities in @vercel/node ([#598](https://github.com/andymai/gridfinity-layout-tool/issues/598)) ([f254646](https://github.com/andymai/gridfinity-layout-tool/commit/f2546466675e6b36fae3eb334b7a80be13033055))
- polyfill Symbol.dispose for brepjs compatibility with older browsers ([#996](https://github.com/andymai/gridfinity-layout-tool/issues/996)) ([bac311d](https://github.com/andymai/gridfinity-layout-tool/commit/bac311ddd8c29071497b33b44d5311b8a8993589))
- prevent floating inspector panel jitter during slider interaction ([#689](https://github.com/andymai/gridfinity-layout-tool/issues/689)) ([6d7d711](https://github.com/andymai/gridfinity-layout-tool/commit/6d7d7111f799471736b4a43b68eaf6833ea02a15))
- prevent interior controls from being overwritten by event bubbling ([#698](https://github.com/andymai/gridfinity-layout-tool/issues/698)) ([d3b3e81](https://github.com/andymai/gridfinity-layout-tool/commit/d3b3e81aeef327d6e8977e495c949bd3ff1df58e))
- prevent WASM memory access crashes from degenerate geometry ([#703](https://github.com/andymai/gridfinity-layout-tool/issues/703)) ([0e93d1e](https://github.com/andymai/gridfinity-layout-tool/commit/0e93d1ef1150feec935c9927c5ad3f9442d2139f))
- **print-export:** fix multiple bugs and i18n issues in print modal ([#827](https://github.com/andymai/gridfinity-layout-tool/issues/827)) ([89117a1](https://github.com/andymai/gridfinity-layout-tool/commit/89117a1bcd4960612b65ae82b898c46974a485fa))
- re-enable threaded WASM for OpenCascade ([#1013](https://github.com/andymai/gridfinity-layout-tool/issues/1013)) ([b855ab0](https://github.com/andymai/gridfinity-layout-tool/commit/b855ab0d328235359daf7405a56eb4fcdb467048))
- remove stacking lip from split bin interior cut faces ([#1017](https://github.com/andymai/gridfinity-layout-tool/issues/1017)) ([f9661c4](https://github.com/andymai/gridfinity-layout-tool/commit/f9661c422ac0936a71afc75374433f8d7d8aeea5))
- render split bin pieces in both assembled and exploded modes ([#1021](https://github.com/andymai/gridfinity-layout-tool/issues/1021)) ([bd1dd8a](https://github.com/andymai/gridfinity-layout-tool/commit/bd1dd8ac50b536d537a5be61a8d8f8fb4c37f23f))
- reset floating inspector position lock on hide/selection change ([#691](https://github.com/andymai/gridfinity-layout-tool/issues/691)) ([da46a36](https://github.com/andymai/gridfinity-layout-tool/commit/da46a36fdb6c15dfe7f62a9e06f103c694eb39a4))
- resolve all test failures after ESLint lint fix PR ([#695](https://github.com/andymai/gridfinity-layout-tool/issues/695)) ([#696](https://github.com/andymai/gridfinity-layout-tool/issues/696)) ([524994a](https://github.com/andymai/gridfinity-layout-tool/commit/524994a6f36a907f2439b63505493e476631e650))
- resolve ESLint errors and add missing tests ([#563](https://github.com/andymai/gridfinity-layout-tool/issues/563)) ([485f776](https://github.com/andymai/gridfinity-layout-tool/commit/485f776c0e2cd4ffc7ae20189e8d51c9c267f472))
- resolve pinched scoop at merged cutout junctions ([#681](https://github.com/andymai/gridfinity-layout-tool/issues/681)) ([792fbf3](https://github.com/andymai/gridfinity-layout-tool/commit/792fbf3a229eb4ce73b40e6ab61356536ffd4a3f))
- resolve pthread worker script path for threaded WASM ([#1009](https://github.com/andymai/gridfinity-layout-tool/issues/1009)) ([3cb854f](https://github.com/andymai/gridfinity-layout-tool/commit/3cb854fc763d04c82e61441c883a4ae4e770b62f))
- resolve TypeScript errors in Vercel API build ([#808](https://github.com/andymai/gridfinity-layout-tool/issues/808)) ([1a39d8b](https://github.com/andymai/gridfinity-layout-tool/commit/1a39d8b6649063eccb73b6af131c01f048062c29))
- restore locateFile override for WASM loading in ES module workers ([#994](https://github.com/andymai/gridfinity-layout-tool/issues/994)) ([f07ef47](https://github.com/andymai/gridfinity-layout-tool/commit/f07ef471204c36125c9b9e743f5fd632cfa61d63))
- retry WASM worker init on failure and fix preload cache mismatch ([#1007](https://github.com/andymai/gridfinity-layout-tool/issues/1007)) ([1619038](https://github.com/andymai/gridfinity-layout-tool/commit/1619038123a9196fd85e65da3efc75945140462a))
- **security:** address 8 security audit findings (H-1 through L-4) ([#888](https://github.com/andymai/gridfinity-layout-tool/issues/888)) ([1599490](https://github.com/andymai/gridfinity-layout-tool/commit/1599490056d3dfbf7c4c7a4709566cd93e717d07))
- **seo:** shorten meta descriptions to 100-130 characters ([#556](https://github.com/andymai/gridfinity-layout-tool/issues/556)) ([8cba243](https://github.com/andymai/gridfinity-layout-tool/commit/8cba2432429538042cb7822a82431db57f970033))
- **settings:** remove grid visuals settings and use defaults ([#753](https://github.com/andymai/gridfinity-layout-tool/issues/753)) ([ad1108c](https://github.com/andymai/gridfinity-layout-tool/commit/ad1108ce426b4bc5364f4a78913f9169a6f9a55a))
- **settings:** stabilize modal height and add mobile fullscreen ([#751](https://github.com/andymai/gridfinity-layout-tool/issues/751)) ([221a463](https://github.com/andymai/gridfinity-layout-tool/commit/221a4634db52207face06f76073217b1555f6e73))
- shorten divider length to prevent bowing and align lip with gridfinity spec ([e55dc1c](https://github.com/andymai/gridfinity-layout-tool/commit/e55dc1c4666c5e4b0dd3da2cf0a7c612cd6bbba5))
- shorten divider length to prevent bowing, align lip with gridfinity spec ([#569](https://github.com/andymai/gridfinity-layout-tool/issues/569)) ([002d1c5](https://github.com/andymai/gridfinity-layout-tool/commit/002d1c5dd563d5a4ba1b1f47d7dfdadf8590e936))
- **slicer:** use correct `file=` parameter in protocol handler URLs ([#872](https://github.com/andymai/gridfinity-layout-tool/issues/872)) ([87e5118](https://github.com/andymai/gridfinity-layout-tool/commit/87e51187a4ce16d9319ed7566b130e024a15d2ec))
- snap staging drag to nearest valid position to prevent flickering ([#719](https://github.com/andymai/gridfinity-layout-tool/issues/719)) ([5bb4bb0](https://github.com/andymai/gridfinity-layout-tool/commit/5bb4bb0df8afc164b514b8ccc3628e8ea8d8d0df))
- start wall slot cuts at floor surface, not socket interface ([d006f59](https://github.com/andymai/gridfinity-layout-tool/commit/d006f59c8a1ec28c66e397a2f851987040110bff))
- stash rotate button clipping and move-to-grid context menu ([#837](https://github.com/andymai/gridfinity-layout-tool/issues/837)) ([f14cc84](https://github.com/andymai/gridfinity-layout-tool/commit/f14cc841d4a579d46e12b8be6776ea1185fe2e79))
- **storage:** fix www→canonical migration library merge and edge cases ([#860](https://github.com/andymai/gridfinity-layout-tool/issues/860)) ([a391b6c](https://github.com/andymai/gridfinity-layout-tool/commit/a391b6cc3d06ae69a7d4d7165a784c71bdbb9c6b))
- **storage:** make clearAllData async to prevent IndexedDB reload race ([#889](https://github.com/andymai/gridfinity-layout-tool/issues/889)) ([c4cf9c9](https://github.com/andymai/gridfinity-layout-tool/commit/c4cf9c929f392401ff1429a487615214fca48b3f))
- **storage:** salvage layouts with bin collisions instead of rejecting ([#819](https://github.com/andymai/gridfinity-layout-tool/issues/819)) ([fb65d19](https://github.com/andymai/gridfinity-layout-tool/commit/fb65d19ab417512a373e18e2a656f12dd2805886))
- **sw:** exclude wwwMigration chunk from service worker precache ([#866](https://github.com/andymai/gridfinity-layout-tool/issues/866)) ([7081a81](https://github.com/andymai/gridfinity-layout-tool/commit/7081a81060e8e8058265c71fc1219d35089cd246))
- **types:** accept nullable activeLayoutId in resolveLayout ([#746](https://github.com/andymai/gridfinity-layout-tool/issues/746)) ([a6e462b](https://github.com/andymai/gridfinity-layout-tool/commit/a6e462be5ecec75f3ae4f35fe45d3d3cf94735d4))
- update tests for post-merge API changes ([1e0debc](https://github.com/andymai/gridfinity-layout-tool/commit/1e0debc6988f7850dc2978afee35cb6881b1a65a))
- use configurable clearance for half-lap wall joints and add wall tab protrusion tests ([da8fd9c](https://github.com/andymai/gridfinity-layout-tool/commit/da8fd9c779735c1094550c3149eeb8b43dc4d9b3))
- **validation:** reject zero/negative dimensions in type guards ([#743](https://github.com/andymai/gridfinity-layout-tool/issues/743)) ([7124558](https://github.com/andymai/gridfinity-layout-tool/commit/7124558dd8a1e3f5cbb9a5288b9d2f340a9781dc))
- widen onRemediate prop type to accept sync callbacks ([#637](https://github.com/andymai/gridfinity-layout-tool/issues/637)) ([df0ece3](https://github.com/andymai/gridfinity-layout-tool/commit/df0ece38a421326c5515ce67c2314f424a754d29))
- widen return types to include LayoutLibraryLimitError ([#770](https://github.com/andymai/gridfinity-layout-tool/issues/770)) ([063c570](https://github.com/andymai/gridfinity-layout-tool/commit/063c5700b9839a8cc81d17e365382b5ef5c1ad7a))
- **www-migration:** fix empty-layout bug and add canonical IDB integrity verification ([#862](https://github.com/andymai/gridfinity-layout-tool/issues/862)) ([fa72d5c](https://github.com/andymai/gridfinity-layout-tool/commit/fa72d5c95bdad9933e0cadd390fe2cebc1f48cc3))
- **www-migration:** handle blank iframe onload before bridge navigates ([#864](https://github.com/andymai/gridfinity-layout-tool/issues/864)) ([98ff871](https://github.com/andymai/gridfinity-layout-tool/commit/98ff871989fca2ae2f10dfbc0a3bbe281ef4e4cb))

### Performance

- **baseplate:** add intermediate slab-with-pockets cache and increase cache sizes ([#910](https://github.com/andymai/gridfinity-layout-tool/issues/910)) ([026deb9](https://github.com/andymai/gridfinity-layout-tool/commit/026deb92a0e62113f6ae79abb154e891a984361a))
- **baseplate:** add worker pool for parallel split piece generation ([#911](https://github.com/andymai/gridfinity-layout-tool/issues/911)) ([c625f46](https://github.com/andymai/gridfinity-layout-tool/commit/c625f468d303d3d826cfea14cf709ae3128d2036))
- **baseplate:** batch all CSG boolean operations into single passes ([#908](https://github.com/andymai/gridfinity-layout-tool/issues/908)) ([0ca8dca](https://github.com/andymai/gridfinity-layout-tool/commit/0ca8dca1ec12891f9010a7e461e13eedde1ad61e))
- **baseplate:** optimize tessellation with adaptive tolerance and skip edge mesh ([#912](https://github.com/andymai/gridfinity-layout-tool/issues/912)) ([20ca5fc](https://github.com/andymai/gridfinity-layout-tool/commit/20ca5fccda82692baf26ffa6b121f9446e66a5b6))
- cache assembled shell (base + box + lip) across generation calls ([#581](https://github.com/andymai/gridfinity-layout-tool/issues/581)) ([966d6b2](https://github.com/andymai/gridfinity-layout-tool/commit/966d6b2cb9f6aec0465ae604f5c11271d0bc0e5b))
- cache intermediate shapes across generation calls ([#580](https://github.com/andymai/gridfinity-layout-tool/issues/580)) ([ac6bdfb](https://github.com/andymai/gridfinity-layout-tool/commit/ac6bdfb52df256ff6a34aff42e130f1b2069e276))
- optimize 3D preview rendering and grid computations ([#612](https://github.com/andymai/gridfinity-layout-tool/issues/612)) ([f1c0e63](https://github.com/andymai/gridfinity-layout-tool/commit/f1c0e63dd7d10e644283b094a8af915d08d0c4ea))
- optimize bin designer generation pipeline ([#686](https://github.com/andymai/gridfinity-layout-tool/issues/686)) ([fc3bfb8](https://github.com/andymai/gridfinity-layout-tool/commit/fc3bfb85513e640cac9117d339e1e5c4e093afe1))
- reduce main bundle size by 27% via lazy loading ([#817](https://github.com/andymai/gridfinity-layout-tool/issues/817)) ([5c0696b](https://github.com/andymai/gridfinity-layout-tool/commit/5c0696b68786872fb5214db948759d65588e22b9))
- **tests:** eliminate redundant cleanup, real-timer sleeps, and unnecessary overhead ([#884](https://github.com/andymai/gridfinity-layout-tool/issues/884)) ([fc5a19d](https://github.com/andymai/gridfinity-layout-tool/commit/fc5a19dea820cd33b086b1eef2ea351ececde698))
- use brepjs composeTransforms for wall pattern generation ([#702](https://github.com/andymai/gridfinity-layout-tool/issues/702)) ([dbaa95c](https://github.com/andymai/gridfinity-layout-tool/commit/dbaa95c7a0be75c6cfcfb2150551648b2f7eacf6))

## [4.1.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.0.4...gridfinity-layout-tool-v4.1.0) (2026-03-04)

### Features

- add flip horizontal/vertical to cutout editor ([#1047](https://github.com/andymai/gridfinity-layout-tool/issues/1047)) ([70a35f3](https://github.com/andymai/gridfinity-layout-tool/commit/70a35f359c9eef5a1303a8ea64aa6d8358ddb9f7))

### Bug Fixes

- default cutout editor to rectangle tool on open ([#1045](https://github.com/andymai/gridfinity-layout-tool/issues/1045)) ([1a0d176](https://github.com/andymai/gridfinity-layout-tool/commit/1a0d17658900280379787d29641e7dcac4ead195))

## [4.0.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.0.3...gridfinity-layout-tool-v4.0.4) (2026-03-04)

### Bug Fixes

- move baseplate export button next to tool switcher for discoverability ([#1043](https://github.com/andymai/gridfinity-layout-tool/issues/1043)) ([4d7d216](https://github.com/andymai/gridfinity-layout-tool/commit/4d7d216f0baa6324dfc28ee8c7ce15c0943f39eb))

## [4.0.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.0.2...gridfinity-layout-tool-v4.0.3) (2026-03-04)

### Bug Fixes

- correct Y-axis split connector prism positioning ([#1041](https://github.com/andymai/gridfinity-layout-tool/issues/1041)) ([db12346](https://github.com/andymai/gridfinity-layout-tool/commit/db123465905a7aa12bc538f4c8ecb8aa83bd8946))

## [4.0.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.0.1...gridfinity-layout-tool-v4.0.2) (2026-03-04)

### Bug Fixes

- add volumetric overlap for split bin lip fuse to eliminate geometry artifacts ([#1039](https://github.com/andymai/gridfinity-layout-tool/issues/1039)) ([ffd6791](https://github.com/andymai/gridfinity-layout-tool/commit/ffd6791a3f284ab281135a3e71ac359502163bf3))

## [4.0.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v4.0.0...gridfinity-layout-tool-v4.0.1) (2026-03-04)

### Bug Fixes

- use configurable clearance for half-lap wall joints and add wall tab protrusion tests ([da8fd9c](https://github.com/andymai/gridfinity-layout-tool/commit/da8fd9c779735c1094550c3149eeb8b43dc4d9b3))

## [4.0.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.54.2...gridfinity-layout-tool-v4.0.0) (2026-03-04)

### ⚠ BREAKING CHANGES

- topOffset is now a global setting in cutoutConfig, not per-cutout

### Features

- add AbortSignal cancellation for mid-operation generation abort ([#640](https://github.com/andymai/gridfinity-layout-tool/issues/640)) ([ac1cb55](https://github.com/andymai/gridfinity-layout-tool/commit/ac1cb550102caf3855985848a286fa7f40e0f242))
- add alignment connectors to split bin exports ([#1004](https://github.com/andymai/gridfinity-layout-tool/issues/1004)) ([c1361b2](https://github.com/andymai/gridfinity-layout-tool/commit/c1361b2af466613bbfa1ffb98813ec39468e36c7))
- add branded ID types for compile-time type safety ([7918752](https://github.com/andymai/gridfinity-layout-tool/commit/791875291220fefb0301caa6ab953a8356dc0dcf))
- add bulk export/import for all layouts ([#802](https://github.com/andymai/gridfinity-layout-tool/issues/802)) ([a6c5bc7](https://github.com/andymai/gridfinity-layout-tool/commit/a6c5bc75aeed22e68fba71751bf9982c2f085afc))
- add constraint resolution engine for bin designer ([#693](https://github.com/andymai/gridfinity-layout-tool/issues/693)) ([053273e](https://github.com/andymai/gridfinity-layout-tool/commit/053273e59fc27ef4a93737bd7073447d49fcf1d0))
- add design system with CVA-based component architecture ([#618](https://github.com/andymai/gridfinity-layout-tool/issues/618)) ([91ae9a3](https://github.com/andymai/gridfinity-layout-tool/commit/91ae9a3c2619dab3bf178686eefbb43772e66668))
- add face origin provenance pipeline (brepjs 8.3.0) ([#763](https://github.com/andymai/gridfinity-layout-tool/issues/763)) ([7fbc59a](https://github.com/andymai/gridfinity-layout-tool/commit/7fbc59ad171446dcbfa41e4f36b7091786a58fb5))
- add feedback UI with GitHub Issue creation ([#722](https://github.com/andymai/gridfinity-layout-tool/issues/722)) ([707580d](https://github.com/andymai/gridfinity-layout-tool/commit/707580d0f748adc2d1f81d6cc4ceaec89cd7a6a4))
- add flat floor (no socket) base option to bin designer ([#621](https://github.com/andymai/gridfinity-layout-tool/issues/621)) ([f3bdaa6](https://github.com/andymai/gridfinity-layout-tool/commit/f3bdaa6e80d5e4a4ef3640109e4a31e7f8add50e))
- add half sockets option for bins ([#659](https://github.com/andymai/gridfinity-layout-tool/issues/659)) ([1973458](https://github.com/andymai/gridfinity-layout-tool/commit/19734585b9e6e12f46a0d97b09da83ad3f3ca105))
- add half-lap wall connectors for thin walls (&lt; 1.4mm) ([#1029](https://github.com/andymai/gridfinity-layout-tool/issues/1029)) ([c98410f](https://github.com/andymai/gridfinity-layout-tool/commit/c98410f4107fe1bb7b546518191554584161ac17))
- add honeycomb wall cutouts to bin designer ([#589](https://github.com/andymai/gridfinity-layout-tool/issues/589)) ([b5fe8a2](https://github.com/andymai/gridfinity-layout-tool/commit/b5fe8a2a2144eb60e3716b080c9c3759b6ec23c6))
- add i18n untranslated values check and translate ~1,200 locale strings ([#571](https://github.com/andymai/gridfinity-layout-tool/issues/571)) ([78407b4](https://github.com/andymai/gridfinity-layout-tool/commit/78407b4de0ff9eaef4b55d97c67369891b20f2bb))
- add multi-format export (STL / STEP / 3MF) to bin designer ([#683](https://github.com/andymai/gridfinity-layout-tool/issues/683)) ([7f62eae](https://github.com/andymai/gridfinity-layout-tool/commit/7f62eae34f85311bc6f84955b4020344e6596c16))
- add pen tool for freeform path cutouts ([#685](https://github.com/andymai/gridfinity-layout-tool/issues/685)) ([ca16505](https://github.com/andymai/gridfinity-layout-tool/commit/ca165058dc21634cad4e1358388f2500be97020f))
- add ruler measurement tool to cutout editor ([#706](https://github.com/andymai/gridfinity-layout-tool/issues/706)) ([31e9d0d](https://github.com/andymai/gridfinity-layout-tool/commit/31e9d0d9bef8c4da04c70f4c8688409416fea559))
- add scoop and funnel wall cutout shapes ([523439e](https://github.com/andymai/gridfinity-layout-tool/commit/523439e651483dba11153a326ec167e25b7c0196))
- add shape cutouts for solid bins in bin designer ([#629](https://github.com/andymai/gridfinity-layout-tool/issues/629)) ([f5fb107](https://github.com/andymai/gridfinity-layout-tool/commit/f5fb107a0f9a8e888f6dee004dfe8b5bd1c378f2))
- add solid parameter to BaseConfig for future cutouts support ([#624](https://github.com/andymai/gridfinity-layout-tool/issues/624)) ([9a9ecad](https://github.com/andymai/gridfinity-layout-tool/commit/9a9ecade822cf58ff8087c93898bc2b89a02d77a))
- add Storage dashboard tab in Settings ([#801](https://github.com/andymai/gridfinity-layout-tool/issues/801)) ([60447b7](https://github.com/andymai/gridfinity-layout-tool/commit/60447b7d5382b76d35165645842102a6df66c112))
- add unused i18n key detection script ([#541](https://github.com/andymai/gridfinity-layout-tool/issues/541)) ([94a706b](https://github.com/andymai/gridfinity-layout-tool/commit/94a706ba74e6a55610297c37e7a78349dad7fe92))
- add wall cutout feature to bin designer ([cdd1fe0](https://github.com/andymai/gridfinity-layout-tool/commit/cdd1fe05d629ce48e8b859610d2af0f0d14e36ec))
- add wall cutout feature to bin designer ([#707](https://github.com/andymai/gridfinity-layout-tool/issues/707)) ([8675067](https://github.com/andymai/gridfinity-layout-tool/commit/86750678196951e561d02a4d615c49fccc727ae0))
- always show ToolSwitcher in baseplate generator header ([#1019](https://github.com/andymai/gridfinity-layout-tool/issues/1019)) ([8e6f0e8](https://github.com/andymai/gridfinity-layout-tool/commit/8e6f0e894632cc9ab5e9c8fcf1bb30d134d08082))
- **analytics:** replace Vercel heartbeat with rich PostHog heartbeat ([#886](https://github.com/andymai/gridfinity-layout-tool/issues/886)) ([ec2070f](https://github.com/andymai/gridfinity-layout-tool/commit/ec2070f8dcbc49c88bca9764eed918dcace53739))
- **api:** add hourly cron to clean up expired slicer-temp blobs ([#848](https://github.com/andymai/gridfinity-layout-tool/issues/848)) ([4bac1f8](https://github.com/andymai/gridfinity-layout-tool/commit/4bac1f86a3c1c10eb4524b6d20e6d9af3cd4c294))
- auto-clean localStorage layout backups ([#800](https://github.com/andymai/gridfinity-layout-tool/issues/800)) ([6391445](https://github.com/andymai/gridfinity-layout-tool/commit/6391445e4d37feea3aa1be6a72cdbfc749e4ed58))
- auto-enable half-bin mode on fractional grid input ([#634](https://github.com/andymai/gridfinity-layout-tool/issues/634)) ([908cc5b](https://github.com/andymai/gridfinity-layout-tool/commit/908cc5bee1649ebb9f6f86769c158808284b58ac))
- **baseplate:** 3D preview visual polish ([#939](https://github.com/andymai/gridfinity-layout-tool/issues/939)) ([7860d29](https://github.com/andymai/gridfinity-layout-tool/commit/7860d297c333b6164fd72b1778b2648b9ef8285b))
- **baseplate:** add custom grid size with "Synced with layout" toggle ([#918](https://github.com/andymai/gridfinity-layout-tool/issues/918)) ([fa18138](https://github.com/andymai/gridfinity-layout-tool/commit/fa181380a560f59b0226b425702fc13c75e48972))
- **baseplate:** add dovetail connectors for split baseplate pieces ([#900](https://github.com/andymai/gridfinity-layout-tool/issues/900)) ([0e36ab9](https://github.com/andymai/gridfinity-layout-tool/commit/0e36ab9850cb77de24c6c4a665890af1f1b7f657))
- **baseplate:** add edge lines, improve tessellation, and polish 3D preview ([#925](https://github.com/andymai/gridfinity-layout-tool/issues/925)) ([985d314](https://github.com/andymai/gridfinity-layout-tool/commit/985d3146e9bcdd86e9dad032df1c374629df0264))
- **baseplate:** add magnet holes and direct mesh generator ([#896](https://github.com/andymai/gridfinity-layout-tool/issues/896)) ([d7804c4](https://github.com/andymai/gridfinity-layout-tool/commit/d7804c48bfc1bd454439b568f94cba0ce60027ee))
- **baseplate:** add standalone baseplate generator ([#892](https://github.com/andymai/gridfinity-layout-tool/issues/892)) ([94c8f49](https://github.com/andymai/gridfinity-layout-tool/commit/94c8f49d5492c3b05c33c51e1430d1ee8f66eb5e))
- **baseplate:** graduate generator and add SEO landing page ([#937](https://github.com/andymai/gridfinity-layout-tool/issues/937)) ([7a54033](https://github.com/andymai/gridfinity-layout-tool/commit/7a5403395f3d3ec281c884b81a621a51f1759771))
- **baseplate:** improve panel hierarchy, loading UX, and section transitions ([#944](https://github.com/andymai/gridfinity-layout-tool/issues/944)) ([4262810](https://github.com/andymai/gridfinity-layout-tool/commit/426281021610e285f7a092e9e5676a3a6f8ef2e1))
- **baseplate:** replace greedy 1D split with optimal 2D tiling ([#898](https://github.com/andymai/gridfinity-layout-tool/issues/898)) ([a18622c](https://github.com/andymai/gridfinity-layout-tool/commit/a18622c868e183aeb9211532a231d5bbde4eef27))
- **baseplate:** shared ExportDialog with parallel export and slicer integration ([#932](https://github.com/andymai/gridfinity-layout-tool/issues/932)) ([2a8dfe1](https://github.com/andymai/gridfinity-layout-tool/commit/2a8dfe1daec3f2d780e9ce30f5e1c4f90212ad0d))
- **baseplate:** spatial padding schematic for edge padding section ([#935](https://github.com/andymai/gridfinity-layout-tool/issues/935)) ([994fcac](https://github.com/andymai/gridfinity-layout-tool/commit/994fcac178791a6d2c5c6ab2e01b02b152fbd554))
- **bin-designer:** add Open in Slicer deep-link export ([#846](https://github.com/andymai/gridfinity-layout-tool/issues/846)) ([39d70df](https://github.com/andymai/gridfinity-layout-tool/commit/39d70df3ca6e33b5e7684389e3bba8763f8bd08f))
- **bin-designer:** auto-enable half-bin mode when fractional dimension is typed ([#893](https://github.com/andymai/gridfinity-layout-tool/issues/893)) ([d26a4bc](https://github.com/andymai/gridfinity-layout-tool/commit/d26a4bcc4ef822e6943370e872c535c715dcf2c3))
- **bin-designer:** cutout editor UX polish ([#964](https://github.com/andymai/gridfinity-layout-tool/issues/964)) ([8abacea](https://github.com/andymai/gridfinity-layout-tool/commit/8abacea39c0b32c7ca2123fd8e7391165cd00279))
- **bin-designer:** improve cutout editor onboarding and discoverability ([#962](https://github.com/andymai/gridfinity-layout-tool/issues/962)) ([fb059c7](https://github.com/andymai/gridfinity-layout-tool/commit/fb059c77e50e4812f33a3a13680edc8123455531))
- **bin-designer:** pattern registry architecture and dropdown UI ([#614](https://github.com/andymai/gridfinity-layout-tool/issues/614)) ([d68158b](https://github.com/andymai/gridfinity-layout-tool/commit/d68158b1f37aed1e858418f0fa9ac5ae6b7e11e5))
- branded ID types for compile-time type safety ([#567](https://github.com/andymai/gridfinity-layout-tool/issues/567)) ([cee698c](https://github.com/andymai/gridfinity-layout-tool/commit/cee698ca3ba0e6020b6c2e6d64f0e3b879a3932f))
- **design-linking:** auto-sync linked bin design dimensions ([#812](https://github.com/andymai/gridfinity-layout-tool/issues/812)) ([e31a86c](https://github.com/andymai/gridfinity-layout-tool/commit/e31a86c826c85aa87253ad034199d7f424090104))
- **export:** make 3MF the default export format ([#966](https://github.com/andymai/gridfinity-layout-tool/issues/966)) ([a4bc7af](https://github.com/andymai/gridfinity-layout-tool/commit/a4bc7af9fe15e46b8e226ab4cac49b0a747e18a1))
- **feedback:** llm-enriched issue creation with priority and duplicate detection ([#731](https://github.com/andymai/gridfinity-layout-tool/issues/731)) ([cd4ea84](https://github.com/andymai/gridfinity-layout-tool/commit/cd4ea847ec07988a59d57b991b6aa9b484317301))
- finger scoop with stacking lip alignment ([#668](https://github.com/andymai/gridfinity-layout-tool/issues/668)) ([cf4cdcc](https://github.com/andymai/gridfinity-layout-tool/commit/cf4cdcc5ae8010546862a9ef53e7d4ad2f18da43))
- **generation:** add magnet support for half-unit bins and baseplates ([#920](https://github.com/andymai/gridfinity-layout-tool/issues/920)) ([f4081a0](https://github.com/andymai/gridfinity-layout-tool/commit/f4081a0fbb7557133ba4d6b926bb6ec09df953c8))
- **generation:** add multi-threaded WASM support for OpenCascade ([#600](https://github.com/andymai/gridfinity-layout-tool/issues/600)) ([0a3487b](https://github.com/andymai/gridfinity-layout-tool/commit/0a3487bb9acbd65a7967c164b78041a368780354))
- **generation:** indexedDB WASM module caching + shared pool compilation ([#950](https://github.com/andymai/gridfinity-layout-tool/issues/950)) ([980f8ae](https://github.com/andymai/gridfinity-layout-tool/commit/980f8ae36ed3e9c764c3ec73de0a1009c9784fee))
- **generation:** rotate honeycomb hex cutouts to pointy-top orientation ([#606](https://github.com/andymai/gridfinity-layout-tool/issues/606)) ([de4a067](https://github.com/andymai/gridfinity-layout-tool/commit/de4a067183884f9ab1a8df674759668d660fa740))
- **generation:** shared BridgeManager with WASM preloading ([#948](https://github.com/andymai/gridfinity-layout-tool/issues/948)) ([9b0d0bb](https://github.com/andymai/gridfinity-layout-tool/commit/9b0d0bbe571050f2297348a7f11c9879054d21e4))
- **generation:** upgrade to brepjs 4.0.3 with minification-safe isShape3D ([7b540d8](https://github.com/andymai/gridfinity-layout-tool/commit/7b540d8389a5aee713596ddd1fcd12b4da199572))
- **i18n:** consolidate redundant keys and remove 152 orphaned translations ([#843](https://github.com/andymai/gridfinity-layout-tool/issues/843)) ([aec5e9a](https://github.com/andymai/gridfinity-layout-tool/commit/aec5e9a949b1c97ace78a0a5cf1aa2081fa5c071))
- **i18n:** localize bin designer loading messages ([#551](https://github.com/andymai/gridfinity-layout-tool/issues/551)) ([83364ea](https://github.com/andymai/gridfinity-layout-tool/commit/83364ea05e860b7e4f9a3636295e73fd9b2cba88))
- improve auto scoop radius with height-aware formula and resolved display ([#671](https://github.com/andymai/gridfinity-layout-tool/issues/671)) ([7ba7847](https://github.com/andymai/gridfinity-layout-tool/commit/7ba78477bfc60d099c0bcfacd77ac241e51fa887))
- improve divider export with descriptive filenames ([fd78b59](https://github.com/andymai/gridfinity-layout-tool/commit/fd78b5931edc64e8b3ac1790b12b72a5db1399df))
- improve print time/filament estimates with enhanced volume calc and user settings ([#573](https://github.com/andymai/gridfinity-layout-tool/issues/573)) ([6ed6c13](https://github.com/andymai/gridfinity-layout-tool/commit/6ed6c13eb5c139644188afedc134269374058143))
- increase max bin dimensions from 8x8 to 16x16 ([#630](https://github.com/andymai/gridfinity-layout-tool/issues/630)) ([06b4a1a](https://github.com/andymai/gridfinity-layout-tool/commit/06b4a1ac55d9943c64ff6d9d5977c934c8715058))
- indexed mesh wire format ([#639](https://github.com/andymai/gridfinity-layout-tool/issues/639)) ([17de936](https://github.com/andymai/gridfinity-layout-tool/commit/17de9363f10b44ce9516ef2ea9739be867a1b780))
- **layers:** layer height UX overhaul ([#816](https://github.com/andymai/gridfinity-layout-tool/issues/816)) ([af597c0](https://github.com/andymai/gridfinity-layout-tool/commit/af597c088fbb0115ee1aa262481f4bb38d462374))
- **layers:** replace bin palette panel with compact popover toolbar ([#929](https://github.com/andymai/gridfinity-layout-tool/issues/929)) ([3a5b6c4](https://github.com/andymai/gridfinity-layout-tool/commit/3a5b6c4febe02f177e09c35748c15a617a2dd718))
- migrate library index from localStorage to IndexedDB ([#799](https://github.com/andymai/gridfinity-layout-tool/issues/799)) ([e1068bd](https://github.com/andymai/gridfinity-layout-tool/commit/e1068bda1f034e13e725b75e9b0dd346ca5f7696))
- optimize localStorage with key consolidation and IDB migration ([#806](https://github.com/andymai/gridfinity-layout-tool/issues/806)) ([41f954d](https://github.com/andymai/gridfinity-layout-tool/commit/41f954dcc22483fe56e2b2cbe575b9f5115cc70f))
- prefetch lazy-loaded chunks during browser idle time ([#553](https://github.com/andymai/gridfinity-layout-tool/issues/553)) ([fcf2790](https://github.com/andymai/gridfinity-layout-tool/commit/fcf279085bd877e8e1b265fc22dc4fd7c8869342))
- **print:** unify filament estimates with analytical volume model, add nozzle size setting ([#829](https://github.com/andymai/gridfinity-layout-tool/issues/829)) ([284548c](https://github.com/andymai/gridfinity-layout-tool/commit/284548ca6b529a5d40d6d1909a0eb05293cd79fd))
- remove delete bin drop zone ([#835](https://github.com/andymai/gridfinity-layout-tool/issues/835)) ([c6bcb69](https://github.com/andymai/gridfinity-layout-tool/commit/c6bcb6931077ba92140f565d39ac958a92a36991))
- remove expanded bin list modal feature ([bfa0c08](https://github.com/andymai/gridfinity-layout-tool/commit/bfa0c0859b8fbff573e7ec1f17d53e3c537b7f92))
- remove expanded bin list modal feature ([#626](https://github.com/andymai/gridfinity-layout-tool/issues/626)) ([1c1a321](https://github.com/andymai/gridfinity-layout-tool/commit/1c1a321158b543e40435c386407525a73f83f375))
- remove vercel speed insights ([#652](https://github.com/andymai/gridfinity-layout-tool/issues/652)) ([3a02938](https://github.com/andymai/gridfinity-layout-tool/commit/3a0293853dadaabfeb115169f4ad211ebbe2b5a6))
- **result:** add useResultToast hook with recovery hints ([#973](https://github.com/andymai/gridfinity-layout-tool/issues/973)) ([ef42261](https://github.com/andymai/gridfinity-layout-tool/commit/ef42261b383b24aff2d4793eae9900dad9d034d7))
- **seo:** dynamic meta tags + server-side bot OG injection ([#559](https://github.com/andymai/gridfinity-layout-tool/issues/559)) ([f765bdb](https://github.com/andymai/gridfinity-layout-tool/commit/f765bdb5f6e59b41472df350ebb8ec59a25b6cd1))
- **settings:** add Appearance tab with theme, accent, density, and grid controls ([#748](https://github.com/andymai/gridfinity-layout-tool/issues/748)) ([5cbce12](https://github.com/andymai/gridfinity-layout-tool/commit/5cbce12abd7917da9411ae6e760f7a02ee0f5450))
- shared ref-counted worker pool for parallel split operations ([#1015](https://github.com/andymai/gridfinity-layout-tool/issues/1015)) ([74683c2](https://github.com/andymai/gridfinity-layout-tool/commit/74683c2147226b1453d44c5f4e4786e85210a318))
- show disabled label tabs with explanation instead of hiding ([72b3779](https://github.com/andymai/gridfinity-layout-tool/commit/72b3779048b3da4cc7829111a71fd212e5ade6cb))
- slotted bin style with removable dividers and reference preview ([52fa740](https://github.com/andymai/gridfinity-layout-tool/commit/52fa740c708817c0a8116810835032daa7bd36be))
- smart snap placement for bins near collisions ([#832](https://github.com/andymai/gridfinity-layout-tool/issues/832)) ([7e4fdbb](https://github.com/andymai/gridfinity-layout-tool/commit/7e4fdbb5f641078e4a9477ad08366bf63bdf1b89))
- snapshot history with auto-save, restore, and IndexedDB recovery ([#797](https://github.com/andymai/gridfinity-layout-tool/issues/797)) ([f2bf4ec](https://github.com/andymai/gridfinity-layout-tool/commit/f2bf4ec0596682897403ab02b6082cd94829835a))
- split export for oversized bins in Bin Designer ([#582](https://github.com/andymai/gridfinity-layout-tool/issues/582)) ([0283639](https://github.com/andymai/gridfinity-layout-tool/commit/028363925ff3e93581a7e5eb3e7f9633ca3de0cc))
- **storage:** www → canonical domain storage migration ([#856](https://github.com/andymai/gridfinity-layout-tool/issues/856)) ([582f3e3](https://github.com/andymai/gridfinity-layout-tool/commit/582f3e309cc7c3ccf6ffdd4d34192ff066494412))
- **store:** add extracted selector hooks for cross-store derivations ([#970](https://github.com/andymai/gridfinity-layout-tool/issues/970)) ([735b39c](https://github.com/andymai/gridfinity-layout-tool/commit/735b39c8232fb4b430b4a12c572f6e7ba3d0150f))
- **toolswitcher:** shorten labels to Layout / Bins / Baseplate ([#942](https://github.com/andymai/gridfinity-layout-tool/issues/942)) ([2895f54](https://github.com/andymai/gridfinity-layout-tool/commit/2895f54d2cf05877e732ff18b4a4a4f026894ace))
- **ux:** communicate grid interaction failures and surface the stash to new users ([5cd6b46](https://github.com/andymai/gridfinity-layout-tool/commit/5cd6b465ecca9f498b3746a20fd4d957b01d2022))

### Bug Fixes

- 4 bugs found via systematic codebase audit (round 2) ([#767](https://github.com/andymai/gridfinity-layout-tool/issues/767)) ([6b538f3](https://github.com/andymai/gridfinity-layout-tool/commit/6b538f3ad4906c423495290037f33382a002ece1))
- 5 bugs found via systematic codebase audit with TDD ([#765](https://github.com/andymai/gridfinity-layout-tool/issues/765)) ([2458e69](https://github.com/andymai/gridfinity-layout-tool/commit/2458e69df0df642455439c9475c7e3587045a4a1))
- add explicit permissions to release workflow ([#544](https://github.com/andymai/gridfinity-layout-tool/issues/544)) ([b62ed09](https://github.com/andymai/gridfinity-layout-tool/commit/b62ed0911f232520619056f0fec7d6a9e8470b00))
- address PR review comments ([ef7e21b](https://github.com/andymai/gridfinity-layout-tool/commit/ef7e21b288d863559085f70e7aa08f64c58911e2))
- adjust coverage thresholds to realistic achievable levels ([#648](https://github.com/andymai/gridfinity-layout-tool/issues/648)) ([49d0d13](https://github.com/andymai/gridfinity-layout-tool/commit/49d0d1318105142c6fd7f2b8805818fb0ab556b2))
- align Button, Input, Checkbox, Toast, Dialog sizing to match production ([#664](https://github.com/andymai/gridfinity-layout-tool/issues/664)) ([807b70c](https://github.com/andymai/gridfinity-layout-tool/commit/807b70ce91ae86d99fcc4a18994f7bd59400e78c))
- align design system sizing to match production components ([#662](https://github.com/andymai/gridfinity-layout-tool/issues/662)) ([a1aa1d5](https://github.com/andymai/gridfinity-layout-tool/commit/a1aa1d59e12d2864f330ed83ad47ec8dd24ca6d0))
- align Select, Stepper, Toast sizing to match production and add visual regression tests ([#666](https://github.com/andymai/gridfinity-layout-tool/issues/666)) ([2ceddbe](https://github.com/andymai/gridfinity-layout-tool/commit/2ceddbe712b2dd124d2f3e4c4df6e06313efb064))
- allow clicking export file name to edit it directly ([#632](https://github.com/andymai/gridfinity-layout-tool/issues/632)) ([4d99a1b](https://github.com/andymai/gridfinity-layout-tool/commit/4d99a1b16673337abd28b45535ddc314fc5d42c3))
- **analytics:** prevent Infinity binsPerMinute in ML confidence scoring ([#741](https://github.com/andymai/gridfinity-layout-tool/issues/741)) ([203d768](https://github.com/andymai/gridfinity-layout-tool/commit/203d7688fa26b624729ce35d978db059ce4da1f8))
- **api:** add missing allowOverwrite to report endpoint blob put ([#739](https://github.com/andymai/gridfinity-layout-tool/issues/739)) ([162b18e](https://github.com/andymai/gridfinity-layout-tool/commit/162b18e8e6d6e3fab4900fdb3e4f0c455b3232d0))
- **baseplate:** defer worker pool exposure until WASM init completes ([#922](https://github.com/andymai/gridfinity-layout-tool/issues/922)) ([2884057](https://github.com/andymai/gridfinity-layout-tool/commit/28840570d8fbffbf7c21c6e3e3e7f2084121677c))
- **baseplate:** pin fractional half-units to edge positions in split tiling ([#902](https://github.com/andymai/gridfinity-layout-tool/issues/902)) ([7af94ea](https://github.com/andymai/gridfinity-layout-tool/commit/7af94ea7be9094087b48d29cf2dcb3b6422ef3a8))
- bin designer UI fixes and remove JSON export from export modal ([#548](https://github.com/andymai/gridfinity-layout-tool/issues/548)) ([9bf5a89](https://github.com/andymai/gridfinity-layout-tool/commit/9bf5a8986f74dedf06198b610fc0aebc8a09dee4))
- **bin-designer:** enable scrolling in saved designs dialog with 9+ designs ([#790](https://github.com/andymai/gridfinity-layout-tool/issues/790)) ([c31fc6b](https://github.com/andymai/gridfinity-layout-tool/commit/c31fc6bc87ab13fd9e4541fe82ca09160b681b9b))
- **bin-designer:** enable scrolling in saved designs dialog with 9+ designs ([#792](https://github.com/andymai/gridfinity-layout-tool/issues/792)) ([872de41](https://github.com/andymai/gridfinity-layout-tool/commit/872de417d9712533f9743033d077bc5862289d6f))
- **bin-designer:** fix export dialog bugs and UX issues ([#850](https://github.com/andymai/gridfinity-layout-tool/issues/850)) ([9b1ba6b](https://github.com/andymai/gridfinity-layout-tool/commit/9b1ba6ba87ba3a29fd0cc32f40a9931b76b990d6))
- **bin-designer:** fix Open in Slicer 400 error and clean up test warnings ([#859](https://github.com/andymai/gridfinity-layout-tool/issues/859)) ([f0f4398](https://github.com/andymai/gridfinity-layout-tool/commit/f0f4398e68d7c1b846d7f470a7c36a92b1e339ea))
- **bin-designer:** fix Open in Slicer 403 by checking all Vercel URL env vars ([#854](https://github.com/andymai/gridfinity-layout-tool/issues/854)) ([13dea6a](https://github.com/andymai/gridfinity-layout-tool/commit/13dea6af95a7e7eeaa60bede353007032150742b))
- **bin-designer:** fix Open in Slicer firing download instead of opening app ([#852](https://github.com/andymai/gridfinity-layout-tool/issues/852)) ([9654a00](https://github.com/andymai/gridfinity-layout-tool/commit/9654a003c965bf82ab912bbb1b7f76e4c2fb4dd5))
- **bin-designer:** mobile UI fixes for touch targets, layout, and UX ([#774](https://github.com/andymai/gridfinity-layout-tool/issues/774)) ([19e8dfb](https://github.com/andymai/gridfinity-layout-tool/commit/19e8dfb805d7814c04d80f7b370a19f54e4d3d53))
- **bin-designer:** optimize 3D preview for mobile web ([#780](https://github.com/andymai/gridfinity-layout-tool/issues/780)) ([611f257](https://github.com/andymai/gridfinity-layout-tool/commit/611f2570074ae064571a94515047d7c3e0734ece))
- **bin-designer:** poll blob URL after upload to handle CDN propagation delay ([#870](https://github.com/andymai/gridfinity-layout-tool/issues/870)) ([f07bb3c](https://github.com/andymai/gridfinity-layout-tool/commit/f07bb3cd77ed1e976bb7b101d3add0209c4d46a6))
- **bin-designer:** preserve stacking lip wall in preview tessellation ([#782](https://github.com/andymai/gridfinity-layout-tool/issues/782)) ([c813a61](https://github.com/andymai/gridfinity-layout-tool/commit/c813a61c1e98c4d7174cd9b080433fe1b79d0980))
- **bin-designer:** use dimension-based tessellation with tight lip tolerance ([#787](https://github.com/andymai/gridfinity-layout-tool/issues/787)) ([54aab1a](https://github.com/andymai/gridfinity-layout-tool/commit/54aab1ab501a5eb2d8fcd73c1834b06fec59fcee))
- **bin-designer:** use Override in 3MF content types for slicer compatibility ([#868](https://github.com/andymai/gridfinity-layout-tool/issues/868)) ([4d69971](https://github.com/andymai/gridfinity-layout-tool/commit/4d699713eb25cf250c7a13ba712f5a1f49a83566))
- **bin-designer:** use scrollbar-thin style in saved designs dialog ([#794](https://github.com/andymai/gridfinity-layout-tool/issues/794)) ([f1b8551](https://github.com/andymai/gridfinity-layout-tool/commit/f1b85512e36322314ab33071f74d8a387cb8745e))
- **build:** export formatDimension from shared utils ([e0fa499](https://github.com/andymai/gridfinity-layout-tool/commit/e0fa499d946bcd8f9eb4d86edba6d4a32cc54178))
- **build:** resolve npm vulnerabilities and build warnings ([#608](https://github.com/andymai/gridfinity-layout-tool/issues/608)) ([e01c9b5](https://github.com/andymai/gridfinity-layout-tool/commit/e01c9b589699d4ae8aefbb9e162273ed0992f067))
- **categories:** widen color picker popup to prevent squished layout ([#756](https://github.com/andymai/gridfinity-layout-tool/issues/756)) ([e3faa80](https://github.com/andymai/gridfinity-layout-tool/commit/e3faa80e20c88fbe9b81758bb3dadb72789d24e6))
- **ci:** remove duplicate push trigger for release-please branch ([#917](https://github.com/andymai/gridfinity-layout-tool/issues/917)) ([3c3b250](https://github.com/andymai/gridfinity-layout-tool/commit/3c3b2509092a6aec4e37f5f923d713ece86296fd))
- **ci:** resolve post-merge ESLint errors in InitErrorFallback and report handler ([7c38671](https://github.com/andymai/gridfinity-layout-tool/commit/7c386710962da69d7073c7040a2de9d5f7767053))
- **ci:** skip Vercel preview builds for release-please branches ([#906](https://github.com/andymai/gridfinity-layout-tool/issues/906)) ([63919e5](https://github.com/andymai/gridfinity-layout-tool/commit/63919e5cdd21508b87044c3ced6e9fad6f04f2d4))
- **ci:** update PostHog source map upload inputs for v2 ([#772](https://github.com/andymai/gridfinity-layout-tool/issues/772)) ([aee03ee](https://github.com/andymai/gridfinity-layout-tool/commit/aee03eeadc22272004cdf8ae5baca74f922587ee))
- cls loading spinner, mobile resize, and vibrate guards ([#876](https://github.com/andymai/gridfinity-layout-tool/issues/876)) ([74074ba](https://github.com/andymai/gridfinity-layout-tool/commit/74074ba795fa878c2f4f6ce6b79cf00bf39437e2))
- **cls:** eliminate loading spinner CLS regression from IndexedDB migration ([#874](https://github.com/andymai/gridfinity-layout-tool/issues/874)) ([a4b2241](https://github.com/andymai/gridfinity-layout-tool/commit/a4b2241f1d72186d5c23d383dea5db496fad8876))
- code review cleanup - memory leaks and error handling ([#592](https://github.com/andymai/gridfinity-layout-tool/issues/592)) ([d9ecfd4](https://github.com/andymai/gridfinity-layout-tool/commit/d9ecfd4227f2ecc5fee2a70ce6e9e86bc82f4d66))
- correct half-lap clearance to 0.1mm per side and add depth relief ([#1031](https://github.com/andymai/gridfinity-layout-tool/issues/1031)) ([7b454c2](https://github.com/andymai/gridfinity-layout-tool/commit/7b454c2718e6ab7a9d8e823bf1100b8397a88a85))
- correct wall cutout sketch orientation and improve penetration depth ([410bccf](https://github.com/andymai/gridfinity-layout-tool/commit/410bccf8c8dbd34d9e868e216f672cbbfd5cfc58))
- **deps:** resolve 5 high-severity Dependabot alerts via npm overrides ([#988](https://github.com/andymai/gridfinity-layout-tool/issues/988)) ([0b6e3a1](https://github.com/andymai/gridfinity-layout-tool/commit/0b6e3a121c43ef7bd99869eed7f1670f96624ea1))
- **deps:** scope minimatch overrides to preserve v3 API for eslint plugins ([#990](https://github.com/andymai/gridfinity-layout-tool/issues/990)) ([b9bb32c](https://github.com/andymai/gridfinity-layout-tool/commit/b9bb32c4bd9af3bf8c926a1f60bdbcadfd85ea59))
- **deps:** update brepjs to v2 and fix undici peer dependency ([89fd031](https://github.com/andymai/gridfinity-layout-tool/commit/89fd031541f32eacc1a0a55a9c7ee74f41078578))
- **deps:** upgrade brepjs 8.3.0→8.8.8 and brepjs-opencascade 0.7.2→0.8.2 ([#992](https://github.com/andymai/gridfinity-layout-tool/issues/992)) ([7f29e88](https://github.com/andymai/gridfinity-layout-tool/commit/7f29e880bd962c7b6701e864543c240eaaa742d5))
- **design-linking:** reconcile design→grid sync on navigation return ([#821](https://github.com/andymai/gridfinity-layout-tool/issues/821)) ([4405181](https://github.com/andymai/gridfinity-layout-tool/commit/440518123e7d0c5ffa3a5ada21f3f4fc6fc00e58))
- **design-linking:** sync inspector dimension changes to linked designs ([#814](https://github.com/andymai/gridfinity-layout-tool/issues/814)) ([9b94f53](https://github.com/andymai/gridfinity-layout-tool/commit/9b94f53146a8e0de7f41fdb1f3ef46c3b8c8a5f5))
- disable threaded WASM — Emscripten pthreads incompatible with Vite ([#1011](https://github.com/andymai/gridfinity-layout-tool/issues/1011)) ([9bc5d46](https://github.com/andymai/gridfinity-layout-tool/commit/9bc5d4691d531cf0da3c1faa5a5f7bf3bcc7ff6a))
- divider height stepper stuck after decreasing from auto ([36815f9](https://github.com/andymai/gridfinity-layout-tool/commit/36815f922bfff88e0e4250411b9ff5c928eaa717))
- **e2e:** update Playwright tests for current UI state ([#946](https://github.com/andymai/gridfinity-layout-tool/issues/946)) ([063131a](https://github.com/andymai/gridfinity-layout-tool/commit/063131a9099f8a53ccc3c334173f7c8176ad86e8))
- **feedback:** address review comments on sanitization and formatting ([#733](https://github.com/andymai/gridfinity-layout-tool/issues/733)) ([e35bf3c](https://github.com/andymai/gridfinity-layout-tool/commit/e35bf3c8451c6c3ae5ff745e188f4f1a03146e9d))
- floor tongue skipped at default wall thickness due to floating point ([3cfbe68](https://github.com/andymai/gridfinity-layout-tool/commit/3cfbe68eef946d3007a1bc356d740fdca4e03031))
- **generation:** add mainScriptUrlOrBlob for threaded WASM module resolution ([#604](https://github.com/andymai/gridfinity-layout-tool/issues/604)) ([cc29444](https://github.com/andymai/gridfinity-layout-tool/commit/cc294444ef52a795a982a6ae02f607a306a244a6))
- **generation:** address PR review feedback for slot export fix ([#927](https://github.com/andymai/gridfinity-layout-tool/issues/927)) ([2443223](https://github.com/andymai/gridfinity-layout-tool/commit/244322370ce6c58b8065c5d30e8a6eb87ceae4f4))
- **generation:** resolve non-manifold slot geometry on STL export ([#921](https://github.com/andymai/gridfinity-layout-tool/issues/921)) ([#923](https://github.com/andymai/gridfinity-layout-tool/issues/923)) ([4b328d6](https://github.com/andymai/gridfinity-layout-tool/commit/4b328d6017d3d7fb29760ee739dd8a851745344c))
- **grid-editor:** clamp fractional row/column coords to valid half-bin positions ([#737](https://github.com/andymai/gridfinity-layout-tool/issues/737)) ([f7fb02c](https://github.com/andymai/gridfinity-layout-tool/commit/f7fb02c43c479a196aef49c1ad250cc9b01756b1))
- handle legacy bin designer designs missing compartments field ([#650](https://github.com/andymai/gridfinity-layout-tool/issues/650)) ([392dacd](https://github.com/andymai/gridfinity-layout-tool/commit/392dacd8a32c8748334d9a9f5afd22bf7680c738))
- hide SEO fallback content flash on page load ([#714](https://github.com/andymai/gridfinity-layout-tool/issues/714)) ([b278ded](https://github.com/andymai/gridfinity-layout-tool/commit/b278ded69e84ebec1d455c15a8b102c6509c63c9))
- honeycomb wall pattern for 3u bins ([#595](https://github.com/andymai/gridfinity-layout-tool/issues/595)) ([0c80a95](https://github.com/andymai/gridfinity-layout-tool/commit/0c80a958f62922d886059c0bbeeb35f4fcfc8aae))
- **i18n:** eliminate CLS from fullscreen loading spinner on initial render ([#915](https://github.com/andymai/gridfinity-layout-tool/issues/915)) ([3adfbe1](https://github.com/andymai/gridfinity-layout-tool/commit/3adfbe1273e22cf86fd4be6eb471315992c692c2))
- **icons:** eliminate transparent corners in favicon and PWA icons ([#840](https://github.com/andymai/gridfinity-layout-tool/issues/840)) ([3c7c03c](https://github.com/andymai/gridfinity-layout-tool/commit/3c7c03cfb371a2f7009fe003acb62563de3d42da))
- inset focus rings, pattern registry fallback, and honeycomb icon ([#616](https://github.com/andymai/gridfinity-layout-tool/issues/616)) ([01bcd00](https://github.com/andymai/gridfinity-layout-tool/commit/01bcd0049799c16d613c0e7e04901f43f75f9b13))
- **lint:** resolve all 10 ESLint no-unnecessary-condition warnings ([#761](https://github.com/andymai/gridfinity-layout-tool/issues/761)) ([7b831f3](https://github.com/andymai/gridfinity-layout-tool/commit/7b831f3002c1fd4fbb8b4fa5e63db42e2607d16f))
- make direction toggle compact and inline ([2f4cc14](https://github.com/andymai/gridfinity-layout-tool/commit/2f4cc14c245f54067ee0b2e643e56cb3e69467f2))
- make half-lap connectors work with stacking lip ([#1034](https://github.com/andymai/gridfinity-layout-tool/issues/1034)) ([2ead738](https://github.com/andymai/gridfinity-layout-tool/commit/2ead7386c86484dbf68d909a803aa5c3ff09f0e8))
- make split connector booleans robust for threaded OCCT builds ([#1023](https://github.com/andymai/gridfinity-layout-tool/issues/1023)) ([58e9810](https://github.com/andymai/gridfinity-layout-tool/commit/58e98106b1f21fe5022b52aefcb56cfd3b16267f))
- **mobile:** improve touch grid usability and polish mobile UX ([3066246](https://github.com/andymai/gridfinity-layout-tool/commit/3066246a58bb19d1dac29e38de2e48ee640d0969))
- **mobile:** make settings modal responsive on mobile viewports ([#904](https://github.com/andymai/gridfinity-layout-tool/issues/904)) ([a5f3466](https://github.com/andymai/gridfinity-layout-tool/commit/a5f3466c07bb54400e2ea88e8002350898a9ee2e))
- **mobile:** use portrait-oriented default drawer size on mobile ([#878](https://github.com/andymai/gridfinity-layout-tool/issues/878)) ([94b0313](https://github.com/andymai/gridfinity-layout-tool/commit/94b031391d3da1fd079bc0300528b4fc92bea126))
- orient divider STL flat for FDM printing ([7cfb643](https://github.com/andymai/gridfinity-layout-tool/commit/7cfb643f8a44475eb48aa6aad2050096d62fad6b))
- overhaul split bin generation chain ([#1027](https://github.com/andymai/gridfinity-layout-tool/issues/1027)) ([270f768](https://github.com/andymai/gridfinity-layout-tool/commit/270f76843b2cd94bd8ea9b1c436156e62e25e9b9))
- pass gridUnitMm and categories to mobile TSV export ([6d86076](https://github.com/andymai/gridfinity-layout-tool/commit/6d86076a26ce58bc42cd7b4b33cd6c11caa68baa))
- patch undici security vulnerabilities in @vercel/node ([#598](https://github.com/andymai/gridfinity-layout-tool/issues/598)) ([f254646](https://github.com/andymai/gridfinity-layout-tool/commit/f2546466675e6b36fae3eb334b7a80be13033055))
- polyfill Symbol.dispose for brepjs compatibility with older browsers ([#996](https://github.com/andymai/gridfinity-layout-tool/issues/996)) ([bac311d](https://github.com/andymai/gridfinity-layout-tool/commit/bac311ddd8c29071497b33b44d5311b8a8993589))
- prevent floating inspector panel jitter during slider interaction ([#689](https://github.com/andymai/gridfinity-layout-tool/issues/689)) ([6d7d711](https://github.com/andymai/gridfinity-layout-tool/commit/6d7d7111f799471736b4a43b68eaf6833ea02a15))
- prevent interior controls from being overwritten by event bubbling ([#698](https://github.com/andymai/gridfinity-layout-tool/issues/698)) ([d3b3e81](https://github.com/andymai/gridfinity-layout-tool/commit/d3b3e81aeef327d6e8977e495c949bd3ff1df58e))
- prevent WASM memory access crashes from degenerate geometry ([#703](https://github.com/andymai/gridfinity-layout-tool/issues/703)) ([0e93d1e](https://github.com/andymai/gridfinity-layout-tool/commit/0e93d1ef1150feec935c9927c5ad3f9442d2139f))
- **print-export:** fix multiple bugs and i18n issues in print modal ([#827](https://github.com/andymai/gridfinity-layout-tool/issues/827)) ([89117a1](https://github.com/andymai/gridfinity-layout-tool/commit/89117a1bcd4960612b65ae82b898c46974a485fa))
- re-enable threaded WASM for OpenCascade ([#1013](https://github.com/andymai/gridfinity-layout-tool/issues/1013)) ([b855ab0](https://github.com/andymai/gridfinity-layout-tool/commit/b855ab0d328235359daf7405a56eb4fcdb467048))
- remove stacking lip from split bin interior cut faces ([#1017](https://github.com/andymai/gridfinity-layout-tool/issues/1017)) ([f9661c4](https://github.com/andymai/gridfinity-layout-tool/commit/f9661c422ac0936a71afc75374433f8d7d8aeea5))
- rename slot spacing to compartment width for clarity ([1cf2b3b](https://github.com/andymai/gridfinity-layout-tool/commit/1cf2b3b328cb9b014b776682b1d2149b95913178))
- render split bin pieces in both assembled and exploded modes ([#1021](https://github.com/andymai/gridfinity-layout-tool/issues/1021)) ([bd1dd8a](https://github.com/andymai/gridfinity-layout-tool/commit/bd1dd8ac50b536d537a5be61a8d8f8fb4c37f23f))
- reset floating inspector position lock on hide/selection change ([#691](https://github.com/andymai/gridfinity-layout-tool/issues/691)) ([da46a36](https://github.com/andymai/gridfinity-layout-tool/commit/da46a36fdb6c15dfe7f62a9e06f103c694eb39a4))
- resolve all test failures after ESLint lint fix PR ([#695](https://github.com/andymai/gridfinity-layout-tool/issues/695)) ([#696](https://github.com/andymai/gridfinity-layout-tool/issues/696)) ([524994a](https://github.com/andymai/gridfinity-layout-tool/commit/524994a6f36a907f2439b63505493e476631e650))
- resolve ESLint errors and add missing tests ([#563](https://github.com/andymai/gridfinity-layout-tool/issues/563)) ([485f776](https://github.com/andymai/gridfinity-layout-tool/commit/485f776c0e2cd4ffc7ae20189e8d51c9c267f472))
- resolve pinched scoop at merged cutout junctions ([#681](https://github.com/andymai/gridfinity-layout-tool/issues/681)) ([792fbf3](https://github.com/andymai/gridfinity-layout-tool/commit/792fbf3a229eb4ce73b40e6ab61356536ffd4a3f))
- resolve pthread worker script path for threaded WASM ([#1009](https://github.com/andymai/gridfinity-layout-tool/issues/1009)) ([3cb854f](https://github.com/andymai/gridfinity-layout-tool/commit/3cb854fc763d04c82e61441c883a4ae4e770b62f))
- resolve TypeScript errors in Vercel API build ([#808](https://github.com/andymai/gridfinity-layout-tool/issues/808)) ([1a39d8b](https://github.com/andymai/gridfinity-layout-tool/commit/1a39d8b6649063eccb73b6af131c01f048062c29))
- restore locateFile override for WASM loading in ES module workers ([#994](https://github.com/andymai/gridfinity-layout-tool/issues/994)) ([f07ef47](https://github.com/andymai/gridfinity-layout-tool/commit/f07ef471204c36125c9b9e743f5fd632cfa61d63))
- retry WASM worker init on failure and fix preload cache mismatch ([#1007](https://github.com/andymai/gridfinity-layout-tool/issues/1007)) ([1619038](https://github.com/andymai/gridfinity-layout-tool/commit/1619038123a9196fd85e65da3efc75945140462a))
- **security:** address 8 security audit findings (H-1 through L-4) ([#888](https://github.com/andymai/gridfinity-layout-tool/issues/888)) ([1599490](https://github.com/andymai/gridfinity-layout-tool/commit/1599490056d3dfbf7c4c7a4709566cd93e717d07))
- **seo:** shorten meta descriptions to 100-130 characters ([#556](https://github.com/andymai/gridfinity-layout-tool/issues/556)) ([8cba243](https://github.com/andymai/gridfinity-layout-tool/commit/8cba2432429538042cb7822a82431db57f970033))
- **settings:** remove grid visuals settings and use defaults ([#753](https://github.com/andymai/gridfinity-layout-tool/issues/753)) ([ad1108c](https://github.com/andymai/gridfinity-layout-tool/commit/ad1108ce426b4bc5364f4a78913f9169a6f9a55a))
- **settings:** stabilize modal height and add mobile fullscreen ([#751](https://github.com/andymai/gridfinity-layout-tool/issues/751)) ([221a463](https://github.com/andymai/gridfinity-layout-tool/commit/221a4634db52207face06f76073217b1555f6e73))
- shorten divider length to prevent bowing and align lip with gridfinity spec ([e55dc1c](https://github.com/andymai/gridfinity-layout-tool/commit/e55dc1c4666c5e4b0dd3da2cf0a7c612cd6bbba5))
- shorten divider length to prevent bowing, align lip with gridfinity spec ([#569](https://github.com/andymai/gridfinity-layout-tool/issues/569)) ([002d1c5](https://github.com/andymai/gridfinity-layout-tool/commit/002d1c5dd563d5a4ba1b1f47d7dfdadf8590e936))
- **slicer:** use correct `file=` parameter in protocol handler URLs ([#872](https://github.com/andymai/gridfinity-layout-tool/issues/872)) ([87e5118](https://github.com/andymai/gridfinity-layout-tool/commit/87e51187a4ce16d9319ed7566b130e024a15d2ec))
- snap staging drag to nearest valid position to prevent flickering ([#719](https://github.com/andymai/gridfinity-layout-tool/issues/719)) ([5bb4bb0](https://github.com/andymai/gridfinity-layout-tool/commit/5bb4bb0df8afc164b514b8ccc3628e8ea8d8d0df))
- start wall slot cuts at floor surface, not socket interface ([d006f59](https://github.com/andymai/gridfinity-layout-tool/commit/d006f59c8a1ec28c66e397a2f851987040110bff))
- stash rotate button clipping and move-to-grid context menu ([#837](https://github.com/andymai/gridfinity-layout-tool/issues/837)) ([f14cc84](https://github.com/andymai/gridfinity-layout-tool/commit/f14cc841d4a579d46e12b8be6776ea1185fe2e79))
- **storage:** fix www→canonical migration library merge and edge cases ([#860](https://github.com/andymai/gridfinity-layout-tool/issues/860)) ([a391b6c](https://github.com/andymai/gridfinity-layout-tool/commit/a391b6cc3d06ae69a7d4d7165a784c71bdbb9c6b))
- **storage:** make clearAllData async to prevent IndexedDB reload race ([#889](https://github.com/andymai/gridfinity-layout-tool/issues/889)) ([c4cf9c9](https://github.com/andymai/gridfinity-layout-tool/commit/c4cf9c929f392401ff1429a487615214fca48b3f))
- **storage:** salvage layouts with bin collisions instead of rejecting ([#819](https://github.com/andymai/gridfinity-layout-tool/issues/819)) ([fb65d19](https://github.com/andymai/gridfinity-layout-tool/commit/fb65d19ab417512a373e18e2a656f12dd2805886))
- **sw:** exclude wwwMigration chunk from service worker precache ([#866](https://github.com/andymai/gridfinity-layout-tool/issues/866)) ([7081a81](https://github.com/andymai/gridfinity-layout-tool/commit/7081a81060e8e8058265c71fc1219d35089cd246))
- **types:** accept nullable activeLayoutId in resolveLayout ([#746](https://github.com/andymai/gridfinity-layout-tool/issues/746)) ([a6e462b](https://github.com/andymai/gridfinity-layout-tool/commit/a6e462be5ecec75f3ae4f35fe45d3d3cf94735d4))
- update tests for post-merge API changes ([1e0debc](https://github.com/andymai/gridfinity-layout-tool/commit/1e0debc6988f7850dc2978afee35cb6881b1a65a))
- **validation:** reject zero/negative dimensions in type guards ([#743](https://github.com/andymai/gridfinity-layout-tool/issues/743)) ([7124558](https://github.com/andymai/gridfinity-layout-tool/commit/7124558dd8a1e3f5cbb9a5288b9d2f340a9781dc))
- widen onRemediate prop type to accept sync callbacks ([#637](https://github.com/andymai/gridfinity-layout-tool/issues/637)) ([df0ece3](https://github.com/andymai/gridfinity-layout-tool/commit/df0ece38a421326c5515ce67c2314f424a754d29))
- widen return types to include LayoutLibraryLimitError ([#770](https://github.com/andymai/gridfinity-layout-tool/issues/770)) ([063c570](https://github.com/andymai/gridfinity-layout-tool/commit/063c5700b9839a8cc81d17e365382b5ef5c1ad7a))
- **www-migration:** fix empty-layout bug and add canonical IDB integrity verification ([#862](https://github.com/andymai/gridfinity-layout-tool/issues/862)) ([fa72d5c](https://github.com/andymai/gridfinity-layout-tool/commit/fa72d5c95bdad9933e0cadd390fe2cebc1f48cc3))
- **www-migration:** handle blank iframe onload before bridge navigates ([#864](https://github.com/andymai/gridfinity-layout-tool/issues/864)) ([98ff871](https://github.com/andymai/gridfinity-layout-tool/commit/98ff871989fca2ae2f10dfbc0a3bbe281ef4e4cb))

### Performance

- **baseplate:** add intermediate slab-with-pockets cache and increase cache sizes ([#910](https://github.com/andymai/gridfinity-layout-tool/issues/910)) ([026deb9](https://github.com/andymai/gridfinity-layout-tool/commit/026deb92a0e62113f6ae79abb154e891a984361a))
- **baseplate:** add worker pool for parallel split piece generation ([#911](https://github.com/andymai/gridfinity-layout-tool/issues/911)) ([c625f46](https://github.com/andymai/gridfinity-layout-tool/commit/c625f468d303d3d826cfea14cf709ae3128d2036))
- **baseplate:** batch all CSG boolean operations into single passes ([#908](https://github.com/andymai/gridfinity-layout-tool/issues/908)) ([0ca8dca](https://github.com/andymai/gridfinity-layout-tool/commit/0ca8dca1ec12891f9010a7e461e13eedde1ad61e))
- **baseplate:** optimize tessellation with adaptive tolerance and skip edge mesh ([#912](https://github.com/andymai/gridfinity-layout-tool/issues/912)) ([20ca5fc](https://github.com/andymai/gridfinity-layout-tool/commit/20ca5fccda82692baf26ffa6b121f9446e66a5b6))
- cache assembled shell (base + box + lip) across generation calls ([#581](https://github.com/andymai/gridfinity-layout-tool/issues/581)) ([966d6b2](https://github.com/andymai/gridfinity-layout-tool/commit/966d6b2cb9f6aec0465ae604f5c11271d0bc0e5b))
- cache intermediate shapes across generation calls ([#580](https://github.com/andymai/gridfinity-layout-tool/issues/580)) ([ac6bdfb](https://github.com/andymai/gridfinity-layout-tool/commit/ac6bdfb52df256ff6a34aff42e130f1b2069e276))
- optimize 3D preview rendering and grid computations ([#612](https://github.com/andymai/gridfinity-layout-tool/issues/612)) ([f1c0e63](https://github.com/andymai/gridfinity-layout-tool/commit/f1c0e63dd7d10e644283b094a8af915d08d0c4ea))
- optimize bin designer generation pipeline ([#686](https://github.com/andymai/gridfinity-layout-tool/issues/686)) ([fc3bfb8](https://github.com/andymai/gridfinity-layout-tool/commit/fc3bfb85513e640cac9117d339e1e5c4e093afe1))
- reduce main bundle size by 27% via lazy loading ([#817](https://github.com/andymai/gridfinity-layout-tool/issues/817)) ([5c0696b](https://github.com/andymai/gridfinity-layout-tool/commit/5c0696b68786872fb5214db948759d65588e22b9))
- **tests:** eliminate redundant cleanup, real-timer sleeps, and unnecessary overhead ([#884](https://github.com/andymai/gridfinity-layout-tool/issues/884)) ([fc5a19d](https://github.com/andymai/gridfinity-layout-tool/commit/fc5a19dea820cd33b086b1eef2ea351ececde698))
- use brepjs composeTransforms for wall pattern generation ([#702](https://github.com/andymai/gridfinity-layout-tool/issues/702)) ([dbaa95c](https://github.com/andymai/gridfinity-layout-tool/commit/dbaa95c7a0be75c6cfcfb2150551648b2f7eacf6))

## [3.54.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.54.1...gridfinity-layout-tool-v3.54.2) (2026-03-04)

### Bug Fixes

- make half-lap connectors work with stacking lip ([#1034](https://github.com/andymai/gridfinity-layout-tool/issues/1034)) ([2ead738](https://github.com/andymai/gridfinity-layout-tool/commit/2ead7386c86484dbf68d909a803aa5c3ff09f0e8))

## [3.54.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.54.0...gridfinity-layout-tool-v3.54.1) (2026-03-04)

### Bug Fixes

- correct half-lap clearance to 0.1mm per side and add depth relief ([#1031](https://github.com/andymai/gridfinity-layout-tool/issues/1031)) ([7b454c2](https://github.com/andymai/gridfinity-layout-tool/commit/7b454c2718e6ab7a9d8e823bf1100b8397a88a85))

## [3.54.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.53.4...gridfinity-layout-tool-v3.54.0) (2026-03-04)

### Features

- add half-lap wall connectors for thin walls (&lt; 1.4mm) ([#1029](https://github.com/andymai/gridfinity-layout-tool/issues/1029)) ([c98410f](https://github.com/andymai/gridfinity-layout-tool/commit/c98410f4107fe1bb7b546518191554584161ac17))

## [3.53.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.53.3...gridfinity-layout-tool-v3.53.4) (2026-03-04)

### Bug Fixes

- overhaul split bin generation chain ([#1027](https://github.com/andymai/gridfinity-layout-tool/issues/1027)) ([270f768](https://github.com/andymai/gridfinity-layout-tool/commit/270f76843b2cd94bd8ea9b1c436156e62e25e9b9))

## [3.53.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.53.2...gridfinity-layout-tool-v3.53.3) (2026-03-03)

### Bug Fixes

- floor tongue skipped at default wall thickness due to floating point ([3cfbe68](https://github.com/andymai/gridfinity-layout-tool/commit/3cfbe68eef946d3007a1bc356d740fdca4e03031))

## [3.53.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.53.1...gridfinity-layout-tool-v3.53.2) (2026-03-03)

### Bug Fixes

- make split connector booleans robust for threaded OCCT builds ([#1023](https://github.com/andymai/gridfinity-layout-tool/issues/1023)) ([58e9810](https://github.com/andymai/gridfinity-layout-tool/commit/58e98106b1f21fe5022b52aefcb56cfd3b16267f))

## [3.53.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.53.0...gridfinity-layout-tool-v3.53.1) (2026-03-03)

### Bug Fixes

- render split bin pieces in both assembled and exploded modes ([#1021](https://github.com/andymai/gridfinity-layout-tool/issues/1021)) ([bd1dd8a](https://github.com/andymai/gridfinity-layout-tool/commit/bd1dd8ac50b536d537a5be61a8d8f8fb4c37f23f))

## [3.53.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.52.1...gridfinity-layout-tool-v3.53.0) (2026-03-03)

### Features

- always show ToolSwitcher in baseplate generator header ([#1019](https://github.com/andymai/gridfinity-layout-tool/issues/1019)) ([8e6f0e8](https://github.com/andymai/gridfinity-layout-tool/commit/8e6f0e894632cc9ab5e9c8fcf1bb30d134d08082))

## [3.52.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.52.0...gridfinity-layout-tool-v3.52.1) (2026-03-03)

### Bug Fixes

- remove stacking lip from split bin interior cut faces ([#1017](https://github.com/andymai/gridfinity-layout-tool/issues/1017)) ([f9661c4](https://github.com/andymai/gridfinity-layout-tool/commit/f9661c422ac0936a71afc75374433f8d7d8aeea5))

## [3.52.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.51.4...gridfinity-layout-tool-v3.52.0) (2026-03-03)

### Features

- shared ref-counted worker pool for parallel split operations ([#1015](https://github.com/andymai/gridfinity-layout-tool/issues/1015)) ([74683c2](https://github.com/andymai/gridfinity-layout-tool/commit/74683c2147226b1453d44c5f4e4786e85210a318))

## [3.51.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.51.3...gridfinity-layout-tool-v3.51.4) (2026-03-03)

### Bug Fixes

- re-enable threaded WASM for OpenCascade ([#1013](https://github.com/andymai/gridfinity-layout-tool/issues/1013)) ([b855ab0](https://github.com/andymai/gridfinity-layout-tool/commit/b855ab0d328235359daf7405a56eb4fcdb467048))

## [3.51.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.51.2...gridfinity-layout-tool-v3.51.3) (2026-03-03)

### Bug Fixes

- disable threaded WASM — Emscripten pthreads incompatible with Vite ([#1011](https://github.com/andymai/gridfinity-layout-tool/issues/1011)) ([9bc5d46](https://github.com/andymai/gridfinity-layout-tool/commit/9bc5d4691d531cf0da3c1faa5a5f7bf3bcc7ff6a))

## [3.51.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.51.1...gridfinity-layout-tool-v3.51.2) (2026-03-03)

### Bug Fixes

- resolve pthread worker script path for threaded WASM ([#1009](https://github.com/andymai/gridfinity-layout-tool/issues/1009)) ([3cb854f](https://github.com/andymai/gridfinity-layout-tool/commit/3cb854fc763d04c82e61441c883a4ae4e770b62f))

## [3.51.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.51.0...gridfinity-layout-tool-v3.51.1) (2026-03-03)

### Bug Fixes

- retry WASM worker init on failure and fix preload cache mismatch ([#1007](https://github.com/andymai/gridfinity-layout-tool/issues/1007)) ([1619038](https://github.com/andymai/gridfinity-layout-tool/commit/1619038123a9196fd85e65da3efc75945140462a))

## [3.51.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.50.5...gridfinity-layout-tool-v3.51.0) (2026-03-03)

### Features

- add alignment connectors to split bin exports ([#1004](https://github.com/andymai/gridfinity-layout-tool/issues/1004)) ([c1361b2](https://github.com/andymai/gridfinity-layout-tool/commit/c1361b2af466613bbfa1ffb98813ec39468e36c7))

## [3.50.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.50.4...gridfinity-layout-tool-v3.50.5) (2026-03-02)

### Bug Fixes

- polyfill Symbol.dispose for brepjs compatibility with older browsers ([#996](https://github.com/andymai/gridfinity-layout-tool/issues/996)) ([bac311d](https://github.com/andymai/gridfinity-layout-tool/commit/bac311ddd8c29071497b33b44d5311b8a8993589))

## [3.50.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.50.3...gridfinity-layout-tool-v3.50.4) (2026-03-02)

### Bug Fixes

- restore locateFile override for WASM loading in ES module workers ([#994](https://github.com/andymai/gridfinity-layout-tool/issues/994)) ([f07ef47](https://github.com/andymai/gridfinity-layout-tool/commit/f07ef471204c36125c9b9e743f5fd632cfa61d63))

## [3.50.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.50.2...gridfinity-layout-tool-v3.50.3) (2026-03-02)

### Bug Fixes

- **deps:** upgrade brepjs 8.3.0→8.8.8 and brepjs-opencascade 0.7.2→0.8.2 ([#992](https://github.com/andymai/gridfinity-layout-tool/issues/992)) ([7f29e88](https://github.com/andymai/gridfinity-layout-tool/commit/7f29e880bd962c7b6701e864543c240eaaa742d5))

## [3.50.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.50.1...gridfinity-layout-tool-v3.50.2) (2026-03-02)

### Bug Fixes

- **deps:** scope minimatch overrides to preserve v3 API for eslint plugins ([#990](https://github.com/andymai/gridfinity-layout-tool/issues/990)) ([b9bb32c](https://github.com/andymai/gridfinity-layout-tool/commit/b9bb32c4bd9af3bf8c926a1f60bdbcadfd85ea59))

## [3.50.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.50.0...gridfinity-layout-tool-v3.50.1) (2026-03-02)

### Bug Fixes

- **deps:** resolve 5 high-severity Dependabot alerts via npm overrides ([#988](https://github.com/andymai/gridfinity-layout-tool/issues/988)) ([0b6e3a1](https://github.com/andymai/gridfinity-layout-tool/commit/0b6e3a121c43ef7bd99869eed7f1670f96624ea1))

## [3.50.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.49.0...gridfinity-layout-tool-v3.50.0) (2026-03-02)

### Features

- **generation:** add magnet support for half-unit bins and baseplates ([#920](https://github.com/andymai/gridfinity-layout-tool/issues/920)) ([f4081a0](https://github.com/andymai/gridfinity-layout-tool/commit/f4081a0fbb7557133ba4d6b926bb6ec09df953c8))

## [3.49.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.48.0...gridfinity-layout-tool-v3.49.0) (2026-03-01)

### Features

- **result:** add useResultToast hook with recovery hints ([#973](https://github.com/andymai/gridfinity-layout-tool/issues/973)) ([ef42261](https://github.com/andymai/gridfinity-layout-tool/commit/ef42261b383b24aff2d4793eae9900dad9d034d7))

## [3.48.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.47.0...gridfinity-layout-tool-v3.48.0) (2026-03-01)

### Features

- **store:** add extracted selector hooks for cross-store derivations ([#970](https://github.com/andymai/gridfinity-layout-tool/issues/970)) ([735b39c](https://github.com/andymai/gridfinity-layout-tool/commit/735b39c8232fb4b430b4a12c572f6e7ba3d0150f))

## [3.47.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.46.0...gridfinity-layout-tool-v3.47.0) (2026-03-01)

### Features

- **export:** make 3MF the default export format ([#966](https://github.com/andymai/gridfinity-layout-tool/issues/966)) ([a4bc7af](https://github.com/andymai/gridfinity-layout-tool/commit/a4bc7af9fe15e46b8e226ab4cac49b0a747e18a1))

## [3.46.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.45.0...gridfinity-layout-tool-v3.46.0) (2026-03-01)

### Features

- **bin-designer:** cutout editor UX polish ([#964](https://github.com/andymai/gridfinity-layout-tool/issues/964)) ([8abacea](https://github.com/andymai/gridfinity-layout-tool/commit/8abacea39c0b32c7ca2123fd8e7391165cd00279))

## [3.45.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.44.0...gridfinity-layout-tool-v3.45.0) (2026-03-01)

### Features

- **bin-designer:** improve cutout editor onboarding and discoverability ([#962](https://github.com/andymai/gridfinity-layout-tool/issues/962)) ([fb059c7](https://github.com/andymai/gridfinity-layout-tool/commit/fb059c77e50e4812f33a3a13680edc8123455531))

## [3.44.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.43.0...gridfinity-layout-tool-v3.44.0) (2026-03-01)

### Features

- **generation:** indexedDB WASM module caching + shared pool compilation ([#950](https://github.com/andymai/gridfinity-layout-tool/issues/950)) ([980f8ae](https://github.com/andymai/gridfinity-layout-tool/commit/980f8ae36ed3e9c764c3ec73de0a1009c9784fee))

## [3.43.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.42.1...gridfinity-layout-tool-v3.43.0) (2026-03-01)

### Features

- **generation:** shared BridgeManager with WASM preloading ([#948](https://github.com/andymai/gridfinity-layout-tool/issues/948)) ([9b0d0bb](https://github.com/andymai/gridfinity-layout-tool/commit/9b0d0bbe571050f2297348a7f11c9879054d21e4))

## [3.42.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.42.0...gridfinity-layout-tool-v3.42.1) (2026-03-01)

### Bug Fixes

- **e2e:** update Playwright tests for current UI state ([#946](https://github.com/andymai/gridfinity-layout-tool/issues/946)) ([063131a](https://github.com/andymai/gridfinity-layout-tool/commit/063131a9099f8a53ccc3c334173f7c8176ad86e8))

## [3.42.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.41.0...gridfinity-layout-tool-v3.42.0) (2026-03-01)

### Features

- **baseplate:** improve panel hierarchy, loading UX, and section transitions ([#944](https://github.com/andymai/gridfinity-layout-tool/issues/944)) ([4262810](https://github.com/andymai/gridfinity-layout-tool/commit/426281021610e285f7a092e9e5676a3a6f8ef2e1))

## [3.41.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.40.0...gridfinity-layout-tool-v3.41.0) (2026-02-28)

### Features

- **toolswitcher:** shorten labels to Layout / Bins / Baseplate ([#942](https://github.com/andymai/gridfinity-layout-tool/issues/942)) ([2895f54](https://github.com/andymai/gridfinity-layout-tool/commit/2895f54d2cf05877e732ff18b4a4a4f026894ace))

## [3.40.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.39.0...gridfinity-layout-tool-v3.40.0) (2026-02-28)

### Features

- **baseplate:** 3D preview visual polish ([#939](https://github.com/andymai/gridfinity-layout-tool/issues/939)) ([7860d29](https://github.com/andymai/gridfinity-layout-tool/commit/7860d297c333b6164fd72b1778b2648b9ef8285b))

## [3.39.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.38.0...gridfinity-layout-tool-v3.39.0) (2026-02-28)

### Features

- **baseplate:** graduate generator and add SEO landing page ([#937](https://github.com/andymai/gridfinity-layout-tool/issues/937)) ([7a54033](https://github.com/andymai/gridfinity-layout-tool/commit/7a5403395f3d3ec281c884b81a621a51f1759771))

## [3.38.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.37.0...gridfinity-layout-tool-v3.38.0) (2026-02-28)

### Features

- **baseplate:** spatial padding schematic for edge padding section ([#935](https://github.com/andymai/gridfinity-layout-tool/issues/935)) ([994fcac](https://github.com/andymai/gridfinity-layout-tool/commit/994fcac178791a6d2c5c6ab2e01b02b152fbd554))

## [3.37.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.36.0...gridfinity-layout-tool-v3.37.0) (2026-02-28)

### Features

- **baseplate:** shared ExportDialog with parallel export and slicer integration ([#932](https://github.com/andymai/gridfinity-layout-tool/issues/932)) ([2a8dfe1](https://github.com/andymai/gridfinity-layout-tool/commit/2a8dfe1daec3f2d780e9ce30f5e1c4f90212ad0d))

## [3.36.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.35.1...gridfinity-layout-tool-v3.36.0) (2026-02-25)

### Features

- **layers:** replace bin palette panel with compact popover toolbar ([#929](https://github.com/andymai/gridfinity-layout-tool/issues/929)) ([3a5b6c4](https://github.com/andymai/gridfinity-layout-tool/commit/3a5b6c4febe02f177e09c35748c15a617a2dd718))

## [3.35.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.35.0...gridfinity-layout-tool-v3.35.1) (2026-02-25)

### Bug Fixes

- **generation:** address PR review feedback for slot export fix ([#927](https://github.com/andymai/gridfinity-layout-tool/issues/927)) ([2443223](https://github.com/andymai/gridfinity-layout-tool/commit/244322370ce6c58b8065c5d30e8a6eb87ceae4f4))

## [3.35.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.34.1...gridfinity-layout-tool-v3.35.0) (2026-02-25)

### Features

- **baseplate:** add edge lines, improve tessellation, and polish 3D preview ([#925](https://github.com/andymai/gridfinity-layout-tool/issues/925)) ([985d314](https://github.com/andymai/gridfinity-layout-tool/commit/985d3146e9bcdd86e9dad032df1c374629df0264))

## [3.34.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.34.0...gridfinity-layout-tool-v3.34.1) (2026-02-25)

### Bug Fixes

- **baseplate:** defer worker pool exposure until WASM init completes ([#922](https://github.com/andymai/gridfinity-layout-tool/issues/922)) ([2884057](https://github.com/andymai/gridfinity-layout-tool/commit/28840570d8fbffbf7c21c6e3e3e7f2084121677c))
- **generation:** resolve non-manifold slot geometry on STL export ([#921](https://github.com/andymai/gridfinity-layout-tool/issues/921)) ([#923](https://github.com/andymai/gridfinity-layout-tool/issues/923)) ([4b328d6](https://github.com/andymai/gridfinity-layout-tool/commit/4b328d6017d3d7fb29760ee739dd8a851745344c))

## [3.34.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.33.7...gridfinity-layout-tool-v3.34.0) (2026-02-25)

### Features

- **baseplate:** add custom grid size with "Synced with layout" toggle ([#918](https://github.com/andymai/gridfinity-layout-tool/issues/918)) ([fa18138](https://github.com/andymai/gridfinity-layout-tool/commit/fa181380a560f59b0226b425702fc13c75e48972))

## [3.33.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.33.6...gridfinity-layout-tool-v3.33.7) (2026-02-25)

### Bug Fixes

- **ci:** remove duplicate push trigger for release-please branch ([#917](https://github.com/andymai/gridfinity-layout-tool/issues/917)) ([3c3b250](https://github.com/andymai/gridfinity-layout-tool/commit/3c3b2509092a6aec4e37f5f923d713ece86296fd))
- **i18n:** eliminate CLS from fullscreen loading spinner on initial render ([#915](https://github.com/andymai/gridfinity-layout-tool/issues/915)) ([3adfbe1](https://github.com/andymai/gridfinity-layout-tool/commit/3adfbe1273e22cf86fd4be6eb471315992c692c2))

## [3.33.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.33.5...gridfinity-layout-tool-v3.33.6) (2026-02-25)

### Performance

- **baseplate:** add intermediate slab-with-pockets cache and increase cache sizes ([#910](https://github.com/andymai/gridfinity-layout-tool/issues/910)) ([026deb9](https://github.com/andymai/gridfinity-layout-tool/commit/026deb92a0e62113f6ae79abb154e891a984361a))
- **baseplate:** add worker pool for parallel split piece generation ([#911](https://github.com/andymai/gridfinity-layout-tool/issues/911)) ([c625f46](https://github.com/andymai/gridfinity-layout-tool/commit/c625f468d303d3d826cfea14cf709ae3128d2036))

## [3.33.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.33.4...gridfinity-layout-tool-v3.33.5) (2026-02-25)

### Performance

- **baseplate:** optimize tessellation with adaptive tolerance and skip edge mesh ([#912](https://github.com/andymai/gridfinity-layout-tool/issues/912)) ([20ca5fc](https://github.com/andymai/gridfinity-layout-tool/commit/20ca5fccda82692baf26ffa6b121f9446e66a5b6))

## [3.33.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.33.3...gridfinity-layout-tool-v3.33.4) (2026-02-25)

### Performance

- **baseplate:** batch all CSG boolean operations into single passes ([#908](https://github.com/andymai/gridfinity-layout-tool/issues/908)) ([0ca8dca](https://github.com/andymai/gridfinity-layout-tool/commit/0ca8dca1ec12891f9010a7e461e13eedde1ad61e))

## [3.33.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.33.2...gridfinity-layout-tool-v3.33.3) (2026-02-25)

### Bug Fixes

- **ci:** skip Vercel preview builds for release-please branches ([#906](https://github.com/andymai/gridfinity-layout-tool/issues/906)) ([63919e5](https://github.com/andymai/gridfinity-layout-tool/commit/63919e5cdd21508b87044c3ced6e9fad6f04f2d4))

## [3.33.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.33.1...gridfinity-layout-tool-v3.33.2) (2026-02-25)

### Bug Fixes

- **mobile:** make settings modal responsive on mobile viewports ([#904](https://github.com/andymai/gridfinity-layout-tool/issues/904)) ([a5f3466](https://github.com/andymai/gridfinity-layout-tool/commit/a5f3466c07bb54400e2ea88e8002350898a9ee2e))

## [3.33.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.33.0...gridfinity-layout-tool-v3.33.1) (2026-02-25)

### Bug Fixes

- **baseplate:** pin fractional half-units to edge positions in split tiling ([#902](https://github.com/andymai/gridfinity-layout-tool/issues/902)) ([7af94ea](https://github.com/andymai/gridfinity-layout-tool/commit/7af94ea7be9094087b48d29cf2dcb3b6422ef3a8))

## [3.33.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.32.0...gridfinity-layout-tool-v3.33.0) (2026-02-25)

### Features

- **baseplate:** add dovetail connectors for split baseplate pieces ([#900](https://github.com/andymai/gridfinity-layout-tool/issues/900)) ([0e36ab9](https://github.com/andymai/gridfinity-layout-tool/commit/0e36ab9850cb77de24c6c4a665890af1f1b7f657))

## [3.32.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.31.0...gridfinity-layout-tool-v3.32.0) (2026-02-25)

### Features

- **baseplate:** replace greedy 1D split with optimal 2D tiling ([#898](https://github.com/andymai/gridfinity-layout-tool/issues/898)) ([a18622c](https://github.com/andymai/gridfinity-layout-tool/commit/a18622c868e183aeb9211532a231d5bbde4eef27))

## [3.31.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.30.0...gridfinity-layout-tool-v3.31.0) (2026-02-25)

### Features

- **baseplate:** add magnet holes and direct mesh generator ([#896](https://github.com/andymai/gridfinity-layout-tool/issues/896)) ([d7804c4](https://github.com/andymai/gridfinity-layout-tool/commit/d7804c48bfc1bd454439b568f94cba0ce60027ee))

## [3.30.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.29.0...gridfinity-layout-tool-v3.30.0) (2026-02-24)

### Features

- **baseplate:** add standalone baseplate generator ([#892](https://github.com/andymai/gridfinity-layout-tool/issues/892)) ([94c8f49](https://github.com/andymai/gridfinity-layout-tool/commit/94c8f49d5492c3b05c33c51e1430d1ee8f66eb5e))

## [3.29.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.28.1...gridfinity-layout-tool-v3.29.0) (2026-02-24)

### Features

- **bin-designer:** auto-enable half-bin mode when fractional dimension is typed ([#893](https://github.com/andymai/gridfinity-layout-tool/issues/893)) ([d26a4bc](https://github.com/andymai/gridfinity-layout-tool/commit/d26a4bcc4ef822e6943370e872c535c715dcf2c3))

## [3.28.1](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.28.0...gridfinity-layout-tool-v3.28.1) (2026-02-24)

### Bug Fixes

- **ci:** resolve post-merge ESLint errors in InitErrorFallback and report handler ([7c38671](https://github.com/andymai/gridfinity-layout-tool/commit/7c386710962da69d7073c7040a2de9d5f7767053))
- **security:** address 8 security audit findings (H-1 through L-4) ([#888](https://github.com/andymai/gridfinity-layout-tool/issues/888)) ([1599490](https://github.com/andymai/gridfinity-layout-tool/commit/1599490056d3dfbf7c4c7a4709566cd93e717d07))

## [3.28.0](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.10...gridfinity-layout-tool-v3.28.0) (2026-02-24)

### Features

- **analytics:** replace Vercel heartbeat with rich PostHog heartbeat ([#886](https://github.com/andymai/gridfinity-layout-tool/issues/886)) ([ec2070f](https://github.com/andymai/gridfinity-layout-tool/commit/ec2070f8dcbc49c88bca9764eed918dcace53739))

### Bug Fixes

- **storage:** make clearAllData async to prevent IndexedDB reload race ([#889](https://github.com/andymai/gridfinity-layout-tool/issues/889)) ([c4cf9c9](https://github.com/andymai/gridfinity-layout-tool/commit/c4cf9c929f392401ff1429a487615214fca48b3f))

## [3.27.10](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.9...gridfinity-layout-tool-v3.27.10) (2026-02-23)

### Performance

- **tests:** eliminate redundant cleanup, real-timer sleeps, and unnecessary overhead ([#884](https://github.com/andymai/gridfinity-layout-tool/issues/884)) ([fc5a19d](https://github.com/andymai/gridfinity-layout-tool/commit/fc5a19dea820cd33b086b1eef2ea351ececde698))

## [3.27.9](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.8...gridfinity-layout-tool-v3.27.9) (2026-02-23)

### Bug Fixes

- cls loading spinner, mobile resize, and vibrate guards ([#876](https://github.com/andymai/gridfinity-layout-tool/issues/876)) ([74074ba](https://github.com/andymai/gridfinity-layout-tool/commit/74074ba795fa878c2f4f6ce6b79cf00bf39437e2))
- **mobile:** use portrait-oriented default drawer size on mobile ([#878](https://github.com/andymai/gridfinity-layout-tool/issues/878)) ([94b0313](https://github.com/andymai/gridfinity-layout-tool/commit/94b031391d3da1fd079bc0300528b4fc92bea126))

## [3.27.8](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.7...gridfinity-layout-tool-v3.27.8) (2026-02-23)

### Bug Fixes

- **cls:** eliminate loading spinner CLS regression from IndexedDB migration ([#874](https://github.com/andymai/gridfinity-layout-tool/issues/874)) ([a4b2241](https://github.com/andymai/gridfinity-layout-tool/commit/a4b2241f1d72186d5c23d383dea5db496fad8876))

## [3.27.7](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.6...gridfinity-layout-tool-v3.27.7) (2026-02-23)

### Bug Fixes

- **slicer:** use correct `file=` parameter in protocol handler URLs ([#872](https://github.com/andymai/gridfinity-layout-tool/issues/872)) ([87e5118](https://github.com/andymai/gridfinity-layout-tool/commit/87e51187a4ce16d9319ed7566b130e024a15d2ec))

## [3.27.6](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.5...gridfinity-layout-tool-v3.27.6) (2026-02-23)

### Bug Fixes

- **bin-designer:** poll blob URL after upload to handle CDN propagation delay ([#870](https://github.com/andymai/gridfinity-layout-tool/issues/870)) ([f07bb3c](https://github.com/andymai/gridfinity-layout-tool/commit/f07bb3cd77ed1e976bb7b101d3add0209c4d46a6))

## [3.27.5](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.4...gridfinity-layout-tool-v3.27.5) (2026-02-23)

### Bug Fixes

- **bin-designer:** use Override in 3MF content types for slicer compatibility ([#868](https://github.com/andymai/gridfinity-layout-tool/issues/868)) ([4d69971](https://github.com/andymai/gridfinity-layout-tool/commit/4d699713eb25cf250c7a13ba712f5a1f49a83566))

## [3.27.4](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.3...gridfinity-layout-tool-v3.27.4) (2026-02-23)

### Bug Fixes

- **sw:** exclude wwwMigration chunk from service worker precache ([#866](https://github.com/andymai/gridfinity-layout-tool/issues/866)) ([7081a81](https://github.com/andymai/gridfinity-layout-tool/commit/7081a81060e8e8058265c71fc1219d35089cd246))

## [3.27.3](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.2...gridfinity-layout-tool-v3.27.3) (2026-02-23)

### Bug Fixes

- **www-migration:** handle blank iframe onload before bridge navigates ([#864](https://github.com/andymai/gridfinity-layout-tool/issues/864)) ([98ff871](https://github.com/andymai/gridfinity-layout-tool/commit/98ff871989fca2ae2f10dfbc0a3bbe281ef4e4cb))

## [3.27.2](https://github.com/andymai/gridfinity-layout-tool/compare/gridfinity-layout-tool-v3.27.1...gridfinity-layout-tool-v3.27.2) (2026-02-23)

### Bug Fixes

- **www-migration:** fix empty-layout bug and add canonical IDB integrity verification ([#862](https://github.com/andymai/gridfinity-layout-tool/issues/862)) ([fa72d5c](https://github.com/andymai/gridfinity-layout-tool/commit/fa72d5c95bdad9933e0cadd390fe2cebc1f48cc3))

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
