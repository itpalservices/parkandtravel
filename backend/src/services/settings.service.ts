import { prisma } from "../lib/prisma";

export interface ConfigurationSettings {
  availableUncovered: number | null;
  availableCovered: number | null;
  priceUncovered: number | null;
  priceCovered: number | null;
  priceWash: number | null;
  dayEnd: number | null;
  deliveryFee: number | null;
  tax: number | null;
  emailDescription: string | null;
  priceIncrementsCovered: number[] | null;
  priceIncrementsUncovered: number[] | null;
  mandatoryPayment: boolean;
  mandatoryCheckInPayment: boolean;
  airportDelivery: boolean;
  availableAfter: number;
  returnDetailsDefault: boolean;
  defaultParkingType: string;
}

export const PARKING_TYPE_IDS = ['parkingType_covered', 'parkingType_uncovered'] as const;
const DEFAULT_PARKING_TYPE_FALLBACK = 'parkingType_covered';

const SETTING_KEYS = {
  availableUncovered: "configurationSetting_availableUncovered",
  availableCovered: "configurationSetting_availableCovered",
  priceUncovered: "configurationSetting_priceUncovered",
  priceCovered: "configurationSetting_priceCovered",
  priceWash: "configurationSetting_priceWash",
  dayEnd: "configurationSetting_dayEnd",
  deliveryFee: "configurationSetting_deliveryFee",
  tax: "configurationSetting_tax",
  emailDescription: "configurationSetting_emailDescription",
  priceIncrementsCovered: "configurationSetting_priceIncrementsCovered",
  priceIncrementsUncovered: "configurationSetting_priceIncrementsUncovered",
  mandatoryPayment: "configurationSetting_mandatoryPrePayment",
  mandatoryCheckInPayment: "configurationSetting_mandatoryCheckInPayment",
  airportDelivery: "configurationSetting_delivery",
  availableAfter: "configurationSetting_availableAfter",
  returnDetailsDefault: "configurationSetting_returnDetailsDefault",
  defaultParkingType: "configurationSetting_defaultParkingType"
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
    dayEnd: parseIntOrNull(settingsMap.get(SETTING_KEYS.dayEnd)),
    deliveryFee: parseFloatOrNull(settingsMap.get(SETTING_KEYS.deliveryFee)),
    tax: parseFloatOrNull(settingsMap.get(SETTING_KEYS.tax)),
    emailDescription: settingsMap.get(SETTING_KEYS.emailDescription) ?? null,
    priceIncrementsCovered: parseJsonArrayOrNull(settingsMap.get(SETTING_KEYS.priceIncrementsCovered)),
    priceIncrementsUncovered: parseJsonArrayOrNull(settingsMap.get(SETTING_KEYS.priceIncrementsUncovered)),
    mandatoryPayment: parseBoolean(settingsMap.get(SETTING_KEYS.mandatoryPayment)),
    mandatoryCheckInPayment: parseBoolean(settingsMap.get(SETTING_KEYS.mandatoryCheckInPayment)),
    airportDelivery: parseBoolean(settingsMap.get(SETTING_KEYS.airportDelivery)),
    availableAfter: parseIntOrNull(settingsMap.get(SETTING_KEYS.availableAfter)) ?? 0,
    returnDetailsDefault: parseBoolean(settingsMap.get(SETTING_KEYS.returnDetailsDefault)),
    defaultParkingType: parseParkingTypeId(settingsMap.get(SETTING_KEYS.defaultParkingType))
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

  if (data.dayEnd !== undefined) {
    updates.push({
      id: SETTING_KEYS.dayEnd,
      value: data.dayEnd !== null ? String(data.dayEnd) : null,
    });
  }

  if (data.deliveryFee !== undefined) {
    updates.push({
      id: SETTING_KEYS.deliveryFee,
      value: data.deliveryFee !== null ? String(data.deliveryFee) : null,
    });
  }

  if (data.tax !== undefined) {
    updates.push({
      id: SETTING_KEYS.tax,
      value: data.tax !== null ? String(data.tax) : null,
    });
  }

  if (data.emailDescription !== undefined) {
    updates.push({
      id: SETTING_KEYS.emailDescription,
      value: data.emailDescription !== null && data.emailDescription.trim() !== '' ? data.emailDescription : null,
    });
  }

  if (data.priceIncrementsCovered !== undefined) {
    updates.push({
      id: SETTING_KEYS.priceIncrementsCovered,
      value: data.priceIncrementsCovered !== null ? JSON.stringify(data.priceIncrementsCovered) : null,
    });
  }

  if (data.priceIncrementsUncovered !== undefined) {
    updates.push({
      id: SETTING_KEYS.priceIncrementsUncovered,
      value: data.priceIncrementsUncovered !== null ? JSON.stringify(data.priceIncrementsUncovered) : null,
    });
  }

  if (data.mandatoryPayment !== undefined) {
    updates.push({
      id: SETTING_KEYS.mandatoryPayment,
      value: data.mandatoryPayment !== null ? JSON.stringify(data.mandatoryPayment) : null,
    });
  }

  if (data.mandatoryCheckInPayment !== undefined) {
    updates.push({
      id: SETTING_KEYS.mandatoryCheckInPayment,
      value: data.mandatoryCheckInPayment !== null ? JSON.stringify(data.mandatoryCheckInPayment) : null,
    });
  }

  if (data.airportDelivery !== undefined) {
    updates.push({
      id: SETTING_KEYS.airportDelivery,
      value: JSON.stringify(data.airportDelivery),
    });
  }

  if (data.availableAfter !== undefined) {
    updates.push({
      id: SETTING_KEYS.availableAfter,
      value: data.availableAfter !== null ? String(Math.max(0, Math.floor(Number(data.availableAfter)))) : "0",
    });
  }

  if (data.returnDetailsDefault !== undefined) {
    updates.push({
      id: SETTING_KEYS.returnDetailsDefault,
      value: JSON.stringify(data.returnDetailsDefault),
    });
  }

  if (data.defaultParkingType !== undefined) {
    updates.push({
      id: SETTING_KEYS.defaultParkingType,
      value: parseParkingTypeId(data.defaultParkingType),
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

function parseParkingTypeId(value: string | null | undefined): string {
  return value === 'parkingType_covered' || value === 'parkingType_uncovered'
    ? value
    : DEFAULT_PARKING_TYPE_FALLBACK;
}

function parseBoolean(value: string | null | undefined): boolean {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;

  return false;
}

export async function getAvailableAfterDays(): Promise<number> {
  const result = await prisma.$queryRawUnsafe<{ value: string | null }[]>(
    `SELECT value FROM configuration_settings WHERE id = $1`,
    'configurationSetting_availableAfter'
  );
  if (!result.length || result[0].value === null) return 0;
  const parsed = parseInt(result[0].value, 10);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function parseJsonArrayOrNull(value: string | null | undefined): number[] | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((v: any) => typeof v === "number")) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
