import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type Category = "Transport" | "Home" | "Food" | "Shopping";
type Period = "7d" | "30d" | "all";

type Preset = {
  id: string;
  name: string;
  category: Category;
  unit: string;
  factor: number;
  helper: string;
};

type Entry = {
  id: string;
  presetId: string;
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  factor: number;
  carbon: number;
  note: string;
  date: string;
};

const STORAGE_KEY = "carbon-compass-v1";

const presets: Preset[] = [
  {
    id: "car-commute",
    name: "Car commute",
    category: "Transport",
    unit: "km",
    factor: 0.192,
    helper: "Average passenger car per kilometer",
  },
  {
    id: "bus-ride",
    name: "Bus ride",
    category: "Transport",
    unit: "km",
    factor: 0.089,
    helper: "Per kilometer on a city bus",
  },
  {
    id: "train-ride",
    name: "Train ride",
    category: "Transport",
    unit: "km",
    factor: 0.041,
    helper: "Per kilometer on a rail trip",
  },
  {
    id: "electricity",
    name: "Home electricity",
    category: "Home",
    unit: "kWh",
    factor: 0.42,
    helper: "Average grid electricity per kilowatt hour",
  },
  {
    id: "heating",
    name: "Heating run",
    category: "Home",
    unit: "hour",
    factor: 1.1,
    helper: "A short heating session per hour",
  },
  {
    id: "beef-meal",
    name: "Beef meal",
    category: "Food",
    unit: "meal",
    factor: 7.2,
    helper: "One beef-heavy meal",
  },
  {
    id: "plant-meal",
    name: "Plant-based meal",
    category: "Food",
    unit: "meal",
    factor: 1.1,
    helper: "A lower-carbon meal choice",
  },
  {
    id: "delivery",
    name: "Parcel delivery",
    category: "Shopping",
    unit: "package",
    factor: 1.3,
    helper: "Typical last-mile delivery per package",
  },
  {
    id: "clothing",
    name: "Clothing purchase",
    category: "Shopping",
    unit: "item",
    factor: 8,
    helper: "An average apparel purchase",
  },
];

const categoryMeta: Record<
  Category,
  { label: string; tint: string; glow: string; bar: string }
> = {
  Transport: {
    label: "Transport",
    tint: "bg-sky-300",
    glow: "from-sky-500/35 to-cyan-400/15",
    bar: "from-sky-400 to-cyan-300",
  },
  Home: {
    label: "Home",
    tint: "bg-emerald-300",
    glow: "from-emerald-500/35 to-lime-400/15",
    bar: "from-emerald-400 to-lime-300",
  },
  Food: {
    label: "Food",
    tint: "bg-amber-300",
    glow: "from-amber-500/35 to-orange-400/15",
    bar: "from-amber-300 to-orange-300",
  },
  Shopping: {
    label: "Shopping",
    tint: "bg-fuchsia-300",
    glow: "from-fuchsia-500/35 to-pink-400/15",
    bar: "from-fuchsia-400 to-pink-300",
  },
};

const defaultEntries: Entry[] = [
  {
    id: "demo-1",
    presetId: "car-commute",
    name: "Car commute",
    category: "Transport",
    quantity: 18,
    unit: "km",
    factor: 0.192,
    carbon: 3.46,
    note: "Office run",
    date: offsetDate(-1),
  },
  {
    id: "demo-2",
    presetId: "plant-meal",
    name: "Plant-based meal",
    category: "Food",
    quantity: 2,
    unit: "meal",
    factor: 1.1,
    carbon: 2.2,
    note: "Lunch and dinner",
    date: offsetDate(-2),
  },
  {
    id: "demo-3",
    presetId: "electricity",
    name: "Home electricity",
    category: "Home",
    quantity: 14,
    unit: "kWh",
    factor: 0.42,
    carbon: 5.88,
    note: "Evening heating and lights",
    date: offsetDate(-3),
  },
  {
    id: "demo-4",
    presetId: "train-ride",
    name: "Train ride",
    category: "Transport",
    quantity: 42,
    unit: "km",
    factor: 0.041,
    carbon: 1.72,
    note: "Weekend trip",
    date: offsetDate(-6),
  },
  {
    id: "demo-5",
    presetId: "delivery",
    name: "Parcel delivery",
    category: "Shopping",
    quantity: 1,
    unit: "package",
    factor: 1.3,
    carbon: 1.3,
    note: "Online order",
    date: offsetDate(-8),
  },
];

