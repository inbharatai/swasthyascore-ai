import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";

type ScreenShot = {
  src: string;
  title: string;
  detail: string;
};

const screens: ScreenShot[] = [
  {
    src: "product-media/screenshots/02-home-dashboard.png",
    title: "Mobile dashboard",
    detail: "Open directly into the working screening app.",
  },
  {
    src: "product-media/screenshots/04-risk-measurements-step.png",
    title: "Guided check",
    detail: "Height, weight and waist stay manual-first.",
  },
  {
    src: "product-media/screenshots/11-camera-assist.png",
    title: "Camera assist",
    detail: "Visual guidance only, never diagnosis.",
  },
  {
    src: "product-media/screenshots/07-results-summary.png",
    title: "Clear result",
    detail: "Code-based BMI, BP, lab and diabetes-risk logic.",
  },
  {
    src: "product-media/screenshots/10-lab-ocr-after-upload.png",
    title: "AI support",
    detail: "OCR and explanations remain optional.",
  },
];

const features = [
  "60-second risk check",
  "English / Hindi",
  "Offline manual calculator",
  "Doctor-ready report",
];

const safetyCards = [
  ["Code calculates", "BMI, waist, BP, labs and diabetes score"],
  ["AI assists", "OCR, explanation and referral notes"],
  ["Safety first", "Screening only. Doctor confirmation required."],
];

function sceneOpacity(frame: number, start: number, end: number) {
  return interpolate(frame, [start, start + 20, end - 20, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function rise(frame: number, start: number, distance = 46) {
  return interpolate(frame, [start, start + 34], [distance, 0], {
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
          "radial-gradient(circle at 18% 8%, rgba(45,212,191,0.34), transparent 28%), radial-gradient(circle at 80% 18%, rgba(56,189,248,0.26), transparent 30%), linear-gradient(180deg, #f0fdfa 0%, #eff6ff 52%, #f8fafc 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 720,
          height: 720,
          borderRadius: "50%",
          left: -290,
          top: 300,
          background: "rgba(15,118,110,0.18)",
          filter: "blur(20px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 820,
          height: 820,
          borderRadius: "50%",
          right: -360,
          bottom: -240,
          background: "rgba(3,105,161,0.18)",
          filter: "blur(22px)",
        }}
      />
    </AbsoluteFill>
  );
}

function BrandHeader() {
  return (
    <div
      style={{
        position: "absolute",
        top: 72,
        left: 64,
        right: 64,
        display: "flex",
        alignItems: "center",
        gap: 20,
        zIndex: 20,
      }}
    >
      <div
        style={{
          width: 70,
          height: 70,
          borderRadius: 22,
          background: "linear-gradient(135deg, #0f766e, #0369a1)",
          boxShadow: "0 18px 46px rgba(15,118,110,0.26)",
        }}
      />
      <div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 950,
            letterSpacing: 2,
            color: "#042f2e",
          }}
        >
          SwasthyaScore AI
        </div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: "#64748b" }}>
          Screening only. Not a diagnosis.
        </div>
      </div>
    </div>
  );
}

function PhoneMockup({
  screen,
  delay = 0,
  scale = 1,
  rotate = 0,
}: {
  screen: ScreenShot;
  delay?: number;
  scale?: number;
  rotate?: number;
}) {
  const frame = useCurrentFrame();
  const entrance = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 17, mass: 0.9 },
  });

  return (
    <div
      style={{
        width: 492 * scale,
        height: 984 * scale,
        borderRadius: 76 * scale,
        padding: 18 * scale,
        background: "linear-gradient(160deg, #0f172a, #164e63)",
        boxShadow: "0 40px 110px rgba(15,23,42,0.32)",
        transform: `translateY(${(1 - entrance) * 90}px) rotate(${interpolate(
          entrance,
          [0, 1],
          [rotate - 5, rotate],
        )}deg)`,
        opacity: entrance,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 56 * scale,
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
            left: 28 * scale,
            right: 28 * scale,
            bottom: 28 * scale,
            borderRadius: 30 * scale,
            padding: `${18 * scale}px ${20 * scale}px`,
            background: "rgba(4,47,46,0.9)",
            color: "white",
          }}
        >
          <div style={{ fontSize: 24 * scale, fontWeight: 950 }}>{screen.title}</div>
          <div style={{ marginTop: 8 * scale, fontSize: 15 * scale, lineHeight: 1.35 }}>
            {screen.detail}
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, delay }: { children: string; delay: number }) {
  const frame = useCurrentFrame();
  const progress = spring({ frame: frame - delay, fps: 30, config: { damping: 16 } });

  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: 999,
        padding: "18px 24px",
        background: "rgba(255,255,255,0.88)",
        color: "#0f766e",
        fontSize: 24,
        fontWeight: 950,
        boxShadow: "0 16px 42px rgba(15,23,42,0.08)",
        opacity: progress,
        transform: `translateY(${(1 - progress) * 28}px)`,
      }}
    >
      {children}
    </div>
  );
}

