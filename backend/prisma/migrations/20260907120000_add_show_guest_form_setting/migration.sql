-- Seed configuration setting controlling whether the "Proceed as a Guest" flow is offered
INSERT INTO "configuration_settings" ("id", "value") VALUES ('configurationSetting_showGuestForm', 'true')
ON CONFLICT ("id") DO NOTHING;
