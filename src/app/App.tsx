import { useState, useEffect, useRef, useId } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  History,
  X,
  Leaf,
  Zap,
  Flame,
  Wind,
  TreePine,
  Droplets,
  Clock,
  TrendingDown,
  TrendingUp,
  BarChart2,
  CalendarDays,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

const COL_PRIMARY = "#2E7D32";
const COL_ACCENT = "#81C784";
const COL_BG_LIGHT = "#F1F8E9";
const COL_WHITE = "#FFFFFF";
const COL_TEXT = "#1B5E20";
const COL_DANGER = "#D32F2F";
const COL_WARN = "#F57F17";

const FACTORS = {
  petrol: 2.31,
  diesel: 2.68,
  coal: 2.42,
  firewood: 1.65,
  lpg: 2.98,
  cng: 2.66,
  electricity: 0.85,
};

const PERIODS = { Daily: 7, Weekly: 4, Monthly: 6, Yearly: 5 };
const THRESHOLDS = {
  Daily: 15,
  Weekly: 100,
  Monthly: 5000,
  Yearly: 100000,
};

type Fuel = keyof typeof FACTORS;
type Mode = keyof typeof PERIODS;

type ActivityRecord = {
  id: string;
  timestamp: number;
  fuel: Fuel;
  mode: Mode;
  type:
    | "session_start"
    | "fuel_switch"
    | "mode_switch"
    | "data_entry"
    | "reset";
  totalEmissions?: number;
  entryCount?: number;
};

const HISTORY_KEY = "terraspec_activity_history";
const MAX_HISTORY = 300;

const FUEL_ICON_MAP: Record<Fuel, React.ReactNode> = {
  petrol: <Droplets size={15} />,
  diesel: <Droplets size={15} />,
  coal: <Flame size={15} />,
  firewood: <TreePine size={15} />,
  lpg: <Wind size={15} />,
  cng: <Wind size={15} />,
  electricity: <Zap size={15} />,
};

const FUEL_COLORS: Record<Fuel, string> = {
  petrol: "#1565C0",
  diesel: "#4527A0",
  coal: "#37474F",
  firewood: "#6D4C41",
  lpg: "#00838F",
  cng: "#2E7D32",
  electricity: "#F9A825",
};

