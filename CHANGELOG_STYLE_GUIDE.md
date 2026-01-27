# Changelog Style Guide

This guide helps AI agents and humans maintain the CHANGELOG.md file with consistent formatting and categorization.

## Philosophy

The changelog is for **humans**, not machines. It should:

- **Be clear** - Describe what changed and why it matters
- **Be concise** - Get to the point without filler
- **Be specific** - Avoid vague descriptions
- **Focus on user impact** - Prioritize user-facing changes

## Voice Guidelines

### Good Examples

```markdown
- **Bin Designer** - Design custom bins in the browser with parametric controls and STL export
- Fixed bins disappearing during drag operations
- Improved stash panel visibility
- Resolved Z-fighting in 3D preview
```

### Avoid

```markdown
- Added bin designer feature (too vague)
- Fixed bug #123 (meaningless to readers)
- Implemented user story XYZ (internal jargon)
- This update contains bug fixes and improvements (lazy)
```

### Tone by Change Type

| Situation       | Tone                | Example                                   |
| --------------- | ------------------- | ----------------------------------------- |
| New feature     | Direct, informative | "**Feature** - Description of capability" |
| Bug fix         | Straightforward     | "Fixed issue where..."                    |
| Performance     | Specific            | "Reduced bundle size by 61KB"             |
| Breaking change | Clear, direct       | "**Breaking:** Changed X to Y"            |

## Format Structure

### Version Headers

Use date-based releases (ISO 8601):

```markdown
## [2026-01-26]

### Added

### Changed

### Fixed

### Removed

### Security
```

### Category Definitions

Following [Keep a Changelog](https://keepachangelog.com):

| Category                 | When to Use                            |
| ------------------------ | -------------------------------------- |
| **Added**                | New features or capabilities           |
| **Changed**              | Modifications to existing features     |
| **Fixed**                | Bug fixes                              |
| **Removed**              | Deleted features                       |
| **Deprecated**           | Features marked for future removal     |
| **Security**             | Vulnerability fixes                    |
| **Performance**          | Speed or efficiency improvements       |
| **Accessibility**        | WCAG compliance, screen reader support |
| **Internationalization** | New languages, translation updates     |

### Entry Format

```markdown
- **Feature Name** - Brief description of what changed ([#PR](link))
```

For significant features:

```markdown
- **Bin Designer** - Design custom Gridfinity bins in the browser:
  - Parametric controls for dimensions, walls, and dividers
  - Real-time 3D preview with orbit controls
  - STL export for 3D printing
```

### Grouping Related Changes

Combine multiple PRs for one feature:

**Instead of:**

```markdown
- Add bin designer types ([#304])
- Add bin designer generation engine ([#305])
- Add bin designer parameter panel ([#306])
```

**Write:**

```markdown
- **Bin Designer** - Parametric bin generator with 3D preview and STL export ([#304-309])
```

## Content Guidelines

### What to Include

- New features that users will notice
- Bug fixes that affected user workflows
- Performance improvements with measurable impact
- Security fixes (after deployment)
- Breaking changes
- Accessibility improvements
- New language translations

### What to Omit

- Internal refactoring (unless it enables new features)
- Dependency updates (unless they fix user-facing issues)
- Code style changes
- Test additions
- Documentation-only changes (unless user-facing)

## Special Sections

### Breaking Changes

Call these out prominently:

```markdown
### Breaking Changes

- **Storage Migration** - Layouts now use IndexedDB instead of localStorage. Existing layouts are automatically migrated. ([#106])
```

### Highlights

For major releases:

```markdown
## [2026-01-20]

**Highlights:** Parametric bin generator with real-time 3D preview and STL export.

### Added

...
```

## Writing Tips

### Make It Scannable

- Bold text for feature names
- Short first sentences
- Bullet points for lists
- Clear category headers

### Be Specific About Fixes

**Instead of:** "Fixed drag and drop bug"
**Write:** "Fixed bins teleporting to wrong layer during drag"

## AI Agent Instructions

When updating the changelog:

1. **Read recent commits** - `git log --oneline -50`
2. **Group by feature** - Combine related commits into single entries
3. **Use correct categories** - Based on definitions above, not commit prefixes
4. **Match existing style** - Read current entries first
5. **Link to PRs** - Include PR numbers
6. **Use ISO dates** - YYYY-MM-DD format

### Commit Prefix to Category Mapping

| Commit Prefix | Usually Maps To           |
| ------------- | ------------------------- |
| `feat:`       | Added                     |
| `fix:`        | Fixed                     |
| `perf:`       | Performance               |
| `refactor:`   | Omit (unless significant) |
| `test:`       | Omit                      |
| `docs:`       | Omit (unless user-facing) |
| `chore:`      | Omit                      |
| `a11y:`       | Accessibility             |
| `i18n:`       | Internationalization      |

### Example Prompt

```
Update CHANGELOG.md with changes from PRs #415-#417. Follow CHANGELOG_STYLE_GUIDE.md.
Group related changes. Include PR links.
```

## Version History

- **2026-01-26** - Initial style guide created
