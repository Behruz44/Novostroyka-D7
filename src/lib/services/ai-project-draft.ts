export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface ProjectDraft {
  name: string;
  address: string;
  totalBudgetMinor: string;
  stages: { name: string; floor: number; weightBp: number }[];
  budgetLines: { category: string; plannedMinor: string }[];
}

export interface AiDraftResult {
  reply: string;
  draft: ProjectDraft | null;
}

const SYSTEM_PROMPT = `Ты помогаешь владельцу описать новый строительный объект.
Задавай уточняющие вопросы (тип объекта, количество этажей, адрес, примерный масштаб бюджета), пока не наберётся достаточно информации.
Когда информации достаточно — верни СТРУКТУРИРОВАННЫЙ JSON в формате:
{
  "name": "Название объекта",
  "address": "Адрес или пустая строка",
  "totalBudgetMinor": "Сумма в формате 1250000.00",
  "stages": [
    { "name": "Название этапа", "floor": 0, "weightBp": 5000 }
  ],
  "budgetLines": [
    { "category": "Категория", "plannedMinor": "500000.00" }
  ]
}

Важно по JSON:
- weightBp — это вес этапа в базисных пунктах (bp). Сумма всех weightBp должна быть ровно 10000 (=100%).
- floor: 0 = общие/подземные работы, 1+ = этажи.
- totalBudgetMinor — строка в формате "рубли.копейки" (например "5000000.00").
- plannedMinor — то же формат, сумма всех plannedMinor не обязана равняться totalBudgetMinor.
- budgetLines: 3-7 типичных категорий (Материалы, Зарплата, Техника, Проектирование, Прочее и т.д.)

До того как информации достаточно — только обычные уточняющие вопросы текстом, без JSON.
Когда готов дать структуру — верни ТОЛЬКО блок \`\`\`json ... \`\`\` с валидным JSON внутри, без другого текста.`;

const MAX_TOKENS = 1024;
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";
const TIMEOUT_MS = 30_000;

function extractJsonBlock(text: string): ProjectDraft | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (
      typeof parsed.name === "string" &&
      typeof parsed.totalBudgetMinor === "string" &&
      Array.isArray(parsed.stages) &&
      parsed.stages.every(
        (s: unknown) =>
          typeof s === "object" &&
          s !== null &&
          typeof (s as { name: unknown }).name === "string" &&
          typeof (s as { floor: unknown }).floor === "number" &&
          typeof (s as { weightBp: unknown }).weightBp === "number",
      ) &&
      Array.isArray(parsed.budgetLines) &&
      parsed.budgetLines.every(
        (b: unknown) =>
          typeof b === "object" &&
          b !== null &&
          typeof (b as { category: unknown }).category === "string" &&
          typeof (b as { plannedMinor: unknown }).plannedMinor === "string",
      )
    ) {
      return parsed as ProjectDraft;
    }
  } catch {
    // invalid JSON
  }
  return null;
}

export async function generateProjectDraft(
  messages: ChatMessageInput[],
): Promise<AiDraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("ANTHROPIC_API_KEY не настроен на сервере");
  }

  // Convert messages to Anthropic format
  const anthropicMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[ai-project-draft] Anthropic API timeout");
      throw new Error("Истекло время ожидания ответа ИИ. Попробуйте еще раз.");
    }
    console.error("[ai-project-draft] Anthropic API unreachable:", err);
    throw new Error("ИИ недоступен. Попробуйте позже.");
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(
      `[ai-project-draft] Anthropic API error ${response.status}: ${errBody.slice(0, 200)}`,
    );
    if (response.status === 429) {
      throw new Error("Превышен лимит запросов к ИИ. Попробуйте через минуту.");
    }
    if (response.status >= 500) {
      throw new Error("Сервис ИИ временно недоступен. Попробуйте позже.");
    }
    throw new Error(`Ошибка ИИ (${response.status})`);
  }

  const data = await response.json();
  const replyText: string =
    data.content?.map((c: { text?: string }) => c.text).join("") ?? "";

  const draft = extractJsonBlock(replyText);
  const cleanReply = draft
    ? "Готово! Я подготовил структуру объекта. Проверьте форму ниже."
    : replyText;

  return { reply: cleanReply, draft };
}
