import { reportError } from "../store/useUI";
import { equal } from "./types";
import { currentDatabase } from "../db/database";
import { useSettings } from "../store/useSettings";
import { withDefaultSettings } from "../store/settingsDefaults";
export async function selectPreferences(owner: string | null) {
  const name = owner ? `easy-learn-settings-${owner}` : "easy-learn-settings";
  // Read before setState: Zustand persist writes immediately, so resetting to
  // defaults first would erase the saved preferences before rehydration.
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(name) ?? "null")?.state?.settings;
  } catch {
    stored = undefined;
  }
  useSettings.persist.setOptions({ name });
  useSettings.setState({ settings: withDefaultSettings(stored) });
  const database = currentDatabase();
  const remote = database.owner
    ? await database.preferences.get("settings")
    : undefined;
  if (remote)
    useSettings.setState({
      settings: withDefaultSettings(
        remote.value as Parameters<typeof withDefaultSettings>[0],
      ),
    });
}
export function observePreferences() {
  return useSettings.subscribe((state, previous) => {
    const database = currentDatabase();
    if (!database.owner || equal(state.settings, previous.settings)) return;
    void database.preferences
      .put({ id: "settings", value: state.settings })
      .catch(reportError);
  });
}
