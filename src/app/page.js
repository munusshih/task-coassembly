"use client";

import { useState } from "react";
import { firebaseReady } from "../firebase";
import Navigation from "./components/Navigation";
import MembersPage from "./components/MembersPage";
import ProjectsPage from "./components/ProjectsPage";
import DataViewPage from "./components/DataViewPage";
import TbdPage from "./components/TbdPage";

const DATA_TABS = ["tasks", "kanban", "meetingNotes"];
const TBD_TABS = ["finance", "resources"];

export default function Home() {
  const [activeTab, setActiveTab] = useState("members");

  if (!firebaseReady) {
    return (
      <main className="page-shell">
        <section className="panel">
          <h1>Firebase config needed</h1>
          <p>Add the required <code>NEXT_PUBLIC_FIREBASE_*</code> values to <code>.env.local</code>.</p>
        </section>
      </main>
    );
  }

  function renderPage() {
    if (activeTab === "members") return <MembersPage />;
    if (activeTab === "projects") return <ProjectsPage />;
    if (DATA_TABS.includes(activeTab)) return <DataViewPage tabKey={activeTab} />;
    if (TBD_TABS.includes(activeTab)) return <TbdPage tabKey={activeTab} />;
    return null;
  }

  return (
    <>
      <main className="page-shell">
        <section className="page-content">
          {renderPage()}
        </section>
      </main>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}
