# UI/UX Implementation Plan
## DOD Teams Meeting Minutes Management System

**Document Purpose:** Comprehensive UI/UX design specification and implementation guide following Microsoft Fluent Design principles with DOD-grade professional appearance

**Last Updated:** November 13, 2025  
**Status:** Implementation Guide  
**Audience:** Frontend engineers, UX designers, accessibility specialists

---

## Executive Summary

### Purpose

This document provides detailed UI/UX design specifications, component guidelines, and implementation standards for building a professional, accessible, and classification-aware interface for the DOD Teams Meeting Minutes Management System.

### Scope

**In Scope:**
- Microsoft Fluent Design System integration
- Dual-theme system (Light/Dark modes)
- Responsive design (desktop, tablet, mobile)
- WCAG 2.1 AA accessibility compliance
- Classification visual indicators
- Component library and design tokens
- User workflows and interaction patterns

**Out of Scope:**
- Branding and logo design
- Marketing materials
- Training videos
- Print layouts

### Design Principles

```yaml
Professional DOD Appearance:
  - Clean, modern interface without excessive embellishment
  - High information density for power users
  - Classification badges prominently displayed
  - Government-appropriate color palette

Microsoft Fluent Design Alignment:
  - Consistent with Microsoft 365 visual language
  - Familiar to Teams users
  - Smooth animations and transitions
  - Depth and shadow for hierarchy

Accessibility First:
  - WCAG 2.1 AA compliant
  - Keyboard navigation support
  - Screen reader optimized
  - High contrast mode support
  - Minimum 4.5:1 text contrast ratios

Classification Awareness:
  - Color-coded classification badges
  - Visual indicators on all classified content
  - Clear security markings on documents
  - Access-denied states clearly communicated
```

---

## Reference Design System

### Design Tokens

**File**: `client/src/styles/design-tokens.css`

```css
:root {
  /* Color Palette - Aligned with Microsoft Fluent */
  --color-primary: 218 100% 50%;        /* Microsoft Blue #0078D4 */
  --color-primary-hover: 218 100% 45%;
  --color-primary-active: 218 100% 40%;
  
  --color-secondary: 0 0% 50%;          /* Neutral Gray */
  --color-accent: 218 100% 50%;         /* Accent Blue */
  
  /* Background Colors */
  --color-background: 0 0% 100%;        /* White */
  --color-surface: 0 0% 98%;            /* Light Gray */
  --color-card: 0 0% 100%;              /* White */
  
  /* Text Colors - 3-level hierarchy */
  --color-text-primary: 0 0% 13%;       /* Near Black #212121 */
  --color-text-secondary: 0 0% 38%;     /* Medium Gray #616161 */
  --color-text-tertiary: 0 0% 62%;      /* Light Gray #9E9E9E */
  
  /* Classification Colors */
  --color-unclassified: 142 71% 45%;    /* Green #28A745 */
  --color-confidential: 35 100% 50%;    /* Orange #FFA500 */
  --color-secret: 0 100% 50%;           /* Red #FF0000 */
  
  /* Semantic Colors */
  --color-success: 142 71% 45%;         /* Green */
  --color-warning: 45 100% 51%;         /* Yellow */
  --color-error: 0 100% 50%;            /* Red */
  --color-info: 218 100% 50%;           /* Blue */
  
  /* Spacing Scale (Consistent hierarchy) */
  --spacing-xs: 0.25rem;    /* 4px */
  --spacing-sm: 0.5rem;     /* 8px */
  --spacing-md: 1rem;       /* 16px */
  --spacing-lg: 1.5rem;     /* 24px */
  --spacing-xl: 2rem;       /* 32px */
  --spacing-2xl: 3rem;      /* 48px */
  
  /* Typography */
  --font-family-base: "Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", sans-serif;
  --font-family-mono: "Consolas", "Monaco", "Courier New", monospace;
  
  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */
  --font-size-2xl: 1.5rem;   /* 24px */
  --font-size-3xl: 2rem;     /* 32px */
  
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 9999px;
  
  /* Shadows (Fluent depth) */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.12);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.16);
  
  /* Transitions */
  --transition-fast: 150ms ease-in-out;
  --transition-base: 250ms ease-in-out;
  --transition-slow: 350ms ease-in-out;
  
  /* Z-Index Scale */
  --z-base: 1;
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-modal-backdrop: 1200;
  --z-modal: 1300;
  --z-popover: 1400;
  --z-tooltip: 1500;
}

/* Dark Mode Overrides */
.dark {
  --color-background: 0 0% 10%;         /* Dark Gray #1A1A1A */
  --color-surface: 0 0% 13%;            /* Darker Gray #212121 */
  --color-card: 0 0% 15%;               /* Card Gray #262626 */
  
  --color-text-primary: 0 0% 95%;       /* Near White */
  --color-text-secondary: 0 0% 70%;     /* Light Gray */
  --color-text-tertiary: 0 0% 50%;      /* Medium Gray */
}
```

