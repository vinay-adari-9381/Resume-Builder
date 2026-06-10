import { useState, useRef, useCallback, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// ─── Color tokens ────────────────────────────────────────────────
const T = {
  bg: "#0F0F11",
  surface: "#18181C",
  card: "#1E1E24",
  border: "#2A2A35",
  borderHover: "#3D3D50",
  accent: "#7C6EF5",
  accentHover: "#9589F7",
  accentDim: "#2A2540",
  text: "#F0EFF8",
  muted: "#8A89A0",
  faint: "#3A3A48",
  green: "#4ADE80",
  greenDim: "#1A3D2B",
  amber: "#FBB040",
  amberDim: "#3D2C0A",
  red: "#F87171",
  redDim: "#3D1A1A",
  teal: "#2DD4BF",
};

const TEMPLATES = {
  modern: { label: "Modern", accent: "#7C6EF5" },
  clean:  { label: "Clean",  accent: "#2DD4BF" },
  bold:   { label: "Bold",   accent: "#F87171" },
};

const initData = () => ({
  name: "", title: "", email: "", phone: "", location: "",
  linkedin: "", github: "", website: "",
  summary: "",
  experience:     [{ id: 1, company: "", role: "", duration: "", bullets: "" }],
  education:      [{ id: 1, school: "", degree: "", year: "", gpa: "" }],
  skills: "",
  projects:       [{ id: 1, name: "", tech: "", description: "" }],
  certifications: "",
});

// ─── AI call via proxy server ─────────────────────────────────────
async function callClaude(messages, system = "") {
  const res = await fetch("http://localhost:5000/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system || "You are an expert resume coach. Be concise and specific." },
        ...messages
      ],
      max_tokens: 1000,
    }),
  });
  const data = await res.json();
  console.log("AI response:", data);
  return data.choices?.[0]?.message?.content || "";
}

function scoreATS(data) {
  let score = 0;
  const issues = [];
  const passes = [];

  if (data.name?.trim())          { score += 10; passes.push("Full name present"); }
  else issues.push("Add your full name");
  if (data.email?.includes("@"))  { score += 8;  passes.push("Email present"); }
  else issues.push("Add a professional email");
  if (data.phone?.trim())         { score += 7;  passes.push("Phone number present"); }
  else issues.push("Add phone number");
  if (data.summary?.length > 60)  { score += 15; passes.push("Summary section present"); }
  else issues.push("Write a summary (60+ chars)");
  if (data.experience?.some(e => e.bullets?.trim())) { score += 20; passes.push("Work experience with bullets"); }
  else issues.push("Add bullet points to experience");
  if (data.skills?.trim())        { score += 15; passes.push("Skills section present"); }
  else issues.push("Add skills");
  if (data.education?.some(e => e.school?.trim())) { score += 10; passes.push("Education present"); }
  else issues.push("Add education");
  if (data.linkedin?.trim())      { score += 5;  passes.push("LinkedIn URL"); }
  else issues.push("Add LinkedIn URL");

  const hasBullets = data.experience?.some(
    e => e.bullets?.includes("\n") || e.bullets?.split(/[.!?]/).length > 2
  );
  if (hasBullets) { score += 10; passes.push("Multiple bullet points per role"); }

  const allText = JSON.stringify(data).toLowerCase();
  const powerWords = ["led","built","increased","reduced","managed","designed",
                      "implemented","delivered","achieved","improved"];
  const found = powerWords.filter(w => allText.includes(w));
  if (found.length >= 3) { score += 10; passes.push(`Strong action verbs (${found.slice(0,3).join(", ")}…)`); }
  else issues.push("Add action verbs: led, built, improved…");

  return { score: Math.min(score, 100), issues, passes };
}