function App() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries);
  const [period, setPeriod] = useState<Period>(loadPeriod);
  const [target, setTarget] = useState<number>(loadTarget);
  const [presetId, setPresetId] = useState(presets[0].id);
  const [quantity, setQuantity] = useState("12");
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("Ready to log a new activity.");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, period, target }));
  }, [entries, period, target]);

  const currentPreset = useMemo(
    () => presets.find((preset) => preset.id === presetId) ?? presets[0],
    [presetId],
  );

  const visibleEntries = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (period === "7d") {
      cutoff.setDate(now.getDate() - 6);
    } else if (period === "30d") {
      cutoff.setDate(now.getDate() - 29);
    } else {
      return [...entries].sort((a, b) => b.date.localeCompare(a.date));
    }

    return [...entries]
      .filter((entry) => new Date(`${entry.date}T00:00:00`) >= startOfDay(cutoff))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, period]);

  const summary = useMemo(() => {
    const totalsByCategory = Object.fromEntries(
      (Object.keys(categoryMeta) as Category[]).map((category) => [category, 0]),
    ) as Record<Category, number>;

    const daily = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      const key = toDateInput(day);
      return { key, label: dayLabel(day), total: 0 };
    });

    visibleEntries.forEach((entry) => {
      totalsByCategory[entry.category] += entry.carbon;
    });

    daily.forEach((day) => {
      day.total = visibleEntries
        .filter((entry) => entry.date === day.key)
        .reduce((sum, entry) => sum + entry.carbon, 0);
    });

    const total = round(visibleEntries.reduce((sum, entry) => sum + entry.carbon, 0));
    const average = visibleEntries.length ? round(total / averageWindowDays(period, visibleEntries)) : 0;
    const biggestCategory = (Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1])[0] ?? [
      "Transport",
      0,
    ]) as [Category, number];
    const totalAll = round(entries.reduce((sum, entry) => sum + entry.carbon, 0));
    const progress = target > 0 ? Math.min(total / target, 1) : 0;
    const remaining = Math.max(target - total, 0);
    return {
      daily,
      total,
      average,
      biggestCategory,
      totalAll,
      progress,
      remaining,
      totalsByCategory,
    };
  }, [entries, period, target, visibleEntries]);

  const projected = useMemo(() => {
    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      return 0;
    }
    return round(quantityValue * currentPreset.factor);
  }, [currentPreset.factor, quantity]);

  const insight = useMemo(() => {
    if (summary.biggestCategory[1] <= 0) {
      return "Log a few entries and the app will surface the biggest carbon source.";
    }

    const { biggestCategory } = summary;
    if (biggestCategory[0] === "Transport") {
      return "Swap one short car trip for rail or a shared ride and your weekly total drops fast.";
    }
    if (biggestCategory[0] === "Home") {
      return "Set a shorter heating window or trim standby loads to cut your home footprint.";
    }
    if (biggestCategory[0] === "Food") {
      return "A couple of plant-based meals this week can make the biggest dent in your total.";
    }
    return "Hold purchases for a day before checking out and your shopping footprint usually shrinks.";
  }, [summary.biggestCategory]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setStatus("Enter a quantity greater than zero.");
      return;
    }

    const carbon = round(quantityValue * currentPreset.factor);
    const entry: Entry = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      presetId: currentPreset.id,
      name: currentPreset.name,
      category: currentPreset.category,
      quantity: quantityValue,
      unit: currentPreset.unit,
      factor: currentPreset.factor,
      carbon,
      note: note.trim(),
      date,
    };

    setEntries((current) => [entry, ...current]);
    setNote("");
    setQuantity("12");
    setStatus(`Saved ${currentPreset.name} for ${formatKg(carbon)}.`);
  }

  function resetDemo() {
    setEntries(defaultEntries);
    setStatus("Demo data restored.");
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#07130d] text-white selection:bg-emerald-300/30 selection:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-drift absolute -left-32 top-10 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="animate-drift-slow absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="animate-pulse-slow absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-lime-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.2),transparent_40%),linear-gradient(180deg,rgba(5,15,10,0.4),rgba(7,19,13,0.95))]" />
      </div>

      <main className="relative mx-auto max-w-7xl px-6 pb-16 pt-6 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Carbon Compass</p>
            <p className="mt-1 text-sm text-white/60">Personal footprint tracking with local-only storage</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur">
            {status}
          </div>
        </header>

        <section className="grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.35em] text-emerald-200/70">
              Track what matters
            </p>
            <h1 className="mt-5 text-balance text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              See your carbon footprint before it becomes a habit.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
              Log transport, home energy, food, and shopping in one place. Carbon Compass turns each
              activity into a clear footprint, shows the biggest source, and keeps your monthly target
              in view.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  const form = document.getElementById("activity-form");
                  form?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 transition duration-300 hover:-translate-y-0.5 hover:bg-emerald-200"
              >
                Log an activity
              </button>
              <button
                type="button"
                onClick={resetDemo}
                className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10"
              >
                Restore demo data
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-emerald-400/10 via-white/5 to-cyan-400/10 blur-2xl" />
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/55">Current period</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["7d", "30d", "all"] as Period[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPeriod(option)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition duration-300 ${
                          period === option
                            ? "bg-white text-slate-950"
                            : "bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {option === "7d" ? "Last 7 days" : option === "30d" ? "Last 30 days" : "All time"}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="grid gap-2 text-right text-sm text-white/55">
                  Monthly target
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={target}
                    onChange={(event) => setTarget(Number(event.target.value))}
                    className="w-32 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right text-white outline-none transition focus:border-emerald-300/60"
                  />
                </label>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="flex items-center gap-6">
                  <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
                    <circle
                      cx="60"
                      cy="60"
                      r="46"
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="14"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="46"
                      fill="none"
                      stroke="url(#meterGradient)"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 46}`}
                      strokeDashoffset={`${2 * Math.PI * 46 * (1 - summary.progress)}`}
                      className="transition-[stroke-dashoffset] duration-700 ease-out"
                    />
                    <defs>
                      <linearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                  </svg>

                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-white/45">This period</p>
                    <p className="mt-2 text-5xl font-semibold tracking-tight text-white">
                      {formatKg(summary.total)}
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                      {summary.remaining > 0
                        ? `${formatKg(summary.remaining)} left before the target`
                        : "Target reached. Keep the streak going."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 text-sm text-white/70">
                  <Metric label="Daily average" value={`${formatKg(summary.average)}/day`} />
                  <Metric
                    label="Largest source"
                    value={`${summary.biggestCategory[0]} ${formatKg(summary.biggestCategory[1])}`}
                  />
                  <Metric label="All time tracked" value={formatKg(summary.totalAll)} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div
            id="activity-form"
            className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Log activity</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Record what changed today</h2>
              </div>
              <p className="max-w-sm text-right text-sm leading-6 text-white/55">
                Every entry updates the meter, category split, and weekly trend immediately.
              </p>
            </div>

            <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-white/65">
                  Activity
                  <select
                    value={presetId}
                    onChange={(event) => setPresetId(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-emerald-300/60"
                  >
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id} className="bg-slate-950">
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-white/65">
                  Date
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-emerald-300/60"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                <label className="grid gap-2 text-sm text-white/65">
                  Quantity
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition focus-within:border-emerald-300/60">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      className="w-full bg-transparent text-white outline-none placeholder:text-white/30"
                      placeholder="12"
                    />
                    <span className="text-white/45">{currentPreset.unit}</span>
                  </div>
                </label>

                <label className="grid gap-2 text-sm text-white/65">
                  Notes
                  <input
                    type="text"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-emerald-300/60"
                    placeholder="Optional context"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/20 px-4 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/45">Projected footprint</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{formatKg(projected)}</p>
                </div>
                <div className="text-sm text-white/60">
                  <p>{currentPreset.helper}</p>
                  <p className="mt-1 text-white/45">
                    {currentPreset.factor.toFixed(3)} kg CO2e per {currentPreset.unit}
                  </p>
                </div>
                <button
                  type="submit"
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition duration-300 hover:-translate-y-0.5 hover:bg-emerald-100"
                >
                  Save activity
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Recent log</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">What is driving the total</h2>
              </div>
              <button
                type="button"
                onClick={() => setEntries([])}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
              >
                Clear all
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {visibleEntries.length > 0 ? (
                visibleEntries.map((entry) => {
                  const meta = categoryMeta[entry.category];
                  return (
                    <article
                      key={entry.id}
                      className={`group rounded-3xl border border-white/10 bg-gradient-to-r ${meta.glow} p-[1px] transition duration-300 hover:-translate-y-0.5`}
                    >
                      <div className="rounded-3xl bg-slate-950/80 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <div className={`h-2.5 w-2.5 rounded-full ${meta.tint}`} />
                              <p className="text-base font-medium text-white">{entry.name}</p>
                              <span className="text-xs uppercase tracking-[0.3em] text-white/35">
                                {meta.label}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-white/55">
                              {entry.quantity} {entry.unit} on {formatDate(entry.date)}
                              {entry.note ? ` · ${entry.note}` : ""}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-lg font-semibold text-white">{formatKg(entry.carbon)}</p>
                            <p className="text-xs uppercase tracking-[0.3em] text-white/35">kg CO2e</p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm text-white/55">
                          <span>{entry.factor.toFixed(3)} kg CO2e per {entry.unit}</span>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.id)}
                            className="text-white/55 transition hover:text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-center text-white/55">
                  No entries in this period yet. Add an activity to fill the timeline.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Category split</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">See which part of life is loudest</h2>

            <div className="mt-6 space-y-4">
              {(Object.keys(categoryMeta) as Category[]).map((category) => {
                const value = summary.totalsByCategory[category];
                const percent = summary.total > 0 ? Math.round((value / summary.total) * 100) : 0;
                const meta = categoryMeta[category];
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between text-sm text-white/65">
                      <span>{meta.label}</span>
                      <span>
                        {formatKg(value)} ({percent}%)
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${meta.bar} transition-all duration-700`}
                        style={{ width: `${Math.max(percent, value > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-6 text-sm leading-7 text-white/60">{insight}</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Weekly pulse</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">A simple rhythm for the week</h2>
              </div>
              <p className="text-right text-sm text-white/55">
                {period === "7d"
                  ? "Showing the last 7 days"
                  : period === "30d"
                    ? "Showing the last 30 days"
                    : "Showing all data"}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-3">
              {summary.daily.map((day) => {
                const max = Math.max(...summary.daily.map((item) => item.total), 1);
                const height = Math.max((day.total / max) * 100, day.total > 0 ? 10 : 3);
                return (
                  <div key={day.key} className="flex flex-col items-center gap-3">
                    <div className="flex h-48 w-full items-end rounded-3xl border border-white/10 bg-black/15 p-2">
                      <div
                        className="w-full rounded-2xl bg-gradient-to-t from-emerald-400 via-lime-300 to-cyan-300 transition-all duration-700"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <div className="text-center text-xs text-white/50">
                      <p>{day.label}</p>
                      <p className="mt-1 text-white/70">{formatKg(day.total)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/15 p-4 text-sm leading-7 text-white/65">
              Focus on the highest bar, then look for one switch that is easy to keep repeating.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 transition duration-300 hover:border-white/20 hover:bg-black/25">
      <p className="text-xs uppercase tracking-[0.3em] text-white/40">{label}</p>
      <p className="mt-2 text-lg font-medium text-white">{value}</p>
    </div>
  );
}

function loadEntries() {
  if (typeof window === "undefined") {
    return defaultEntries;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultEntries;
  }

  try {
    const parsed = JSON.parse(raw) as { entries?: Entry[] };
    return Array.isArray(parsed.entries) ? parsed.entries : defaultEntries;
  } catch {
    return defaultEntries;
  }
}

function loadPeriod(): Period {
  if (typeof window === "undefined") {
    return "30d";
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return "30d";
  }

  try {
    const parsed = JSON.parse(raw) as { period?: Period };
    return parsed.period ?? "30d";
  } catch {
    return "30d";
  }
}

function loadTarget() {
  if (typeof window === "undefined") {
    return 250;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return 250;
  }

  try {
    const parsed = JSON.parse(raw) as { target?: number };
    return parsed.target && parsed.target > 0 ? parsed.target : 250;
  } catch {
    return 250;
  }
}

function todayInput() {
  return toDateInput(new Date());
}

function offsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function formatKg(value: number) {
  return `${round(value).toFixed(value < 10 ? 2 : 1)} kg`;
}

function averageWindowDays(period: Period, entries: Entry[]) {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  if (entries.length === 0) return 1;

  const oldest = entries.reduce((min, entry) => {
    const current = new Date(`${entry.date}T00:00:00`).getTime();
    return Math.min(min, current);
  }, Date.now());

  const span = Math.ceil((Date.now() - oldest) / 86_400_000) + 1;
  return Math.max(1, span);
}

export default App;
