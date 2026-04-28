import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type ScreenShot = {
  src: string;
  title: string;
  detail: string;
};

const screenshots: ScreenShot[] = [
  {
    src: "product-media/screenshots/02-home-dashboard.png",
    title: "Mobile-first dashboard",
    detail: "The product opens directly into the working screening app.",
  },
  {
    src: "product-media/screenshots/04-risk-measurements-step.png",
    title: "Guided risk check",
    detail: "One calm task at a time for field workers and families.",
  },
  {
    src: "product-media/screenshots/07-results-summary.png",
    title: "Code-based results",
    detail: "BMI, waist, diabetes score, BP and labs stay deterministic.",
  },
  {
    src: "product-media/screenshots/10-lab-ocr-after-upload.png",
    title: "AI lab OCR",
    detail: "Visible values can be extracted, then manually verified.",
  },
  {
    src: "product-media/screenshots/11-camera-assist.png",
    title: "Camera Health Assist",
    detail: "Safe visual guidance, never image-based diagnosis.",
  },
];

const featureCards = [
  "Obesity risk",
  "Diabetes score",
  "BP flag",
  "Lab OCR",
  "Referral note",
  "Offline shell",
];

const riskCards = [
  ["BMI", "Asian/Indian public-health cutoffs"],
  ["Waist", "Male >90 cm, Female >80 cm risk flag"],
  ["IDRS-style score", "Age, waist, activity, family history"],
  ["BP", "Urgent warning for very high readings"],
];

const aiCards = [
  ["AI reads", "Lab report image OCR"],
  ["AI explains", "Simple English/Hindi summaries"],
  ["AI formats", "Doctor-ready referral notes"],
];

function clampProgress(frame: number, start: number, duration: number) {
  return Math.max(0, Math.min(1, (frame - start) / duration));
}

function fade(frame: number, start: number, end: number) {
  return interpolate(frame, [start, start + 24, end - 24, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function rise(frame: number, start: number) {
  return interpolate(frame, [start, start + 36], [42, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

function Background() {
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 12% 18%, rgba(45,212,191,0.34), transparent 30%), radial-gradient(circle at 85% 8%, rgba(56,189,248,0.28), transparent 32%), linear-gradient(135deg, #ecfeff 0%, #f8fafc 47%, #dbeafe 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          borderRadius: "50%",
          left: -260,
          bottom: -300,
          background: "rgba(15,118,110,0.16)",
          filter: "blur(18px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          right: -120,
          top: 160,
          border: "2px solid rgba(15,118,110,0.16)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 980,
          height: 980,
          borderRadius: "50%",
          right: -320,
          bottom: -520,
          background: "rgba(2,132,199,0.18)",
          filter: "blur(22px)",
        }}
      />
    </AbsoluteFill>
  );
}

function Wordmark() {
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 72,
        display: "flex",
        alignItems: "center",
        gap: 18,
        color: "#042f2e",
        zIndex: 20,
      }}
    >
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          background: "linear-gradient(135deg, #0f766e, #0369a1)",
          boxShadow: "0 18px 40px rgba(15,118,110,0.28)",
        }}
      />
      <div>
        <div
          style={{
            fontSize: 32,
            letterSpacing: 8,
            fontWeight: 900,
            textTransform: "uppercase",
          }}
        >
          SwasthyaScore AI
        </div>
        <div style={{ marginTop: 6, color: "#475569", fontSize: 20, fontWeight: 700 }}>
          Screening only. Not a medical diagnosis.
        </div>
      </div>
    </div>
  );
}