### Component Sizing Standards

**Interactive Controls (Buttons, Inputs):**

| Size | Height | Padding (Horizontal) | Font Size | Use Case |
|------|--------|---------------------|-----------|----------|
| **sm** | 32px (2rem) | 12px | 14px | Secondary actions, compact layouts |
| **default** | 36px (2.25rem) | 16px | 16px | Primary actions, standard forms |
| **lg** | 40px (2.5rem) | 20px | 18px | Hero CTAs, prominent actions |

**All interactive elements on the same horizontal line MUST have the same height.**

**Badges and Pills (Non-interactive):**

| Type | Height | Padding | Font Size |
|------|--------|---------|-----------|
| **Badge** | 24px | 8px horizontal | 12px |
| **Pill** | 28px | 12px horizontal | 14px |

---

## Detailed Implementation Plan

### Phase 1: Design Foundation (Week 1)

**Step 1.1: Implement Design Guidelines**

**File**: `design_guidelines.md` (already exists - reference only)

Ensure this file contains:
- Color palette aligned with Fluent Design
- Typography scale
- Spacing standards
- Component usage guidelines

**Step 1.2: Configure Tailwind with Design Tokens**

**File**: `tailwind.config.ts` (modify)

```typescript
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./client/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic colors using CSS variables
        primary: "hsl(var(--color-primary) / <alpha-value>)",
        secondary: "hsl(var(--color-secondary) / <alpha-value>)",
        accent: "hsl(var(--color-accent) / <alpha-value>)",
        
        background: "hsl(var(--color-background) / <alpha-value>)",
        surface: "hsl(var(--color-surface) / <alpha-value>)",
        card: "hsl(var(--color-card) / <alpha-value>)",
        
        // Classification colors
        unclassified: "hsl(var(--color-unclassified) / <alpha-value>)",
        confidential: "hsl(var(--color-confidential) / <alpha-value>)",
        secret: "hsl(var(--color-secret) / <alpha-value>)",
      },
      spacing: {
        'xs': 'var(--spacing-xs)',
        'sm': 'var(--spacing-sm)',
        'md': 'var(--spacing-md)',
        'lg': 'var(--spacing-lg)',
        'xl': 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'full': 'var(--radius-full)',
      },
      fontFamily: {
        sans: 'var(--font-family-base)',
        mono: 'var(--font-family-mono)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
      },
      transitionDuration: {
        'fast': 'var(--transition-fast)',
        'base': 'var(--transition-base)',
        'slow': 'var(--transition-slow)',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

### Phase 2: Core Component Library (Week 2-3)

**Step 2.1: Classification Badge Component**

**File**: `client/src/components/ui/classification-badge.tsx`

```typescript
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ClassificationBadgeProps {
  classification: 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET';
  className?: string;
}

export function ClassificationBadge({ classification, className }: ClassificationBadgeProps) {
  const variants = {
    'UNCLASSIFIED': 'bg-unclassified text-white',
    'CONFIDENTIAL': 'bg-confidential text-white',
    'SECRET': 'bg-secret text-white'
  };
  
  return (
    <Badge 
      variant="default"
      className={cn(
        'font-semibold uppercase tracking-wide',
        variants[classification],
        className
      )}
      data-testid={`badge-classification-${classification.toLowerCase()}`}
    >
      {classification}
    </Badge>
  );
}
```

**Step 2.2: Meeting Card Component**

**File**: `client/src/components/meeting-card.tsx`

```typescript
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ClassificationBadge } from '@/components/ui/classification-badge';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface MeetingCardProps {
  meeting: {
    id: number;
    subject: string;
    startTime: Date;
    attendeesCount: number;
    classification: 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET';
    status: 'pending' | 'approved' | 'rejected';
  };
  onClick: () => void;
}

