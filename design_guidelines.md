# Microsoft Teams Meeting Minutes Agent - Design Guidelines

## Design Approach
**System:** Fluent Design System (Microsoft Teams Integration)
**Rationale:** Enterprise productivity tool requiring native Teams experience. Fluent ensures seamless integration with existing Teams interface patterns and theme system.

## Core Design Principles
- **Information Density Over Visual Flair:** Prioritize data accessibility and scanning efficiency
- **Teams-Native Feel:** Users should not distinguish between this app and native Teams features
- **Contextual Clarity:** Always communicate AI processing status and meeting context clearly

## Typography System
**Font Family:** Segoe UI (Teams standard)
- **Headers:** Semibold 24px (page titles), Semibold 20px (section headers), Semibold 16px (card titles)
- **Body Text:** Regular 14px (primary content), Regular 13px (metadata/timestamps)
- **Labels/Tags:** Semibold 12px (status badges, categories)

## Layout & Spacing System
**Tailwind Units:** Use 3, 4, 6, 8, 12, 16 for consistent rhythm
- Container padding: px-6 py-4
- Card spacing: gap-4 between cards, p-6 internal padding
- Section margins: mb-8 between major sections
- Component spacing: space-y-3 for stacked elements

## Component Library

### Navigation & Structure
**Left Sidebar Tab:**
- Icon + "Meeting Minutes" label matching Teams tab pattern
- Active state indicator (blue vertical bar, subtle background)

**Top Bar (Per View):**
- Breadcrumb navigation (Home / Meetings / [Meeting Name])
- Search bar (full-width, Fluent SearchBox component)
- Action buttons right-aligned (New Meeting, Settings icon)

### Dashboard View
**Layout:** 2-column grid on desktop (md:grid-cols-2), single column mobile

**Quick Stats Cards (Top Row):**
- 3 metric cards: Total Meetings, This Week, Pending Review
- Each card: Large number (32px), label below, trend indicator
- Subtle border, light background fill

**Recent Meetings List:**
- Card-based layout with 4px rounded corners
- Per card: Meeting title (bold), date/time, participant count badge, AI processing status chip
- Hover state: subtle shadow elevation
- Right chevron for navigation

**Search & Filter Bar:**
- Persistent search input at top
- Filter chips below: Date Range, Participants, Meeting Type, Tags
- Clear filters link on right

### Meetings List View
**Table Layout (Desktop):**
- Columns: Meeting Title, Date/Time, Duration, Participants (avatars), Status, Actions
- Sortable headers with arrow indicators
- Row hover: background tint, action buttons fade in
- Checkbox column for bulk actions
- Sticky header on scroll

**List Layout (Mobile):**
- Stacked cards with key info
- Expandable details on tap

### Meeting Detail View
**Header Section:**
- Meeting title (24px bold), date/time below
- Participant avatars row (overlapping style)
- Action buttons: Share, Edit Tags, Export (right-aligned)

**Content Area - Tabbed Interface:**
- Tabs: Summary, Full Transcript, Action Items, Decisions, Attachments
- Tab content with generous whitespace (p-8)

**Summary Tab:**
- AI-generated summary in readable prose format (max-w-3xl)
- Key highlights in callout boxes with subtle background
- Timestamp references linkable to transcript

**Action Items Section:**
- Checkbox list with assignee avatars
- Due date badges (color-coded: overdue red, upcoming orange, completed green)
- Add new action item button at bottom

**Transcript View:**
- Speaker labels (bold), timestamps (muted), text content
- Search highlights in yellow background
- Smooth scroll to timestamp on click

### Archive Search
**Advanced Search Panel:**
- Multi-field search: Keywords, Date Range, Participants, Tags
- Collapsible filters sidebar (left, 300px width)
- Results count at top

**Results Grid:**
- Card layout showing meeting preview
- Matched text snippets with highlights
- Relevance score indicator
- Sort dropdown: Relevance, Date, Duration

## Status & Feedback Elements
**AI Processing States:**
- "Processing..." with animated spinner (Fluent Spinner)
- "Completed" with green checkmark
- "Error" with warning icon + retry button
- Progress bar for long operations

**Empty States:**
- Centered icon (96px), heading, description, primary action button
- "No meetings yet" / "No results found" / "No action items"

**Toast Notifications:**
- Top-right corner, auto-dismiss 4s
- Success (green accent), Error (red accent), Info (blue accent)

## Images
**Not Applicable:** This is a productivity dashboard tool integrated into Teams. No hero images or marketing visuals needed. Focus entirely on data presentation, tables, lists, and functional UI components.

## Responsive Behavior
**Breakpoints:**
- Mobile (<640px): Single column, collapsible filters, simplified tables → cards
- Tablet (640-1024px): 2-column layouts where appropriate, visible but collapsible sidebar
- Desktop (>1024px): Full multi-column layouts, persistent sidebars

**Teams Integration:**
- Respect Teams content area constraints (no fixed widths exceeding container)
- Support both Teams light and dark mode (use Fluent theme tokens)