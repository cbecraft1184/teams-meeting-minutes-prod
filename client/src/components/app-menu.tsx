import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  Button,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  MoreHorizontal24Regular,
  QuestionCircle20Regular,
  Settings20Regular,
  Info20Regular,
} from "@fluentui/react-icons";
import { useLocation } from "wouter";

const useStyles = makeStyles({
  menuButton: {
    minWidth: "auto",
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  icon: {
    color: tokens.colorNeutralForeground2,
  },
});

export function AppMenu() {
  const styles = useStyles();
  const [, setLocation] = useLocation();

  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          icon={<MoreHorizontal24Regular />}
          className={styles.menuButton}
          data-testid="button-app-menu"
          aria-label="More options"
        />
      </MenuTrigger>

      <MenuPopover>
        <MenuList>
          <MenuItem
            onClick={() => setLocation("/help")}
            data-testid="menu-item-help"
          >
            <div className={styles.menuItem}>
              <QuestionCircle20Regular className={styles.icon} />
              <span>Help</span>
            </div>
          </MenuItem>
          <MenuItem
            onClick={() => setLocation("/settings")}
            data-testid="menu-item-settings"
          >
            <div className={styles.menuItem}>
              <Settings20Regular className={styles.icon} />
              <span>Settings</span>
            </div>
          </MenuItem>
          <MenuDivider />
          <MenuItem
            onClick={() => setLocation("/about")}
            data-testid="menu-item-about"
          >
            <div className={styles.menuItem}>
              <Info20Regular className={styles.icon} />
              <span>About</span>
            </div>
          </MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
