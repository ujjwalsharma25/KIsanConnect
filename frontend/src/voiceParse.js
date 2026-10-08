// Parses a spoken sentence like:
//   "Pyaaz pachaas quintal athaara sau rupaye quintal Meerut se grade A organic"
//   "Onion fifty quintal eighteen hundred rupees per quintal from Meerut grade A"
// into structured listing fields. Best-effort: only fills a field when it's
// reasonably confident, so it never silently puts a wrong number in the wrong box.

const HI_NUM = {
  "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "छे": 6,
  "सात": 7, "आठ": 8, "नौ": 9, "दस": 10, "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14,
  "पंद्रह": 15, "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19, "बीस": 20,
  "तीस": 30, "चालीस": 40, "पचास": 50, "साठ": 60, "सत्तर": 70, "अस्सी": 80, "नब्बे": 90,
  "सौ": 100, "हज़ार": 1000, "हजार": 1000,
};

function hindiWordsToNumber(text) {
  // handles simple compounds like "अठारह सौ" (1800), "पचास" (50), "दो हज़ार" (2000)
  const words = text.trim().split(/\s+/);
  let total = 0, current = 0, matched = false;
  for (const w of words) {
    if (HI_NUM[w] !== undefined) {
      matched = true;
      const v = HI_NUM[w];
      if (v === 100 || v === 1000) {
        current = (current || 1) * v;
        total += current;
        current = 0;
      } else {
        current += v;
      }
    }
  }
  total += current;
  return matched ? total : null;
}

// replace any run of Hindi number-words in the text with digits, so later regexes
// (which look for \d+) catch them too
function normalizeHindiNumbers(text) {
  const tokens = text.split(/\s+/);
  let out = [];
  let buf = [];
  const flush = () => {
    if (buf.length) {
      const n = hindiWordsToNumber(buf.join(" "));
      if (n !== null) out.push(String(n));
      else out.push(...buf);
      buf = [];
    }
  };
  for (const tok of tokens) {
    if (HI_NUM[tok] !== undefined) buf.push(tok);
    else { flush(); out.push(tok); }
  }
  flush();
  return out.join(" ");
}

const CROP_WORDS = {
  pyaaz: "Onion", pyaz: "Onion", प्याज: "Onion", onion: "Onion",
  aloo: "Potato", आलू: "Potato", potato: "Potato",
  tamatar: "Tomato", टमाटर: "Tomato", tomato: "Tomato",
  gehu: "Wheat", गेहूं: "Wheat", गेहूँ: "Wheat", wheat: "Wheat",
  dhaan: "Paddy", धान: "Paddy", paddy: "Paddy", rice: "Paddy",
  baingan: "Brinjal", बैंगन: "Brinjal", brinjal: "Brinjal",
  kela: "Banana", केला: "Banana", banana: "Banana",
  patta: "Cabbage", पत्ता: "Cabbage", cabbage: "Cabbage",
};

export function parseVoiceListing(raw) {
  const text = normalizeHindiNumbers(raw.toLowerCase());
  const result = { crop: "", qty: "", rate: "", location: "", route: "", grade: "", organic: false };

  // crop: match a known crop word anywhere in the sentence
  for (const [word, canonical] of Object.entries(CROP_WORDS)) {
    if (text.includes(word)) { result.crop = canonical; break; }
  }

  const numbers = [...text.matchAll(/\d+(\.\d+)?/g)].map((m) => ({ val: m[0], idx: m.index }));

  // rate: a number near "rupaye/rupee/₹/rate/bhav/price" (prefer this explicit match)
  const rateMatch = text.match(/(\d+(\.\d+)?)\s*(rupaye|rupay|rupee|rs|₹|rate|bhav|भाव|रुपए|रुपये)/);
  if (rateMatch) result.rate = rateMatch[1];

  // quantity: a number right before "quintal/क्विंटल/quintals"
  const qtyMatch = text.match(/(\d+(\.\d+)?)\s*(quintal|quintals|क्विंटल|क्वीटल|kuintal)/);
  if (qtyMatch) result.qty = qtyMatch[1];

  // fallback: if we found exactly 2 numbers and couldn't tag them, assume
  // smaller = quantity, larger = rate (quantities are usually under a few hundred,
  // mandi rates are usually in the thousands per quintal)
  if (!result.qty && !result.rate && numbers.length >= 2) {
    const sorted = [...numbers].sort((a, b) => +a.val - +b.val);
    result.qty = sorted[0].val;
    result.rate = sorted[sorted.length - 1].val;
  } else if (!result.qty && numbers.length >= 1 && result.rate) {
    const other = numbers.find((n) => n.val !== result.rate);
    if (other) result.qty = other.val;
  } else if (!result.rate && numbers.length >= 1 && result.qty) {
    const other = numbers.find((n) => n.val !== result.qty);
    if (other) result.rate = other.val;
  }

  // location: text after "se"/"से"/"from"/"at" — take the next 1-3 words, strip trailing keywords
  const locMatch = text.match(/(?:से|from|at)\s+([a-zа-я\u0900-\u097F]+(?:\s+[a-zа-я\u0900-\u097F]+){0,2})/i);
  if (locMatch) {
    result.location = locMatch[1]
      .replace(/\b(grade|organic|जैविक|ग्रेड)\b.*$/i, "")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // grade: "grade a" / "ग्रेड ए" / standalone " a " near the end
  const gradeMatch = text.match(/(?:grade|ग्रेड)\s*([abc])/i) || text.match(/(?:grade|ग्रेड)\s*(ए|बी|सी)/);
  if (gradeMatch) {
    const g = gradeMatch[1];
    result.grade = { "ए": "A", "बी": "B", "सी": "C" }[g] || g.toUpperCase();
  }

  // organic
  if (/organic|जैविक/.test(text)) result.organic = true;

  // route: "every sunday" / "हर रविवार" style phrase, kept as-is (best-effort passthrough)
  const routeMatch = raw.match(/(हर\s+\S+.*|every\s+\S+.*)/i);
  if (routeMatch) result.route = routeMatch[1].trim();

  return result;
}