export function MeetingCard({ meeting, onClick }: MeetingCardProps) {
  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer"
      onClick={onClick}
      data-testid={`card-meeting-${meeting.id}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <ClassificationBadge classification={meeting.classification} />
          <StatusBadge status={meeting.status} />
        </div>
        <FileText className="h-4 w-4 text-text-tertiary" />
      </CardHeader>
      
      <CardContent className="space-y-3">
        <CardTitle className="text-lg line-clamp-2" data-testid={`text-meeting-subject-${meeting.id}`}>
          {meeting.subject}
        </CardTitle>
        
        <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{format(meeting.startTime, 'PPP')}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{meeting.attendeesCount} attendees</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants = {
    'pending': 'bg-warning/10 text-warning border-warning/20',
    'approved': 'bg-success/10 text-success border-success/20',
    'rejected': 'bg-error/10 text-error border-error/20'
  };
  
  return (
    <Badge variant="outline" className={variants[status]}>
      {status}
    </Badge>
  );
}
```

### Phase 3: Page Layouts & Navigation (Week 3-4)

**Step 3.1: Sidebar Navigation**

**File**: `client/src/components/app-sidebar.tsx`

```typescript
import { Home, Calendar, CheckSquare, Settings, FileText } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Meetings", url: "/meetings", icon: Calendar },
  { title: "Action Items", url: "/action-items", icon: CheckSquare },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  
  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Meeting Minutes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
```

**Step 3.2: Main Application Layout**

**File**: `client/src/App.tsx` (modify)

```typescript
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ClassificationBanner } from "@/components/classification-banner";

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            
            <div className="flex flex-col flex-1">
              {/* Top Header */}
              <header className="flex items-center justify-between px-4 py-3 border-b bg-surface">
                <div className="flex items-center gap-3">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <h1 className="text-lg font-semibold">DOD Meeting Minutes</h1>
                </div>
                
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <UserMenu />
                </div>
              </header>
              
              {/* Classification Banner (if viewing classified content) */}
              <ClassificationBanner classification="SECRET" />
              
              {/* Main Content */}
              <main className="flex-1 overflow-auto bg-background p-6">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
```

### Phase 4: Responsive Design (Week 4-5)

**Step 4.1: Responsive Breakpoints**

```css
/* Tailwind breakpoints */
sm: 640px   /* Tablet portrait */
md: 768px   /* Tablet landscape */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large desktop */
```

**Mobile-First Design Rules:**
1. Stack cards vertically on mobile (<768px)
2. Collapse sidebar to icon-only on tablet (<1024px)
3. Reduce padding/spacing by 50% on mobile
4. Hide tertiary information on mobile (show on hover/expand)

**Step 4.2: Responsive Grid Layout**

```typescript
// Meeting list grid - responsive
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
  {meetings.map(meeting => (
    <MeetingCard key={meeting.id} meeting={meeting} />
  ))}
</div>

// Dashboard stats - responsive
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard title="Total Meetings" value="127" />
  <StatCard title="Pending Approval" value="8" />
  <StatCard title="Action Items" value="34" />
  <StatCard title="Archived" value="119" />
</div>
```

### Phase 5: Accessibility Implementation (Week 5-6)

**Step 5.1: WCAG 2.1 AA Compliance Checklist**

**Color Contrast:**
- ✅ Text contrast ratio ≥4.5:1 (normal text)
- ✅ Text contrast ratio ≥3:1 (large text >18pt)
- ✅ UI component contrast ≥3:1
- ✅ Focus indicators visible (2px outline)

**Keyboard Navigation:**
- ✅ All interactive elements keyboard accessible
- ✅ Logical tab order (top-to-bottom, left-to-right)
- ✅ Skip navigation link for main content
- ✅ Modal focus trap implemented
- ✅ Escape key closes modals/dialogs

**Screen Reader Support:**
- ✅ Semantic HTML (header, nav, main, aside, footer)
- ✅ ARIA labels on icons-only buttons
- ✅ ARIA live regions for dynamic content
- ✅ Alt text on all images
- ✅ Form labels properly associated

**Step 5.2: Focus Management**

```typescript
// Focus trap for modals
import { useEffect, useRef } from 'react';

export function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isOpen) return;
    
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;
    
    // Focus first element
    firstElement?.focus();
    
    // Trap focus within modal
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };
    
    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);
  
  return (
    <div ref={modalRef} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}
```

---

## Controls & Compliance Alignment

### WCAG 2.1 AA Requirements

| Criterion | Level | Requirement | Implementation | Status |
|-----------|-------|-------------|----------------|--------|
| **1.1.1 Non-text Content** | A | Alt text on images | All images have descriptive alt text | ✅ Required |
| **1.3.1 Info and Relationships** | A | Semantic HTML | Use semantic elements (header, nav, main) | ✅ Required |
| **1.4.3 Contrast (Minimum)** | AA | 4.5:1 text contrast | Design tokens enforce minimum contrast | ✅ Required |
| **2.1.1 Keyboard** | A | Keyboard accessible | All interactive elements keyboard accessible | ✅ Required |
| **2.4.3 Focus Order** | A | Logical tab order | Tested with keyboard-only navigation | ✅ Required |
| **2.4.7 Focus Visible** | AA | Visible focus indicator | 2px outline on all focusable elements | ✅ Required |
| **3.2.4 Consistent Identification** | AA | Consistent UI patterns | Design system ensures consistency | ✅ Required |
| **4.1.2 Name, Role, Value** | A | ARIA attributes | Proper ARIA labels on custom components | ✅ Required |

### Section 508 Compliance

| Requirement | Implementation | Validation |
|-------------|----------------|------------|
| **§1194.22(a) Text equivalent** | Alt text on all images | Automated test |
| **§1194.22(b) Multimedia alternatives** | N/A (no multimedia) | - |
| **§1194.22(i) Frames** | Page title on all routes | Manual review |
| **§1194.22(l) Skip navigation** | Skip link to main content | Manual test |
| **§1194.22(n) Forms** | Labels on all form fields | Automated test |

---

## Validation & Acceptance Criteria

### Design Acceptance Criteria

**DAC-1: Visual Consistency**
- ✅ All pages use consistent spacing (sm, md, lg, xl)
- ✅ All interactive elements same size on horizontal lines
- ✅ Color palette limited to design tokens
- ✅ Typography follows scale (xs, sm, base, lg, xl)

**DAC-2: Classification Visual Indicators**
- ✅ Classification badge visible on all classified content
- ✅ Badge colors: Green (UNCLASS), Orange (CONF), Red (SECRET)
- ✅ Banner displays at top when viewing SECRET content
- ✅ Documents show classification markings in header/footer

**DAC-3: Responsive Design**
- ✅ Layout adapts correctly at all breakpoints
- ✅ No horizontal scrolling on mobile (320px+)
- ✅ Touch targets ≥44px on mobile
- ✅ Readable text without zooming

**DAC-4: Accessibility**
- ✅ All WCAG 2.1 AA criteria met
- ✅ Keyboard navigation works without mouse
- ✅ Screen reader announces all content correctly
- ✅ Focus indicators visible throughout

**DAC-5: Performance**
- ✅ Lighthouse accessibility score ≥95
- ✅ First Contentful Paint <1.5s
- ✅ Time to Interactive <3s
- ✅ Cumulative Layout Shift <0.1

### User Testing Runbook

**Test 1: Keyboard Navigation**
```
1. Load dashboard page
2. Press Tab key repeatedly
3. Verify tab order: Skip link → Sidebar toggle → Nav items → Main content → Footer
4. Press Enter on focused interactive elements
5. Verify all actions work without mouse

Expected: Complete task flow using keyboard only
```

**Test 2: Screen Reader (NVDA/JAWS)**
```
1. Enable screen reader
2. Navigate to meeting details page
3. Verify announcements:
   - Page title announced
   - Classification level announced
   - All form labels read correctly
   - Button purposes clear
   
Expected: All content accessible via screen reader
```

**Test 3: Color Contrast**
```
1. Use WebAIM Contrast Checker
2. Test all text/background combinations
3. Verify ratios:
   - Body text: ≥4.5:1
   - Large text (18pt+): ≥3:1
   - UI components: ≥3:1

Expected: All combinations pass WCAG AA
```

**Test 4: Mobile Responsive**
```
1. Open site on iPhone SE (375px width)
2. Navigate all pages
3. Verify:
   - No horizontal scroll
   - All buttons tappable (44px minimum)
   - Text readable without zoom
   - Sidebar collapses correctly

Expected: Fully functional on small screens
```

---

## Appendices

### Appendix A: Component Inventory

| Component | Variants | Size Options | Accessibility | Status |
|-----------|----------|--------------|---------------|--------|
| **Button** | default, outline, ghost, link | sm, default, lg, icon | ARIA label, keyboard | ✅ Built-in |
| **Badge** | default, secondary, outline | - | Role="status" | ✅ Built-in |
| **Card** | default | - | Semantic structure | ✅ Built-in |
| **Input** | text, email, password, number | sm, default | Label association | ✅ Built-in |
| **Select** | default | sm, default | ARIA expanded | ✅ Built-in |
| **Dialog** | default | - | Focus trap, Esc close | ✅ Built-in |
| **Tooltip** | default | - | ARIA described-by | ✅ Built-in |
| **ClassificationBadge** | UNCLASS, CONF, SECRET | - | Role, color contrast | ⚠️ Custom |
| **MeetingCard** | default | - | Click handler, keyboard | ⚠️ Custom |

### Appendix B: Dark Mode Implementation

```typescript
// ThemeProvider component
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  
  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('theme') as Theme;
    if (saved) setTheme(saved);
  }, []);
  
  useEffect(() => {
    // Apply to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### Appendix C: Animation Guidelines

**Micro-interactions:**
- Button hover: 150ms ease-in-out
- Card elevation: 250ms ease-in-out
- Modal open/close: 350ms ease-in-out
- Page transitions: 300ms ease-in-out

**Accessibility:**
- Respect `prefers-reduced-motion` media query
- Disable animations for users who prefer reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Appendix D: DOD Classification Banner Requirements

**CRITICAL: All classification banners MUST comply with DOD standards for classified information systems. This is a mandatory security requirement, not optional.**

#### 1. Banner Display Rules

**UNCLASSIFIED Content:**
- Top banner: Green background (#28A745), white text, "UNCLASSIFIED"
- Bottom banner: Same as top
- Text: `UNCLASSIFIED`
- Height: Minimum 40px
- Position: Fixed to viewport (always visible)

**CONFIDENTIAL Content:**
- Top banner: Orange background (#FFA500), black text, "CONFIDENTIAL"
- Bottom banner: Same as top
- Text: `CONFIDENTIAL`
- Height: Minimum 40px
- Position: Fixed to viewport (always visible)
- Warning icon: ⚠️ (optional but recommended)

**SECRET Content:**
- Top banner: Red background (#FF0000), white text, "SECRET"
- Bottom banner: Same as top
- Text: `SECRET`
- Height: Minimum 40px
- Position: Fixed to viewport (always visible)
- Alert icon: 🔴 (optional but recommended)

#### 2. Implementation Requirements

**React Component (ClassificationBanner):**
```typescript
// client/src/components/classification-banner.tsx
interface ClassificationBannerProps {
  classification: 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET';
  position: 'top' | 'bottom';
}

export function ClassificationBanner({ classification, position }: ClassificationBannerProps) {
  const styles = {
    UNCLASSIFIED: {
      bg: 'bg-green-600',
      text: 'text-white',
      icon: '',
    },
    CONFIDENTIAL: {
      bg: 'bg-orange-500',
      text: 'text-black',
      icon: '⚠️',
    },
    SECRET: {
      bg: 'bg-red-600',
      text: 'text-white',
      icon: '🔴',
    },
  };

  const style = styles[classification];

  return (
    <div
      className={`${style.bg} ${style.text} ${
        position === 'top' ? 'fixed top-0' : 'fixed bottom-0'
      } left-0 right-0 h-10 flex items-center justify-center font-bold text-sm z-50`}
      role="banner"
      aria-label={`${classification} classification banner`}
      data-testid={`banner-${classification.toLowerCase()}-${position}`}
    >
      {style.icon && <span className="mr-2">{style.icon}</span>}
      <span>{classification}</span>
      {classification === 'SECRET' && (
        <span className="ml-2 font-normal">- Authorized Personnel Only</span>
      )}
    </div>
  );
}
```

**Usage in App Layout:**
```typescript
// client/src/App.tsx
import { ClassificationBanner } from '@/components/classification-banner';

export default function App() {
  // Determine highest classification level user is viewing
  const currentClassification = determinePageClassification(); // 'UNCLASSIFIED', 'CONFIDENTIAL', or 'SECRET'

  return (
    <>
      {/* Top classification banner - REQUIRED */}
      <ClassificationBanner classification={currentClassification} position="top" />
      
      {/* Main application content */}
      <main className="mt-10 mb-10"> {/* Account for fixed banners */}
        <Router />
      </main>
      
      {/* Bottom classification banner - REQUIRED */}
      <ClassificationBanner classification={currentClassification} position="bottom" />
    </>
  );
}
```

#### 3. Dynamic Classification Detection

**Algorithm:**
```typescript
// Determine page classification based on content being viewed
function determinePageClassification(): 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' {
  const currentPath = window.location.pathname;
  
  // Check if viewing specific meeting
  if (currentPath.startsWith('/meetings/')) {
    const meetingId = currentPath.split('/')[2];
    const meeting = getMeetingById(meetingId); // From React Query cache
    return meeting?.classification || 'UNCLASSIFIED';
  }
  
  // Check if viewing search results with mixed classifications
  if (currentPath === '/search') {
    const results = getSearchResults();
    const hasSecret = results.some(r => r.classification === 'SECRET');
    const hasConf = results.some(r => r.classification === 'CONFIDENTIAL');
    
    // Display highest classification present in results
    if (hasSecret) return 'SECRET';
    if (hasConf) return 'CONFIDENTIAL';
    return 'UNCLASSIFIED';
  }
  
  // Default to UNCLASSIFIED for dashboard, login, etc.
  return 'UNCLASSIFIED';
}
```

#### 4. Document Export Markings

**PDF/DOCX Headers & Footers:**
- Classification MUST appear on every page
- Header format: `[CLASSIFICATION]` centered, all caps, bold
- Footer format: Same as header
- Font size: 14pt minimum
- Color: Match web banner colors

**Implementation (using pdf-lib):**
```typescript
import { PDFDocument, rgb } from 'pdf-lib';

async function addClassificationMarkings(
  pdfDoc: PDFDocument,
  classification: 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET'
) {
  const pages = pdfDoc.getPages();
  
  const colors = {
    UNCLASSIFIED: rgb(0.16, 0.65, 0.27), // Green
    CONFIDENTIAL: rgb(1.0, 0.65, 0.0),   // Orange
    SECRET: rgb(1.0, 0.0, 0.0),          // Red
  };
  
  pages.forEach((page) => {
    const { width, height } = page.getSize();
    
    // Top marking
    page.drawText(classification, {
      x: width / 2 - 60,
      y: height - 30,
      size: 14,
      color: colors[classification],
    });
    
    // Bottom marking
    page.drawText(classification, {
      x: width / 2 - 60,
      y: 20,
      size: 14,
      color: colors[classification],
    });
  });
}
```

#### 5. Accessibility Requirements

**Screen Reader Announcements:**
```typescript
// Announce classification when page loads or changes
useEffect(() => {
  const announcement = `Page classification: ${currentClassification}. ${
    currentClassification === 'SECRET'
      ? 'This page contains SECRET information. Authorized personnel only.'
      : currentClassification === 'CONFIDENTIAL'
      ? 'This page contains CONFIDENTIAL information.'
      : 'This page contains UNCLASSIFIED information.'
  }`;
  
  // Announce via aria-live region
  const liveRegion = document.getElementById('classification-announcer');
  if (liveRegion) {
    liveRegion.textContent = announcement;
  }
}, [currentClassification]);
```

**ARIA Live Region:**
```tsx
<div
  id="classification-announcer"
  className="sr-only"
  role="status"
  aria-live="polite"
  aria-atomic="true"
/>
```

#### 6. Testing Requirements

**Manual Testing Checklist:**
- [ ] UNCLASSIFIED banner: Green, white text, visible top and bottom
- [ ] CONFIDENTIAL banner: Orange, black text, visible top and bottom
- [ ] SECRET banner: Red, white text, "Authorized Personnel Only" suffix
- [ ] Banners remain fixed during scroll
- [ ] Banners update when navigating to different classification pages
- [ ] Screen reader announces classification on page load
- [ ] Exported PDFs include classification markings on every page
- [ ] High contrast mode: Banners still visible and distinguishable

**Automated Test (Playwright):**
```typescript
test('Classification banners display correctly', async ({ page }) => {
  await page.goto('/meetings/secret-meeting-123');
  
  // Verify top banner
  const topBanner = page.getByTestId('banner-secret-top');
  await expect(topBanner).toBeVisible();
  await expect(topBanner).toContainText('SECRET');
  await expect(topBanner).toContainText('Authorized Personnel Only');
  
  // Verify bottom banner
  const bottomBanner = page.getByTestId('banner-secret-bottom');
  await expect(bottomBanner).toBeVisible();
  await expect(bottomBanner).toContainText('SECRET');
  
  // Verify banner stays visible during scroll
  await page.mouse.wheel(0, 1000);
  await expect(topBanner).toBeVisible();
  await expect(bottomBanner).toBeVisible();
});
```

#### 7. Production Validation

**Before deploying to production:**
- [ ] All CONFIDENTIAL/SECRET pages display appropriate banners
- [ ] UNCLASSIFIED pages display green banner (not absent)
- [ ] Banner z-index ensures always on top (z-50 or higher)
- [ ] Exported documents include classification markings
- [ ] ISSO review of classification marking compliance completed
- [ ] Section 508 compliance verified for all banner states

**Failure to properly implement classification banners may result in:**
- ATO certification denial
- Security audit failure
- Unauthorized disclosure of classified information
- System shutdown by DOD security personnel

**Sign-Off Required:**
- [ ] UI/UX Lead
- [ ] Information System Security Officer (ISSO)
- [ ] Compliance Lead

#### 8. Visual Standards Reference

**Banner Placement in Application:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🔴 SECRET - Authorized Personnel Only                 │ ← Top Banner (Fixed, z-index: 50)
├─────────────────────────────────────────────────────────────────┤
│  Header with navigation and user menu                           │
├─────────────────────────────────────────────────────────────────┤
│  Main content area                                               │
│                                                                  │
│  Meeting details with SECRET badge                              │
│  - Title: "Q4 Budget Planning"                                  │
│  - Classification: SECRET (red badge)                           │
│  - Attendees: 5 personnel                                       │
│  - Minutes: Approved                                            │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  🔴 SECRET - Authorized Personnel Only              │ ← Bottom Banner (Fixed, z-index: 50)
└─────────────────────────────────────────────────────────────────┘
```

**Document Export Markings:**
```
┌──────────────────────────────────────────┐
│              SECRET                      │ ← Header (Every Page)
│  ───────────────────────────────────────  │
│                                           │
│  Meeting Minutes                          │
│  Meeting ID: meeting-789                  │
│  Date: November 13, 2025                  │
│  Classification: SECRET                   │
│                                           │
│  Attendees:                               │
│  - CAPT Smith, USN (SECRET clearance)    │
│  - LCDR Jones, USN (SECRET clearance)    │
│                                           │
│  Discussion:                              │
│  [SECRET meeting content...]              │
│                                           │
│  ───────────────────────────────────────  │
│              SECRET                      │ ← Footer (Every Page)
└──────────────────────────────────────────┘
```

---

**Document Version:** 1.0  
**Last Reviewed:** November 13, 2025  
**Next Review:** Upon major design system updates or WCAG revisions