function ResumePreview({ data, template }) {
  const acc = TEMPLATES[template].accent;
  const s = {
    page:        { background: "#fff", color: "#111", width: "100%", minHeight: 700, padding: "36px 40px", fontFamily: "'Outfit', sans-serif", fontSize: 13, lineHeight: 1.5 },
    name:        { fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#0A0A0F", marginBottom: 2 },
    title:       { fontSize: 13, color: "#555", marginBottom: 12, fontWeight: 500 },
    contact:     { display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: "#666", marginBottom: 20, borderBottom: `2px solid ${acc}`, paddingBottom: 14 },
    sectionHead: { fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: acc, marginBottom: 8, marginTop: 18 },
    rule:        { border: "none", borderTop: "1px solid #eee", marginTop: 4, marginBottom: 10 },
    expRow:      { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 },
    company:     { fontWeight: 600, fontSize: 13, color: "#111" },
    role:        { fontSize: 12, color: "#444", marginBottom: 4 },
    duration:    { fontSize: 11, color: "#888" },
    bullet:      { fontSize: 12, color: "#333", paddingLeft: 14, position: "relative", marginBottom: 2 },
    summary:     { fontSize: 12.5, color: "#333", lineHeight: 1.7 },
    skill:       { display: "inline-block", background: `${acc}18`, color: acc, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, marginRight: 6, marginBottom: 5 },
  };

  const parseBullets = (raw = "") => raw.split(/\n|•/).map(l => l.trim()).filter(Boolean);
  const Bullet = ({ text }) => text ? (
    <div style={s.bullet}>
      <span style={{ position: "absolute", left: 0, color: acc }}>•</span>
      {text.trim()}
    </div>
  ) : null;

  return (
    <div style={s.page} className="print-area">
      <div style={s.name}>{data.name || "Your Name"}</div>
      {data.title && <div style={s.title}>{data.title}</div>}
      <div style={s.contact}>
        {data.email    && <span>✉ {data.email}</span>}
        {data.phone    && <span>📞 {data.phone}</span>}
        {data.location && <span>📍 {data.location}</span>}
        {data.linkedin && <span>in/{data.linkedin.replace(/.*linkedin\.com\/in\//, "")}</span>}
        {data.github   && <span>github/{data.github.replace(/.*github\.com\//, "")}</span>}
        {data.website  && <span>🌐 {data.website}</span>}
      </div>

      {data.summary && <><div style={s.sectionHead}>Summary</div><hr style={s.rule} /><div style={s.summary}>{data.summary}</div></>}

      {data.experience?.some(e => e.company || e.role) && <>
        <div style={s.sectionHead}>Experience</div><hr style={s.rule} />
        {data.experience.map(exp => (exp.company || exp.role) ? (
          <div key={exp.id} style={{ marginBottom: 12 }}>
            <div style={s.expRow}>
              <div style={s.company}>{exp.company}</div>
              <div style={s.duration}>{exp.duration}</div>
            </div>
            <div style={s.role}>{exp.role}</div>
            {parseBullets(exp.bullets).map((b, i) => <Bullet key={i} text={b} />)}
          </div>
        ) : null)}
      </>}

      {data.projects?.some(p => p.name) && <>
        <div style={s.sectionHead}>Projects</div><hr style={s.rule} />
        {data.projects.map(p => p.name ? (
          <div key={p.id} style={{ marginBottom: 10 }}>
            <div style={s.expRow}>
              <span style={{ ...s.company, fontSize: 12 }}>{p.name}</span>
              {p.tech && <span style={{ fontSize: 10, color: acc, fontWeight: 600 }}>{p.tech}</span>}
            </div>
            {p.description && <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>{p.description}</div>}
          </div>
        ) : null)}
      </>}

      {data.skills && <>
        <div style={s.sectionHead}>Skills</div><hr style={s.rule} />
        <div>{data.skills.split(",").map((sk, i) => sk.trim() ? <span key={i} style={s.skill}>{sk.trim()}</span> : null)}</div>
      </>}

      {data.education?.some(e => e.school) && <>
        <div style={s.sectionHead}>Education</div><hr style={s.rule} />
        {data.education.map(ed => ed.school ? (
          <div key={ed.id} style={{ marginBottom: 8 }}>
            <div style={s.expRow}>
              <span style={s.company}>{ed.school}</span>
              <span style={s.duration}>{ed.year}</span>
            </div>
            <div style={s.role}>{ed.degree}{ed.gpa ? ` · GPA ${ed.gpa}` : ""}</div>
          </div>
        ) : null)}
      </>}

      {data.certifications && <>
        <div style={s.sectionHead}>Certifications</div><hr style={s.rule} />
        {data.certifications.split(",").map((c, i) => c.trim() ? (
          <div key={i} style={{ fontSize: 12, color: "#333", marginBottom: 3 }}>• {c.trim()}</div>
        ) : null)}
      </>}
    </div>
  );
}

function ATSPanel({ data }) {
  const { score, issues, passes } = scoreATS(data);
  const color    = score >= 75 ? T.green : score >= 50 ? T.amber : T.red;
  const colorDim = score >= 75 ? T.greenDim : score >= 50 ? T.amberDim : T.redDim;
  return (
    <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>ATS Score</span>
        <div style={{ background: colorDim, padding: "4px 14px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color, fontWeight: 700, fontSize: 20, fontFamily: "'DM Mono', monospace" }}>{score}</span>
          <span style={{ color, fontSize: 12 }}>/100</span>
        </div>
      </div>
      <div style={{ height: 6, background: T.faint, borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
      {passes.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: T.green, flexShrink: 0 }}>✓</span>
          <span style={{ color: T.muted }}>{p}</span>
        </div>
      ))}
      {issues.map((issue, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: T.red, flexShrink: 0 }}>✗</span>
          <span style={{ color: T.muted }}>{issue}</span>
        </div>
      ))}
    </div>
  );
}

function AIPanel({ data }) {
  const [loading, setLoading] = useState(false);
  const [type,    setType]    = useState("summary");
  const [result,  setResult]  = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [error,   setError]   = useState("");

  const generate = async () => {
    setLoading(true);
    setResult("");
    setError("");
    try {
      const ctx = `Name: ${data.name}, Title: ${data.title}, Skills: ${data.skills}, Experience: ${data.experience?.map(e => `${e.role} at ${e.company}`).join("; ")}`;
      let prompt = "";
      if (type === "summary")
        prompt = `Write a 3-sentence professional summary for: ${ctx}. Be specific, punchy, ATS-friendly. No generic fluff.`;
      else if (type === "bullets")
        prompt = `Improve these experience bullets for ${data.experience?.[0]?.role} at ${data.experience?.[0]?.company}:\n${data.experience?.[0]?.bullets}\nRewrite as 3-4 strong action-verb bullets with measurable impact. Start each with a different verb.`;
      else if (type === "tailor")
        prompt = `Given this job description:\n${jobDesc}\n\nAnd this candidate: ${ctx}\n\nSuggest 5 specific resume customizations to improve ATS match. Be concrete.`;
      else if (type === "skills")
        prompt = `For a ${data.title} with experience in ${data.experience?.map(e => e.role).join(", ")}, suggest 15 in-demand skills for their resume. Format as comma-separated.`;

      const text = await callClaude([{ role: "user", content: prompt }]);
      if (text) setResult(text);
      else setError("No response received. Make sure server.js is running on port 5000.");
    } catch (e) {
      console.error(e);
      setError("❌ Cannot connect to server. Run 'node server.js' in a separate terminal.");
    }
    setLoading(false);
  };

  return (
    <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>✦</span> AI Suggestions
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {[["summary","Summary"],["bullets","Bullets"],["skills","Skills"],["tailor","Tailor"]].map(([v, l]) => (
          <button key={v} className="btn btn-ghost btn-sm" onClick={() => setType(v)}
            style={{ borderColor: type === v ? T.accent : T.border, color: type === v ? T.accent : T.muted, background: type === v ? T.accentDim : "transparent" }}>
            {l}
          </button>
        ))}
      </div>

      {type === "tailor" && (
        <div style={{ marginBottom: 10 }}>
          <label>Job Description</label>
          <textarea placeholder="Paste job description here…" value={jobDesc}
            onChange={e => setJobDesc(e.target.value)} style={{ minHeight: 80, fontSize: 12 }} />
        </div>
      )}

      <button className="btn btn-primary" onClick={generate} disabled={loading}
        style={{ width: "100%", marginBottom: 14 }}>
        {loading ? <><span className="spinner" style={{ marginRight: 8 }} />Generating…</> : "Generate with AI →"}
      </button>

      {error && (
        <div style={{ background: T.redDim, border: `1px solid ${T.red}`, borderRadius: 8, padding: 12, fontSize: 12.5, color: T.red, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {result && (
        <div className="animate-in" style={{ background: T.surface, borderRadius: 8, padding: 14, fontSize: 12.5, lineHeight: 1.7, color: T.text, whiteSpace: "pre-wrap", border: `1px solid ${T.border}` }}>
          {result}
        </div>
      )}
    </div>
  );
}

const Field = ({ label, value, onChange, placeholder, type = "text" }) => (
  <div style={{ marginBottom: 12 }}>
    <label>{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

const TextArea = ({ label, value, onChange, placeholder, rows = 3 }) => (
  <div style={{ marginBottom: 12 }}>
    <label>{label}</label>
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ minHeight: rows * 28 }} />
  </div>
);

const SectionHead = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.accent, marginBottom: 12, marginTop: 24, paddingBottom: 8, borderBottom: `1px solid ${T.faint}` }}>
    {children}
  </div>
);

export default function ResumeBuilder() {
  const [data,        setData]        = useState(initData());
  const [template,    setTemplate]    = useState("modern");
  const [tab,         setTab]         = useState("form");
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    const css = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: ${T.bg}; color: ${T.text}; font-family: 'Outfit', sans-serif; }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${T.faint}; border-radius: 3px; }
      .serif { font-family: 'DM Serif Display', serif; }
      .mono  { font-family: 'DM Mono', monospace; }
      input, textarea, select {
        background: ${T.surface}; border: 1px solid ${T.border};
        color: ${T.text}; border-radius: 8px; padding: 8px 12px;
        font-family: 'Outfit', sans-serif; font-size: 14px; width: 100%;
        outline: none; transition: border-color 0.15s;
      }
      input:focus, textarea:focus, select:focus { border-color: ${T.accent}; }
      textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
      label { font-size: 12px; font-weight: 500; color: ${T.muted}; letter-spacing: 0.06em; text-transform: uppercase; display: block; margin-bottom: 5px; }
      .btn { border-radius: 8px; padding: 9px 18px; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all 0.15s; }
      .btn-primary { background: ${T.accent}; color: #fff; }
      .btn-primary:hover { background: ${T.accentHover}; }
      .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
      .btn-ghost { background: transparent; border: 1px solid ${T.border}; color: ${T.muted}; }
      .btn-ghost:hover { border-color: ${T.borderHover}; color: ${T.text}; }
      .btn-sm { padding: 6px 12px; font-size: 12px; }
      @media print { .no-print { display: none !important; } .print-area { box-shadow: none !important; } }
      @keyframes spin   { to { transform: rotate(360deg); } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .animate-in { animation: fadeIn 0.3s ease forwards; }
      .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    `;
    const el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  const set        = key => val => setData(d => ({ ...d, [key]: val }));
  const updateExp  = (id, key, val) => setData(d => ({ ...d, experience: d.experience.map(e => e.id === id ? { ...e, [key]: val } : e) }));
  const addExp     = () => setData(d => ({ ...d, experience: [...d.experience, { id: Date.now(), company: "", role: "", duration: "", bullets: "" }] }));
  const removeExp  = id => setData(d => ({ ...d, experience: d.experience.filter(e => e.id !== id) }));
  const updateEdu  = (id, key, val) => setData(d => ({ ...d, education: d.education.map(e => e.id === id ? { ...e, [key]: val } : e) }));
  const addEdu     = () => setData(d => ({ ...d, education: [...d.education, { id: Date.now(), school: "", degree: "", year: "", gpa: "" }] }));
  const updateProj = (id, key, val) => setData(d => ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, [key]: val } : p) }));
  const addProj    = () => setData(d => ({ ...d, projects: [...d.projects, { id: Date.now(), name: "", tech: "", description: "" }] }));

  // ✅ FIXED: static imports at top of file + setTimeout for DOM settle + finally block
 const downloadPDF = useCallback(() => {
  setDownloading(true);

  setTimeout(async () => {
    try {

      // Check resume exists
      if (!previewRef.current) {
        throw new Error("previewRef.current is null");
      }

      console.log("Preview:", previewRef.current);

      const canvas = await html2canvas(
        previewRef.current,
        {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        }
      );

      const imgData =
        canvas.toDataURL("image/png");

      const pdf =
        new jsPDF(
          "p",
          "mm",
          "a4"
        );

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        (canvas.height * pageWidth) /
        canvas.width;

      pdf.addImage(
        imgData,
        "PNG",
        0,
        0,
        pageWidth,
        pageHeight
      );

      pdf.save(
        `${data.name || "resume"}.pdf`
      );

    } catch (e) {
      console.error("PDF ERROR:", e);

      alert(
        `PDF export failed:\n${e.message}`
      );

    } finally {
      setDownloading(false);
    }
  }, 300);

}, [data.name]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="no-print" style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: T.accentDim, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
          <span className="serif" style={{ fontSize: 18, letterSpacing: "-0.02em" }}>ResumeAI</span>
          <span style={{ background: T.accentDim, color: T.accent, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>BETA</span>
        </div>
        <div style={{ display: "flex", gap: 4, background: T.bg, borderRadius: 10, padding: 4 }}>
          {[["form","✏ Edit"],["preview","👁 Preview"],["ats","⚡ ATS"],["ai","✦ AI"]].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className="btn"
              style={{ padding: "7px 14px", fontSize: 13, background: tab === v ? T.card : "transparent", color: tab === v ? T.text : T.muted, borderRadius: 8 }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={template} onChange={e => setTemplate(e.target.value)}
            style={{ width: "auto", padding: "7px 12px", fontSize: 13, background: T.surface, border: `1px solid ${T.border}` }}>
            {Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label} Template</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={downloadPDF} disabled={downloading}>
            {downloading ? <><span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />…</> : "⬇ PDF"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: "20px 24px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>

        {tab === "form" && (
          <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ background: T.surface, borderRadius: 14, padding: 24, border: `1px solid ${T.border}`, overflowY: "auto", maxHeight: "calc(100vh - 140px)" }}>
              <SectionHead>Personal Info</SectionHead>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Field label="Full Name"  value={data.name}     onChange={set("name")}     placeholder="Alex Johnson" />
                <Field label="Job Title"  value={data.title}    onChange={set("title")}    placeholder="Senior Software Engineer" />
                <Field label="Email"      value={data.email}    onChange={set("email")}    placeholder="alex@example.com" type="email" />
                <Field label="Phone"      value={data.phone}    onChange={set("phone")}    placeholder="+91 98765 43210" />
                <Field label="Location"   value={data.location} onChange={set("location")} placeholder="Hyderabad, India" />
                <Field label="LinkedIn"   value={data.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/yourname" />
                <Field label="GitHub"     value={data.github}   onChange={set("github")}   placeholder="github.com/yourname" />
                <Field label="Website"    value={data.website}  onChange={set("website")}  placeholder="yourportfolio.dev" />
              </div>

              <SectionHead>Summary</SectionHead>
              <TextArea label="Professional Summary" value={data.summary} onChange={set("summary")}
                placeholder="Results-driven engineer with 5+ years building scalable systems…" rows={4} />

              <SectionHead>Experience</SectionHead>
              {data.experience.map((exp, i) => (
                <div key={exp.id} style={{ background: T.card, borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.accent }}>Position {i + 1}</span>
                    {data.experience.length > 1 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => removeExp(exp.id)} style={{ padding: "2px 8px", fontSize: 11 }}>Remove</button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                    <Field label="Company"  value={exp.company}  onChange={v => updateExp(exp.id, "company",  v)} placeholder="Acme Corp" />
                    <Field label="Role"     value={exp.role}     onChange={v => updateExp(exp.id, "role",     v)} placeholder="Software Engineer" />
                    <Field label="Duration" value={exp.duration} onChange={v => updateExp(exp.id, "duration", v)} placeholder="Jan 2022 – Present" />
                  </div>
                  <TextArea label="Bullets (one per line or •)" value={exp.bullets} onChange={v => updateExp(exp.id, "bullets", v)}
                    placeholder={"Led migration to microservices, reducing latency by 40%\nBuilt CI/CD pipeline saving 8 hrs/week"} rows={4} />
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={addExp} style={{ width: "100%", marginBottom: 4 }}>+ Add Position</button>

              <SectionHead>Projects</SectionHead>
              {data.projects.map(p => (
                <div key={p.id} style={{ background: T.card, borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${T.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                    <Field label="Project Name" value={p.name} onChange={v => updateProj(p.id, "name", v)} placeholder="Portfolio Dashboard" />
                    <Field label="Tech Stack"   value={p.tech} onChange={v => updateProj(p.id, "tech", v)} placeholder="React, Node, PostgreSQL" />
                  </div>
                  <TextArea label="Description" value={p.description} onChange={v => updateProj(p.id, "description", v)}
                    placeholder="Built a real-time analytics dashboard serving 10k+ users…" rows={2} />
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={addProj} style={{ width: "100%", marginBottom: 4 }}>+ Add Project</button>

              <SectionHead>Education</SectionHead>
              {data.education.map(ed => (
                <div key={ed.id} style={{ background: T.card, borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${T.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                    <Field label="School"         value={ed.school} onChange={v => updateEdu(ed.id, "school", v)} placeholder="JNTU Hyderabad" />
                    <Field label="Degree"         value={ed.degree} onChange={v => updateEdu(ed.id, "degree", v)} placeholder="B.Tech Computer Science" />
                    <Field label="Year"           value={ed.year}   onChange={v => updateEdu(ed.id, "year",   v)} placeholder="2023" />
                    <Field label="GPA (optional)" value={ed.gpa}    onChange={v => updateEdu(ed.id, "gpa",    v)} placeholder="8.5" />
                  </div>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={addEdu} style={{ width: "100%", marginBottom: 4 }}>+ Add Education</button>

              <SectionHead>Skills & Certs</SectionHead>
              <TextArea label="Skills (comma-separated)" value={data.skills} onChange={set("skills")}
                placeholder="React, Node.js, Python, AWS, Docker, PostgreSQL, GraphQL" rows={2} />
              <TextArea label="Certifications (comma-separated)" value={data.certifications} onChange={set("certifications")}
                placeholder="AWS Certified, Google Cloud Professional" rows={2} />
            </div>

            <div style={{ position: "sticky", top: 20, maxHeight: "calc(100vh - 130px)", overflowY: "auto" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Live Preview</div>
              <div ref={previewRef} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 0 0 1px rgba(255,255,255,0.08)" }}>
                <ResumePreview data={data} template={template} />
              </div>
            </div>
          </div>
        )}

        {tab === "preview" && (
          <div className="animate-in" style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: T.muted }}>A4 Preview</span>
              <div style={{ display: "flex", gap: 8 }}>
                {Object.entries(TEMPLATES).map(([k, v]) => (
                  <button key={k} className="btn btn-ghost btn-sm" onClick={() => setTemplate(k)}
                    style={{ borderColor: template === k ? T.accent : T.border, color: template === k ? T.accent : T.muted }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div
  ref={previewRef}
  style={{
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
    overflow: "hidden"
  }}
>
  <ResumePreview
    data={data}
    template={template}
  />
</div>  
          </div>
        )}

        {tab === "ats" && (
          <div className="animate-in" style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{ marginBottom: 20 }}>
              <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>ATS Checker</div>
              <div style={{ fontSize: 13, color: T.muted }}>Applicant Tracking Systems scan resumes before humans do. Score 75+ to pass most filters.</div>
            </div>
            <ATSPanel data={data} />
            <div style={{ marginTop: 20, background: T.surface, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>ATS Tips</div>
              {[
                ["Use standard section headings", "ATS parsers expect: Experience, Education, Skills, Summary"],
                ["Avoid tables & columns",         "Single-column layout is more reliably parsed"],
                ["Include keywords from job post",  "Mirror exact phrases from the job description"],
                ["Use .docx or clean PDF",          "Avoid images, headers/footers, or complex formatting"],
                ["Quantify achievements",           "Numbers (%, $, users) make bullets stand out"],
              ].map(([title, desc], i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: i < 4 ? `1px solid ${T.faint}` : "none" }}>
                  <div style={{ width: 28, height: 28, background: T.accentDim, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: T.accent, flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{title}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "ai" && (
          <div className="animate-in" style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{ marginBottom: 20 }}>
              <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>AI Writing Assistant</div>
              <div style={{ fontSize: 13, color: T.muted }}>Generate professional summaries, improve bullets, or tailor your resume to a job description.</div>
            </div>
            <AIPanel data={data} />
            <div style={{ marginTop: 16, background: T.surface, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>How to use AI suggestions</div>
              <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
                1. Fill in your experience and title in the Edit tab first.<br />
                2. Use <strong style={{ color: T.text }}>Summary</strong> to generate a professional 3-sentence intro.<br />
                3. Use <strong style={{ color: T.text }}>Bullets</strong> to rewrite your first job's bullet points with stronger verbs.<br />
                4. Use <strong style={{ color: T.text }}>Skills</strong> to discover in-demand skills for your role.<br />
                5. Paste a job description into <strong style={{ color: T.text }}>Tailor</strong> for ATS keyword suggestions.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