const loadHistory = (): ActivityRecord[] => {
  try {
    return JSON.parse(
      localStorage.getItem(HISTORY_KEY) || "[]",
    );
  } catch {
    return [];
  }
};
const saveHistory = (records: ActivityRecord[]) => {
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(records.slice(-MAX_HISTORY)),
  );
};
const appendActivity = (
  record: Omit<ActivityRecord, "id">,
): ActivityRecord[] => {
  const history = loadHistory();
  const newRecord: ActivityRecord = {
    ...record,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  const updated = [...history, newRecord];
  saveHistory(updated);
  return updated;
};

// ── Compute stats from actual localStorage data ──────────────────────────────
type FuelStat = {
  fuel: Fuel;
  totalCO2: number;
  sessions: number;
  compliance: number;
};

function computeFuelStats(): FuelStat[] {
  return (Object.keys(FACTORS) as Fuel[])
    .map((fuel) => {
      let totalCO2 = 0;
      let sessions = 0;
      let compliantSessions = 0;
      (Object.keys(PERIODS) as Mode[]).forEach((mode) => {
        const raw = localStorage.getItem(`${fuel}_${mode}`);
        if (!raw) return;
        const vals: string[] = JSON.parse(raw);
        const nums = vals.map((v) => parseFloat(v) || 0);
        const co2 = nums.reduce(
          (s, v) => s + v * FACTORS[fuel],
          0,
        );
        if (co2 > 0) {
          sessions++;
          totalCO2 += co2;
          const avg = co2 / nums.length;
          if (avg <= THRESHOLDS[mode]) compliantSessions++;
        }
      });
      return {
        fuel,
        totalCO2: parseFloat(totalCO2.toFixed(2)),
        sessions,
        compliance: sessions
          ? Math.round((compliantSessions / sessions) * 100)
          : 100,
      };
    })
    .filter((s) => s.sessions > 0)
    .sort((a, b) => b.totalCO2 - a.totalCO2);
}

// ── Weekly bar data (last 7 days) ────────────────────────────────────────────
function computeWeeklyBars(history: ActivityRecord[]) {
  const days: { label: string; co2: number; date: string }[] =
    [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    const label =
      i === 0
        ? "Today"
        : d.toLocaleDateString([], { weekday: "short" });
    const co2 = history
      .filter(
        (r) =>
          r.type === "data_entry" &&
          new Date(r.timestamp).toDateString() === dateStr,
      )
      .reduce((s, r) => s + (r.totalEmissions || 0), 0);
    days.push({
      label,
      co2: parseFloat(co2.toFixed(1)),
      date: dateStr,
    });
  }
  return days;
}

function computeOverallStats(history: ActivityRecord[]) {
  const sessions = history.filter(
    (r) => r.type === "session_start",
  ).length;
  const dataEntries = history.filter(
    (r) => r.type === "data_entry",
  );
  const totalCO2 = dataEntries.reduce(
    (s, r) => s + (r.totalEmissions || 0),
    0,
  );
  const daysActive = new Set(
    history.map((r) => new Date(r.timestamp).toDateString()),
  ).size;
  const fuelsTracked = new Set(
    history
      .filter((r) => r.type === "data_entry")
      .map((r) => r.fuel),
  ).size;
  return {
    sessions,
    totalCO2: parseFloat(totalCO2.toFixed(2)),
    daysActive,
    fuelsTracked,
  };
}

const getExpertAdvice = (
  fuel: Fuel,
  isHigh: boolean,
): string[] => {
  const adviceMap: Record<
    Fuel,
    { high: string[]; stable: string[] }
  > = {
    petrol: {
      high: [
        "Review logistics routes to optimize fuel usage.",
        "Transition fleet to hybrid/EV models to lower long-term overhead.",
      ],
      stable: [
        "Sustainable consumption levels. Maintain current logistical efficiency.",
      ],
    },
    diesel: {
      high: [
        "Review logistics routes to optimize fuel usage.",
        "Transition fleet to hybrid/EV models to lower long-term overhead.",
      ],
      stable: [
        "Sustainable consumption levels. Maintain current logistical efficiency.",
      ],
    },
    coal: {
      high: [
        "Exceeding industrial benchmarks. Consider upgrading scrubbers or transitioning to Natural Gas.",
        "Implement heat recovery systems to maximize energy extraction from coal combustion.",
      ],
      stable: [
        "Emissions are within corporate compliance levels for this period.",
      ],
    },
    electricity: {
      high: [
        "Install solar arrays to offset grid dependency.",
        "Conduct a facility-wide energy audit to identify hardware inefficiencies.",
      ],
      stable: [
        "Efficient electricity profile. Continue monitoring peak-load times.",
      ],
    },
    firewood: {
      high: [
        "Analyze machinery duty cycles for energy savings.",
        "Continue scheduled maintenance to ensure peak efficiency.",
      ],
      stable: ["Sustainable consumption levels."],
    },
    lpg: {
      high: [
        "Analyze machinery duty cycles for energy savings.",
        "Continue scheduled maintenance to ensure peak efficiency.",
      ],
      stable: ["Sustainable consumption levels."],
    },
    cng: {
      high: [
        "Analyze machinery duty cycles for energy savings.",
        "Continue scheduled maintenance to ensure peak efficiency.",
      ],
      stable: ["Sustainable consumption levels."],
    },
  };
  return adviceMap[fuel][isHigh ? "high" : "stable"];
};

const Logo = ({ size = 95 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 95 95">
    <circle
      cx="47.5"
      cy="47.5"
      r="37.5"
      fill={COL_PRIMARY}
      stroke={COL_TEXT}
      strokeWidth="2"
    />
    <path
      d="M 15 47.5 A 32.5 32.5 0 0 1 80 47.5"
      fill={COL_ACCENT}
    />
    <text
      x="47.5"
      y="55"
      textAnchor="middle"
      fill={COL_WHITE}
      fontSize="18"
      fontWeight="bold"
    >
      CO2
    </text>
  </svg>
);

// ── History Panel ────────────────────────────────────────────────────────────
function HistoryPanel({
  history,
  onClose,
  onClear,
}: {
  history: ActivityRecord[];
  onClose: () => void;
  onClear: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "sessions">(
    "overview",
  );

  const fuelStats = computeFuelStats();
  const weeklyBars = computeWeeklyBars(history);
  const maxWeeklyCO2 = Math.max(
    ...weeklyBars.map((d) => d.co2),
    1,
  );
  const stats = computeOverallStats(history);

  const sessionRecords = [...history]
    .filter((r) => r.type === "data_entry")
    .reverse()
    .slice(0, 30);

  const overallComplianceRate = fuelStats.length
    ? Math.round(
        fuelStats.reduce((s, f) => s + f.compliance, 0) /
          fuelStats.length,
      )
    : 100;

  return (
    <div
      className="absolute inset-y-0 right-0 z-50 w-[440px] flex flex-col shadow-2xl"
      style={{
        backgroundColor: "#F0F7F0",
        borderLeft: "2px solid #333333",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background:
            "linear-gradient(160deg, #1B5E20 0%, #2E7D32 60%, #388E3C 100%)",
          padding: "20px 20px 0 20px",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            >
              <BarChart2 size={20} color={COL_WHITE} />
            </div>
            <div>
              <h2
                className="text-lg font-bold leading-none"
                style={{ color: COL_WHITE }}
              >
                Emission Progress
              </h2>
              <p
                className="text-xs mt-0.5"
                style={{ color: "#A5D6A7" }}
              >
                {stats.daysActive} day
                {stats.daysActive !== 1 ? "s" : ""} tracked
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-colors hover:bg-white/10"
            style={{ color: COL_WHITE }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary hero */}
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ backgroundColor: "rgba(0,0,0,0.18)" }}
        >
          <p
            className="text-xs font-medium uppercase tracking-widest mb-1"
            style={{ color: "#A5D6A7" }}
          >
            Total CO₂ Logged
          </p>
          <div className="flex items-end gap-2">
            <span
              className="text-3xl font-bold"
              style={{ color: COL_WHITE }}
            >
              {stats.totalCO2.toLocaleString("en-US", {
                maximumFractionDigits: 1,
              })}
            </span>
            <span
              className="text-sm mb-1 font-medium"
              style={{ color: "#A5D6A7" }}
            >
              kg CO₂
            </span>
            <div
              className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{
                backgroundColor:
                  overallComplianceRate >= 70
                    ? "rgba(129,199,132,0.25)"
                    : "rgba(211,47,47,0.25)",
              }}
            >
              {overallComplianceRate >= 70 ? (
                <ShieldCheck size={13} color={COL_ACCENT} />
              ) : (
                <ShieldAlert size={13} color="#EF9A9A" />
              )}
              <span
                className="text-xs font-bold"
                style={{
                  color:
                    overallComplianceRate >= 70
                      ? COL_ACCENT
                      : "#EF9A9A",
                }}
              >
                {overallComplianceRate}% compliant
              </span>
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            {
              label: "Sessions",
              value: stats.sessions,
              icon: <Clock size={13} />,
            },
            {
              label: "Fuels Used",
              value: stats.fuelsTracked,
              icon: <Leaf size={13} />,
            },
            {
              label: "Days Active",
              value: stats.daysActive,
              icon: <CalendarDays size={13} />,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-3 flex flex-col gap-1"
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
              }}
            >
              <div
                className="flex items-center gap-1"
                style={{ color: "#A5D6A7" }}
              >
                {s.icon}
                <span className="text-xs">{s.label}</span>
              </div>
              <span
                className="text-xl font-bold"
                style={{ color: COL_WHITE }}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div
          className="flex"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {(["overview", "sessions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-2.5 text-sm font-semibold capitalize transition-all"
              style={{
                color:
                  tab === t
                    ? COL_WHITE
                    : "rgba(255,255,255,0.5)",
                borderBottom:
                  tab === t
                    ? `2px solid ${COL_ACCENT}`
                    : "2px solid transparent",
                marginBottom: "-1px",
                background: "transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: `${COL_ACCENT} transparent`,
        }}
      >
        {tab === "overview" ? (
          <div className="p-4 flex flex-col gap-4">
            {/* Weekly activity bar chart */}
            <div
              className="rounded-2xl p-4"
              style={{
                backgroundColor: COL_WHITE,
                border: "1.5px solid #D0E8D0",
              }}
            >
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: COL_TEXT }}
              >
                Last 7 Days
              </p>
              <div
                className="flex items-end justify-between gap-1.5"
                style={{ height: "80px" }}
              >
                {weeklyBars.map((d, i) => {
                  const pct =
                    maxWeeklyCO2 > 0
                      ? (d.co2 / maxWeeklyCO2) * 100
                      : 0;
                  const isToday = i === 6;
                  return (
                    <div
                      key={d.date}
                      className="flex flex-col items-center gap-1.5 flex-1"
                    >
                      <div
                        className="w-full flex flex-col justify-end"
                        style={{ height: "56px" }}
                      >
                        <div
                          className="w-full rounded-t-md transition-all"
                          style={{
                            height: `${Math.max(pct, d.co2 > 0 ? 6 : 0)}%`,
                            minHeight: d.co2 > 0 ? "4px" : "0",
                            backgroundColor: isToday
                              ? COL_PRIMARY
                              : COL_ACCENT,
                            opacity: isToday ? 1 : 0.7,
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-medium"
                        style={{
                          color: isToday ? COL_PRIMARY : "#888",
                          fontSize: "0.65rem",
                        }}
                      >
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fuel breakdown */}
            <div
              className="rounded-2xl p-4"
              style={{
                backgroundColor: COL_WHITE,
                border: "1.5px solid #D0E8D0",
              }}
            >
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: COL_TEXT }}
              >
                Fuel Breakdown
              </p>
              {fuelStats.length === 0 ? (
                <p
                  className="text-sm text-center py-4"
                  style={{ color: "#aaa" }}
                >
                  No fuel data recorded yet.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {fuelStats.map((fs, i) => {
                    const maxCO2 = fuelStats[0].totalCO2;
                    const pct =
                      maxCO2 > 0
                        ? (fs.totalCO2 / maxCO2) * 100
                        : 0;
                    const barColor = FUEL_COLORS[fs.fuel];
                    return (
                      <div key={fs.fuel}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="p-1.5 rounded-lg"
                              style={{
                                backgroundColor:
                                  barColor + "18",
                                color: barColor,
                              }}
                            >
                              {FUEL_ICON_MAP[fs.fuel]}
                            </div>
                            <span
                              className="text-sm font-semibold capitalize"
                              style={{ color: COL_TEXT }}
                            >
                              {fs.fuel}
                            </span>
                            {i === 0 && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                                style={{
                                  backgroundColor: "#FFF3E0",
                                  color: COL_WARN,
                                }}
                              >
                                Most
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-bold"
                              style={{ color: COL_TEXT }}
                            >
                              {fs.totalCO2.toFixed(1)} kg
                            </span>
                            {fs.compliance >= 70 ? (
                              <TrendingDown
                                size={13}
                                color={COL_PRIMARY}
                              />
                            ) : (
                              <TrendingUp
                                size={13}
                                color={COL_DANGER}
                              />
                            )}
                          </div>
                        </div>
                        <div
                          className="w-full rounded-full overflow-hidden"
                          style={{
                            height: "6px",
                            backgroundColor: "#E8F5E9",
                          }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: barColor,
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span
                            className="text-xs"
                            style={{ color: "#aaa" }}
                          >
                            {fs.sessions} period
                            {fs.sessions !== 1 ? "s" : ""}{" "}
                            tracked
                          </span>
                          <span
                            className="text-xs font-medium"
                            style={{
                              color:
                                fs.compliance >= 70
                                  ? COL_PRIMARY
                                  : COL_DANGER,
                            }}
                          >
                            {fs.compliance}% compliant
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Compliance ring summary */}
            {fuelStats.length > 0 && (
              <div
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: COL_WHITE,
                  border: "1.5px solid #D0E8D0",
                }}
              >
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: COL_TEXT }}
                >
                  Compliance Overview
                </p>
                <div className="flex items-center gap-4">
                  <svg
                    width="72"
                    height="72"
                    viewBox="0 0 72 72"
                  >
                    <circle
                      cx="36"
                      cy="36"
                      r="28"
                      fill="none"
                      stroke="#E8F5E9"
                      strokeWidth="8"
                    />
                    <circle
                      cx="36"
                      cy="36"
                      r="28"
                      fill="none"
                      stroke={
                        overallComplianceRate >= 70
                          ? COL_PRIMARY
                          : COL_DANGER
                      }
                      strokeWidth="8"
                      strokeDasharray={`${(overallComplianceRate / 100) * 175.9} 175.9`}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                    />
                    <text
                      x="36"
                      y="40"
                      textAnchor="middle"
                      fontSize="14"
                      fontWeight="bold"
                      fill={COL_TEXT}
                    >
                      {overallComplianceRate}%
                    </text>
                  </svg>
                  <div className="flex flex-col gap-2 flex-1">
                    {fuelStats.slice(0, 3).map((fs) => (
                      <div
                        key={fs.fuel}
                        className="flex items-center justify-between"
                      >
                        <span
                          className="text-xs capitalize"
                          style={{ color: "#555" }}
                        >
                          {fs.fuel}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div
                            className="rounded-full"
                            style={{
                              width: "48px",
                              height: "4px",
                              backgroundColor: "#E8F5E9",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${fs.compliance}%`,
                                height: "100%",
                                backgroundColor:
                                  fs.compliance >= 70
                                    ? COL_PRIMARY
                                    : COL_DANGER,
                                borderRadius: "999px",
                              }}
                            />
                          </div>
                          <span
                            className="text-xs font-bold w-8 text-right"
                            style={{
                              color:
                                fs.compliance >= 70
                                  ? COL_PRIMARY
                                  : COL_DANGER,
                            }}
                          >
                            {fs.compliance}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Sessions Tab */
          <div className="p-4 flex flex-col gap-3">
            {sessionRecords.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 gap-3"
                style={{ color: "#aaa" }}
              >
                <Leaf size={40} color={COL_ACCENT} />
                <p className="text-sm font-medium">
                  No data entries yet.
                </p>
                <p
                  className="text-xs text-center"
                  style={{ color: "#bbb" }}
                >
                  Enter fuel values to start tracking your
                  emission sessions.
                </p>
              </div>
            ) : (
              sessionRecords.map((r) => {
                const fuelColor = FUEL_COLORS[r.fuel];
                const dateLabel = new Date(
                  r.timestamp,
                ).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                });
                const timeLabel = new Date(
                  r.timestamp,
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl p-4"
                    style={{
                      backgroundColor: COL_WHITE,
                      border: "1.5px solid #D0E8D0",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2.5 rounded-xl shrink-0"
                        style={{
                          backgroundColor: fuelColor + "18",
                          color: fuelColor,
                        }}
                      >
                        {FUEL_ICON_MAP[r.fuel]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-sm font-bold capitalize"
                            style={{ color: COL_TEXT }}
                          >
                            {r.fuel}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: "#999" }}
                          >
                            {dateLabel} · {timeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: "#F1F8E9",
                              color: COL_TEXT,
                            }}
                          >
                            {r.mode}
                          </span>
                          <span
                            className="text-xs font-semibold"
                            style={{ color: COL_PRIMARY }}
                          >
                            {(r.totalEmissions || 0).toFixed(2)}{" "}
                            kg CO₂
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: "#aaa" }}
                          >
                            {r.entryCount}{" "}
                            {r.entryCount === 1
                              ? "entry"
                              : "entries"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Mini progress bar toward threshold */}
                    {r.totalEmissions !== undefined &&
                      (() => {
                        const thresh = THRESHOLDS[r.mode];
                        const avg =
                          r.totalEmissions /
                          (r.entryCount || 1);
                        const pct = Math.min(
                          (avg / thresh) * 100,
                          100,
                        );
                        const isOver = avg > thresh;
                        return (
                          <div className="mt-3">
                            <div className="flex justify-between mb-1">
                              <span
                                className="text-xs"
                                style={{ color: "#aaa" }}
                              >
                                Avg vs limit
                              </span>
                              <span
                                className="text-xs font-medium"
                                style={{
                                  color: isOver
                                    ? COL_DANGER
                                    : COL_PRIMARY,
                                }}
                              >
                                {isOver
                                  ? "⚠ Over limit"
                                  : "✓ Within limit"}
                              </span>
                            </div>
                            <div
                              className="rounded-full overflow-hidden"
                              style={{
                                height: "5px",
                                backgroundColor: "#E8F5E9",
                              }}
                            >
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: "100%",
                                  backgroundColor: isOver
                                    ? COL_DANGER
                                    : COL_PRIMARY,
                                  borderRadius: "999px",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {history.length > 0 && (
        <div
          className="px-4 py-3 border-t"
          style={{
            borderColor: "#C8E6C9",
            backgroundColor: "#F0F7F0",
          }}
        >
          <button
            onClick={onClear}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-red-50"
            style={{
              borderColor: COL_DANGER,
              color: COL_DANGER,
            }}
          >
            Clear All History
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedFuel, setSelectedFuel] =
    useState<Fuel>("petrol");
  const [mode, setMode] = useState<Mode>("Daily");
  const [entries, setEntries] = useState<string[]>([]);
  const [showSplash, setShowSplash] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ActivityRecord[]>([]);
  const entryDebounceRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const uid = useId().replace(/:/g, "");
  const gradId = `grad_${uid}`;
  const sessionLoggedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showSplash && !sessionLoggedRef.current) {
      sessionLoggedRef.current = true;
      const updated = appendActivity({
        timestamp: Date.now(),
        fuel: selectedFuel,
        mode,
        type: "session_start",
      });
      setHistory(updated);
    }
  }, [showSplash]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    const key = `${selectedFuel}_${mode}`;
    const saved = localStorage.getItem(key);
    setEntries(
      saved ? JSON.parse(saved) : Array(PERIODS[mode]).fill(""),
    );
  }, [selectedFuel, mode]);

  const saveEntries = (newEntries: string[]) => {
    setEntries(newEntries);
    localStorage.setItem(
      `${selectedFuel}_${mode}`,
      JSON.stringify(newEntries),
    );
    if (entryDebounceRef.current)
      clearTimeout(entryDebounceRef.current);
    entryDebounceRef.current = setTimeout(() => {
      const nums = newEntries.map((e) => parseFloat(e) || 0);
      const filled = nums.filter((n) => n > 0);
      if (!filled.length) return;
      const totalEm = nums.reduce(
        (s, v) => s + v * FACTORS[selectedFuel],
        0,
      );
      const updated = appendActivity({
        timestamp: Date.now(),
        fuel: selectedFuel,
        mode,
        type: "data_entry",
        totalEmissions: parseFloat(totalEm.toFixed(2)),
        entryCount: filled.length,
      });
      setHistory(updated);
    }, 1500);
  };

  const handleEntryChange = (index: number, value: string) => {
    const newEntries = [...entries];
    newEntries[index] = value;
    saveEntries(newEntries);
  };

  const handleFuelSwitch = (fuel: Fuel) => {
    if (fuel === selectedFuel) return;
    setSelectedFuel(fuel);
    const updated = appendActivity({
      timestamp: Date.now(),
      fuel,
      mode,
      type: "fuel_switch",
    });
    setHistory(updated);
  };

  const handleModeSwitch = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    const updated = appendActivity({
      timestamp: Date.now(),
      fuel: selectedFuel,
      mode: m,
      type: "mode_switch",
    });
    setHistory(updated);
  };

  const resetCurrentMode = () => {
    localStorage.removeItem(`${selectedFuel}_${mode}`);
    setEntries(Array(PERIODS[mode]).fill(""));
    const updated = appendActivity({
      timestamp: Date.now(),
      fuel: selectedFuel,
      mode,
      type: "reset",
    });
    setHistory(updated);
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const numericData = entries.map((e) => parseFloat(e) || 0);
  const mult = FACTORS[selectedFuel];
  const emissions = numericData.map((val) => val * mult);
  const total = emissions.reduce((sum, val) => sum + val, 0);
  const avg =
    emissions.length > 0 ? total / emissions.length : 0;
  const limit = THRESHOLDS[mode];
  const isHigh = avg > limit;

  const chartData = emissions.map((value, index) => ({
    index: index + 1,
    emissions: parseFloat(value.toFixed(2)),
  }));

  const getLabelPrefix = () =>
    ({
      Daily: "Day",
      Weekly: "Week",
      Monthly: "Month",
      Yearly: "Year",
    })[mode];

  const sessionCount = history.filter(
    (r) => r.type === "session_start",
  ).length;

  if (showSplash) {
    return (
      <div className="size-full flex flex-col items-center justify-center bg-white">
        <Logo size={100} />
        <h1
          className="mt-5 text-3xl font-bold"
          style={{ color: COL_PRIMARY }}
        >
          TERRA SPEC
        </h1>
      </div>
    );
  }

  return (
    <div
      className="size-full flex flex-col relative"
      style={{ backgroundColor: "#F5F7F5" }}
    >
      <div className="flex-1 flex gap-3 p-3">
        {/* Sidebar */}
        <div
          className="w-80 rounded-3xl p-6 border flex flex-col"
          style={{
            backgroundColor: COL_BG_LIGHT,
            borderColor: "#333333",
          }}
        >
          <div className="flex flex-col items-center mb-6">
            <Logo size={95} />
            <h1
              className="mt-2 text-2xl font-bold"
              style={{ color: COL_PRIMARY }}
            >
              TERRA SPEC
            </h1>
          </div>

          <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
            {Object.keys(FACTORS)
              .sort()
              .map((fuel) => (
                <button
                  key={fuel}
                  onClick={() => handleFuelSwitch(fuel as Fuel)}
                  className="px-4 py-3 rounded-lg font-medium transition-colors border"
                  style={{
                    backgroundColor:
                      selectedFuel === fuel
                        ? COL_ACCENT
                        : COL_WHITE,
                    color: COL_TEXT,
                    borderColor: "#333333",
                  }}
                >
                  {fuel.toUpperCase()}
                </button>
              ))}
          </div>

          {/* History Button */}
          <button
            onClick={() => setShowHistory(true)}
            className="mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border transition-all hover:opacity-90 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${COL_PRIMARY}, #1B5E20)`,
              color: COL_WHITE,
              borderColor: "#1B5E20",
              boxShadow: "0 2px 12px rgba(46,125,50,0.35)",
            }}
          >
            <History size={17} />
            <span>Emission Progress</span>
            {sessionCount > 0 && (
              <span
                className="ml-1 text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  backgroundColor: COL_ACCENT,
                  color: COL_TEXT,
                }}
              >
                {sessionCount}
              </span>
            )}
          </button>
        </div>

        {/* Entry Panel */}
        <div
          className="flex-1 rounded-3xl border"
          style={{
            backgroundColor: COL_WHITE,
            borderColor: "#333333",
          }}
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2
                className="text-2xl font-bold"
                style={{ color: COL_PRIMARY }}
              >
                {selectedFuel.toUpperCase()} ANALYSIS
              </h2>
              <div className="flex gap-2">
                {(Object.keys(PERIODS) as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeSwitch(m)}
                    className="px-8 py-2 rounded-lg font-medium transition-colors border"
                    style={{
                      backgroundColor:
                        mode === m ? COL_PRIMARY : "#E0E0E0",
                      color: mode === m ? COL_WHITE : COL_TEXT,
                      borderColor: "#333333",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end mb-4">
              <button
                onClick={resetCurrentMode}
                className="px-4 py-2 rounded-lg border font-bold text-sm transition-colors hover:bg-red-50"
                style={{
                  borderColor: COL_DANGER,
                  color: COL_DANGER,
                }}
              >
                ↺ RESET CURRENT MODE
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {entries.map((entry, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl"
                  style={{ backgroundColor: COL_BG_LIGHT }}
                >
                  <label
                    className="font-bold min-w-[60px] sm:min-w-[80px] shrink-0"
                    style={{ color: COL_TEXT }}
                  >
                    {getLabelPrefix()} {index + 1}:
                  </label>
                  <input
                    type="text"
                    value={entry}
                    onChange={(e) =>
                      handleEntryChange(index, e.target.value)
                    }
                    placeholder={
                      selectedFuel === "electricity"
                        ? "kWh"
                        : selectedFuel === "coal"
                          ? "kg"
                          : selectedFuel === "firewood"
                            ? "kg"
                            : selectedFuel === "lpg"
                              ? "kg"
                              : selectedFuel === "cng"
                                ? "m³"
                                : "liters"
                    }
                    className="flex-1 min-w-0 px-2 sm:px-3 py-2 rounded-lg border"
                    style={{
                      backgroundColor: COL_WHITE,
                      borderColor: "#333333",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="flex justify-center gap-6 p-6">
        <div
          className="w-[450px] h-[420px] rounded-3xl border p-6"
          style={{
            backgroundColor: COL_WHITE,
            borderColor: "#333333",
          }}
        >
          <h3
            className="text-lg font-bold mb-4"
            style={{ color: COL_PRIMARY }}
          >
            {selectedFuel.charAt(0).toUpperCase() +
              selectedFuel.slice(1)}{" "}
            Trend
          </h3>
          <AreaChart width={400} height={320} data={chartData}>
            <defs>
              <linearGradient
                id={gradId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={COL_ACCENT}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={COL_ACCENT}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              opacity={0.3}
            />
            <XAxis dataKey="index" />
            <YAxis />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="emissions"
              stroke={COL_PRIMARY}
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
            />
          </AreaChart>
        </div>

        <div
          className="w-[450px] h-[420px] rounded-3xl border p-6"
          style={{
            backgroundColor: COL_WHITE,
            borderColor: "#333333",
          }}
        >
          <h3
            className="text-lg font-bold mb-4"
            style={{ color: COL_PRIMARY }}
          >
            ENVIRONMENTAL AUDIT
          </h3>
          <div
            className="h-[340px] overflow-y-auto p-4 rounded-2xl text-sm leading-relaxed"
            style={{
              backgroundColor: "#FAFAFA",
              color: "#222222",
            }}
          >
            <div className="font-mono">
              <div className="font-bold mb-2">
                [ {selectedFuel.toUpperCase()} CORPORATE AUDIT ]
              </div>
              <div className="mb-3">{"━".repeat(35)}</div>
              <div className="mb-1">
                • Total Emissions :{" "}
                {total.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                kg CO2
              </div>
              <div className="mb-1">
                • Intensity/Period:{" "}
                {avg.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                kg
              </div>
              <div className="mb-3">
                • Compliance Limit:{" "}
                {limit.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{" "}
                kg
              </div>
              <div className="mb-3">{"━".repeat(35)}</div>
              <div className="font-bold mb-2">
                AUDIT STATUS:
              </div>
              <div className="mb-4">
                &gt;&gt;{" "}
                {isHigh
                  ? "⚠️ REDUCTION MANDATED"
                  : "✅ WITHIN COMPLIANCE"}
              </div>
              <div className="font-bold mb-2">
                STRATEGIC ADVICE:
              </div>
              {getExpertAdvice(selectedFuel, isHigh).map(
                (tip, i) => (
                  <div key={i} className="mb-3">
                    {i + 1}. {tip}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-2 left-2 text-sm italic"
        style={{ color: "#777777" }}
      >
        Made by Aditya with Gemini
      </div>

      {showHistory && (
        <HistoryPanel
          history={history}
          onClose={() => setShowHistory(false)}
          onClear={clearHistory}
        />
      )}
    </div>
  );
}