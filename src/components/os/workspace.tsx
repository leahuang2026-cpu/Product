"use client";
import { ArchiveView, DetailPage } from "./archive";
import { EntriesView } from "./entries";
import { Composer } from "./composer";
import { SettingsView } from "./settings";
import { Login } from "./auth";
export function OSWorkspace({ section, id }: { section: string; id?: string }) {
  if (id) return <DetailPage id={id} />;
  switch (section) {
    case "home":
    case "focus":
      return <EntriesView kind="focus" home />;
    case "capture":
      return (
        <>
          <div className="page-title">
            <h1>记录此刻</h1>
          </div>
          <Composer />
        </>
      );
    case "archive":
      return <ArchiveView />;
    case "ideas":
      return <ArchiveView garden />;
    case "direction":
      return <EntriesView kind="direction" />;
    case "reflection":
      return <EntriesView kind="reflection" />;
    case "settings":
      return <SettingsView />;
    case "login":
      return <Login />;
    default:
      return null;
  }
}
