import React, { useEffect, useState } from "react";
import { usePanelStore } from "./panel-store.js";
import { sendToBackgroundData } from "../message-router.js";

export const PanelTeamWorkspace: React.FC = () => {
  const { pageContext } = usePanelStore();
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState("");

  const jobKey = pageContext?.url ? new URL(pageContext.url).pathname : "unknown";

  const fetchNotes = async () => {
    try {
      const ctx = await sendToBackgroundData<{ sharedNotes?: Array<{ jobKey: string; authorId: string; note: string; timestamp: number }> }>("SJA:GET_TEAM_CONTEXT");
      if (ctx?.sharedNotes) {
        setNotes(ctx.sharedNotes.filter((n: any) => n.jobKey === jobKey));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [jobKey]);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setError("");
    try {
      await sendToBackgroundData("SJA:ADD_SHARED_NOTE", { jobKey, note: newNote });
      setNewNote("");
      fetchNotes();
    } catch (e: any) {
      setError(e.message || "Failed to add note. Ensure you are on Pro/Enterprise tier.");
    }
  };

  return (
    <div className="sja-card sja-team-card">
      <div className="sja-card-title" style={{ borderBottom: "1px solid var(--sja-border)", paddingBottom: "6px" }}>
        <span className="sja-card-icon">🤝</span> Team Workspace Notes
      </div>
      
      <div className="sja-notes-list" style={{ marginTop: "8px", maxHeight: "150px", overflowY: "auto" }}>
        {notes.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: "11px", fontStyle: "italic" }}>No notes for this job yet.</div>
        ) : (
          notes.map((n, i) => (
            <div key={i} style={{ background: "#f3f4f6", padding: "6px", borderRadius: "4px", marginBottom: "6px", fontSize: "11px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "2px", color: "#4b5563" }}>{n.authorId}</div>
              <div>{n.note}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: "8px" }}>
        <input 
          type="text" 
          placeholder="Type a note..." 
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #d1d5db", borderRadius: "4px" }}
        />
        {error && <div style={{ color: "#ef4444", fontSize: "10px", marginTop: "4px" }}>{error}</div>}
      </div>
    </div>
  );
};
