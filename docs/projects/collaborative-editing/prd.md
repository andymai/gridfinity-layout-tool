# Product Requirements Document: Collaborative Layout Editing

**Document Version**: 2.0
**Last Updated**: January 2026
**Status**: Draft
**Author**: Product Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Personas](#4-user-personas)
5. [User Stories](#5-user-stories)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [User Experience](#8-user-experience)
9. [Edge Cases & Error Handling](#9-edge-cases--error-handling)
10. [Out of Scope](#10-out-of-scope)
11. [Dependencies & Risks](#11-dependencies--risks)
12. [Feature Flag](#12-feature-flag)
13. [Appendix](#13-appendix)

---

## 1. Overview

### 1.1 Executive Summary

Add real-time collaborative editing to the Gridfinity Layout Tool, enabling multiple users to work on the same drawer layout simultaneously. Users will see each other's cursors, edits will sync in real-time, and the experience will match the quality of established collaborative tools like Google Docs and Figma.

### 1.2 Background

Currently, users can share layouts via:
- **Cloud shares**: Read-only links (`/s/{id}`) that allow others to view and import layouts
- **URL encoding**: Layout data embedded in URL hash (limited by URL length)

These sharing methods are one-way—recipients can view and copy, but cannot collaborate on the original layout. Users who want to work together must take turns, manually merging changes.

### 1.3 Proposal

Extend the existing cloud sharing model with **permission levels**, following Google Docs' sharing paradigm:

- **View-only** (current behavior): Recipients can view and import a copy
- **Can edit** (new): Recipients can edit the layout in real-time with the owner

Key design decisions:
- **One URL per layout**: `/s/{shareId}` for both viewing and editing—permission is server-side
- **Persistent collaboration**: No session expiration—collaboration persists as long as the layout exists
- **Cloud-first**: Collaborative layouts live on the server; local copy becomes a linked reference
- **Trust-based**: Anyone with the link can make changes when editing is enabled (no authentication required)

---

## 2. Problem Statement

### 2.1 User Pain Points

| Pain Point | Current Workaround | Impact |
|------------|-------------------|--------|
| **Couples/families** planning shared drawer organization cannot work together | Take turns, describe changes verbally | Frustration, slower iteration |
| **Makers/YouTubers** want to show design process live | Screen share only (no interaction) | Passive audience, no engagement |
| **Teams/makerspaces** coordinating shared toolbox layouts | Export/import cycles, manual merge | Version conflicts, lost work |
| **Getting feedback** requires multiple share-import cycles | Re-share after every change | Tedious, breaks flow |

### 2.2 Opportunity

Real-time collaboration is an expected feature in modern design tools. Adding it to Gridfinity Layout Tool would:
- Differentiate from spreadsheet-based planning
- Enable new use cases (live streaming, workshops)
- Increase engagement and sharing
- Reduce friction for multi-person households

---

## 3. Goals & Success Metrics

### 3.1 Product Goals

| Goal | Description | Priority |
|------|-------------|----------|
| **G1** | Enable seamless real-time co-editing of layouts | P0 |
| **G2** | Provide visual presence awareness (cursors, activity) | P0 |
| **G3** | Support both view-only and edit permission levels | P0 |
| **G4** | Maintain single-user experience quality in multi-user mode | P1 |
| **G5** | Work reliably across desktop, tablet, and mobile | P1 |

### 3.2 Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Adoption** | 10% of active users enable collaboration within 3 months | Analytics: collaboration enabled events |
| **Engagement** | Average 2+ participants per collaborative layout | Analytics: participant count |
| **Duration** | Average collaborative session > 5 minutes | Analytics: connection duration |
| **Reliability** | < 1% of connections experience sync errors | Error tracking |
| **Latency** | Cursor updates visible within 100ms | Performance monitoring |
| **Satisfaction** | > 80% positive feedback in survey | In-app feedback prompt |

### 3.3 Non-Goals

- User accounts or authentication (trust-based only)
- Commenting or annotation system
- Version history or branching
- Fine-grained permissions (per-layer, per-category)

---

## 4. User Personas

### 4.1 Primary Personas

#### **Alex - The Household Organizer**
- **Background**: Planning a garage workshop with their partner
- **Goal**: Design drawer layouts together, each at their own computer
- **Behavior**: Creates layout, shares edit link, makes changes while discussing
- **Needs**: See partner's cursor, real-time updates, simple sharing
- **Quote**: "We can finally plan this together instead of taking turns!"

#### **Jordan - The Content Creator**
- **Background**: Runs a 3D printing YouTube channel
- **Goal**: Design layouts live with audience input
- **Behavior**: Streams design session, viewers join to watch
- **Needs**: View-only mode for audience, visible cursor, stable performance
- **Quote**: "My viewers can see exactly what I'm doing and follow along."

#### **Sam - The Makerspace Coordinator**
- **Background**: Manages shared tools at a community workshop
- **Goal**: Let multiple members contribute to tool organization
- **Behavior**: Creates base layout, shares edit link with trusted members
- **Needs**: Multiple editors, conflict handling, works on various devices
- **Quote**: "Everyone can add their tools without stepping on each other."

### 4.2 Secondary Personas

#### **Casey - The Remote Helper**
- **Background**: Helping elderly parent organize craft supplies
- **Goal**: Guide parent through layout design remotely
- **Behavior**: Joins parent's layout, makes edits while on video call
- **Needs**: Works alongside screen share, intuitive for non-tech users

#### **Riley - The Workshop Instructor**
- **Background**: Teaches organization workshops at maker faires
- **Goal**: Demonstrate layout design to workshop attendees
- **Behavior**: Projects their screen, attendees follow on their devices
- **Needs**: Easy join flow, works on phones, read-only default

---

## 5. User Stories

### 5.1 Enabling Collaboration

#### US-1.1: Enable Editing for Others
**As** a layout owner
**I want to** allow others to edit my layout
**So that** we can design together

**Acceptance Criteria:**
- [ ] Share panel shows permission selector: "Anyone with the link can **view**" vs "**edit**"
- [ ] Selecting "edit" uploads layout to cloud if not already shared
- [ ] Local layout becomes a linked reference to cloud version
- [ ] URL stays the same (`/s/{id}`)—permission is stored server-side
- [ ] Owner can change permission level at any time

#### US-1.2: Keep Layout View-Only
**As** a layout owner
**I want to** share my layout as view-only
**So that** others can see but not modify it

**Acceptance Criteria:**
- [ ] Default permission is "view" (current behavior)
- [ ] Same `/s/{id}` URL for both view and edit modes
- [ ] Viewers see layout and cursors but cannot edit
- [ ] Edit controls disabled/hidden for viewers
- [ ] Viewers can still pan, zoom, toggle 3D preview locally

#### US-1.3: Share Link
**As** a layout owner
**I want to** easily share the collaboration link
**So that** others can join quickly

**Acceptance Criteria:**
- [ ] "Copy link" button in share panel
- [ ] Link auto-copied when enabling collaboration
- [ ] Toast confirms link copied
- [ ] Same link works whether permission is view or edit

### 5.2 Joining Collaboration

#### US-2.1: Join via Link
**As** a potential collaborator
**I want to** join by clicking a link
**So that** I can start collaborating immediately

**Acceptance Criteria:**
- [ ] Clicking link opens app directly with layout loaded
- [ ] No sign-up or authentication required
- [ ] Loading state shown while connecting
- [ ] Error shown if layout doesn't exist
- [ ] Participant assigned default name ("Guest 1", "Guest 2", etc.)

#### US-2.2: Join with Custom Name
**As** a collaborator
**I want to** set my display name when joining
**So that** others can identify me

**Acceptance Criteria:**
- [ ] Optional name prompt on join (can skip)
- [ ] Name appears next to cursor
- [ ] Name shown in participant list
- [ ] Name persisted for browser session
- [ ] URL parameter support: `/s/{id}?name=Alex`

#### US-2.3: Handle Invalid Link
**As** a user clicking an old/invalid link
**I want to** understand why I can't join
**So that** I know what to do next

**Acceptance Criteria:**
- [ ] "Layout not found" for invalid IDs
- [ ] Option to go home or create new layout
- [ ] No cryptic error messages
- [ ] Redirect to home with toast message

### 5.3 Presence Awareness

#### US-3.1: See Other Cursors
**As** a collaborator
**I want to** see where other participants' cursors are
**So that** I know what they're looking at

**Acceptance Criteria:**
- [ ] Each participant has unique cursor color
- [ ] Cursor shows participant name label
- [ ] Cursor position updates smoothly (< 100ms latency)
- [ ] Cursor visible when over grid area
- [ ] Cursor fades when participant is idle (> 5 seconds)

#### US-3.2: See Who's Connected
**As** a collaborator
**I want to** see a list of all connected participants
**So that** I know who I'm working with

**Acceptance Criteria:**
- [ ] Participant avatars/names in header
- [ ] Count shown: "3 collaborators"
- [ ] Colored dots match cursor colors
- [ ] Shows when participants join/leave
- [ ] Owner indicated (crown icon or "Host" label)

#### US-3.3: See Others' Actions
**As** a collaborator
**I want to** see what actions others are taking
**So that** I don't interfere with their work

**Acceptance Criteria:**
- [ ] Selection box visible when others select area
- [ ] Drag preview visible when others drag bins
- [ ] Resize preview visible when others resize
- [ ] Drawing preview visible when others draw
- [ ] Action indicators use participant's color

### 5.4 Collaborative Editing

#### US-4.1: Draw Bins Together
**As** an editor
**I want to** draw new bins while others are editing
**So that** we can build the layout in parallel

**Acceptance Criteria:**
- [ ] Drawing works same as single-user mode
- [ ] New bins appear for all participants immediately
- [ ] Collision detection prevents overlapping bins
- [ ] Undo works for my own actions only

#### US-4.2: Move Bins Together
**As** an editor
**I want to** move bins while others are editing
**So that** we can reorganize efficiently

**Acceptance Criteria:**
- [ ] Dragging works same as single-user mode
- [ ] Moved bins update for all participants
- [ ] Cannot move bin another user is actively moving
- [ ] Staging area works normally

#### US-4.3: Edit Bin Properties
**As** an editor
**I want to** change bin labels, categories, and notes
**So that** I can contribute to bin organization

**Acceptance Criteria:**
- [ ] Property changes sync to all participants
- [ ] Last edit wins for simultaneous changes
- [ ] Inspector panel shows current data
- [ ] No special locking UI needed (trust-based)

#### US-4.4: Modify Layout Structure
**As** an editor
**I want to** add/remove layers and categories
**So that** we can evolve the layout structure together

**Acceptance Criteria:**
- [ ] Layer changes sync (add, delete, rename, reorder)
- [ ] Category changes sync (add, delete, color change)
- [ ] Drawer size changes sync
- [ ] Layout name changes sync
- [ ] Destructive actions (delete layer with bins) handled gracefully

### 5.5 Local Preferences

#### US-5.1: Independent Zoom/Pan
**As** a collaborator
**I want to** zoom and pan independently
**So that** I can focus on my area of interest

**Acceptance Criteria:**
- [ ] Zoom level is local (not synced)
- [ ] Pan position is local (not synced)
- [ ] Each user can have different zoom levels
- [ ] Remote cursors render at correct grid position regardless of zoom

#### US-5.2: Independent Layer View
**As** a collaborator
**I want to** view different layers independently
**So that** I can focus on specific layers

**Acceptance Criteria:**
- [ ] Active layer selection is local
- [ ] "Show other layers" toggle is local
- [ ] Other users' edits on hidden layers still sync
- [ ] Selection is local (selecting bin doesn't select for others)

#### US-5.3: Independent 3D Preview
**As** a collaborator
**I want to** toggle 3D preview independently
**So that** I can use my preferred view

**Acceptance Criteria:**
- [ ] 3D preview toggle is local
- [ ] Preview rotation is local
- [ ] Layer view mode is local
- [ ] Preview reflects synced layout state

### 5.6 Permission Management

#### US-6.1: Change Permission Level
**As** a layout owner
**I want to** change between view-only and editable
**So that** I can control who can modify my layout

**Acceptance Criteria:**
- [ ] Toggle in share panel to switch permission
- [ ] Change takes effect immediately for all connected users
- [ ] View-only users see edit controls disabled
- [ ] Toast notification when permission changes
- [ ] URL stays the same—only server-side permission changes

#### US-6.2: Disable Collaboration
**As** a layout owner
**I want to** stop sharing my layout entirely
**So that** I can work privately again

**Acceptance Criteria:**
- [ ] "Stop sharing" option in share panel
- [ ] All connected participants disconnected
- [ ] Participants prompted to save a copy
- [ ] Layout returns to local-only storage
- [ ] Share link becomes invalid

#### US-6.3: Save Copy of Layout
**As** a collaborator
**I want to** save a copy of the layout to my library
**So that** I can keep the design

**Acceptance Criteria:**
- [ ] "Save Copy" button available for all participants
- [ ] Saves current state to local library
- [ ] Saved as new layout (not linked to original)
- [ ] Does not affect collaboration for others
- [ ] Works in both view-only and edit modes

### 5.7 Error Handling

#### US-7.1: Handle Disconnection
**As** a collaborator
**I want to** gracefully handle network issues
**So that** I don't lose my work

**Acceptance Criteria:**
- [ ] "Reconnecting..." banner shown on disconnect
- [ ] Auto-reconnect with exponential backoff
- [ ] Local edits queued during disconnect
- [ ] Queued edits synced on reconnect
- [ ] Option to save copy if reconnect fails

#### US-7.2: Handle Conflicts
**As** an editor
**I want to** understand when my edit conflicts
**So that** I know what happened

**Acceptance Criteria:**
- [ ] Conflicting edits resolved automatically (last-write-wins)
- [ ] Toast notification for rejected edits (rare)
- [ ] No data loss—worst case is edit doesn't apply
- [ ] Full sync if state diverges too much

---

## 6. Functional Requirements

### 6.1 Sharing Model

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | System shall support two permission levels: `view` and `edit` | P0 |
| FR-1.2 | Permission level shall be changeable by owner at any time | P0 |
| FR-1.3 | Same share URL (`/s/{id}`) shall work for both permission levels | P0 |
| FR-1.4 | Permission shall be stored server-side, not reflected in URL | P0 |
| FR-1.5 | Collaborative layouts shall be stored on server (cloud-only) | P0 |
| FR-1.6 | Local layout shall become linked reference when collaboration enabled | P1 |

### 6.2 Real-Time Sync

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Layout changes shall propagate to all participants within 200ms | P0 |
| FR-2.2 | Cursor positions shall update at minimum 20fps (50ms intervals) | P0 |
| FR-2.3 | System shall use Liveblocks for real-time synchronization | P0 |
| FR-2.4 | Clients shall apply optimistic updates with server confirmation | P1 |
| FR-2.5 | System shall perform full state sync on reconnection | P0 |
| FR-2.6 | Operations shall be validated server-side before broadcast | P0 |

### 6.3 Presence

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Each participant shall have a unique, consistent color | P0 |
| FR-3.2 | Cursor position shall be shown for all participants over the grid | P0 |
| FR-3.3 | Participant names shall be displayed next to their cursors | P0 |
| FR-3.4 | Interaction previews (drag, resize, draw) shall be visible to others | P1 |
| FR-3.5 | Participant list shall show all connected users | P0 |
| FR-3.6 | System shall announce participant joins and leaves | P1 |

### 6.4 Permissions

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | View-only participants shall not be able to modify layout | P0 |
| FR-4.2 | View-only participants shall be able to pan, zoom, and toggle preview | P0 |
| FR-4.3 | View-only participants shall see all cursors and presence | P0 |
| FR-4.4 | Edit participants shall have full editing capabilities | P0 |
| FR-4.5 | All participants shall be able to save a copy to their library | P0 |

### 6.5 Data Integrity

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Layout shall persist on server until owner deletes share | P0 |
| FR-5.2 | Server shall validate all operations against current state | P0 |
| FR-5.3 | Invalid operations shall be rejected with error message | P0 |
| FR-5.4 | System shall prevent operations on deleted entities | P0 |
| FR-5.5 | Drawer resize shall handle displaced bins (move to staging) | P0 |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1.1 | Cursor update latency | < 100ms (95th percentile) |
| NFR-1.2 | Operation sync latency | < 200ms (95th percentile) |
| NFR-1.3 | Initial connection time | < 2 seconds |
| NFR-1.4 | Memory usage per participant | < 50MB additional |
| NFR-1.5 | CPU usage during active collaboration | < 10% additional |

### 7.2 Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-2.1 | Concurrent collaborative layouts | 10,000+ |
| NFR-2.2 | Participants per layout | 20 (soft limit), 50 (hard limit) |
| NFR-2.3 | Operations per second per layout | 100+ |
| NFR-2.4 | Cursor updates per second per layout | 400+ (20 users × 20fps) |

### 7.3 Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-3.1 | Service availability | 99.9% uptime |
| NFR-3.2 | Data loss rate | 0% (no operation loss) |
| NFR-3.3 | Reconnection success rate | > 95% within 30 seconds |
| NFR-3.4 | Graceful degradation | Offline mode preserves local state |

### 7.4 Compatibility

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-4.1 | Browser support | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| NFR-4.2 | Device support | Desktop, tablet, mobile |
| NFR-4.3 | Network tolerance | Works on 3G (500kbps) |
| NFR-4.4 | Backwards compatibility | Non-collab features unaffected |

### 7.5 Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-5.1 | Share ID entropy | Cryptographically random, 96+ bits |
| NFR-5.2 | Rate limiting | 100 operations/min per connection |
| NFR-5.3 | Content validation | Same limits as cloud share (500KB, 2500 bins) |
| NFR-5.4 | No sensitive data exposure | Share IDs only, no auth tokens |

---

## 8. User Experience

### 8.1 Entry Points

#### Enabling Collaboration (Owner)

```
Layout open → Click "Share" → Share panel opens
                                    ↓
                           ┌─────────────────────────────────────┐
                           │   Share this layout                 │
                           ├─────────────────────────────────────┤
                           │                                     │
                           │  Anyone with the link can:          │
                           │                                     │
                           │  [View ▼]                           │
                           │    ├─ View (default)                │
                           │    └─ Edit                          │
                           │                                     │
                           │  ┌─────────────────────────────────┐│
                           │  │ https://gridfinity.app/s/abc123 ││
                           │  └─────────────────────────────────┘│
                           │                                     │
                           │  [Copy link]                        │
                           │                                     │
                           └─────────────────────────────────────┘
```

URL stays the same regardless of permission level.

#### Joining (Collaborator)

```
Click link → /s/{shareId}
                    ↓
            ┌─────────────────────────────┐
            │   Joining...                │
            │   [Loading spinner]         │
            └─────────────────────────────┘
                    ↓
            Layout loads with collaboration
            Banner: "You're collaborating with Alex"
```

### 8.2 Collaboration UI Elements

#### Header Bar (During Collaboration)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Layout Name          [● Collaborating] [👤 👤 👤 +2] [Share] [Menu]  │
└──────────────────────────────────────────────────────────────────────┘
     ↑                        ↑                ↑
 Layout name          Status indicator   Participant avatars
```

#### Participant List Details

```
Expanded participant list:
┌─────────────────────┐
│ Collaborators (5)   │
├─────────────────────┤
│ 🟢 Alex (host)  👑  │  ← Owner
│ 🔵 Jordan           │
│ 🟣 Sam              │
│ 🟡 Guest 4          │
│ 🟠 Guest 5          │
└─────────────────────┘
```

#### Cursor Appearance

```
      ╲
       ╲  Jordan
        ◢───────┐
        │       │  ← Name label
        └───────┘

Interaction preview (when dragging):
      ╲
       ╲  Jordan
        ◢
        ┌ ─ ─ ─ ─ ┐  ← Dashed outline
        │  3×2    │     showing drag
        └ ─ ─ ─ ─ ┘     preview
```

#### Collaboration Banner

```
Edit mode (owner):
┌──────────────────────────────────────────────────────────────────────┐
│ ✏️ Collaborating with 3 others                           [Copy Link] │
└──────────────────────────────────────────────────────────────────────┘

Edit mode (participant):
┌──────────────────────────────────────────────────────────────────────┐
│ ✏️ Editing Alex's layout with 2 others                   [Save Copy] │
└──────────────────────────────────────────────────────────────────────┘

View-only mode:
┌──────────────────────────────────────────────────────────────────────┐
│ 👁 Viewing Alex's layout (view-only)                     [Save Copy] │
└──────────────────────────────────────────────────────────────────────┘

Disconnected:
┌──────────────────────────────────────────────────────────────────────┐
│ ⚠️ Connection lost • Reconnecting...                     [Save Copy] │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.3 Mobile Experience

On mobile devices:
- Participant avatars collapse to count: "👥 5"
- Tap count to expand participant list (bottom sheet)
- Cursors render but without name labels (space constraint)
- Collaboration banner is sticky but minimal
- "Save Copy" accessible from overflow menu

### 8.4 Interaction States

| State | Visual Indicator |
|-------|------------------|
| Connected, idle | Green dot in header |
| Connected, collaborators active | Visible cursors on grid |
| Reconnecting | Yellow banner, pulsing indicator |
| Disconnected (> 30s) | Red banner with save option |
| View-only mode | Lock icon on edit controls, banner |

### 8.5 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Shift + C` | Copy share link |

---

## 9. Edge Cases & Error Handling

### 9.1 Connection Edge Cases

| Scenario | Behavior |
|----------|----------|
| Owner closes browser tab | Collaboration continues, layout persists on server |
| Owner's network drops | Other participants can continue, owner can rejoin |
| Last participant leaves | Layout persists on server, owner can share again |
| 21st participant tries to join | "Layout is busy" message, suggest trying later |

### 9.2 Editing Edge Cases

| Scenario | Behavior |
|----------|----------|
| Two users draw overlapping bins | First wins, second gets collision error |
| User A deletes bin user B is dragging | Drag cancelled, toast notification |
| User deletes layer with others' bins | Bins move to staging, notification |
| Drawer resize displaces bins | Bins move to staging for all users |
| User undoes after sync | Undo local actions only, no global undo |

### 9.3 Network Edge Cases

| Scenario | Behavior |
|----------|----------|
| Participant has slow network (>500ms) | Cursor interpolation hides lag |
| Operation arrives out of order | Liveblocks handles ordering |
| Client misses operations | Detects gap, requests full sync |
| Rate limit exceeded | Operations queued, warning shown |

### 9.4 Permission Edge Cases

| Scenario | Behavior |
|----------|----------|
| Owner changes view→edit while users connected | All users gain edit ability immediately |
| Owner changes edit→view while user dragging | Drag cancelled, controls disabled |
| Owner stops sharing while users connected | All users disconnected, prompted to save copy |

### 9.5 Error Messages

| Error | User-Facing Message |
|-------|---------------------|
| Layout not found | "This layout doesn't exist or has been deleted." |
| Layout busy | "This layout has too many editors right now. Try again later." |
| Permission denied | "You can only view this layout. Ask the owner for edit access." |
| Operation rejected | "Your change couldn't be applied. Someone else may have edited the same area." |
| Connection failed | "Unable to connect. Check your internet connection and try again." |

---

## 10. Out of Scope

The following features are explicitly **not** included in this version:

### 10.1 Deferred to Future Versions

| Feature | Reason | Future Version |
|---------|--------|----------------|
| User accounts/auth | Increases complexity, trust-based MVP | v2 |
| Password-protected layouts | Adds friction, trust-based MVP | v2 |
| Participant approval (lobby) | Owner overhead, trust-based MVP | v2 |
| Comments/annotations | Different feature set | v2 |
| Version history | Significant infrastructure | v2+ |
| Undo others' actions | Conflict complexity | v2+ |
| Per-layer permissions | Fine-grained control complexity | v3 |
| Voice/video integration | Different product direction | Maybe never |

### 10.2 Explicitly Not Planned

| Feature | Reason |
|---------|--------|
| Offline-first collaboration | Requires CRDT, significant complexity |
| Cross-layout collaboration | Scope creep, single layout focus |
| Real-time chat | Use external tools (Discord, etc.) |

---

## 11. Dependencies & Risks

### 11.1 Technical Dependencies

| Dependency | Purpose | Risk Level |
|------------|---------|------------|
| Liveblocks | Real-time sync, presence, storage | Medium |
| Vercel deployment | Hosting, edge functions | Low (existing) |
| Vercel Blob | Layout storage | Low (existing) |

### 11.2 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Liveblocks unavailability | Low | High | Abstract sync layer, have backup plan |
| High latency degrades UX | Medium | Medium | Optimistic updates, cursor interpolation |
| Abuse (spam edits) | Medium | Low | Rate limiting, owner can disable editing |
| Conflicts cause data loss | Low | High | Server validation, Liveblocks conflict resolution |
| Mobile performance issues | Medium | Medium | Reduce cursor update frequency on mobile |
| Bandwidth costs | Medium | Medium | Throttle cursors, compress operations |

### 11.3 Open Questions

| Question | Status |
|----------|--------|
| Liveblocks pricing at scale? | Evaluate during beta |
| Max participants (20 vs. 50)? | Start with 20, increase if needed |

---

## 12. Feature Flag

### 12.1 Labs Toggle

Collaboration is gated behind a Labs feature flag, allowing users to opt-in:

**Location**: Settings > Labs > "Collaborative Editing"

**Behavior when enabled**:
- Share panel shows permission selector (view/edit)
- `/s/{id}` URLs check permission and enable collaboration if set to "edit"
- Presence UI components load

**Behavior when disabled**:
- Share panel works as today (view-only links)
- `/s/{id}` URLs always load in view-only mode
- No presence UI

### 12.2 Rollout Plan

1. **Internal testing**: Team members enable via Labs
2. **Beta**: Announce in community, gather feedback
3. **GA**: Enable by default, remove Labs toggle

---

## 13. Appendix

### 13.1 Glossary

| Term | Definition |
|------|------------|
| **Owner** | The user who created and controls the layout |
| **Collaborator** | Any user connected to a collaborative layout |
| **Participant** | Same as collaborator |
| **Presence** | Real-time awareness of other users (cursors, activity) |
| **Permission level** | Whether collaborators can view or edit |
| **Linked layout** | Local layout that references a cloud-stored original |

### 13.2 Related Documents

- [Systems Architecture: Collaborative Editing](./architecture.md)
- [Design Requirements: Collaborative Editing](./design-requirements.md)

### 13.3 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01 | Product Team | Initial draft with session-based model |
| 2.0 | 2026-01 | Product Team | Revised to Google Docs-style sharing model |

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Engineering Lead | | | |
| Design Lead | | | |
