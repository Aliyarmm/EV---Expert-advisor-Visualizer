import { SettingsPanel } from "@/components/settings-panel";

export const metadata = {
  title: "Settings — EA Index",
  description: "Data management, risk settings, and export configuration",
};

export default function SettingsPage() {
  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-text mb-1">
          Settings
        </h1>
        <p className="text-sm text-text-tertiary">
          Manage data sources, configure risk parameters, and set up export
          preferences.
        </p>
      </div>
      <SettingsPanel />
    </main>
  );
}
