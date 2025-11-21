import { Button, makeStyles } from "@fluentui/react-components";
import { WeatherMoon20Regular, WeatherSunny20Regular } from "@fluentui/react-icons";
import { useTheme } from "@/hooks/use-theme";

const useStyles = makeStyles({
  button: {
    minWidth: "32px",
    minHeight: "32px",
  },
  icon: {
    width: "20px",
    height: "20px",
  },
});

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const styles = useStyles();

  return (
    <Button
      appearance="subtle"
      className={styles.button}
      icon={theme === "light" ? <WeatherSunny20Regular className={styles.icon} /> : <WeatherMoon20Regular className={styles.icon} />}
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label="Toggle theme"
      data-testid="button-theme-toggle"
    />
  );
}
