import fs from "node:fs";

function modernizeProfileTab() {
  const filePath = "packages/extension/src/popup/tabs/ProfileTab.tsx";
  let content = fs.readFileSync(filePath, "utf8");

  // Replace light mode card containers
  content = content.replaceAll(
    'className="bg-white rounded-xl border border-slate-200 p-3"',
    'style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px" }}'
  );
  content = content.replaceAll(
    'className="bg-white rounded-xl border border-slate-200 p-3 space-y-2"',
    'style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}'
  );
  content = content.replaceAll(
    'className="bg-white rounded-xl border border-slate-200 p-3 space-y-3"',
    'style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}'
  );

  // Replace subcard containers (bg-slate-50 border border-slate-200)
  content = content.replaceAll(
    'className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-2 space-y-2"',
    'style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px 12px", marginBottom: "8px", display: "flex", flexDirection: "column", gap: "8px" }}'
  );
  content = content.replaceAll(
    'className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 relative"',
    'style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px", position: "relative" }}'
  );
  content = content.replaceAll(
    'className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1.5"',
    'style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}'
  );

  // Replace light mode warning/alert banners
  content = content.replaceAll(
    'className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900"',
    'style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "12px", padding: "10px 12px", fontSize: "11px", color: "#FCD34D" }}'
  );
  content = content.replaceAll(
    'className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[10px] text-amber-800"',
    'style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "8px", padding: "8px 10px", fontSize: "10px", color: "#FCD34D" }}'
  );
  content = content.replaceAll(
    'className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-800"',
    'style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "12px", padding: "10px 12px", fontSize: "11px", color: "#34D399" }}'
  );
  content = content.replaceAll(
    'className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-[10px] text-indigo-900"',
    'style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "12px", padding: "10px 12px", fontSize: "10px", color: "#A5B4FC" }}'
  );

  // Replace stat pills in upload step
  content = content.replaceAll('className="bg-indigo-50 border border-indigo-100 rounded-lg p-1.5"', 'style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "8px", padding: "6px" }}');
  content = content.replaceAll('className="bg-sky-50 border border-sky-100 rounded-lg p-1.5"', 'style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: "8px", padding: "6px" }}');
  content = content.replaceAll('className="bg-emerald-50 border border-emerald-100 rounded-lg p-1.5"', 'style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "8px", padding: "6px" }}');
  content = content.replaceAll('className="bg-amber-50 border border-amber-100 rounded-lg p-1.5"', 'style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "8px", padding: "6px" }}');

  // Replace colors in stat pills
  content = content.replaceAll('className="text-sm font-bold text-indigo-700"', 'style={{ fontSize: "14px", fontWeight: 800, color: "#818CF8" }}');
  content = content.replaceAll('className="text-sm font-bold text-sky-700"', 'style={{ fontSize: "14px", fontWeight: 800, color: "#38BDF8" }}');
  content = content.replaceAll('className="text-sm font-bold text-emerald-700"', 'style={{ fontSize: "14px", fontWeight: 800, color: "#34D399" }}');
  content = content.replaceAll('className="text-sm font-bold text-amber-700"', 'style={{ fontSize: "14px", fontWeight: 800, color: "#FBBF24" }}');

  // Replace text-slate classes
  content = content.replaceAll('text-slate-500', 'text-[var(--text-muted)]');
  content = content.replaceAll('text-slate-400', 'text-[var(--text-faint)]');
  content = content.replaceAll('text-slate-600', 'text-[var(--text-secondary)]');
  content = content.replaceAll('text-slate-700', 'text-[var(--text-primary)]');
  content = content.replaceAll('text-slate-800', 'text-[var(--text-primary)]');
  content = content.replaceAll('border-slate-200', 'border-[rgba(255,255,255,0.08)]');
  content = content.replaceAll('border-slate-100', 'border-[rgba(255,255,255,0.06)]');
  content = content.replaceAll('bg-slate-100', 'bg-[rgba(255,255,255,0.06)]');

  // Replace reqField and bubbleField implementations with sleek dark styling
  const oldReqField = `  const reqField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    required = true,
    type = "text"
  ) => {
    const empty = !value?.trim();
    return (
      <label className="block">
        <span className={\`text-[10px] font-medium uppercase \${required && empty ? "text-rose-600" : "text-[var(--text-muted)]"}\`}>
          {label} {required && "*"}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={\`mt-0.5 w-full text-sm border rounded-md px-2 py-1.5 focus:outline-none \${
            required && empty ? "border-rose-300 bg-rose-50" : "border-[rgba(255,255,255,0.08)] focus:border-indigo-400"
          }\`}
        />
      </label>
    );
  };`;

  const newReqField = `  const reqField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    required = true,
    type = "text"
  ) => {
    const empty = !value?.trim();
    return (
      <label style={{ display: "block" }}>
        <span style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: required && empty ? "#FB7185" : "var(--text-muted)",
          display: "block",
          marginBottom: "3px",
        }}>
          {label} {required && <span style={{ color: "#FB7185" }}>*</span>}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(255,255,255,0.04)",
            border: required && empty ? "1px solid rgba(244,63,94,0.45)" : "1px solid rgba(255,255,255,0.10)",
            borderRadius: "8px",
            padding: "7px 10px",
            fontSize: "12px",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
      </label>
    );
  };`;

  if (content.includes('const empty = !value?.trim();')) {
    const startIdx = content.indexOf('  const reqField = (');
    const endMarker = '  const bubbleField = (';
    const endIdx = content.indexOf(endMarker);
    if (startIdx !== -1 && endIdx !== -1) {
      content = content.slice(0, startIdx) + newReqField + '\n\n' + content.slice(endIdx);
    }
  }

  // Update bubbleField
  const newBubbleField = `  const bubbleField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: string[]
  ) => {
    return (
      <div style={{ display: "block" }}>
        <span style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          display: "block",
          marginBottom: "3px",
        }}>
          {label}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: "8px",
            padding: "7px 10px",
            fontSize: "12px",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
          {options.map((opt) => {
            const isSelected = value.toLowerCase() === opt.toLowerCase();
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                style={{
                  fontSize: "9px",
                  padding: "2px 8px",
                  borderRadius: "99px",
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
                  border: isSelected ? "1px solid #6366F1" : "1px solid rgba(255,255,255,0.08)",
                  color: isSelected ? "#C7D2FE" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  };`;

  const bStart = content.indexOf('  const bubbleField = (');
  const bEnd = content.indexOf('  const goNext = () => {');
  if (bStart !== -1 && bEnd !== -1) {
    content = content.slice(0, bStart) + newBubbleField + '\n\n' + content.slice(bEnd);
  }

  // Update file drop area
  content = content.replace(
    'className="flex items-center justify-center w-full h-20 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 text-[11px] text-slate-500 transition-colors bg-slate-50/50"',
    'style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "72px", border: "2px dashed rgba(255,255,255,0.12)", borderRadius: "10px", cursor: "pointer", fontSize: "11px", color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", transition: "all 0.2s ease" }}'
  );

  // Update textareas & selects with bg-white
  content = content.replaceAll(
    'className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 h-14 bg-white"',
    'style={{ width: "100%", boxSizing: "border-box", fontSize: "12px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "7px 10px", height: "56px", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", outline: "none" }}'
  );
  content = content.replaceAll(
    'className="mt-0.5 w-full text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white"',
    'style={{ width: "100%", boxSizing: "border-box", marginTop: "2px", fontSize: "12px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "7px 10px", background: "#0d1322", color: "var(--text-primary)", outline: "none" }}'
  );
  content = content.replaceAll(
    'className="mt-0.5 w-full text-xs border border-slate-200 bg-white rounded-md px-2 py-1.5 h-16 focus:outline-none focus:border-indigo-400 text-slate-800"',
    'style={{ width: "100%", boxSizing: "border-box", marginTop: "2px", fontSize: "12px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "7px 10px", height: "64px", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", outline: "none" }}'
  );
  content = content.replaceAll(
    'className="flex-1 text-xs border border-slate-200 bg-white rounded-md px-2 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-400"',
    'style={{ flex: 1, fontSize: "12px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "7px 10px", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", outline: "none" }}'
  );
  content = content.replaceAll(
    'className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1"',
    'style={{ flex: 1, fontSize: "12px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "6px 8px", background: "#0d1322", color: "var(--text-primary)", outline: "none" }}'
  );

  // Skill tags container
  content = content.replaceAll(
    'className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2"',
    'style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "140px", overflowY: "auto", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "8px 10px" }}'
  );
  content = content.replaceAll(
    'className="inline-flex items-center gap-1 text-[10px] bg-white hover:bg-slate-100 text-indigo-700 px-2 py-0.5 rounded-full border border-slate-200 transition-colors"',
    'style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", background: "rgba(99,102,241,0.12)", color: "#C7D2FE", padding: "2px 8px", borderRadius: "99px", border: "1px solid rgba(99,102,241,0.30)" }}'
  );

  fs.writeFileSync(filePath, content, "utf8");
  console.log("ProfileTab modernized successfully!");
}