function PhoneMockup({
  screen,
  frameOffset = 0,
  scale = 1,
}: {
  screen: ScreenShot;
  frameOffset?: number;
  scale?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame: frame - frameOffset, fps, config: { damping: 18 } });

  return (
    <div
      style={{
        width: 404 * scale,
        height: 808 * scale,
        borderRadius: 62 * scale,
        padding: 16 * scale,
        background: "linear-gradient(160deg, #0f172a, #164e63)",
        boxShadow: "0 36px 90px rgba(15,23,42,0.34)",
        transform: `translateY(${(1 - entrance) * 70}px) rotate(${interpolate(
          entrance,
          [0, 1],
          [-4, 0],
        )}deg)`,
        opacity: entrance,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 46 * scale,
          overflow: "hidden",
          background: "#e2e8f0",
          border: `${2 * scale}px solid rgba(255,255,255,0.18)`,
        }}
      >
        <Img
          src={staticFile(screen.src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 42 * scale,
            right: 42 * scale,
            bottom: 28 * scale,
            borderRadius: 24 * scale,
            padding: `${16 * scale}px ${18 * scale}px`,
            background: "rgba(4,47,46,0.88)",
            color: "white",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ fontSize: 22 * scale, fontWeight: 900 }}>{screen.title}</div>
          <div style={{ marginTop: 6 * scale, fontSize: 14 * scale, lineHeight: 1.35 }}>
            {screen.detail}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ children, delay = 0 }: { children: string; delay?: number }) {
  const frame = useCurrentFrame();
  const progress = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 16, mass: 0.8 },
  });

  return (
    <div
      style={{
        padding: "18px 24px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.82)",
        color: "#0f766e",
        fontWeight: 900,
        fontSize: 24,
        boxShadow: "0 16px 42px rgba(15,23,42,0.08)",
        transform: `translateY(${(1 - progress) * 34}px)`,
        opacity: progress,
      }}
    >
      {children}
    </div>
  );
}

function HeroScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 220);
  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 205,
          width: 820,
          transform: `translateY(${rise(frame, 12)}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "12px 20px",
            borderRadius: 999,
            background: "rgba(15,118,110,0.1)",
            color: "#0f766e",
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Built for Bharat
        </div>
        <h1
          style={{
            margin: "34px 0 0",
            fontSize: 88,
            lineHeight: 0.96,
            letterSpacing: -4,
            color: "#082f49",
          }}
        >
          60-second NCD screening in a mobile PWA
        </h1>
        <p
          style={{
            marginTop: 32,
            width: 720,
            fontSize: 32,
            lineHeight: 1.35,
            color: "#475569",
            fontWeight: 700,
          }}
        >
          Obesity, diabetes, blood pressure and lab-risk guidance for field workers,
          clinics, NGOs and families.
        </p>
        <div style={{ marginTop: 42, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {featureCards.map((feature, index) => (
            <Pill key={feature} delay={36 + index * 7}>
              {feature}
            </Pill>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", right: 190, top: 150 }}>
        <PhoneMockup screen={screenshots[0]} frameOffset={28} />
      </div>
    </AbsoluteFill>
  );
}

function FlowScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 190, 430);
  const local = frame - 190;
  const activeIndex = Math.min(2, Math.floor(Math.max(0, local) / 70));

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: 120, top: 185 }}>
        <PhoneMockup screen={screenshots[1 + activeIndex]} frameOffset={210} scale={0.93} />
      </div>
      <div style={{ position: "absolute", right: 110, top: 220, width: 870 }}>
        <h2
          style={{
            fontSize: 74,
            lineHeight: 1.02,
            letterSpacing: -3,
            color: "#042f2e",
            margin: 0,
            transform: `translateY(${rise(frame, 205)}px)`,
          }}
        >
          A calm guided flow, not a long medical form
        </h2>
        <div style={{ marginTop: 54, display: "grid", gap: 22 }}>
          {[
            ["1", "Basic details", "Age, gender and optional name."],
            ["2", "Measurements", "Manual height, weight and waist stay the source of truth."],
            ["3", "Risk factors", "Activity, family history, symptoms and notes."],
            ["4", "BP and labs", "Optional values with safe interpretation."],
            ["5", "Results", "Clear next steps and referral note."],
          ].map((item, index) => {
            const itemProgress = spring({
              frame: frame - (230 + index * 10),
              fps: 30,
              config: { damping: 17 },
            });
            return (
              <div
                key={item[0]}
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr",
                  gap: 20,
                  alignItems: "center",
                  padding: 22,
                  borderRadius: 30,
                  background:
                    index === activeIndex + 1
                      ? "linear-gradient(135deg, rgba(15,118,110,0.96), rgba(3,105,161,0.92))"
                      : "rgba(255,255,255,0.82)",
                  boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
                  transform: `translateX(${(1 - itemProgress) * 45}px)`,
                  opacity: itemProgress,
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 20,
                    display: "grid",
                    placeItems: "center",
                    background: index === activeIndex + 1 ? "rgba(255,255,255,0.16)" : "#ecfeff",
                    color: index === activeIndex + 1 ? "white" : "#0f766e",
                    fontSize: 28,
                    fontWeight: 900,
                  }}
                >
                  {item[0]}
                </div>
                <div style={{ color: index === activeIndex + 1 ? "white" : "#0f172a" }}>
                  <div style={{ fontSize: 30, fontWeight: 900 }}>{item[1]}</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 21,
                      color: index === activeIndex + 1 ? "rgba(255,255,255,0.78)" : "#64748b",
                      fontWeight: 700,
                    }}
                  >
                    {item[2]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function DeterministicScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 400, 650);
  const sweep = clampProgress(frame, 430, 160);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 205,
          width: 720,
          transform: `translateY(${rise(frame, 412)}px)`,
        }}
      >
        <div
          style={{
            color: "#0f766e",
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          Safety architecture
        </div>
        <h2
          style={{
            margin: "26px 0 0",
            color: "#082f49",
            fontSize: 80,
            lineHeight: 0.98,
            letterSpacing: -3,
          }}
        >
          AI assists. Code calculates.
        </h2>
        <p
          style={{
            marginTop: 30,
            color: "#475569",
            fontSize: 32,
            lineHeight: 1.35,
            fontWeight: 700,
          }}
        >
          Deterministic TypeScript rules remain the source of truth for core screening.
        </p>
      </div>
      <div
        style={{
          position: "absolute",
          right: 110,
          top: 188,
          width: 800,
          display: "grid",
          gap: 24,
        }}
      >
        {riskCards.map(([title, detail], index) => {
          const progress = spring({
            frame: frame - (450 + index * 12),
            fps: 30,
            config: { damping: 18 },
          });
          return (
            <div
              key={title}
              style={{
                position: "relative",
                overflow: "hidden",
                padding: 34,
                borderRadius: 34,
                background: "rgba(255,255,255,0.9)",
                border: "1px solid rgba(15,118,110,0.13)",
                boxShadow: "0 20px 50px rgba(15,23,42,0.08)",
                transform: `translateX(${(1 - progress) * 52}px)`,
                opacity: progress,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${Math.max(8, sweep * 100)}%`,
                  background: "linear-gradient(90deg, rgba(45,212,191,0.20), transparent)",
                }}
              />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 38, color: "#0f172a", fontWeight: 950 }}>{title}</div>
                <div style={{ marginTop: 10, fontSize: 24, color: "#64748b", fontWeight: 700 }}>
                  {detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function AiScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 620, 850);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: 125, top: 155 }}>
        <PhoneMockup screen={screenshots[3]} frameOffset={642} scale={0.82} />
      </div>
      <div style={{ position: "absolute", left: 430, top: 230 }}>
        <PhoneMockup screen={screenshots[4]} frameOffset={680} scale={0.66} />
      </div>
      <div style={{ position: "absolute", right: 105, top: 190, width: 830 }}>
        <h2
          style={{
            margin: 0,
            color: "#042f2e",
            fontSize: 78,
            lineHeight: 0.98,
            letterSpacing: -3,
          }}
        >
          Premium AI features with clear boundaries
        </h2>
        <div style={{ marginTop: 54, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          {aiCards.map(([title, detail], index) => {
            const progress = spring({
              frame: frame - (675 + index * 18),
              fps: 30,
              config: { damping: 16 },
            });
            return (
              <div
                key={title}
                style={{
                  minHeight: 230,
                  padding: 28,
                  borderRadius: 34,
                  background:
                    index === 1
                      ? "linear-gradient(135deg, #0f766e, #0369a1)"
                      : "rgba(255,255,255,0.88)",
                  color: index === 1 ? "white" : "#0f172a",
                  boxShadow: "0 26px 60px rgba(15,23,42,0.10)",
                  transform: `translateY(${(1 - progress) * 46}px)`,
                  opacity: progress,
                }}
              >
                <div style={{ fontSize: 34, fontWeight: 950 }}>{title}</div>
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 22,
                    lineHeight: 1.35,
                    color: index === 1 ? "rgba(255,255,255,0.84)" : "#64748b",
                    fontWeight: 750,
                  }}
                >
                  {detail}
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 28,
            padding: "24px 28px",
            borderRadius: 30,
            background: "rgba(255,247,237,0.92)",
            color: "#9a3412",
            fontSize: 26,
            lineHeight: 1.35,
            fontWeight: 900,
          }}
        >
          Never diagnoses. Never prescribes. Always recommends qualified medical confirmation.
        </div>
      </div>
    </AbsoluteFill>
  );
}

function BharatScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 820, 1020);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: 112, top: 190, width: 790 }}>
        <h2
          style={{
            margin: 0,
            color: "#082f49",
            fontSize: 86,
            lineHeight: 0.98,
            letterSpacing: -3,
          }}
        >
          Designed for real-world screening camps
        </h2>
        <p
          style={{
            marginTop: 32,
            color: "#475569",
            fontSize: 32,
            lineHeight: 1.35,
            fontWeight: 760,
          }}
        >
          Works as an installable PWA, supports English and Hindi, keeps data local
          unless an AI feature is intentionally used.
        </p>
        <div style={{ marginTop: 46, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          {[
            ["Installable PWA", "Android, iPhone and desktop browser-ready"],
            ["Offline manual checks", "Calculator flow remains available after caching"],
            ["Bilingual interface", "English / हिंदी for field use"],
            ["Local-first data", "No database required for screening"],
          ].map(([title, detail], index) => (
            <div
              key={title}
              style={{
                padding: 28,
                borderRadius: 32,
                background: "rgba(255,255,255,0.88)",
                boxShadow: "0 20px 54px rgba(15,23,42,0.08)",
                transform: `translateY(${rise(frame, 850 + index * 8)}px)`,
              }}
            >
              <div style={{ color: "#0f766e", fontSize: 29, fontWeight: 950 }}>{title}</div>
              <div style={{ marginTop: 10, color: "#64748b", fontSize: 21, fontWeight: 750 }}>
                {detail}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 112,
          top: 188,
          width: 700,
          height: 700,
          borderRadius: 80,
          background: "linear-gradient(135deg, rgba(15,118,110,0.96), rgba(3,105,161,0.96))",
          boxShadow: "0 36px 90px rgba(15,23,42,0.20)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 5, textTransform: "uppercase" }}>
          SwasthyaScore AI
        </div>
        <div style={{ marginTop: 32, fontSize: 66, lineHeight: 1.05, fontWeight: 950 }}>
          Screening made simple, safe and explainable.
        </div>
        <div style={{ marginTop: 38, fontSize: 30, lineHeight: 1.4, color: "rgba(255,255,255,0.82)", fontWeight: 760 }}>
          For public-health awareness, referral support and better conversations with doctors.
        </div>
      </div>
    </AbsoluteFill>
  );
}

function FinalScene() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [990, 1030], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <div
          style={{
            margin: "0 auto",
            width: 116,
            height: 116,
            borderRadius: 34,
            background: "linear-gradient(135deg, #0f766e, #0369a1)",
            boxShadow: "0 22px 60px rgba(15,118,110,0.30)",
          }}
        />
        <h2
          style={{
            margin: "38px 0 0",
            fontSize: 92,
            letterSpacing: -4,
            color: "#042f2e",
          }}
        >
          SwasthyaScore AI
        </h2>
        <p style={{ marginTop: 20, fontSize: 36, color: "#475569", fontWeight: 800 }}>
          AI-powered NCD risk screening for Bharat
        </p>
        <div
          style={{
            margin: "48px auto 0",
            display: "inline-flex",
            gap: 18,
            alignItems: "center",
            padding: "20px 32px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.9)",
            color: "#0f766e",
            fontSize: 24,
            fontWeight: 950,
            boxShadow: "0 20px 50px rgba(15,23,42,0.08)",
          }}
        >
          Screening only
          <span style={{ color: "#cbd5e1" }}>|</span>
          Not a diagnosis
          <span style={{ color: "#cbd5e1" }}>|</span>
          Doctor confirmation required
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function SwasthyaScoreLandingVideo() {
  return (
    <AbsoluteFill style={{ fontFamily: "Inter, Manrope, Arial, sans-serif" }}>
      <Background />
      <Wordmark />
      <HeroScene />
      <FlowScene />
      <DeterministicScene />
      <AiScene />
      <BharatScene />
      <FinalScene />
    </AbsoluteFill>
  );
}
