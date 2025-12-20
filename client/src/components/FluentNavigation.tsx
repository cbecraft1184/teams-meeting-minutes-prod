import { useState, useEffect, useRef, useMemo } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Avatar,
  Button,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Home24Regular,
  DocumentBulletList24Regular,
  Search24Regular,
  Settings24Regular,
  Shield24Filled,
  TaskListLtr24Regular,
} from "@fluentui/react-icons";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

const useStyles = makeStyles({
  nav: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "260px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRight("1px", "solid", tokens.colorNeutralStroke2),
    transitionProperty: "width, transform",
    transitionDuration: "0.3s",
    transitionTimingFunction: "ease",
    flexShrink: 0,
    "@media (max-width: 768px)": {
      position: "absolute",
      zIndex: 1000,
      left: 0,
      top: 0,
    },
  },
  navHidden: {
    width: 0,
    ...shorthands.overflow("hidden"),
    borderRightWidth: 0,
    "@media (max-width: 768px)": {
      width: "260px",
      transform: "translateX(-100%)",
    },
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 999,
    display: "none",
    "@media (max-width: 768px)": {
      display: "block",
    },
  },
  header: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("12px"),
    ...shorthands.padding("16px"),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
  },
  logo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    backgroundColor: tokens.colorBrandBackground,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  title: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  subtitle: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  menuContainer: {
    flex: 1,
    overflowY: "auto",
    ...shorthands.padding("8px"),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("4px"),
  },
  navButton: {
    justifyContent: "flex-start",
    width: "100%",
  },
  navButtonActive: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    fontWeight: tokens.fontWeightSemibold,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("12px"),
    ...shorthands.padding("16px"),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    whiteSpace: "nowrap",
    ...shorthands.overflow("hidden"),
    textOverflow: "ellipsis",
  },
  userEmail: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    ...shorthands.overflow("hidden"),
    textOverflow: "ellipsis",
  },
});

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home24Regular,
  },
  {
    title: "All Meetings",
    url: "/meetings",
    icon: DocumentBulletList24Regular,
  },
  {
    title: "Search Archive",
    url: "/search",
    icon: Search24Regular,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings24Regular,
  },
  {
    title: "Job Queue",
    url: "/admin/jobs",
    icon: TaskListLtr24Regular,
    adminOnly: true,
  },
];

interface FluentNavigationProps {
  isOpen?: boolean;
  onClose?: () => void;
}

// Custom hook for responsive breakpoint
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function FluentNavigation({ isOpen = true, onClose }: FluentNavigationProps) {
  const styles = useStyles();
  const [location, setLocation] = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Fetch user permissions to determine admin access
  const { data: userInfo } = useQuery<{ permissions: { role: string } }>({
    queryKey: ['/api/user/me'],
  });
  
  const isAdmin = userInfo?.permissions?.role === 'admin';
  
  // Filter menu items based on user role
  const visibleMenuItems = useMemo(() => 
    menuItems.filter(item => !(item as any).adminOnly || isAdmin),
    [isAdmin]
  );

  const handleNavigation = (url: string) => {
    setLocation(url);
    // Close nav on mobile after navigation
    if (isMobile && onClose) {
      onClose();
    }
  };

  // Focus trap for mobile drawer
  useEffect(() => {
    if (!isMobile || !isOpen) return;

    const nav = navRef.current;
    if (!nav) return;

    // Store the element that opened the drawer
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Focus first interactive element in nav
    const firstFocusable = nav.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') as HTMLElement;
    firstFocusable?.focus();

    // Handle tab key to trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = nav.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile, isOpen, onClose]);

  // Focus restoration - runs when drawer closes
  useEffect(() => {
    if (!isMobile) return;
    
    if (!isOpen && previouslyFocusedRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        previouslyFocusedRef.current?.focus();
        previouslyFocusedRef.current = null;
      });
    }
  }, [isMobile, isOpen]);

  return (
    <>
      {isOpen && isMobile && (
        <div className={styles.overlay} onClick={onClose} />
      )}
      <nav 
        ref={navRef}
        className={mergeClasses(styles.nav, !isOpen && styles.navHidden)}
        role="navigation"
        aria-label="Main navigation"
        aria-hidden={!isOpen}
      >
      <div className={styles.header}>
        <div className={styles.logo}>
          <Shield24Filled style={{ color: tokens.colorNeutralForegroundInverted }} />
        </div>
        <div>
          <div className={styles.title}>Teams Meeting</div>
          <div className={styles.subtitle}>Minutes</div>
        </div>
      </div>

      <div className={styles.menuContainer}>
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.url;
          
          return (
            <Button
              key={item.title}
              appearance="subtle"
              icon={<Icon />}
              className={mergeClasses(styles.navButton, isActive && styles.navButtonActive)}
              onClick={() => handleNavigation(item.url)}
              data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}
              tabIndex={!isOpen ? -1 : 0}
              disabled={!isOpen}
            >
              {item.title}
            </Button>
          );
        })}
      </div>

      <div className={styles.footer}>
        <Avatar
          name="Administrator"
          color="brand"
          size={32}
        />
        <div className={styles.userInfo}>
          <div className={styles.userName}>Administrator</div>
          <div className={styles.userEmail}>admin@contoso.com</div>
        </div>
      </div>
    </nav>
    </>
  );
}