function modernizeSettingsTab() {
  const filePath = "packages/extension/src/popup/tabs/SettingsTab.tsx";
  let content = fs.readFileSync(filePath, "utf8");

  // Replace light mode card containers in SettingsTab
  content = content.replaceAll(
    'className="bg-white rounded-xl border border-slate-200 p-3"',
    'style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px" }}'
  );
  content = content.replaceAll(
    'className="bg-white rounded-xl border border-slate-200 p-3 space-y-2"',
    'style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}'
  );

  // Replace white inputs in SettingsTab
  content = content.replaceAll(
    'className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-800 bg-white"',
    'style={{ width: "100%", boxSizing: "border-box", fontSize: "12px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "6px 10px", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", outline: "none" }}'
  );
  content = content.replaceAll(
    'className="w-full text-xs border border-rose-200 rounded-lg px-2 py-1 text-slate-800 bg-white focus:border-rose-400"',
    'style={{ width: "100%", boxSizing: "border-box", fontSize: "12px", border: "1px solid rgba(244,63,94,0.40)", borderRadius: "8px", padding: "6px 10px", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", outline: "none" }}'
  );
  content = content.replaceAll(
    'className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1 text-center bg-white"',
    'style={{ width: "64px", boxSizing: "border-box", fontSize: "12px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "6px 8px", textAlign: "center", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", outline: "none" }}'
  );

  fs.writeFileSync(filePath, content, "utf8");
  console.log("SettingsTab modernized successfully!");
}

modernizeProfileTab();
modernizeSettingsTab();
