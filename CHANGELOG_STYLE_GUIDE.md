# Changelog Style Guide

This guide helps AI agents and humans maintain the CHANGELOG.md file with consistent voice, formatting, and categorization.

## Philosophy

Our changelog is for **humans**, not machines. It should:

- **Be entertaining to read** - Use vivid descriptions that paint a picture
- **Express excitement** - New features deserve celebration (without being obnoxious)
- **Be humble** - Acknowledge that improvements often come from user feedback
- **Focus on impact** - Explain _why_ a change matters, not just _what_ changed

## Voice Guidelines

### Do Say

```markdown
- We're thrilled to introduce **Bin Designer** - design custom bins right in your browser!
- Fixed an embarrassing bug where bins would vanish into the void during drag operations
- Thanks to user feedback, the stash panel now shows bins more clearly
- Finally tackled that pesky Z-fighting issue in the 3D preview
```

### Don't Say

```markdown
- Added bin designer feature (too dry)
- Fixed bug #123 (meaningless to readers)
- Implemented user story XYZ (internal jargon)
- This update contains bug fixes and improvements (lazy)
```

### Tone Spectrum

| Situation         | Tone                           | Example                                                     |
| ----------------- | ------------------------------ | ----------------------------------------------------------- |
| New major feature | Excited, celebratory           | "We're **so excited** to introduce..."                      |
| New minor feature | Pleased, matter-of-fact        | "You can now..."                                            |
| Bug fix           | Humble, maybe self-deprecating | "Fixed an issue where..." or "Squashed a bug that..."       |
| Performance       | Proud but technical            | "Shaved 200ms off load time by..."                          |
| Breaking change   | Direct, apologetic             | "**Breaking:** We had to change... We know this affects..." |

## Format Structure

### Version Headers

We use date-based releases since the project deploys continuously:

```markdown
## [2026-01-26]

### Added

### Changed

### Fixed

### Removed

### Deprecated

### Security
```

For thematic releases, add a name:

```markdown
## [2026-01-26] - "The Collaboration Update"
```

### Category Definitions

Use these categories following [Keep a Changelog](https://keepachangelog.com):

| Category                 | When to Use                                          | Icon |
| ------------------------ | ---------------------------------------------------- | ---- |
| **Added**                | Brand new features, capabilities, or integrations    | ✨   |
| **Changed**              | Modifications to existing features, behavior changes | 🔄   |
| **Fixed**                | Bug fixes, corrections, things that were broken      | 🐛   |
| **Removed**              | Features or code that's been deleted                 | 🗑️   |
| **Deprecated**           | Features marked for future removal                   | ⚠️   |
| **Security**             | Vulnerability fixes, security improvements           | 🔒   |
| **Performance**          | Speed, memory, or efficiency improvements            | ⚡   |
| **Accessibility**        | WCAG compliance, screen reader improvements          | ♿   |
| **Internationalization** | New languages, translation updates                   | 🌍   |

### Entry Format

Each entry should follow this pattern:

```markdown
- **Feature Name** - Brief, impactful description of what changed and why it matters ([#PR](link))
```

For significant features, use multiple lines:

```markdown
- **Bin Designer** - Design custom Gridfinity bins right in your browser! Includes:
  - Parametric controls for dimensions, walls, and dividers
  - Real-time 3D preview with orbit controls
  - STL export for 3D printing
  - Template library with common configurations
```

### Grouping Related Changes

When multiple commits relate to one feature, combine them:

```markdown
### Added

- **Half-Bin Mode** - Place bins with 0.5-unit precision for those tricky drawer dimensions. We went through several iterations on the grid visualization before landing on the current crosshair markers - thanks for the feedback! ([#6](link), [#483](link))
```

## Content Guidelines

### What to Include

- New features that users will notice
- Bug fixes that affected user workflows
- Performance improvements with measurable impact
- Security fixes (after they're safely deployed)
- Breaking changes (always!)
- Accessibility improvements
- New language translations

### What to Omit

- Internal refactoring (unless it enables new features)
- Dependency updates (unless they fix user-facing issues)
- Code style changes
- Test additions (unless they caught real bugs)
- Documentation-only changes (unless user-facing)

### Merge PR Chains

Many features span multiple PRs. Combine them into one entry:

**Instead of:**

```markdown
- Add bin designer types ([#304])
- Add bin designer generation engine ([#305])
- Add bin designer parameter panel ([#306])
- Add bin designer 3D preview ([#307])
```

**Write:**

```markdown
- **Bin Designer** - A complete parametric bin generator with 3D preview and STL export ([#304-309])
```

## Special Sections

### Breaking Changes

Always call these out prominently:

```markdown
### ⚠️ Breaking Changes

- **Storage Migration** - Layouts now use IndexedDB instead of localStorage. Your existing layouts will be automatically migrated, but this is a one-way upgrade. ([#106])
```

### Highlights

For major releases, add a highlights section at the top:

```markdown
## [2026-01-20] - "The Designer Update"

**Highlights:**

- 🎨 New Bin Designer for creating custom bins
- 🤝 Real-time collaboration with presence indicators
- 🌍 Now available in 6 languages

### Added

...
```

### Credits

Acknowledge community contributions:

```markdown
### Community

Thanks to everyone who reported issues and suggested improvements this release!
```

## Writing Tips

### Make It Scannable

Users skim changelogs. Use:

- Bold text for feature names
- Short first sentences
- Bullet points for lists
- Clear category headers

### Be Specific About Fixes

**Instead of:** "Fixed drag and drop bug"
**Write:** "Fixed bins occasionally teleporting to wrong layer during drag operations"

### Celebrate Milestones

```markdown
### 🎉 Milestone

This release marks **6 languages supported** - thank you to our translation contributors!
```

### Acknowledge Iteration

```markdown
- **Stash Panel** - Third time's the charm! After experimenting with collapsible sidebars and floating panels, we landed on a resizable bottom panel that gets out of your way until you need it
```

## AI Agent Instructions

When updating the changelog:

1. **Read recent commits** - Use `git log --oneline -50` to see what's new
2. **Group by feature** - Combine related commits into single entries
3. **Check the categories** - Use the definitions above, not commit prefixes
4. **Match the tone** - Read existing entries to match the voice
5. **Link to PRs** - Include PR numbers in parentheses
6. **Date the release** - Use ISO format: YYYY-MM-DD
7. **Preview before committing** - Read it aloud - does it sound human?

### Commit Message to Category Mapping

| Commit Prefix | Usually Maps To           |
| ------------- | ------------------------- |
| `feat:`       | Added                     |
| `fix:`        | Fixed                     |
| `perf:`       | Performance               |
| `refactor:`   | Omit (unless significant) |
| `test:`       | Omit                      |
| `docs:`       | Omit (unless user-facing) |
| `chore:`      | Omit                      |
| `style:`      | Omit                      |
| `a11y:`       | Accessibility             |
| `i18n:`       | Internationalization      |

### Example Agent Prompt

```
Update CHANGELOG.md with changes from PRs #415-#417. Follow CHANGELOG_STYLE_GUIDE.md.
Use an excited-but-humble tone. Group related changes. Include PR links.
```

## Version History

- **2026-01-26** - Initial style guide created
