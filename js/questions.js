const JSON_PATH = "./questions.json";
const MIN_WEIGHT = -3;
const MAX_WEIGHT =  3;

export async function loadQuestions() {
  const res = await fetch(JSON_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${JSON_PATH} (${res.status})`);
  const data = await res.json();
  return normalizeQuestions(data);
}

function normalizeQuestions(json) {
  if (!json || !Array.isArray(json.categories)) {
    throw new Error("questions.json must have a `categories` array.");
  }

  const flat = [];
  const counters = new Map();

  for (const cat of json.categories) {
    const name = String(cat?.name ?? "").trim();
    if (!name) throw new Error("Each category needs a non-empty `name`.");
    if (!Array.isArray(cat.questions)) {
      throw new Error(`Category "${name}" must have a 'questions' array.`);
    }

    for (const q of cat.questions) {
      const text = String(q?.text ?? "").trim();
      const nsfw = Boolean(q?.nsfw);
      let weight = Number.isFinite(q?.weight) ? Math.trunc(q.weight) : 0;

      if (weight < MIN_WEIGHT) weight = MIN_WEIGHT;
      if (weight > MAX_WEIGHT) weight = MAX_WEIGHT;

      if (!text) {
        console.warn(`[questions] Skipped empty text in category "${name}".`);
        continue;
      }

      const seq = (counters.get(name) || 0) + 1;
      counters.set(name, seq);
      const code = name.split(/\W+/).map(s => s[0]?.toUpperCase() || "X").join("").slice(0, 3);
      const id = `${code}-${String(seq).padStart(3, "0")}`;

      flat.push({ id, category: name, text, nsfw, weight });
    }
  }

  if (!flat.length) {
    throw new Error("No questions were found after parsing questions.json.");
  }

  return flat;
}