function HeroScene() {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 0, 165);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          top: 215,
          left: 64,
          right: 64,
          transform: `translateY(${rise(frame, 8)}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "12px 20px",
            borderRadius: 999,
            background: "rgba(15,118,110,0.11)",
            color: "#0f766e",
            fontSize: 22,
            fontWeight: 950,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Built for Bharat
        </div>
        <h1
          style={{
            margin: "28px 0 0",
            fontSize: 78,
            lineHeight: 0.94,
            letterSpacing: -3,
            color: "#082f49",
          }}
        >
          NCD risk screening that feels like a mobile app
        </h1>
        <p
          style={{
            marginTop: 26,
            fontSize: 30,
            lineHeight: 1.32,
            color: "#475569",
            fontWeight: 760,
          }}
        >
          Obesity, diabetes, BP and lab-risk guidance in a calm guided flow.
        </p>
      </div>

      <div style={{ position: "absolute", left: 294, top: 675 }}>
        <PhoneMockup screen={screens[0]} delay={26} scale={0.98} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 96,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {features.map((feature, index) => (
          <Badge key={feature} delay={58 + index * 8}>
            {feature}
          </Badge>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function FlowScene() {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 145, 315);
  const active = Math.min(2, Math.floor(Math.max(0, frame - 155) / 48));

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: 104, top: 246 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 68,
            lineHeight: 0.98,
            letterSpacing: -2.5,
            color: "#042f2e",
          }}
        >
          One task at a time.
        </h2>
        <p
          style={{
            marginTop: 22,
            width: 820,
            fontSize: 28,
            lineHeight: 1.32,
            fontWeight: 760,
            color: "#64748b",
          }}
        >
          The form becomes a focused mobile wizard for field workers and families.
        </p>
      </div>
      <div style={{ position: "absolute", left: 314, top: 545 }}>
        <PhoneMockup screen={screens[1 + active]} delay={170} scale={0.92} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 100,
          display: "grid",
          gap: 16,
        }}
      >
        {["Basic details", "Measurements", "Risk factors", "BP and labs", "Results"].map(
          (step, index) => {
            const selected = index === active + 1;
            const progress = spring({
              frame: frame - (180 + index * 7),
              fps: 30,
              config: { damping: 16 },
            });
            return (
              <div
                key={step}
                style={{
                  display: "grid",
                  gridTemplateColumns: "58px 1fr",
                  gap: 18,
                  alignItems: "center",
                  padding: "18px 22px",
                  borderRadius: 28,
                  background: selected
                    ? "linear-gradient(135deg, #0f766e, #0369a1)"
                    : "rgba(255,255,255,0.88)",
                  boxShadow: "0 14px 38px rgba(15,23,42,0.08)",
                  opacity: progress,
                  transform: `translateY(${(1 - progress) * 24}px)`,
                }}
              >
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 18,
                    display: "grid",
                    placeItems: "center",
                    background: selected ? "rgba(255,255,255,0.18)" : "#ecfeff",
                    color: selected ? "white" : "#0f766e",
                    fontSize: 24,
                    fontWeight: 950,
                  }}
                >
                  {index + 1}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 950,
                    color: selected ? "white" : "#0f172a",
                  }}
                >
                  {step}
                </div>
              </div>
            );
          },
        )}
      </div>
    </AbsoluteFill>
  );
}

function SafetyScene() {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 295, 465);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: 64, right: 64, top: 230 }}>
        <div
          style={{
            color: "#0f766e",
            fontSize: 24,
            fontWeight: 950,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          Safe by design
        </div>
        <h2
          style={{
            margin: "26px 0 0",
            fontSize: 76,
            lineHeight: 0.98,
            letterSpacing: -3,
            color: "#082f49",
          }}
        >
          Camera and AI assist. They never diagnose.
        </h2>
      </div>
      <div style={{ position: "absolute", left: 82, top: 610 }}>
        <PhoneMockup screen={screens[2]} delay={326} scale={0.78} rotate={-2} />
      </div>
      <div style={{ position: "absolute", right: 82, top: 660 }}>
        <PhoneMockup screen={screens[3]} delay={350} scale={0.72} rotate={3} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 110,
          display: "grid",
          gap: 18,
        }}
      >
        {safetyCards.map(([title, detail], index) => {
          const progress = spring({
            frame: frame - (365 + index * 12),
            fps: 30,
            config: { damping: 16 },
          });
          return (
            <div
              key={title}
              style={{
                padding: 28,
                borderRadius: 34,
                background: index === 1 ? "rgba(15,118,110,0.94)" : "rgba(255,255,255,0.9)",
                color: index === 1 ? "white" : "#0f172a",
                boxShadow: "0 18px 46px rgba(15,23,42,0.09)",
                opacity: progress,
                transform: `translateX(${(1 - progress) * 42}px)`,
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 950 }}>{title}</div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 22,
                  lineHeight: 1.34,
                  fontWeight: 760,
                  color: index === 1 ? "rgba(255,255,255,0.82)" : "#64748b",
                }}
              >
                {detail}
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
  const opacity = sceneOpacity(frame, 445, 610);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: 64, right: 64, top: 225 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 76,
            lineHeight: 0.98,
            letterSpacing: -3,
            color: "#042f2e",
          }}
        >
          AI features stay optional and controlled.
        </h2>
        <p
          style={{
            marginTop: 28,
            fontSize: 29,
            lineHeight: 1.35,
            fontWeight: 780,
            color: "#64748b",
          }}
        >
          Lab OCR, simple explanations and referral notes run only when the user chooses.
        </p>
      </div>
      <div style={{ position: "absolute", left: 294, top: 620 }}>
        <PhoneMockup screen={screens[4]} delay={476} scale={0.98} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 110,
          padding: 34,
          borderRadius: 38,
          background: "linear-gradient(135deg, rgba(15,118,110,0.96), rgba(3,105,161,0.94))",
          color: "white",
          boxShadow: "0 28px 70px rgba(15,23,42,0.16)",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 950 }}>Privacy-first flow</div>
        <div style={{ marginTop: 12, fontSize: 24, lineHeight: 1.35, fontWeight: 760 }}>
          Images are not stored by default. Manual screening works offline.
        </div>
      </div>
    </AbsoluteFill>
  );
}

function FinalScene() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [590, 630], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, display: "grid", placeItems: "center", textAlign: "center" }}>
      <div style={{ padding: "0 70px" }}>
        <div
          style={{
            margin: "0 auto",
            width: 132,
            height: 132,
            borderRadius: 38,
            background: "linear-gradient(135deg, #0f766e, #0369a1)",
            boxShadow: "0 24px 70px rgba(15,118,110,0.30)",
          }}
        />
        <h2
          style={{
            margin: "44px 0 0",
            fontSize: 86,
            lineHeight: 0.98,
            letterSpacing: -4,
            color: "#042f2e",
          }}
        >
          SwasthyaScore AI
        </h2>
        <p style={{ marginTop: 24, fontSize: 34, lineHeight: 1.28, color: "#475569", fontWeight: 850 }}>
          AI-powered NCD risk screening for Bharat
        </p>
        <div
          style={{
            marginTop: 48,
            borderRadius: 999,
            padding: "22px 30px",
            background: "rgba(255,255,255,0.9)",
            color: "#0f766e",
            fontSize: 24,
            fontWeight: 950,
            boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
          }}
        >
          Screening only | Not a diagnosis | Doctor confirmation required
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function SwasthyaScoreLandingVideo() {
  return (
    <AbsoluteFill style={{ fontFamily: "Inter, Manrope, Arial, sans-serif" }}>
      <Background />
      <BrandHeader />
      <HeroScene />
      <FlowScene />
      <SafetyScene />
      <AiScene />
      <FinalScene />
    </AbsoluteFill>
  );
}
