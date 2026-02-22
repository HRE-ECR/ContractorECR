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

// Modal:
// - Blocks background scroll
// - Cannot be closed by clicking backdrop
// - Can be closed by Acknowledge button or ESC
function SignInSuccessModal({ open, onAcknowledge }) {
  React.useEffect(() => {
    if (!open) return;

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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(620px, 100%)",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          padding: 18,
        }}
        // Prevent any bubbling / accidental backdrop close now or later
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>
          ✅ Sign in registered
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          Please see a team leader before entering any operational areas. Please obtain a
          fob for logging onto the depot protection system (if required).
        </div>

        <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>
          ℹ️ Any questions or concerns please contact the on duty manager ℹ️
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" onClick={onAcknowledge}>
            Acknowledge
          </button>
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
  const [message, setMessage] = React.useState(""); // keep original behaviour
  const [error, setError] = React.useState("");

  // NEW: modal open state
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
    setMessage("");

    const otherVal = getOtherValue();
    const pickedAreas = [...(form.areas || [])];

    if (otherVal) {
      const otherLabel = `Other: ${otherVal}`;
      if (!pickedAreas.includes(otherLabel)) pickedAreas.push(otherLabel);
    }

    if (
      !form.first_name ||
      !form.surname ||
      !form.company ||
      !form.phone ||
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
    } else {
      // Keep original reset behaviour
      setForm({ first_name: "", surname: "", company: "", phone: "", areas: [] });
      setOtherArea("Other");

      // NEW: show modal on success (instead of changing page styling)
      setSuccessOpen(true);

      // Optional: keep original message state cleared (or you can remove message block below)
      setMessage("");
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <h2>Contractor/Visitor sign-in</h2>

        <label>
          First name (unique identifier)
          <input
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            required
          />
        </label>

        <label>
          Surname
          <input
            value={form.surname}
            onChange={(e) => setForm({ ...form, surname: e.target.value })}
            required
          />
        </label>

        <label>
          Company
          <input
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            required
          />
        </label>

        <label>
          Phone number (unique identifier)
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </label>

        <div>
          <div>Area of work (select one or more)</div>

          {AREAS.map((a) => (
            <label key={a}>
              <input
                type="checkbox"
                checked={form.areas.includes(a)}
                onChange={() => toggleArea(a)}
              />
              {a}
            </label>
          ))}
        </div>

        <label>
          Other (if not listed)
          <input
            value={otherArea}
            onChange={(e) => setOtherArea(e.target.value)}
            onFocus={() => {
              if ((otherArea || "").trim().toLowerCase() === "other") setOtherArea("");
            }}
            onBlur={() => {
              if (!otherArea || otherArea.trim() === "") setOtherArea("Other");
            }}
          />
        </label>

        <div>If used, it will be saved as Other: your text.</div>

        {error && <p style={{ color: "crimson" }}>{error}</p>}
        {message && <p>{message}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Sign-in"}
        </button>
      </form>

      <SignInSuccessModal
        open={successOpen}
        onAcknowledge={() => setSuccessOpen(false)}
      />
    </>
  );
}
