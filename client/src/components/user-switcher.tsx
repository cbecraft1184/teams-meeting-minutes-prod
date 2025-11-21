import { 
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Button,
  Persona,
  makeStyles,
  tokens,
  shorthands
} from "@fluentui/react-components";
import { 
  PersonSwap20Regular,
  Checkmark20Regular,
  ShieldCheckmark20Filled,
  ShieldTask20Filled,
  Eye20Filled,
  DocumentSearch20Filled
} from "@fluentui/react-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface MockUser {
  id: string;
  email: string;
  displayName: string;
  clearanceLevel: string;
  role: string;
  department: string;
}

interface CurrentUser {
  user: {
    email: string;
    displayName: string;
    role: string;
  };
}

const useStyles = makeStyles({
  personaButton: {
    minWidth: "auto",
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  roleIcon: {
    color: tokens.colorBrandForeground1,
  },
  checkmark: {
    color: tokens.colorPaletteGreenForeground1,
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
  },
  userName: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  userRole: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  currentUserBadge: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorPaletteGreenForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
});

const getRoleIcon = (role: string) => {
  switch (role) {
    case "admin":
      return <ShieldCheckmark20Filled />;
    case "approver":
      return <ShieldTask20Filled />;
    case "auditor":
      return <DocumentSearch20Filled />;
    default:
      return <Eye20Filled />;
  }
};

export function UserSwitcher() {
  const styles = useStyles();

  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ["/api/user/me"],
  });

  const { data: mockUsers } = useQuery<MockUser[]>({
    queryKey: ["/api/dev/mock-users"],
    enabled: import.meta.env.DEV,
  });

  const switchUserMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch(`/api/dev/switch-user`, {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to switch user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      window.location.reload();
    },
  });

  // Only show in development mode
  if (!import.meta.env.DEV || !mockUsers) {
    return null;
  }

  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          icon={<PersonSwap20Regular />}
          className={styles.personaButton}
          data-testid="button-user-switcher"
          aria-label="Switch user account"
        >
          {currentUser?.user?.displayName || "User"}
        </Button>
      </MenuTrigger>

      <MenuPopover>
        <MenuList>
          {mockUsers.map((user) => {
            const isCurrentUser = user.email === currentUser?.user?.email;
            return (
              <MenuItem
                key={user.id}
                onClick={() => {
                  if (!isCurrentUser) {
                    switchUserMutation.mutate(user.email);
                  }
                }}
                disabled={isCurrentUser || switchUserMutation.isPending}
                data-testid={`menu-item-user-${user.role}`}
              >
                <div className={styles.menuItem}>
                  <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                    <span className={styles.roleIcon}>
                      {getRoleIcon(user.role)}
                    </span>
                    <div className={styles.userInfo}>
                      <span className={styles.userName}>{user.displayName}</span>
                      <span className={styles.userRole}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)} • {user.clearanceLevel}
                      </span>
                    </div>
                  </div>
                  {isCurrentUser && (
                    <Checkmark20Regular className={styles.checkmark} />
                  )}
                </div>
              </MenuItem>
            );
          })}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
