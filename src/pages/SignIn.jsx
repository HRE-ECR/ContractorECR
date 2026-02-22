import React from "react";
import { supabase } from "../supabaseClient";

const AREAS = [
  "Maint-1",
  "Maint-2",
  "Insp-shed",
  "Rep-Shed",
  "1-Clean",
  "2-Clean",
  "3-Clean",
  "4-Clean",
];

// Success Pop-up (blocks background scroll)
// Backdrop click is DISABLED (must press Acknowledge or Esc)
function SignInSuccessModal({ open, onAcknowledge }) {
  React.useEffect(() => {
    if (!open) return;

    // Block background scroll while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onAcknowledge();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onAcknowledge]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in registered"
      // NOTE: No backdrop click handler -> cannot close by clicking background
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.60)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(640px, 100%)",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.10)",
        }}
        // Defensive: stop any bubbling just in case you add handlers later
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 18px",
            background:
              "linear-gradient(135deg, rgba(16,185,129,0.20), rgba(34,197,94,0.10))",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: 22, lineHeight: 1.2 }}>✅</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
              Sign in registered
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
              please see a team leader before entering any operational areas.
              Obtain a fob for logging onto the depot protection system if
              required.
            </div>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          <div
            style={{
              marginTop: 6,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "rgba(17,24,39,0.82)",
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.18)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            ℹ️ Any questions or concerns please contact the on duty manager ℹ️
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={onAcknowledge}
              style={{
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontWeight: 900,
                cursor: "pointer",
                background: "#111827",
                color: "#fff",
                minWidth: 160,
              }}
            >
              Acknowledge
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.55 }}>
            Tip: Press <b>Esc</b> to close.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  const [form, setForm] = React.useState({
    first_name: "",
    surname: "",
    company: "",
    phone: "",
    areas: [],
  });

  // "Other" textbox behaviour:
  // - shows "Other" text in the box initially
  // - clears on focus
  // - restores on blur if left empty
  const [otherArea, setOtherArea] = React.useState("Other");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // success popup state
  const [successOpen, setSuccessOpen] = React.useState(false);

  function toggleArea(a) {
    setForm((f) => {
      const exists = f.areas.includes(a);
      return {
        ...f,
        areas: exists ? f.areas.filter((x) => x !== a) : [...f.areas, a],
      };
    });
  }

  function getOtherValue() {
    const v = (otherArea || "").trim();
    if (!v || v.toLowerCase() === "other") return "";
    return v;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const otherVal = getOtherValue();
    const pickedAreas = [...(form.areas || [])];

    if (otherVal) {
      const otherLabel = `Other: ${otherVal}`;
      if (!pickedAreas.includes(otherLabel)) pickedAreas.push(otherLabel);
    }

    if (
      !form.first_name.trim() ||
      !form.surname.trim() ||
      !form.company.trim() ||
      !form.phone.trim() ||
      pickedAreas.length === 0
    ) {
      setError(
        "All fields are mandatory and at least one Area of work must be selected (or enter an Other area)."
      );
      return;
    }

    setLoading(true);

    const { error: err } = await supabase.from("contractors").insert({
      first_name: form.first_name.trim(),
      surname: form.surname.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
      areas: pickedAreas,
      status: "pending",
    });

    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    // SUCCESS: reset form + show popup
    setForm({ first_name: "", surname: "", company: "", phone: "", areas: [] });
    setOtherArea("Other");
    setSuccessOpen(true);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h2 style={{ margin: "8px 0 14px", fontWeight: 900 }}>
        Contractor/Visitor sign-in
      </h2>

      <form
        onSubmit={handleSubmit}
        style={{
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 14,
          padding: 16,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800 }}>First name (unique identifier)</span>
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800 }}>Surname</span>
            <input
              value={form.surname}
              onChange={(e) => setForm({ ...form, surname: e.target.value })}
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800 }}>Company</span>
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 800 }}>Phone number (unique identifier)</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>
            Area of work (select one or more)
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            }}
          >
            {AREAS.map((a) => (
              <label
                key={a}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: form.areas.includes(a)
                    ? "rgba(59,130,246,0.10)"
                    : "#fff",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.areas.includes(a)}
                  onChange={() => toggleArea(a)}
                />
                <span style={{ fontWeight: 800 }}>{a}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 900 }}>Other (if not listed)</span>
              <input
                value={otherArea}
                onChange={(e) => setOtherArea(e.target.value)}
                onFocus={() => {
                  if ((otherArea || "").trim().toLowerCase() === "other") setOtherArea("");
                }}
                onBlur={() => {
                  if (!otherArea || otherArea.trim() === "") setOtherArea("Other");
                }}
                style={inputStyle}
              />
            </label>

            <div style={{ fontSize: 12, opacity: 0.72, marginTop: 6 }}>
              If used, it will be saved as <b>Other: your text</b>.
            </div>
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginTop: 12,
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.25)",
              padding: 12,
              borderRadius: 12,
              color: "#991b1b",
              fontWeight: 800,
            }}
          >
            ❌ {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 16px",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "rgba(17,24,39,0.55)" : "#111827",
              color: "#fff",
              minWidth: 140,
            }}
          >
            {loading ? "Submitting..." : "Sign-in"}
          </button>
        </div>
      </form>

      {/* Success popup */}
      <SignInSuccessModal
        open={successOpen}
        onAcknowledge={() => setSuccessOpen(false)}
      />
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  outline: "none",
  fontSize: 14,
};
