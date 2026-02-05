import JSON5 from "json5";

export function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1).trim();
  }
  if (first !== -1) {
    return text.slice(first).trim();
  }
  return text.trim();
}

function repairTruncatedJson(input: string) {
  let normalized = input.trim();
  if (!normalized) return normalized;

  const stack: string[] = [];
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "{") {
      stack.push("}");
      continue;
    }
    if (char === "[") {
      stack.push("]");
      continue;
    }
    if (char === "}" || char === "]") {
      if (stack.length && stack[stack.length - 1] === char) {
        stack.pop();
      }
    }
  }

  if (inString && quote) {
    normalized += quote;
  }
  normalized = normalized.replace(/,\s*$/, "");
  while (stack.length) {
    normalized += stack.pop();
  }

  return normalized;
}

export function parseJson5Loose<T>(text: string): T {
  const extracted = extractJson(text);
  try {
    return JSON5.parse(extracted) as T;
  } catch (primaryError) {
    const repaired = repairTruncatedJson(extracted);
    if (repaired !== extracted) {
      return JSON5.parse(repaired) as T;
    }
    throw primaryError;
  }
}
