import { prisma } from "../lib/prisma";

export interface ConfigurationSettings {
  availableUncovered: number | null;
  availableCovered: number | null;
  priceUncovered: number | null;
  priceCovered: number | null;
  priceWash: number | null;
}

const SETTING_KEYS = {
  availableUncovered: "configurationSetting_availableUncovered",
  availableCovered: "configurationSetting_availableCovered",
  priceUncovered: "configurationSetting_priceUncovered",
  priceCovered: "configurationSetting_priceCovered",
  priceWash: "configurationSetting_priceWash",
};

interface SettingRow {
  id: string;
  value: string | null;
}

export async function getSettings(): Promise<ConfigurationSettings> {
  const settings = await prisma.$queryRawUnsafe<SettingRow[]>(
    `SELECT id, value FROM configuration_settings`
  );

  const settingsMap = new Map<string, string | null>();
  settings.forEach((s: SettingRow) => settingsMap.set(s.id, s.value));

  return {
    availableUncovered: parseIntOrNull(
      settingsMap.get(SETTING_KEYS.availableUncovered)
    ),
    availableCovered: parseIntOrNull(
      settingsMap.get(SETTING_KEYS.availableCovered)
    ),
    priceUncovered: parseFloatOrNull(
      settingsMap.get(SETTING_KEYS.priceUncovered)
    ),
    priceCovered: parseFloatOrNull(settingsMap.get(SETTING_KEYS.priceCovered)),
    priceWash: parseFloatOrNull(settingsMap.get(SETTING_KEYS.priceWash)),
  };
}

export async function updateSettings(
  data: Partial<ConfigurationSettings>
): Promise<ConfigurationSettings> {
  const updates: { id: string; value: string | null }[] = [];

  if (data.availableUncovered !== undefined) {
    updates.push({
      id: SETTING_KEYS.availableUncovered,
      value:
        data.availableUncovered !== null
          ? String(data.availableUncovered)
          : null,
    });
  }

  if (data.availableCovered !== undefined) {
    updates.push({
      id: SETTING_KEYS.availableCovered,
      value:
        data.availableCovered !== null ? String(data.availableCovered) : null,
    });
  }

  if (data.priceUncovered !== undefined) {
    updates.push({
      id: SETTING_KEYS.priceUncovered,
      value: data.priceUncovered !== null ? String(data.priceUncovered) : null,
    });
  }

  if (data.priceCovered !== undefined) {
    updates.push({
      id: SETTING_KEYS.priceCovered,
      value: data.priceCovered !== null ? String(data.priceCovered) : null,
    });
  }

  if (data.priceWash !== undefined) {
    updates.push({
      id: SETTING_KEYS.priceWash,
      value: data.priceWash !== null ? String(data.priceWash) : null,
    });
  }

  for (const update of updates) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO configuration_settings (id, value) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET value = $2`,
      update.id,
      update.value
    );
  }

  return getSettings();
}

function parseIntOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseFloatOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}
